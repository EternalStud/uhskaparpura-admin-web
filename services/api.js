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
        const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;

        const session = getSession();
        const url = new URL(`${normalizedBaseUrl}${normalizedPath}`);

        if (session?.user?.email) {
            url.searchParams.set("email", session.user.email);
        }

        const response = await fetch(url.toString(), {
            ...options,
            headers: {
                "Content-Type": "application/json",
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
