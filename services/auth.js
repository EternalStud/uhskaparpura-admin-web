"use strict";

import { CONFIG } from "../config/config.js";
import { clearSession, saveSession } from "./session.js";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

const decodeJwtPayload = (token) => {
    try {
        const [, payload] = token.split(".");
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(window.atob(normalized));
    } catch (error) {
        console.error(error);
        throw new Error("Unable to read Google profile.");
    }
};

/**
 * Initializes Google Identity Services login.
 * @param {{ buttonElement: Element|null, onSuccess: Function, onError: Function }} options Login options.
 * @returns {Promise<void>}
 */
export async function signInWithGoogle(options) {
    try {
        if (!CONFIG.GOOGLE_CLIENT_ID) {
            options.onError("Google Client ID is not configured.");
            return;
        }

        if (!options.buttonElement) {
            throw new Error("Google sign-in button container is missing.");
        }

        window.google.accounts.id.initialize({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            callback: async (response) => {
                try {
                    const profile = decodeJwtPayload(response.credential);
                    saveSession({
                        token: response.credential,
                        user: {
                            name: profile.name,
                            email: profile.email,
                            picture: profile.picture
                        },
                        expiresAt: Date.now() + SESSION_DURATION_MS
                    });
                    await options.onSuccess();
                } catch (error) {
                    console.error(error);
                    options.onError("Sign-in failed. Please try again.");
                }
            },
            auto_select: true,
            cancel_on_tap_outside: false
        });

        window.google.accounts.id.renderButton(options.buttonElement, {
            theme: "outline",
            size: "large",
            type: "standard",
            shape: "rectangular",
            text: "signin_with",
            width: Math.min(320, options.buttonElement.clientWidth || 320)
        });

        window.google.accounts.id.prompt();
    } catch (error) {
        console.error(error);
        options.onError("Google sign-in could not be initialized.");
    }
}

/**
 * Logs out the active user.
 * @returns {Promise<void>}
 */
export async function logout() {
    try {
        clearSession();
        window.google?.accounts?.id?.disableAutoSelect();
    } catch (error) {
        console.error(error);
        clearSession();
    }
}
