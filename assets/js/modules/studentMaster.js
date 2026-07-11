"use strict";

import { showToast } from "../../../components/toast.js";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=17892929117";

const getDefaultAcademicYear = () => {
    const year = new Date().getFullYear();
    return `${year}-${String(year + 1).slice(-2)}`;
};

let rawStudents = [];

/**
 * Filter the loaded students in memory and render to the table.
 */
function applyFiltersAndRender() {
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

    const tbody = document.querySelector("#student-tbody");
    const countLabel = document.querySelector("#student-count");

    if (countLabel) {
        countLabel.textContent = filtered.length;
    }

    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 32px; color: var(--color-muted); font-weight: 500;">
                    No student records found matching your search.
                </td>
            </tr>`;
        return;
    }

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

/**
 * Initializes the Student Master module view.
 */
export async function initStudentMasterView() {
    try {
        renderNavbar(document.querySelector("#navbar-student-master"));

        const skeleton = document.querySelector("#skeleton-loader");
        const tableContainer = document.querySelector("#student-table-container");

        if (skeleton) skeleton.style.display = "block";
        if (tableContainer) tableContainer.style.display = "none";

        const academicYear = getDefaultAcademicYear();

        // 1. Fetch all student profiles from backend
        try {
            const response = await apiRequest(`student.master.load?academicYear=${academicYear}`);
            if (response.success && response.students) {
                rawStudents = response.students;
            } else {
                throw new Error(response.error || "Failed to load master student records.");
            }
        } catch (err) {
            console.error(err);
            showToast("Could not retrieve student list.", "error");
        } finally {
            if (skeleton) skeleton.style.display = "none";
            if (tableContainer) tableContainer.style.display = "block";
        }

        // 2. Wire filters listeners
        const classSelect = document.querySelector("#filter-class");
        const nameInput = document.querySelector("#search-name");
        const rollInput = document.querySelector("#search-roll");

        if (classSelect) {
            classSelect.addEventListener("change", applyFiltersAndRender);
        }
        if (nameInput) {
            nameInput.addEventListener("input", applyFiltersAndRender);
        }
        if (rollInput) {
            rollInput.addEventListener("input", applyFiltersAndRender);
        }

        // 3. Initial rendering
        applyFiltersAndRender();

    } catch (error) {
        console.error(error);
        showToast("Student Master view could not be initialized.", "error");
    }
}
