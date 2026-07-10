"use strict";

import { renderNavbar } from "../../components/navbar.js";
import { logout } from "../../services/auth.js";
import { navigateTo } from "./router.js";
import { showToast } from "../../components/toast.js";
import { openPrepareExamModal } from "./modules/prepareExam.js";

const modules = [
    {
        title: "Student Master",
        description: "Open student records.",
        icon: "groups",
        action: "student-master"
    },
    {
        title: "Prepare Exam",
        description: "Prepare Bihar Board marks entry sheets.",
        icon: "assignment",
        action: "prepare-exam"
    },
    {
        title: "Students-Subject Tag",
        description: "Assign and manage student BSEB subject mappings.",
        icon: "bookmarks",
        action: "subject-tag"
    },
    {
        title: "Marks Entry",
        description: "Open marks entry.",
        icon: "edit_note",
        action: "marks-entry"
    },
    {
        title: "Result Generation",
        description: "Open result tools.",
        icon: "workspace_premium",
        action: "result-generation"
    },
    {
        title: "Admission Approval",
        description: "Review admission approvals.",
        icon: "how_to_reg",
        action: "admission-approval",
        hidden: true
    },
    {
        title: "Registration Approval",
        description: "Review registration approvals.",
        icon: "app_registration",
        action: "registration-approval",
        hidden: true
    },
    {
        title: "Logout",
        description: "End this session.",
        icon: "logout",
        action: "logout",
        danger: true
    }
];

const cards = modules.filter((module) => !module.hidden);

const createCard = (card) => {
    const button = document.createElement("button");
    button.className = `dashboard-card${card.danger ? " logout-card" : ""}`;
    button.type = "button";
    button.dataset.action = card.action;
    button.innerHTML = `
        <span class="dashboard-card-icon" aria-hidden="true">
            <span class="material-symbols-rounded">${card.icon}</span>
        </span>
        <span>
            <h2>${card.title}</h2>
            <p>${card.description}</p>
        </span>
    `;
    return button;
};

const handleAction = async (action) => {
    try {
        if (action === "logout") {
            await logout();
            showToast("Signed out.", "success");
            await navigateTo("/login", { replace: true });
            return;
        }

        if (action === "prepare-exam") {
            await openPrepareExamModal();
            return;
        }

        if (action === "subject-tag") {
            await navigateTo("/subject-tag");
            return;
        }

        showToast("This module will be implemented next.", "success");
    } catch (error) {
        console.error(error);
        showToast("Unable to complete the action.", "error");
    }
};

/**
 * Initializes the dashboard shell.
 * @returns {Promise<void>}
 */
export async function initDashboardView() {
    try {
        renderNavbar(document.querySelector("#navbar-root"));
        const actions = document.querySelector("#dashboard-actions");
        if (!actions) {
            throw new Error("Dashboard actions container is missing.");
        }

        actions.replaceChildren(...cards.map(createCard));
        actions.addEventListener("click", (event) => {
            const card = event.target.closest("[data-action]");
            if (card) {
                void handleAction(card.dataset.action);
            }
        });
    } catch (error) {
        console.error(error);
        showToast("Dashboard could not be initialized.", "error");
    }
}
