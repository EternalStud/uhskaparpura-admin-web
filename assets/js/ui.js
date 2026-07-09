"use strict";

/**
 * Creates a Material Symbol span.
 * @param {string} name Icon name.
 * @returns {HTMLSpanElement}
 */
export function createIcon(name) {
    try {
        const icon = document.createElement("span");
        icon.className = "material-symbols-rounded";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = name;
        return icon;
    } catch (error) {
        console.error(error);
        return document.createElement("span");
    }
}
