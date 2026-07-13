import { renderNavbar } from "../../components/navbar.js?t=17892929125";
import { logout } from "../../services/auth.js";
import { navigateTo } from "./router.js";
import { showToast } from "../../components/toast.js";
import { openPrepareExamModal } from "./modules/prepareExam.js";
import { getSession, saveSession } from "../../services/session.js";
import { apiRequest } from "../../services/api.js";

const modules = [
    {
        title: "Student Master",
        description: "Manage student records.",
        icon: "group",
        action: "student-master"
    },
    {
        title: "Prepare Exam Sheets",
        description: "Generate templates in Drive.",
        icon: "article",
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
        title: "Sync SchoolDB",
        description: "Sync student database via e-Shikshakosh Excel.",
        icon: "sync",
        action: "sync-schooldb"
    },
    {
        title: "Exam Lock Control",
        description: "Control teacher marks entry access.",
        icon: "lock_open",
        action: "exam-control"
    }
];

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

        if (action === "student-master") {
            await navigateTo("/student-master");
            return;
        }

        if (action === "subject-tag") {
            await navigateTo("/subject-tag");
            return;
        }

        if (action === "marks-entry") {
            await navigateTo("/marks-entry");
            return;
        }

        if (action === "result-generation") {
            await navigateTo("/result-generation");
            return;
        }

        if (action === "sync-schooldb") {
            await navigateTo("/sync-schooldb");
            return;
        }

        if (action === "exam-control") {
            await navigateTo("/exam-control");
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

        const session = getSession();
        let userRole = (session?.user?.role || "").toUpperCase();
        if (session && !session.user.role) {
            try {
                const profileRes = await apiRequest("auth.profile");
                if (profileRes.success && profileRes.user) {
                    session.user.role = profileRes.user.role;
                    saveSession(session);
                    userRole = (profileRes.user.role || "").toUpperCase();
                }
            } catch (err) {
                console.error("Failed to load user role on dashboard load:", err);
            }
        }

        const visibleCards = modules.filter(module => {
            if (module.hidden) return false;
            // Hide result generation and prepare exam cards for TEACHERs
            if (userRole === "TEACHER") {
                if (module.action === "result-generation" || module.action === "prepare-exam" || module.action === "sync-schooldb" || module.action === "exam-control") {
                    return false;
                }
            }
            // Sync SchoolDB is ADMIN only
            if (module.action === "sync-schooldb" && userRole !== "ADMIN") {
                return false;
            }
            // Exam Lock Control is ADMIN and HM only
            if (module.action === "exam-control" && userRole !== "ADMIN" && userRole !== "HM") {
                return false;
            }
            return true;
        });

        actions.replaceChildren(...visibleCards.map(createCard));
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
