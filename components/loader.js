"use strict";

/**
 * Shows the global loading indicator.
 * @returns {void}
 */
export function showLoader() {
    try {
        const root = document.querySelector("#loader-root");
        if (!root || root.children.length) {
            return;
        }

        root.innerHTML = `
            <div class="loader-backdrop" role="status" aria-label="Loading">
                <div class="loader-spinner"></div>
            </div>
        `;
    } catch (error) {
        console.error(error);
    }
}

/**
 * Hides the global loading indicator.
 * @returns {void}
 */
export function hideLoader() {
    try {
        document.querySelector("#loader-root")?.replaceChildren();
    } catch (error) {
        console.error(error);
    }
}
