"use strict";

import { CONFIG } from "../config/config.js";
import { getSession, clearSession } from "./session.js";

// In-Memory API Cache Map
const apiCache = new Map();

// Caching Rules for GET / Read operations
const CACHE_RULES = [
    { prefix: "exam.list", ttl: 5 * 60 * 1000 },
    { prefix: "auth.profile", ttl: 10 * 60 * 1000 },
    { prefix: "settings.load", ttl: 2 * 60 * 1000 },
    { prefix: "subject.tag.getSections", ttl: 10 * 60 * 1000 },
    { prefix: "subject.tag.getDropdowns", ttl: 10 * 60 * 1000 },
    { prefix: "exam.config.load", ttl: 5 * 60 * 1000 }
];

// Mutation actions that invalidate cache
const INVALIDATION_RULES = {
    "exam.create": ["exam.list"],
    "exam.delete": ["exam.list"],
    "exam.status.toggle": ["exam.list"],
    "exam.config.save": ["exam.config.load"],
    "settings.save": ["settings.load"],
    "subject.tag.save": ["subject.tag.getSections", "subject.tag.loadStudents"],
    "exam.marks.save": ["exam.marks.load", "exam.results.generate"],
    "student.master.sync": ["student.master.load"]
};

/**
 * Clears cached API responses matching prefix or all cache if omitted.
 */
export function clearApiCache(prefixFilter = null) {
    if (!prefixFilter) {
        apiCache.clear();
        return;
    }
    for (const key of apiCache.keys()) {
        if (key.includes(prefixFilter)) {
            apiCache.delete(key);
        }
    }
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
            } else {
                apiCache.delete(cacheKey);
            }
        }

        const finalUrl = url.toString().replace(/\+/g, "%20");
        let response;
        try {
            response = await fetch(finalUrl, {
                ...options,
                headers: {
                    "Content-Type": "text/plain",
                    ...(options.headers ?? {})
                }
            });
        } catch (netErr) {
            console.error("API Fetch Error:", netErr);
            if (!session || !session.user?.email) {
                clearSession();
                window.location.hash = "#/login";
                throw new Error("Session expired or not signed in. Please sign in to continue.");
            }
            throw new Error("Unable to connect to school server. Please check your internet connection.");
        }

        const payload = await response.json();

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

        // Save to cache if eligible
        if (cacheKey && cacheRule && payload?.success !== false) {
            apiCache.set(cacheKey, {
                expiry: Date.now() + cacheRule.ttl,
                payload: JSON.parse(JSON.stringify(payload))
            });
        }

        return payload;
    } catch (error) {
        console.error("apiRequest Error:", error);
        throw error;
    }
}
