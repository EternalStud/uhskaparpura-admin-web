"use strict";

import { initLoginView } from "./login.js?v=1.2.4";
import { initDashboardView } from "./dashboard.js?v=1.2.4";
import { initSubjectTagView } from "./modules/subjectTag.js?v=1.2.4";
import { getSession } from "../../services/session.js";
import { hideLoader, showLoader } from "../../components/loader.js";
import { showToast } from "../../components/toast.js";

const routes = new Map([
    ["/login", { view: "views/login.html", init: initLoginView, public: true }],
    ["/dashboard", { view: "views/dashboard.html", init: initDashboardView, public: false }],
    ["/subject-tag", { view: "views/subjectTag.html", init: initSubjectTagView, public: false }]
]);

const getCurrentPath = () => {
    const hashPath = window.location.hash.replace("#", "");
    return routes.has(hashPath) ? hashPath : "/login";
};

/**
 * Initializes browser navigation handling for the SPA.
 * @returns {void}
 */
export function initRouter() {
    try {
        window.addEventListener("hashchange", () => {
            void renderRoute(getCurrentPath());
        });
    } catch (error) {
        console.error(error);
        showToast("Navigation could not be initialized.", "error");
    }
}

/**
 * Navigates to an application route.
 * @param {string} path Route path.
 * @param {{ replace?: boolean }} options Navigation options.
 * @returns {Promise<void>}
 */
export async function navigateTo(path, options = {}) {
    try {
        const nextPath = routes.has(path) ? path : "/login";
        const nextUrl = `${window.location.pathname}${window.location.search}#${nextPath}`;
        if (options.replace) {
            window.history.replaceState({}, "", nextUrl);
        } else {
            window.history.pushState({}, "", nextUrl);
        }
        await renderRoute(nextPath);
    } catch (error) {
        console.error(error);
        showToast("Unable to open the requested page.", "error");
    }
}

/**
 * Loads and initializes a route.
 * @param {string} path Route path.
 * @returns {Promise<void>}
 */
export async function renderRoute(path) {
    const route = routes.get(path) ?? routes.get("/login");
    const app = document.querySelector("#app");

    try {
        showLoader();
        if (!app || !route) {
            throw new Error("Application root is missing.");
        }

        const session = getSession();
        if (!route.public && !session) {
            await navigateTo("/login", { replace: true });
            return;
        }

        if (route.public && session) {
            await navigateTo("/dashboard", { replace: true });
            return;
        }

        const response = await fetch(route.view, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Unable to load ${route.view}`);
        }

        app.innerHTML = await response.text();
        await route.init();
    } catch (error) {
        console.error(error);
        showToast("The page could not be loaded.", "error");
    } finally {
        hideLoader();
    }
}
