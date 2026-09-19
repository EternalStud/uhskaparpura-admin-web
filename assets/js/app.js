"use strict";

import { initRouter, navigateTo } from "./router.js?t=202609200255";
import { restoreSession } from "../../services/session.js";
import { showToast } from "../../components/toast.js";

const startApp = async () => {
    try {
        const session = await restoreSession();
        if (session && session.token && !session.token.startsWith("UHSSESS_")) {
            // Silently upgrade active session to 30-day server-signed token
            import("../../services/api.js").then(({ apiRequest }) => {
                apiRequest("auth.profile").then((profileRes) => {
                    if (profileRes?.success && profileRes.token) {
                        session.token = profileRes.token;
                        session.expiresAt = Date.now() + (profileRes.expiresIn || (30 * 24 * 60 * 60 * 1000));
                        import("../../services/session.js").then(({ saveSession }) => saveSession(session));
                    }
                }).catch(() => {});
            }).catch(() => {});
        }
        initRouter();
        navigateTo(session ? "/dashboard" : "/login", { replace: true });
    } catch (error) {
        showToast("Unable to start the portal. Please refresh the page.", "error");
        console.error(error);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    void startApp();
});
