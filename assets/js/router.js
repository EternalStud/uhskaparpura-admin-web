"use strict";

import { initLoginView } from "./login.js?t=17892929180";
import { initDashboardView } from "./dashboard.js?t=17892929180";
import { initSubjectTagView } from "./modules/subjectTag.js?t=17892929180";
import { initMarksEntryView } from "./modules/marksEntry.js?t=17892929180";
import { initResultGenerationView } from "./modules/resultGeneration.js?t=17892929180";
import { initStudentMasterView } from "./modules/studentMaster.js?t=17892929180";
import { initSyncSchoolDBView } from "./modules/syncSchoolDB.js?t=17892929180";
import { init as initExamControlView } from "./modules/examControl.js?t=17892929180";
import { getSession, clearSession } from "../../services/session.js";
import { hideLoader, showLoader } from "../../components/loader.js?t=17892929180";
import { showToast } from "../../components/toast.js";


const routes = new Map([
    ["/login", { view: "views/login.html", init: initLoginView, public: true }],
    ["/dashboard", { view: "views/dashboard.html", init: initDashboardView, public: false }],
    ["/subject-tag", { view: "views/subjectTag.html", init: initSubjectTagView, public: false }],
    ["/marks-entry", { view: "views/marksEntry.html", init: initMarksEntryView, public: false }],
    ["/result-generation", { view: "views/resultGeneration.html", init: initResultGenerationView, public: false }],
    ["/student-master", { view: "views/studentMaster.html", init: initStudentMasterView, public: false }],
    ["/sync-schooldb", { view: "views/syncSchoolDB.html", init: initSyncSchoolDBView, public: false }],
    ["/exam-control", { view: "views/examControl.html", init: initExamControlView, public: false }]
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
        const hasValidSession = session && session.user?.role;

        if (!route.public && !hasValidSession) {
            clearSession();
            await navigateTo("/login", { replace: true });
            return;
        }

        if (route.public && hasValidSession) {
            await navigateTo("/dashboard", { replace: true });
            return;
        }


        const userRole = (session?.user?.role || "").toUpperCase();
        if (session && userRole === "TEACHER" && path === "/result-generation") {
            showToast("You do not have permission to access Result Generation.", "error");
            await navigateTo("/dashboard", { replace: true });
            return;
        }

        if (session && userRole !== "ADMIN" && path === "/sync-schooldb") {
            showToast("You do not have permission to access Sync SchoolDB.", "error");
            await navigateTo("/dashboard", { replace: true });
            return;
        }

        if (session && userRole !== "ADMIN" && userRole !== "HM" && path === "/exam-control") {
            showToast("You do not have permission to access Exam Lock Control.", "error");
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
