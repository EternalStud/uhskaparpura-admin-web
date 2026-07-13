"use strict";

import { showToast } from "../../../components/toast.js";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=17892929130";

const getDefaultAcademicYear = () => {
    const year = new Date().getFullYear();
    return `${year}-${String(year + 1).slice(-2)}`;
};

let rawStudents = [];
let isLoaded = false;

/**
 * Calculates and renders class-wise statistics for the loaded students.
 */
const calculateAndRenderStats = (students) => {
    const statsPanel = document.querySelector("#stats-panel");
    const gridContainer = document.querySelector("#stats-grid-container");
    if (!statsPanel || !gridContainer) return;

    if (students.length === 0) {
        statsPanel.style.display = "none";
        return;
    }

    const groups = {};

    students.forEach(s => {
        const cls = String(s.className || "").trim();
        const stream = String(s.stream || "").trim();
        const sec = String(s.section || "").trim();
        const gender = String(s.genderName || "").trim().toLowerCase();

        // Determine group key & display title
        let key = "";
        let displayTitle = "";
        
        if (cls === "9" || cls === "10") {
            key = `Class_${cls}`;
            displayTitle = `Class ${cls}`;
        } else {
            const streamStr = stream || "General";
            key = `Class_${cls}_${streamStr.replace(/\s+/g, "_")}`;
            displayTitle = `Class ${cls} - ${streamStr}`;
        }

        if (!groups[key]) {
            groups[key] = {
                title: displayTitle,
                classNum: cls,
                stream: stream,
                boys: 0,
                girls: 0,
                total: 0
            };
        }

        const g = groups[key];
        const isBoy = gender.startsWith("boy") || gender.startsWith("male") || gender === "m";
        const isGirl = gender.startsWith("girl") || gender.startsWith("female") || gender === "f";

        if (isBoy) {
            g.boys++;
        } else if (isGirl) {
            g.girls++;
        }
        g.total++;
    });

    // Sort: Class 9 -> Class 10 -> Class 11 -> Class 12
    const sortedKeys = Object.keys(groups).sort((a, b) => {
        const gA = groups[a];
        const gB = groups[b];
        
        const numA = Number(gA.classNum) || 0;
        const numB = Number(gB.classNum) || 0;
        
        if (numA !== numB) return numA - numB;
        
        const streamA = gA.stream || "";
        const streamB = gB.stream || "";
        return streamA.localeCompare(streamB);
    });

    gridContainer.innerHTML = sortedKeys.map(key => {
        const g = groups[key];
        return `
            <div style="background: rgba(79, 70, 229, 0.02); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px 16px; text-align: left;">
                <h4 style="margin: 0 0 10px 0; font-size: 0.9rem; font-weight: 700; color: var(--color-primary); border-bottom: 1px solid rgba(0,0,0,0.04); padding-bottom: 4px;">
                    ${g.title}
                </h4>
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; color: var(--color-text);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="display: flex; align-items: center; gap: 4px; color: var(--color-muted);"><span class="material-symbols-rounded" style="font-size: 0.95rem; color: #3B82F6;">man</span> Boys</span>
                        <strong style="font-weight: 700;">${g.boys}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="display: flex; align-items: center; gap: 4px; color: var(--color-muted);"><span class="material-symbols-rounded" style="font-size: 0.95rem; color: #EC4899;">woman</span> Girls</span>
                        <strong style="font-weight: 700;">${g.girls}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(0,0,0,0.06); padding-top: 4px; margin-top: 2px;">
                        <strong style="font-weight: 800;">Total</strong>
                        <strong style="font-weight: 800; color: var(--color-primary);">${g.total}</strong>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    statsPanel.style.display = "block";
};

/**
 * Filter the loaded students in memory and render to the table and mobile workspace.
 */
function applyFiltersAndRender() {
    const tbody = document.querySelector("#student-tbody");
    const mobileWorkspace = document.querySelector("#mobile-workspace");
    const countLabel = document.querySelector("#student-count");

    if (!isLoaded) {
        const statsPanel = document.querySelector("#stats-panel");
        if (statsPanel) statsPanel.style.display = "none";

        const placeholderHtml = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 48px; color: var(--color-muted); font-weight: 500;">
                    <span class="material-symbols-rounded" style="font-size: 2.5rem; display: block; margin-bottom: 12px; color: var(--color-primary);">info</span>
                    Please enter Academic Year and click "Go" to load student details.
                </td>
            </tr>`;
        if (tbody) tbody.innerHTML = placeholderHtml;

        const mobilePlaceholderHtml = `
            <div style="text-align: center; padding: 48px; color: var(--color-muted); font-weight: 500; width: 100%;">
                <span class="material-symbols-rounded" style="font-size: 2.5rem; display: block; margin-bottom: 12px; color: var(--color-primary);">info</span>
                Please enter Academic Year and click "Go" to load student details.
            </div>`;
        if (mobileWorkspace) mobileWorkspace.innerHTML = mobilePlaceholderHtml;

        if (countLabel) countLabel.textContent = "0";
        return;
    }

    const classFilter = document.querySelector("#filter-class")?.value || "";
    const nameSearch = document.querySelector("#search-name")?.value.trim().toLowerCase() || "";
    const rollSearch = document.querySelector("#search-roll")?.value.trim().toLowerCase() || "";

    const filtered = rawStudents.filter(student => {
        // 1. Class filter
        if (classFilter && String(student.className) !== classFilter) {
            return false;
        }

        // 2. Name search
        if (nameSearch && !student.studentName.toLowerCase().includes(nameSearch)) {
            return false;
        }

        // 3. Roll search
        if (rollSearch && !String(student.rollNo).toLowerCase().includes(rollSearch)) {
            return false;
        }

        return true;
    });

    if (countLabel) {
        countLabel.textContent = filtered.length;
    }

    // 1. Render Desktop Table
    if (tbody) {
        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 32px; color: var(--color-muted); font-weight: 500;">
                        No student records found matching your search.
                    </td>
                </tr>`;
        } else {
            tbody.innerHTML = filtered.map(student => {
                return `
                    <tr>
                        <td class="col-center" style="font-weight: 700;">${student.rollNo}</td>
                        <td style="font-weight: 600;">${student.studentName}</td>
                        <td>${student.fatherName}</td>
                        <td>${student.motherName}</td>
                        <td style="font-family: monospace;">${student.mobile}</td>
                        <td style="font-size: 0.85rem; color: var(--color-muted);">${student.address}</td>
                        <td class="col-center" style="font-weight: 600;">Class ${student.className}</td>
                        <td class="col-center">${student.section}</td>
                        <td>${student.stream || "-"}</td>
                    </tr>`;
            }).join("");
        }
    }

    // 2. Render Mobile Cards
    if (mobileWorkspace) {
        if (filtered.length === 0) {
            mobileWorkspace.innerHTML = `
                <div style="text-align: center; padding: 32px; color: var(--color-muted); font-weight: 500; width: 100%;">
                    No student records found matching your search.
                </div>`;
        } else {
            mobileWorkspace.innerHTML = filtered.map(student => {
                return `
                    <div class="student-mobile-card">
                        <div class="mobile-card-header">
                            <div class="mobile-card-meta">
                                <span class="mobile-card-roll" style="font-size: 0.75rem; font-weight: 700; color: var(--color-muted); text-transform: uppercase;">Roll No: ${student.rollNo}</span>
                                <span class="mobile-card-name" style="font-size: 0.95rem; font-weight: 600; color: var(--color-text); margin-top: 2px;">${student.studentName}</span>
                            </div>
                            <span class="badge badge-purple" style="background: rgba(79, 70, 229, 0.1); color: var(--color-primary); font-weight: 600; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">Class ${student.className}-${student.section}</span>
                        </div>
                        <div class="mobile-card-details" style="display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; color: var(--color-muted); margin-top: 8px;">
                            <div><strong>Father's Name:</strong> ${student.fatherName}</div>
                            <div><strong>Mother's Name:</strong> ${student.motherName}</div>
                            <div><strong>Mobile No:</strong> <span style="font-family: monospace;">${student.mobile}</span></div>
                            <div><strong>Address:</strong> ${student.address}</div>
                            ${student.stream ? `<div><strong>Stream:</strong> ${student.stream}</div>` : ''}
                        </div>
                    </div>`;
            }).join("");
        }
    }
}

/**
 * Initializes the Student Master module view.
 */
export async function initStudentMasterView() {
    try {
        renderNavbar(document.querySelector("#navbar-student-master"));

        const skeleton = document.querySelector("#skeleton-loader");
        const tableContainer = document.querySelector("#student-table-container");
        const mobileWorkspace = document.querySelector("#mobile-workspace");
        const academicYearInput = document.querySelector("#filter-academic-year");
        const btnGo = document.querySelector("#btn-go");

        // Clear state
        rawStudents = [];
        isLoaded = false;
        const statsPanel = document.querySelector("#stats-panel");
        if (statsPanel) statsPanel.style.display = "none";

        // Set default academic year
        if (academicYearInput) {
            academicYearInput.value = getDefaultAcademicYear();
        }

        if (skeleton) skeleton.style.display = "none";
        if (tableContainer) tableContainer.style.display = "block";
        if (mobileWorkspace) mobileWorkspace.style.display = "flex";

        // Initial rendering of placeholders
        applyFiltersAndRender();

        // Wire filters listeners
        const classSelect = document.querySelector("#filter-class");
        const nameInput = document.querySelector("#search-name");
        const rollInput = document.querySelector("#search-roll");

        if (classSelect) {
            classSelect.addEventListener("change", () => {
                if (isLoaded) applyFiltersAndRender();
            });
        }
        if (nameInput) {
            nameInput.addEventListener("input", () => {
                if (isLoaded) applyFiltersAndRender();
            });
        }
        if (rollInput) {
            rollInput.addEventListener("input", () => {
                if (isLoaded) applyFiltersAndRender();
            });
        }

        if (btnGo) {
            btnGo.onclick = async () => {
                const academicYear = academicYearInput?.value.trim();
                if (!academicYear) {
                    showToast("Please enter an Academic Year.", "error");
                    return;
                }

                if (skeleton) skeleton.style.display = "block";
                if (tableContainer) tableContainer.style.display = "none";
                if (mobileWorkspace) mobileWorkspace.style.display = "none";

                try {
                    const response = await apiRequest(`student.master.load?academicYear=${academicYear}`);
                    if (response.success && response.students) {
                        rawStudents = response.students;
                        isLoaded = true;
                        showToast(`Successfully loaded ${rawStudents.length} student records.`, "success");
                    } else {
                        throw new Error(response.error || "Failed to load master student records.");
                    }
                } catch (err) {
                    console.error(err);
                    showToast("Could not retrieve student list.", "error");
                } finally {
                    if (skeleton) skeleton.style.display = "none";
                    if (tableContainer) tableContainer.style.display = "block";
                    if (mobileWorkspace) mobileWorkspace.style.display = "flex";
                    calculateAndRenderStats(rawStudents);
                    applyFiltersAndRender();
                }
            };
        }

    } catch (error) {
        console.error(error);
        showToast("Student Master view could not be initialized.", "error");
    }
}
