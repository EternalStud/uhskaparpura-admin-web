"use strict";

/**
 * Placeholder for the future application sidebar.
 * @returns {HTMLElement}
 */
export function createSidebar() {
    try {
        const sidebar = document.createElement("aside");
        sidebar.setAttribute("aria-label", "Module navigation");
        return sidebar;
    } catch (error) {
        console.error(error);
        return document.createElement("aside");
    }
}
