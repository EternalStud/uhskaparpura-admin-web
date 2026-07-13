"use strict";

import { showToast } from "../../../components/toast.js";
import { showLoader, hideLoader } from "../../../components/loader.js?t=17892929125";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=17892929125";

let systemSettings = {};

const EXAMS = [
    { name: "Trimester", desc: "First and second mid-term terminal assessments." },
    { name: "Half yearly", desc: "Mid-academic session examination." },
    { name: "Sent-up", desc: "Pre-board test examination for high classes." },
    { name: "Annual", desc: "Final year-end board/school assessment." }
];

export const init = async () => {
    renderNavbar("navbar-exam-control");

    const loadingEl = document.querySelector("#settings-loading");
    const controlsContainer = document.querySelector("#settings-controls-container");
    const listContainer = document.querySelector(".exam-settings-list");
    const saveBtn = document.querySelector("#save-settings-btn");

    if (!loadingEl || !controlsContainer || !listContainer) return;

    try {
        const response = await apiRequest("settings.load");
        if (response.success && response.settings) {
            systemSettings = response.settings;
            
            // Build exam rows
            listContainer.innerHTML = EXAMS.map(exam => {
                const key = `exam_status_${exam.name}`;
                const isOpen = systemSettings[key] !== "CLOSED"; // defaults to OPEN if undefined
                const statusText = isOpen ? "OPEN" : "CLOSED";
                const statusClass = isOpen ? "status-open" : "status-closed";

                return `
                    <div class="exam-setting-row" data-exam-name="${exam.name}">
                        <div class="exam-setting-info">
                            <h4 class="exam-setting-name">${exam.name} Exam</h4>
                            <p class="exam-setting-desc">${exam.desc}</p>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <span class="status-indicator-text ${statusClass}">${statusText}</span>
                            <label class="switch">
                                <input type="checkbox" class="exam-toggle" ${isOpen ? "checked" : ""}>
                                <span class="slider round"></span>
                            </label>
                        </div>
                    </div>
                `;
            }).join("");

            // Add change listener to toggles to update the status text reactively
            const toggles = document.querySelectorAll(".exam-toggle");
            toggles.forEach(toggle => {
                toggle.addEventListener("change", (e) => {
                    const row = e.target.closest(".exam-setting-row");
                    const statusTextEl = row.querySelector(".status-indicator-text");
                    const checked = e.target.checked;
                    
                    statusTextEl.textContent = checked ? "OPEN" : "CLOSED";
                    statusTextEl.className = `status-indicator-text ${checked ? "status-open" : "status-closed"}`;
                });
            });

            loadingEl.style.display = "none";
            controlsContainer.style.display = "flex";
        } else {
            showToast(response.error || "Failed to load settings.", "error");
        }
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        showToast("Error connecting to settings API.", "error");
    }

    // Save Button Listener
    saveBtn.addEventListener("click", async () => {
        showLoader();
        const payload = {};
        const rows = document.querySelectorAll(".exam-setting-row");
        rows.forEach(row => {
            const examName = row.dataset.examName;
            const checkbox = row.querySelector(".exam-toggle");
            payload[`exam_status_${examName}`] = checkbox.checked ? "OPEN" : "CLOSED";
        });

        try {
            const response = await apiRequest("settings.save", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            if (response.success) {
                showToast("System lock settings saved successfully.", "success");
            } else {
                showToast(response.error || "Failed to save settings.", "error");
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            showToast("Failed to save settings.", "error");
        } finally {
            hideLoader();
        }
    });
};
