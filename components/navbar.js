"use strict";

import { getSession, clearSession } from "../services/session.js";

/**
 * Renders the dashboard navbar.
 * @param {Element|null} target Navbar container.
 * @returns {void}
 */
export function renderNavbar(target) {
    try {
        if (!target) {
            throw new Error("Navbar target is missing.");
        }

        const session = getSession();
        target.innerHTML = `
            <nav class="topbar" aria-label="Primary">
                <div class="topbar-brand" style="cursor: pointer; user-select: none;" id="nav-brand-container" title="Go to Dashboard">
                    <span class="topbar-mark" aria-hidden="true">
                        <span class="material-symbols-rounded">school</span>
                    </span>
                    <span class="topbar-title">
                        <strong>UHS Kaparpura</strong>
                        <span>${session?.user?.email ?? "Examination Portal"}</span>
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="status-pill">
                        <span class="material-symbols-rounded" aria-hidden="true">account_circle</span>
                        ${session?.user?.name ?? "Admin"}
                    </span>
                    <button id="nav-logout-btn" class="btn btn-ghost" style="min-height: 36px; height: 36px; width: 36px; padding: 0; border-radius: 50%; color: var(--color-danger); border-color: rgba(239, 68, 68, 0.15); background: rgba(239, 68, 68, 0.05); display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Logout" aria-label="Logout">
                        <span class="material-symbols-rounded" style="font-size: 1.2rem;">logout</span>
                    </button>
                </div>
            </nav>
        `;

        // Wire event handlers asynchronously to ensure DOM exists
        setTimeout(() => {
            const logoutBtn = document.getElementById("nav-logout-btn");
            if (logoutBtn) {
                logoutBtn.onclick = () => {
                    clearSession();
                    window.location.hash = "#/login";
                };
            }
            const brandContainer = document.getElementById("nav-brand-container");
            if (brandContainer) {
                brandContainer.onclick = () => {
                    window.location.hash = "#/dashboard";
                };
            }
        }, 0);

    } catch (error) {
        console.error(error);
    }
}
