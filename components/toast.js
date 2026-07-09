"use strict";

/**
 * Shows a temporary toast message.
 * @param {string} message Message text.
 * @param {"success"|"error"|"default"} type Toast style.
 * @returns {void}
 */
export function showToast(message, type = "default") {
    try {
        const root = document.querySelector("#toast-root");
        if (!root) {
            return;
        }

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.textContent = message;
        root.append(toast);

        window.setTimeout(() => {
            toast.remove();
        }, 3200);
    } catch (error) {
        console.error(error);
    }
}
