"use strict";

import { initRouter, navigateTo } from "./router.js?v=1.2.3";
import { restoreSession } from "../../services/session.js";
import { showToast } from "../../components/toast.js";

const startApp = async () => {
    try {
        const session = await restoreSession();
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
