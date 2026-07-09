"use strict";

import { signInWithGoogle } from "../../services/auth.js";
import { navigateTo } from "./router.js";
import { showToast } from "../../components/toast.js";

const googleScriptReady = async () => {
    await new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
            if (window.google?.accounts?.id) {
                window.clearInterval(timer);
                resolve();
                return;
            }

            if (Date.now() - startedAt > 8000) {
                window.clearInterval(timer);
                reject(new Error("Google Identity Services did not load."));
            }
        }, 100);
    });
};

const showLoginWarning = (message) => {
    const warning = document.querySelector("#login-warning");
    if (!warning) {
        return;
    }

    warning.textContent = message;
    warning.classList.add("is-visible");
};

/**
 * Initializes the Google login view.
 * @returns {Promise<void>}
 */
export async function initLoginView() {
    try {
        await googleScriptReady();
        await signInWithGoogle({
            buttonElement: document.querySelector("#google-login-button"),
            onSuccess: async () => {
                showToast("Signed in successfully.", "success");
                await navigateTo("/dashboard");
            },
            onError: (message) => {
                showLoginWarning(message);
                showToast(message, "error");
            }
        });
    } catch (error) {
        console.error(error);
        showLoginWarning("Google sign-in is unavailable. Check the client ID and network connection.");
    }
}
