"use strict";

import { getSession } from "../services/session.js";

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
                <div class="topbar-brand">
                    <span class="topbar-mark" aria-hidden="true">
                        <span class="material-symbols-rounded">school</span>
                    </span>
                    <span class="topbar-title">
                        <strong>UHS Kaparpura</strong>
                        <span>${session?.user?.email ?? "Examination Portal"}</span>
                    </span>
                </div>
                <span class="status-pill">
                    <span class="material-symbols-rounded" aria-hidden="true">account_circle</span>
                    ${session?.user?.name ?? "Admin"}
                </span>
            </nav>
        `;
    } catch (error) {
        console.error(error);
    }
}
