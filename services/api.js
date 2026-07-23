"use strict";

import { CONFIG } from "../config/config.js";
import { getSession, clearSession } from "./session.js";


/**
 * Sends a request to the Google Apps Script REST API.
 * @param {string} path API path.
 * @param {RequestInit} options Fetch options.
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

        return payload;
    } catch (error) {
        console.error("apiRequest Error:", error);
        throw error;
    }
}
