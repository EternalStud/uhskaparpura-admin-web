"use strict";

import { CONFIG } from "../config/config.js";
import { getSession } from "./session.js";

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

        const response = await fetch(url.toString(), {
            ...options,
            headers: {
                "Content-Type": "text/plain",
                ...(options.headers ?? {})
            }
        });
        const payload = await response.json();



        if (!response.ok) {
            throw new Error(payload.error ?? payload.message ?? `API request failed with ${response.status}`);
        }

        if (payload?.success === false) {
            throw new Error(payload.error ?? payload.message ?? "API request failed.");
        }

        return payload;
    } catch (error) {
        console.error(error);
        throw error;
    }
}
