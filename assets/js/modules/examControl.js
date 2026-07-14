"use strict";

import { showToast } from "../../../components/toast.js";
import { showLoader, hideLoader } from "../../../components/loader.js?t=17892929145";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=17892929145";

// Local state
let examsList = [];
let activeExamName = "";
let activeClassNum = "9"; // Default tab
let activeConfigs = [];   // Array of { classNum, subjectId, theory, practical, internal }
let classSubjects = {};   // Cache of { classNum: subjects[] }
let subjectSearchQuery = "";

export const init = async () => {
    renderNavbar("navbar-exam-control");

    // View containers
    const examsListView = document.querySelector("#exams-list-view");
    const rulesConfigView = document.querySelector("#rules-config-view");

    // Elements - Exams List View
    const examsLoading = document.querySelector("#exams-loading");
    const examsTableContainer = document.querySelector("#exams-table-container");
    const examsListTbody = document.querySelector("#exams-list-tbody");
    const createExamForm = document.querySelector("#create-exam-form");
    const newExamNameInput = document.querySelector("#new-exam-name");

    // Elements - Config View
    const configExamTitle = document.querySelector("#config-exam-title");
    const closeConfigBtn = document.querySelector("#close-config-btn");
    const cancelConfigBtn = document.querySelector("#cancel-config-btn");
    const saveConfigBtn = document.querySelector("#save-config-btn");
    const classTabs = document.querySelectorAll(".class-tab");
    const subjectSearchInput = document.querySelector("#subject-search-input");
    const subjectOverridesTbody = document.querySelector("#subject-overrides-tbody");

    // Default inputs
    const defaultNpTheory = document.querySelector("#default-np-theory");
    const defaultNpPractical = document.querySelector("#default-np-practical");
    const defaultNpInternal = document.querySelector("#default-np-internal");
    const defaultPTheory = document.querySelector("#default-p-theory");
    const defaultPPractical = document.querySelector("#default-p-practical");
    const defaultPInternal = document.querySelector("#default-p-internal");

    if (!examsListView || !rulesConfigView) return;

    // Load initial list of exams
    await loadExamsList();

    // Event Listeners - Exams List View
    if (createExamForm) {
        createExamForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = String(newExamNameInput.value || "").trim();
            if (!name) return;

            showLoader();
            try {
                const res = await apiRequest("exam.create", {
                    method: "POST",
                    body: JSON.stringify({ examName: name })
                });

                if (res.success) {
                    showToast(`Exam "${name}" created successfully.`, "success");
                    newExamNameInput.value = "";
                    await loadExamsList();
                } else {
                    showToast(res.error || "Failed to create exam.", "error");
                }
            } catch (err) {
                console.error(err);
                showToast("Error creating exam.", "error");
            } finally {
                hideLoader();
            }
        });
    }

    // Event Listeners - Config View
    if (closeConfigBtn) {
        closeConfigBtn.addEventListener("click", () => switchView("list"));
    }
    if (cancelConfigBtn) {
        cancelConfigBtn.addEventListener("click", () => switchView("list"));
    }

    // Class Tab selection
    classTabs.forEach(tab => {
        tab.addEventListener("click", async (e) => {
            classTabs.forEach(t => {
                t.classList.remove("active");
                t.style.color = "var(--color-muted)";
                t.style.borderBottomColor = "transparent";
            });
            tab.classList.add("active");
            tab.style.color = "var(--color-primary)";
            tab.style.borderBottomColor = "var(--color-primary)";

            activeClassNum = tab.dataset.class;
            await renderClassConfig();
        });
    });

    // Subject override search input
    if (subjectSearchInput) {
        subjectSearchInput.addEventListener("input", (e) => {
            subjectSearchQuery = String(e.target.value || "").trim().toLowerCase();
            filterSubjectRows();
        });
    }

    // Default inputs event listeners (update state when changed)
    const setupDefaultInputListeners = (inputs, subjectId) => {
        inputs.forEach(input => {
            input.addEventListener("input", () => {
                const theory = Number(defaultNpTheory.value || 0);
                const practical = Number(defaultNpPractical.value || 0);
                const internal = Number(defaultNpInternal.value || 0);

                let targetRow = activeConfigs.find(c => c.classNum === activeClassNum && c.subjectId === subjectId);
                if (!targetRow) {
                    targetRow = { classNum: activeClassNum, subjectId };
                    activeConfigs.push(targetRow);
                }
                
                if (subjectId === "DEFAULT_NON_PRACTICAL") {
                    targetRow.theory = Number(defaultNpTheory.value || 0);
                    targetRow.practical = Number(defaultNpPractical.value || 0);
                    targetRow.internal = Number(defaultNpInternal.value || 0);
                } else {
                    targetRow.theory = Number(defaultPTheory.value || 0);
                    targetRow.practical = Number(defaultPPractical.value || 0);
                    targetRow.internal = Number(defaultPInternal.value || 0);
                }

                // Re-render subjects overrides table placeholders
                updateSubjectTablePlaceholders();
            });
        });
    };

    setupDefaultInputListeners([defaultNpTheory, defaultNpPractical, defaultNpInternal], "DEFAULT_NON_PRACTICAL");
    setupDefaultInputListeners([defaultPTheory, defaultPPractical, defaultPInternal], "DEFAULT_PRACTICAL");

    // Save rules configurations
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener("click", async () => {
            showLoader();
            try {
                const res = await apiRequest("exam.config.save", {
                    method: "POST",
                    body: JSON.stringify({
                        examName: activeExamName,
                        configs: activeConfigs
                    })
                });

                if (res.success) {
                    showToast("Configuration saved successfully.", "success");
                    switchView("list");
                } else {
                    showToast(res.error || "Failed to save configuration.", "error");
                }
            } catch (err) {
                console.error(err);
                showToast("Error saving configuration.", "error");
            } finally {
                hideLoader();
            }
        });
    }

    // Helper functions
    async function loadExamsList() {
        if (examsLoading) examsLoading.style.display = "block";
        if (examsTableContainer) examsTableContainer.style.display = "none";

        try {
            const res = await apiRequest("exam.list");
            if (res.success && res.exams) {
                examsList = res.exams;
                renderExamsTable();
            } else {
                showToast(res.error || "Failed to load exams.", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Error fetching exams list.", "error");
        } finally {
            if (examsLoading) examsLoading.style.display = "none";
        }
    }

    function renderExamsTable() {
        if (examsList.length === 0) {
            examsListTbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 30px; color: var(--color-muted);">
                        No exams found. Create one above to get started.
                    </td>
                </tr>
            `;
            if (examsTableContainer) examsTableContainer.style.display = "block";
            return;
        }

        examsListTbody.innerHTML = examsList.map(exam => {
            const isOpen = exam.status === "OPEN";
            const statusText = isOpen ? "OPEN" : "CLOSED";
            const statusClass = isOpen ? "status-open" : "status-closed";

            return `
                <tr style="border-bottom: 1px solid var(--color-border);" data-exam-name="${exam.name}">
                    <td style="padding: 14px 16px; font-weight: 600; color: var(--color-text); font-size: 0.95rem;">
                        ${exam.name}
                    </td>
                    <td style="padding: 14px 16px; text-align: center;">
                        <div style="display: inline-flex; align-items: center; justify-content: center; min-width: 130px;">
                            <span class="status-indicator-text ${statusClass}" style="width: 60px; text-align: right;">${statusText}</span>
                            <label class="switch" style="transform: scale(0.85); margin-left: 8px;">
                                <input type="checkbox" class="exam-toggle" ${isOpen ? "checked" : ""}>
                                <span class="slider round"></span>
                            </label>
                        </div>
                    </td>
                    <td style="padding: 14px 16px; text-align: right;">
                        <div class="exam-action-cell">
                            <button class="btn btn-ghost configure-btn" title="Configure Rules" style="padding: 6px 12px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--color-border);">
                                <span class="material-symbols-rounded" style="font-size: 1.1rem; color: var(--color-primary);">tune</span>
                                Configure Rules
                            </button>
                            <button class="btn btn-ghost delete-btn" title="Delete Exam" style="padding: 6px 12px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--color-border); border-color: rgba(239, 68, 68, 0.2); color: var(--color-error);">
                                <span class="material-symbols-rounded" style="font-size: 1.1rem; color: var(--color-error);">delete</span>
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        // Setup toggles listeners
        const toggles = examsListTbody.querySelectorAll(".exam-toggle");
        toggles.forEach(toggle => {
            toggle.addEventListener("change", async (e) => {
                const tr = e.target.closest("tr");
                const examName = tr.dataset.examName;
                const checked = e.target.checked;
                const status = checked ? "OPEN" : "CLOSED";

                const statusTextEl = tr.querySelector(".status-indicator-text");
                statusTextEl.textContent = status;
                statusTextEl.className = `status-indicator-text ${checked ? "status-open" : "status-closed"}`;

                try {
                    const res = await apiRequest("exam.status.toggle", {
                        method: "POST",
                        body: JSON.stringify({ examName, status })
                    });
                    if (res.success) {
                        showToast(`Exam "${examName}" status set to ${status}.`, "success");
                    } else {
                        showToast(res.error || "Failed to update status.", "error");
                        // Revert checkbox state
                        toggle.checked = !checked;
                        statusTextEl.textContent = !checked ? "OPEN" : "CLOSED";
                        statusTextEl.className = `status-indicator-text ${!checked ? "status-open" : "status-closed"}`;
                    }
                } catch (err) {
                    console.error(err);
                    showToast("Error updating exam status.", "error");
                    // Revert checkbox state
                    toggle.checked = !checked;
                    statusTextEl.textContent = !checked ? "OPEN" : "CLOSED";
                    statusTextEl.className = `status-indicator-text ${!checked ? "status-open" : "status-closed"}`;
                }
            });
        });

        // Setup configure click
        const configBtns = examsListTbody.querySelectorAll(".configure-btn");
        configBtns.forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const tr = e.target.closest("tr");
                const examName = tr.dataset.examName;
                await openRulesConfig(examName);
            });
        });

        // Setup delete click
        const deleteBtns = examsListTbody.querySelectorAll(".delete-btn");
        deleteBtns.forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const tr = e.target.closest("tr");
                const examName = tr.dataset.examName;

                const confirmed = confirm(`⚠️ Danger: Are you sure you want to delete the exam "${examName}"?\n\nThis will remove all marks entry rules and settings associated with this exam. Existing marks sheets for this exam will no longer be openable by teachers.`);
                if (!confirmed) return;

                showLoader();
                try {
                    const res = await apiRequest("exam.delete", {
                        method: "POST",
                        body: JSON.stringify({ examName })
                    });
                    if (res.success) {
                        showToast(`Exam "${examName}" deleted successfully.`, "success");
                        await loadExamsList();
                    } else {
                        showToast(res.error || "Failed to delete exam.", "error");
                    }
                } catch (err) {
                    console.error(err);
                    showToast("Error deleting exam.", "error");
                } finally {
                    hideLoader();
                }
            });
        });

        if (examsTableContainer) examsTableContainer.style.display = "block";
    }

    function switchView(view) {
        if (view === "list") {
            examsListView.style.display = "block";
            rulesConfigView.style.display = "none";
        } else {
            examsListView.style.display = "none";
            rulesConfigView.style.display = "block";
        }
    }

    async function openRulesConfig(examName) {
        activeExamName = examName;
        configExamTitle.textContent = `Configure Rules: ${examName}`;
        switchView("config");

        showLoader();
        try {
            // Load configuration rules
            const res = await apiRequest(`exam.config.load?examName=${encodeURIComponent(examName)}`);
            if (res.success && res.configs) {
                activeConfigs = res.configs;
                
                // Select default tab
                activeClassNum = "9";
                classTabs.forEach(t => {
                    t.classList.remove("active");
                    t.style.color = "var(--color-muted)";
                    t.style.borderBottomColor = "transparent";
                });
                const tab9 = Array.from(classTabs).find(t => t.dataset.class === "9");
                tab9.classList.add("active");
                tab9.style.color = "var(--color-primary)";
                tab9.style.borderBottomColor = "var(--color-primary)";

                await renderClassConfig();
            } else {
                showToast(res.error || "Failed to load rules.", "error");
                switchView("list");
            }
        } catch (err) {
            console.error(err);
            showToast("Error fetching configuration rules.", "error");
            switchView("list");
        } finally {
            hideLoader();
        }
    }

    async function renderClassConfig() {
        // 1. Populate Defaults
        const npDefault = activeConfigs.find(c => c.classNum === activeClassNum && c.subjectId === "DEFAULT_NON_PRACTICAL") || { theory: 100, practical: 0, internal: 0 };
        const pDefault = activeConfigs.find(c => c.classNum === activeClassNum && c.subjectId === "DEFAULT_PRACTICAL") || { theory: 80, practical: 20, internal: 0 };

        defaultNpTheory.value = npDefault.theory !== undefined ? npDefault.theory : "";
        defaultNpPractical.value = npDefault.practical !== undefined ? npDefault.practical : "";
        defaultNpInternal.value = npDefault.internal !== undefined ? npDefault.internal : "";

        defaultPTheory.value = pDefault.theory !== undefined ? pDefault.theory : "";
        defaultPPractical.value = pDefault.practical !== undefined ? pDefault.practical : "";
        defaultPInternal.value = pDefault.internal !== undefined ? pDefault.internal : "";

        // 2. Load subjects for this class if not in cache
        if (!classSubjects[activeClassNum]) {
            showLoader();
            try {
                const res = await apiRequest(`subject.tag.getDropdowns?classNum=${activeClassNum}`);
                if (res.success && res.subjects) {
                    classSubjects[activeClassNum] = res.subjects;
                } else {
                    classSubjects[activeClassNum] = [];
                }
            } catch (err) {
                console.error(err);
                classSubjects[activeClassNum] = [];
            } finally {
                hideLoader();
            }
        }

        // 3. Render subjects overrides table
        renderSubjectsOverridesTable();
    }

    function isPracticalSubject(subjectId) {
        const id = String(subjectId || "").toUpperCase();
        return [
            "_PHY", "_CHE", "_BIO", "_GEO", "_HSC", "_PSY", "_MUS", "_AGR", "_CSC", "_MWT", "_SCI", "_SST"
        ].some(suffix => id.endsWith(suffix));
    }

    function renderSubjectsOverridesTable() {
        const subjects = classSubjects[activeClassNum] || [];
        
        if (subjects.length === 0) {
            subjectOverridesTbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 24px; color: var(--color-muted);">
                        No subjects configuration found for this class.
                    </td>
                </tr>
            `;
            return;
        }

        subjectOverridesTbody.innerHTML = subjects.map(sub => {
            const isPrac = isPracticalSubject(sub.subjectId);
            
            // Check if there is an override
            const override = activeConfigs.find(c => c.classNum === activeClassNum && c.subjectId === sub.subjectId);
            const hasOverride = !!override;
            const rowClass = hasOverride ? 'class="has-override" style="background: rgba(79, 70, 229, 0.03);"' : '';

            // Derive default values for placeholders
            const defaults = isPrac ? 
                {
                    theory: defaultPTheory.value || 0,
                    practical: defaultPPractical.value || 0,
                    internal: defaultPInternal.value || 0
                } : {
                    theory: defaultNpTheory.value || 0,
                    practical: defaultNpPractical.value || 0,
                    internal: defaultNpInternal.value || 0
                };

            const tVal = hasOverride ? (override.theory !== undefined ? override.theory : "") : "";
            const pVal = hasOverride ? (override.practical !== undefined ? override.practical : "") : "";
            const iVal = hasOverride ? (override.internal !== undefined ? override.internal : "") : "";

            return `
                <tr ${rowClass} data-subject-id="${sub.subjectId}">
                    <td style="padding: 12px 16px; font-size: 0.9rem;">
                        <strong style="color: var(--color-text);">${sub.code}</strong>
                        <div style="font-size: 0.78rem; color: var(--color-muted); margin-top: 2px;">${sub.name}</div>
                    </td>
                    <td style="padding: 12px 16px;">
                        <input type="number" class="override-input override-theory" min="0" max="100" value="${tVal}" placeholder="${defaults.theory}" style="width: 100%; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.85rem; ${hasOverride ? "border-color: var(--color-primary);" : ""}">
                    </td>
                    <td style="padding: 12px 16px;">
                        <input type="number" class="override-input override-practical" min="0" max="100" value="${pVal}" placeholder="${defaults.practical}" style="width: 100%; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.85rem; ${hasOverride ? "border-color: var(--color-primary);" : ""}">
                    </td>
                    <td style="padding: 12px 16px;">
                        <input type="number" class="override-input override-internal" min="0" max="100" value="${iVal}" placeholder="${defaults.internal}" style="width: 100%; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.85rem; ${hasOverride ? "border-color: var(--color-primary);" : ""}">
                    </td>
                    <td style="padding: 12px 16px; text-align: right;">
                        <button class="btn btn-ghost revert-btn" style="padding: 4px 8px; font-size: 0.75rem; border: 1px solid var(--color-border); color: var(--color-muted); ${hasOverride ? "display: inline-flex; border-color: rgba(79,70,229,0.3); color: var(--color-primary);" : "display: none;"}">Revert</button>
                    </td>
                </tr>
            `;
        }).join("");

        // Setup input changes
        const overrideInputs = subjectOverridesTbody.querySelectorAll(".override-input");
        overrideInputs.forEach(input => {
            input.addEventListener("input", (e) => {
                const tr = e.target.closest("tr");
                const subId = tr.dataset.subjectId;
                
                const tInput = tr.querySelector(".override-theory");
                const pInput = tr.querySelector(".override-practical");
                const iInput = tr.querySelector(".override-internal");
                const revertBtn = tr.querySelector(".revert-btn");

                const tVal = tInput.value !== "" ? Number(tInput.value) : null;
                const pVal = pInput.value !== "" ? Number(pInput.value) : null;
                const iVal = iInput.value !== "" ? Number(iInput.value) : null;

                let row = activeConfigs.find(c => c.classNum === activeClassNum && c.subjectId === subId);

                if (tVal !== null || pVal !== null || iVal !== null) {
                    // Update or create override row
                    if (!row) {
                        row = { classNum: activeClassNum, subjectId: subId };
                        activeConfigs.push(row);
                    }
                    row.theory = tVal !== null ? tVal : 0;
                    row.practical = pVal !== null ? pVal : 0;
                    row.internal = iVal !== null ? iVal : 0;

                    // Style row
                    tr.style.background = "rgba(79, 70, 229, 0.03)";
                    tInput.style.borderColor = "var(--color-primary)";
                    pInput.style.borderColor = "var(--color-primary)";
                    iInput.style.borderColor = "var(--color-primary)";
                    revertBtn.style.display = "inline-flex";
                    revertBtn.style.borderColor = "rgba(79,70,229,0.3)";
                    revertBtn.style.color = "var(--color-primary)";
                } else {
                    // Clear override row
                    if (row) {
                        activeConfigs = activeConfigs.filter(c => !(c.classNum === activeClassNum && c.subjectId === subId));
                    }
                    tr.style.background = "none";
                    tInput.style.borderColor = "var(--color-border)";
                    pInput.style.borderColor = "var(--color-border)";
                    iInput.style.borderColor = "var(--color-border)";
                    revertBtn.style.display = "none";
                }
            });
        });

        // Setup revert button click
        const revertBtns = subjectOverridesTbody.querySelectorAll(".revert-btn");
        revertBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const tr = e.target.closest("tr");
                const subId = tr.dataset.subjectId;

                const tInput = tr.querySelector(".override-theory");
                const pInput = tr.querySelector(".override-practical");
                const iInput = tr.querySelector(".override-internal");

                tInput.value = "";
                pInput.value = "";
                iInput.value = "";

                // Remove override from list
                activeConfigs = activeConfigs.filter(c => !(c.classNum === activeClassNum && c.subjectId === subId));

                // Re-render styles
                tr.style.background = "none";
                tInput.style.borderColor = "var(--color-border)";
                pInput.style.borderColor = "var(--color-border)";
                iInput.style.borderColor = "var(--color-border)";
                btn.style.display = "none";
            });
        });

        // Filter initially if search query is already entered
        if (subjectSearchQuery) {
            filterSubjectRows();
        }
    }

    function updateSubjectTablePlaceholders() {
        const rows = subjectOverridesTbody.querySelectorAll("tr[data-subject-id]");
        rows.forEach(tr => {
            const subId = tr.dataset.subjectId;
            const isPrac = isPracticalSubject(subId);

            const defaults = isPrac ? 
                {
                    theory: defaultPTheory.value || 0,
                    practical: defaultPPractical.value || 0,
                    internal: defaultPInternal.value || 0
                } : {
                    theory: defaultNpTheory.value || 0,
                    practical: defaultNpPractical.value || 0,
                    internal: defaultNpInternal.value || 0
                };

            const tInput = tr.querySelector(".override-theory");
            const pInput = tr.querySelector(".override-practical");
            const iInput = tr.querySelector(".override-internal");

            if (tInput) tInput.placeholder = defaults.theory;
            if (pInput) pInput.placeholder = defaults.practical;
            if (iInput) iInput.placeholder = defaults.internal;
        });
    }

    function filterSubjectRows() {
        const rows = subjectOverridesTbody.querySelectorAll("tr[data-subject-id]");
        rows.forEach(tr => {
            const cellText = String(tr.innerText || "").toLowerCase();
            if (cellText.includes(subjectSearchQuery)) {
                tr.style.display = "table-row";
            } else {
                tr.style.display = "none";
            }
        });
    }
};
