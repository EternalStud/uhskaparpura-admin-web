"use strict";

import { signInWithGoogle } from "../../services/auth.js";
import { navigateTo } from "./router.js";
import { showToast } from "../../components/toast.js";
import { apiRequest } from "../../services/api.js";
import { getSession, saveSession } from "../../services/session.js";

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
                try {
                    // Fetch user role from backend Database dynamically
                    const profileRes = await apiRequest("auth.profile");
                    if (profileRes.success && profileRes.user) {
                        const session = getSession();
                        if (session) {
                            session.user.role = profileRes.user.role;
                            saveSession(session);
                        }
                    }
                } catch (err) {
                    console.error("Failed to load user profile role:", err);
                }
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
