"use strict";

import { showToast } from "../../../components/toast.js";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=17892929117";

const getDefaultAcademicYear = () => {
    const year = new Date().getFullYear();
    return `${year}-${String(year + 1).slice(-2)}`;
};

let rawStudents = [];
let isLoaded = false;

/**
 * Filter the loaded students in memory and render to the table and mobile workspace.
 */
function applyFiltersAndRender() {
    const tbody = document.querySelector("#student-tbody");
    const mobileWorkspace = document.querySelector("#mobile-workspace");
    const countLabel = document.querySelector("#student-count");

    if (!isLoaded) {
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
                    applyFiltersAndRender();
                }
            };
        }

    } catch (error) {
        console.error(error);
        showToast("Student Master view could not be initialized.", "error");
    }
}
