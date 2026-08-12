"use strict";

import { getSession, clearSession } from "../../services/session.js";
import { hideLoader, showLoader } from "../../components/loader.js?t=202608030555";
import { showToast } from "../../components/toast.js";

/** Cache-bust for lazy-loaded feature modules (keep in sync with index.html). */
const MODULE_T = "202608030555";

/**
 * Route table — modules are dynamically imported so login/dashboard
 * do not download marks/results/sync code until needed.
 */
const routes = new Map([
    ["/login", {
        view: "views/login.html",
        public: true,
        load: () => import(`./login.js?t=${MODULE_T}`).then((m) => m.initLoginView)
    }],
    ["/dashboard", {
        view: "views/dashboard.html",
        public: false,
        load: () => import(`./dashboard.js?t=${MODULE_T}`).then((m) => m.initDashboardView)
    }],
    ["/subject-tag", {
        view: "views/subjectTag.html",
        public: false,
        load: () => import(`./modules/subjectTag.js?t=${MODULE_T}`).then((m) => m.initSubjectTagView)
    }],
    ["/marks-entry", {
        view: "views/marksEntry.html",
        public: false,
        load: () => import(`./modules/marksEntry.js?t=${MODULE_T}`).then((m) => m.initMarksEntryView)
    }],
    ["/result-generation", {
        view: "views/resultGeneration.html",
        public: false,
        load: () => import(`./modules/resultGeneration.js?t=${MODULE_T}`).then((m) => m.initResultGenerationView)
    }],
    ["/student-master", {
        view: "views/studentMaster.html",
        public: false,
        load: () => import(`./modules/studentMaster.js?t=${MODULE_T}`).then((m) => m.initStudentMasterView)
    }],
    ["/sync-schooldb", {
        view: "views/syncSchoolDB.html",
        public: false,
        load: () => import(`./modules/syncSchoolDB.js?t=${MODULE_T}`).then((m) => m.initSyncSchoolDBView)
    }],
    ["/exam-control", {
        view: "views/examControl.html",
        public: false,
        load: () => import(`./modules/examControl.js?t=${MODULE_T}`).then((m) => m.init)
    }],
    ["/portal-control", {
        view: "views/portalControl.html",
        public: false,
        load: () => import(`./modules/portalControl.js?t=${MODULE_T}`).then((m) => m.initPortalControlView)
    }],
    ["/registration-mgmt", {
        view: "views/registrationMgmt.html",
        public: false,
        load: () => import(`./modules/registrationMgmt.js?t=${MODULE_T}`).then((m) => m.initRegistrationMgmtView)
    }]
]);

/** In-memory HTML view templates (avoid re-fetching on every navigation). */
const viewHtmlCache = new Map();

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

        if (session && userRole !== "ADMIN" && userRole !== "HM" && path === "/portal-control") {
            showToast("You do not have permission to access School Web Portal Control.", "error");
            await navigateTo("/dashboard", { replace: true });
            return;
        }

        // Parallel: fetch HTML view + start module download
        let html = viewHtmlCache.get(route.view);
        const htmlPromise = html
            ? Promise.resolve(html)
            : fetch(route.view).then(async (response) => {
                if (!response.ok) throw new Error(`Unable to load ${route.view}`);
                const text = await response.text();
                viewHtmlCache.set(route.view, text);
                return text;
            });

        const [viewHtml, initFn] = await Promise.all([
            htmlPromise,
            route.load()
        ]);

        app.innerHTML = viewHtml;
        await initFn();
    } catch (error) {
        console.error(error);
        showToast("The page could not be loaded.", "error");
    } finally {
        hideLoader();
    }
}
