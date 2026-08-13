"use strict";

import { CONFIG } from "../config/config.js";
import { getSession, clearSession } from "./session.js";

// In-Memory API Cache Map
const apiCache = new Map();

// Caching Rules for GET / Read operations (teacher-critical paths first)
const CACHE_RULES = [
    { prefix: "exam.list", ttl: 5 * 60 * 1000 },
    { prefix: "auth.profile", ttl: 10 * 60 * 1000 },
    { prefix: "settings.load", ttl: 2 * 60 * 1000 },
    { prefix: "subject.tag.getSections", ttl: 10 * 60 * 1000 },
    { prefix: "subject.tag.getDropdowns", ttl: 10 * 60 * 1000 },
    { prefix: "subject.tag.loadStudents", ttl: 60 * 1000 },
    { prefix: "exam.config.load", ttl: 5 * 60 * 1000 },
    { prefix: "exam.marks.load", ttl: 45 * 1000 },
    { prefix: "student.master.load", ttl: 2 * 60 * 1000 }
];

/** Persist these across SPA navigations within the tab (survives module reloads). */
const SESSION_PERSIST_PREFIXES = [
    "exam.list",
    "auth.profile",
    "subject.tag.getSections",
    "subject.tag.getDropdowns"
];

const SESSION_CACHE_PREFIX = "uhs_api_cache_v1:";

// Mutation actions that invalidate cache
const INVALIDATION_RULES = {
    "exam.create": ["exam.list"],
    "exam.delete": ["exam.list"],
    "exam.status.toggle": ["exam.list"],
    "exam.config.save": ["exam.config.load"],
    "settings.save": ["settings.load"],
    "subject.tag.save": ["subject.tag.getSections", "subject.tag.loadStudents", "subject.tag.getDropdowns"],
    "exam.marks.save": ["exam.marks.load", "exam.results.generate"],
    "student.master.sync": ["student.master.load"]
};

function shouldPersistAction(actionPath) {
    return SESSION_PERSIST_PREFIXES.some((prefix) => actionPath.startsWith(prefix));
}

function readSessionCache(cacheKey) {
    try {
        const raw = sessionStorage.getItem(SESSION_CACHE_PREFIX + cacheKey);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (!entry || !entry.expiry || Date.now() >= entry.expiry) {
            sessionStorage.removeItem(SESSION_CACHE_PREFIX + cacheKey);
            return null;
        }
        return entry;
    } catch (_) {
        return null;
    }
}

function writeSessionCache(cacheKey, entry, actionPath) {
    if (!shouldPersistAction(actionPath)) return;
    try {
        sessionStorage.setItem(SESSION_CACHE_PREFIX + cacheKey, JSON.stringify(entry));
    } catch (_) { /* quota */ }
}

function clearSessionCacheByPrefix(prefixFilter) {
    try {
        const keys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k && k.startsWith(SESSION_CACHE_PREFIX)) keys.push(k);
        }
        keys.forEach((k) => {
            if (!prefixFilter || k.includes(prefixFilter)) {
                sessionStorage.removeItem(k);
            }
        });
    } catch (_) { /* ignore */ }
}

/**
 * Clears cached API responses matching prefix or all cache if omitted.
 */
export function clearApiCache(prefixFilter = null) {
    if (!prefixFilter) {
        apiCache.clear();
        clearSessionCacheByPrefix(null);
        return;
    }
    for (const key of apiCache.keys()) {
        if (key.includes(prefixFilter)) {
            apiCache.delete(key);
        }
    }
    clearSessionCacheByPrefix(prefixFilter);
}

/**
 * Parse API response text as JSON with actionable errors when GAS returns HTML.
 */
function parseApiJson(rawText, httpStatus) {
    const text = String(rawText || "").trim();
    if (!text) {
        throw new Error(`School server returned an empty response (HTTP ${httpStatus}). Please try again.`);
    }

    try {
        return JSON.parse(text);
    } catch (parseErr) {
        const preview = text.slice(0, 160).replace(/\s+/g, " ");
        const looksHtml = /^</.test(text) || /<!DOCTYPE|<html|Error:|Exceeded maximum|Page not found/i.test(text);

        if (looksHtml) {
            throw new Error(
                "School server returned an invalid response (not JSON). " +
                "Please refresh and try again. If this continues, sign out and sign back in. " +
                `Details: ${preview}`
            );
        }

        throw new Error(`Invalid response from school server: ${preview}`);
    }
}

function isGoogleAppsScriptHtmlError(text) {
    const t = String(text || "");
    return (
        t.includes("<!DOCTYPE html>") ||
        t.includes("Page not found") ||
        t.includes("Moved Temporarily") ||
        t.includes("Web word processing, spreadsheets and presentations")
    );
}

/**
 * Apps Script web apps 302 to googleusercontent.com. Some browsers re-POST that
 * URL and get HTML "Page not found". Prefer GET; for POST, fall back to GET+payload.
 */
async function fetchAppsScript(urlString, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const body = options.body != null ? String(options.body) : "";

    const doFetch = async (url, opts) => {
        const response = await fetch(url, {
            ...opts,
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
                ...(opts.headers ?? {})
            }
        });
        const text = await response.text();
        return { response, text };
    };

    // Primary attempt
    let result = await doFetch(urlString, options);

    // POST redirect quirk → retry as GET with payload= (controllers already support it)
    if (
        method === "POST" &&
        body &&
        isGoogleAppsScriptHtmlError(result.text) &&
        body.length <= 6000
    ) {
        const retryUrl = new URL(urlString);
        retryUrl.searchParams.set("payload", body);
        result = await doFetch(retryUrl.toString().replace(/\+/g, "%20"), {
            method: "GET"
        });
    }

    return result;
}
/**
 * Sends a request to the Google Apps Script REST API with smart caching.
 * @param {string} path API path.
 * @param {RequestInit & { bypassCache?: boolean }} options Fetch options.
 * @returns {Promise<unknown>}
 */
export async function apiRequest(path, options = {}) {
    try {
        const baseUrl = CONFIG.API_BASE_URL ?? "";
        const url = new URL(baseUrl);
        
        let actionPath = path;
        if (path.includes("?")) {
            const parts = path.split("?");
            actionPath = parts[0];
            const searchParams = new URLSearchParams(parts[1]);
            for (const [key, val] of searchParams.entries()) {
                url.searchParams.set(key, val);
            }
        }
        
        url.searchParams.set("action", actionPath);
        const session = getSession();

        if (session?.user?.email) {
            url.searchParams.set("email", session.user.email);
        }

        if (session?.token) {
            url.searchParams.set("token", session.token);
        }

        const isMutation = (options.method && options.method.toUpperCase() !== "GET") || !!options.body;

        // Handle Cache Invalidation on Mutation
        if (isMutation) {
            const prefixesToInvalidate = INVALIDATION_RULES[actionPath] || [];
            prefixesToInvalidate.forEach(prefix => clearApiCache(prefix));
        }

        // Check if path is eligible for GET caching
        const cacheRule = !isMutation && !options.bypassCache && CACHE_RULES.find(rule => actionPath.startsWith(rule.prefix));
        const cacheKey = cacheRule ? url.toString() : null;

        if (cacheKey && apiCache.has(cacheKey)) {
            const entry = apiCache.get(cacheKey);
            if (Date.now() < entry.expiry) {
                return JSON.parse(JSON.stringify(entry.payload));
            }
            apiCache.delete(cacheKey);
        }

        if (cacheKey) {
            const sessionEntry = readSessionCache(cacheKey);
            if (sessionEntry) {
                apiCache.set(cacheKey, sessionEntry);
                return JSON.parse(JSON.stringify(sessionEntry.payload));
            }
        }

        const finalUrl = url.toString().replace(/\+/g, "%20");
        // Auto-stringify body objects for POST requests
        const fetchOptions = { ...options };
        if (fetchOptions.body && typeof fetchOptions.body === "object") {
            fetchOptions.body = JSON.stringify(fetchOptions.body);
        }
        if (fetchOptions.body && !fetchOptions.method) {
            fetchOptions.method = "POST";
        }
        let response;
        let rawText;
        try {
            const fetched = await fetchAppsScript(finalUrl, fetchOptions);
            response = fetched.response;
            rawText = fetched.text;
        } catch (netErr) {
            console.error("API Fetch Error:", netErr);
            if (!session || !session.user?.email) {
                clearSession();
                window.location.hash = "#/login";
                throw new Error("Session expired or not signed in. Please sign in to continue.");
            }
            throw new Error("Unable to connect to school server. Please check your internet connection.");
        }

        const payload = parseApiJson(rawText, response.status);

        if (!response.ok) {
            throw new Error(payload.error ?? payload.message ?? `API request failed with status ${response.status}`);
        }

        if (payload?.success === false) {
            const code = payload.code;
            if (code === "UNAUTHORIZED" || code === "USER_NOT_REGISTERED" || code === "TOKEN_INVALID" || code === "TOKEN_MISSING" || code === "EMAIL_MISMATCH" || code === "AUTH_REQUIRED") {
                clearSession();
                window.location.hash = "#/login";
                throw new Error(payload.message || "Authentication required. Please sign in again.");
            }
            throw new Error(payload.error ?? payload.message ?? "API request failed.");
        }

        // Save to memory (+ sessionStorage for stable teacher dropdowns)
        if (cacheKey && cacheRule && payload?.success !== false) {
            const entry = {
                expiry: Date.now() + cacheRule.ttl,
                payload: JSON.parse(JSON.stringify(payload))
            };
            apiCache.set(cacheKey, entry);
            writeSessionCache(cacheKey, entry, actionPath);
        }

        return payload;
    } catch (error) {
        console.error("apiRequest Error:", error);
        throw error;
    }
}
