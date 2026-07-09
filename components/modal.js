"use strict";

/**
 * Opens a reusable modal dialog.
 * @param {{ title: string, body?: string, content?: Node, size?: "default"|"large", onClose?: Function }} options Modal content.
 * @returns {{ element: HTMLDivElement, close: Function }|null}
 */
export function openModal(options) {
    try {
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        const modal = document.createElement("section");
        const body = document.createElement("div");
        const header = document.createElement("header");
        const title = document.createElement("h2");
        const closeButton = document.createElement("button");
        const closeIcon = document.createElement("span");

        modal.className = `modal ${options.size === "large" ? "modal-large" : ""}`;
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-labelledby", "modal-title");

        header.className = "modal-header";
        title.id = "modal-title";
        title.textContent = options.title;
        closeButton.className = "modal-close";
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Close dialog");
        closeIcon.className = "material-symbols-rounded";
        closeIcon.setAttribute("aria-hidden", "true");
        closeIcon.textContent = "close";
        closeButton.append(closeIcon);
        body.className = "modal-body";

        if (options.content) {
            body.append(options.content);
        } else {
            const message = document.createElement("p");
            message.textContent = options.body ?? "";
            body.append(message);
        }

        header.append(title, closeButton);
        modal.append(header, body);
        backdrop.replaceChildren(modal);

        const close = () => {
            options.onClose?.();
            backdrop.remove();
        };

        closeButton.addEventListener("click", close);
        backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop) {
                close();
            }
        });
        document.body.append(backdrop);
        return { element: backdrop, close };
    } catch (error) {
        console.error(error);
        return null;
    }
}
