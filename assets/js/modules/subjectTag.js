"use strict";

import { showToast } from "../../../components/toast.js";
import { showLoader, hideLoader } from "../../../components/loader.js";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js";

// Local state variables
let dropdownSubjects = [];  // All available subjects for selected class & stream
let studentsList = [];      // Raw loaded student list
let studentsState = [];     // Unified state tracking loaded students
let currentFilters = {};    // Currently active filters

const getDefaultAcademicYear = () => {
    const year = new Date().getFullYear();
    return `${year}-${String(year + 1).slice(-2)}`;
};

/**
 * Checks and updates the visibility of the Stream filter.
 */
const updateStreamFilterVisibility = (classVal) => {
    const streamContainer = document.querySelector("#stream-filter-container");
    const streamSelect = document.querySelector("#filter-stream");
    
    if (classVal === "11" || classVal === "12") {
        streamContainer.style.display = "flex";
        streamSelect.setAttribute("required", "required");
    } else {
        streamContainer.style.display = "none";
        streamSelect.removeAttribute("required");
        streamSelect.value = "";
    }
};

/**
 * Dynamically queries available sections for the selected year and class.
 */
const updateAvailableSections = async () => {
    const yearInput = document.querySelector("#filter-academic-year");
    const classSelect = document.querySelector("#filter-class");
    const sectionSelect = document.querySelector("#filter-section");

    if (!yearInput || !classSelect || !sectionSelect) return;

    const year = String(yearInput.value || "").trim();
    const classNum = String(classSelect.value || "").trim();

    if (!year || !classNum) {
        sectionSelect.innerHTML = '<option value="">Select Section</option>';
        return;
    }

    try {
        const response = await apiRequest(`subject.tag.getSections?academicYear=${year}&classNum=${classNum}`);
        if (response.success && response.sections) {
            sectionSelect.innerHTML = '<option value="">Select Section</option>';
            response.sections.forEach(sec => {
                sectionSelect.innerHTML += `<option value="${sec}">Section ${sec}</option>`;
            });
            
            if (response.sections.length === 0) {
                sectionSelect.innerHTML = '<option value="">No sections available</option>';
            } else {
                // Default selection to "A" if present, otherwise default to first option
                if (response.sections.includes("A")) {
                    sectionSelect.value = "A";
                } else {
                    sectionSelect.value = response.sections[0];
                }
            }
        }
    } catch (error) {
        console.error("Failed to load sections:", error);
        sectionSelect.innerHTML = '<option value="">Error loading sections</option>';
    }
};

/**
 * Strict evaluation of subject combination rules for each student.
 */
const validateStudent = (student, classNum) => {
    const errors = { l1: "", l2: "", e1: "", e2: "", e3: "", add: "" };
    const isSrSec = Number(classNum) >= 11;
    const { l1, l2, e1, e2, e3, add } = student.current;
    
    const getSubjName = (id) => {
        const found = dropdownSubjects.find(s => s.subjectId === id);
        return found ? found.name : "";
    };

    const l1Name = getSubjName(l1);
    const l2Name = getSubjName(l2);
    const e1Name = isSrSec ? getSubjName(e1) : "";
    const e2Name = isSrSec ? getSubjName(e2) : "";
    const e3Name = isSrSec ? getSubjName(e3) : "";
    const addName = isSrSec ? getSubjName(add) : "";

    // 1. Logic violations (only validate when selections are populated to prevent empty inputs triggering errors)
    if (l1 && l2) {
        if (Number(classNum) <= 10) {
            if (l1 === l2) {
                errors.l1 = errors.l2 = "Language 1 and Language 2 cannot be identical.";
            } else if (l1.endsWith("_HIN") && l2.endsWith("_HNL")) {
                errors.l2 = "NLH Hindi is blocked if Hindi L1 is selected.";
            }
        } else {
            if (l1Name === l2Name) {
                errors.l1 = errors.l2 = `Language 1 and Language 2 cannot be the same subject (${l1Name}).`;
            }
        }
    }

    if (isSrSec) {
        const electives = [
            { field: "e1", name: e1Name },
            { field: "e2", name: e2Name },
            { field: "e3", name: e3Name }
        ].filter(x => x.name);

        // Check elective uniqueness
        for (let i = 0; i < electives.length; i++) {
            for (let j = i + 1; j < electives.length; j++) {
                if (electives[i].name === electives[j].name) {
                    errors[electives[i].field] = errors[electives[j].field] = `Electives must be distinct subjects (${electives[i].name}).`;
                }
            }
        }

        // Check additional uniqueness
        if (add && addName) {
            const mains = [
                { field: "l1", name: l1Name },
                { field: "l2", name: l2Name },
                { field: "e1", name: e1Name },
                { field: "e2", name: e2Name },
                { field: "e3", name: e3Name }
            ].filter(x => x.name);

            mains.forEach(m => {
                if (m.name === addName) {
                    errors.add = `Additional subject cannot duplicate ${m.field.toUpperCase()} (${addName}).`;
                }
            });
        }
    }

    // 2. Track complete states
    const isComplete = Boolean(l1 && l2 && (!isSrSec || (e1 && e2 && e3)));

    student.errors = errors;
    student.hasError = Object.values(errors).some(err => err !== "");
    student.isComplete = isComplete && !student.hasError;
    student.isValid = student.isComplete; // A student is valid if they are complete and have no errors
    student.isChanged = (
        student.original.l1 !== l1 ||
        student.original.l2 !== l2 ||
        student.original.e1 !== e1 ||
        student.original.e2 !== e2 ||
        student.original.e3 !== e3 ||
        student.original.add !== add
    );
};

/**
 * Calculates statistics and completion progress.
 */
const updateStatsAndProgress = () => {
    const total = studentsState.length;
    let completed = 0;
    let pending = 0;
    let changedCount = 0;

    studentsState.forEach(s => {
        if (s.isValid) {
            completed++;
        } else {
            pending++;
        }
        if (s.isChanged) {
            changedCount++;
        }
    });

    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Update stats counters
    document.querySelector("#stat-total").textContent = total;
    document.querySelector("#stat-completed").textContent = completed;
    document.querySelector("#stat-pending").textContent = pending;
    document.querySelector("#stat-rate").textContent = `${rate}%`;

    // Update progress bar
    document.querySelector("#progress-text").textContent = `${completed} of ${total} students completed`;
    document.querySelector("#progress-bar-fill").style.width = `${rate}%`;

    // Update minimalist stats summary
    const summaryContainer = document.querySelector("#stats-summary-text-container");
    if (summaryContainer) {
        if (changedCount > 0) {
            summaryContainer.innerHTML = `${total} Students <span class="divider">|</span> <span style="color: var(--color-warning); font-weight: 600;">${changedCount} Unsaved Changes</span>`;
        } else {
            summaryContainer.textContent = `${total} Students`;
        }
    }

    // Update save header actions
    const unsavedIndicator = document.querySelector("#unsaved-indicator");
    const saveBtn = document.querySelector("#save-all-btn");

    if (saveBtn) {
        if (changedCount > 0) {
            if (saveBtn.textContent !== "Saving..." && saveBtn.textContent !== "Saved ✓") {
                saveBtn.textContent = `Save (${changedCount})`;
            }
            saveBtn.removeAttribute("disabled");
            if (unsavedIndicator) unsavedIndicator.style.display = "inline-flex";
        } else {
            if (saveBtn.textContent !== "Saving..." && saveBtn.textContent !== "Saved ✓") {
                saveBtn.textContent = "Save";
            }
            saveBtn.setAttribute("disabled", "disabled");
            if (unsavedIndicator) unsavedIndicator.style.display = "none";
        }
    }
};

/**
 * Returns options list for a specific field based on validations.
 */
const getFieldOptions = (student, fieldName, classNum) => {
    const isSrSec = Number(classNum) >= 11;
    const { l1, l2, e1, e2, e3 } = student.current;

    const getSubjName = (id) => {
        const found = dropdownSubjects.find(s => s.subjectId === id);
        return found ? found.name : "";
    };

    const l1Name = getSubjName(l1);
    const e1Name = getSubjName(e1);
    const e2Name = getSubjName(e2);
    const e3Name = getSubjName(e3);

    if (fieldName === "l1") {
        return dropdownSubjects.filter(s => s.group === "Language 1");
    }
    
    if (fieldName === "l2") {
        const l2All = dropdownSubjects.filter(s => s.group === "Language 2");
        if (Number(classNum) <= 10) {
            const isL1Hindi = l1.endsWith("_HIN");
            return l2All.filter(s => {
                if (isL1Hindi && s.subjectId.endsWith("_HNL")) return false;
                return s.subjectId !== l1;
            });
        } else {
            return l2All.filter(s => s.name !== l1Name);
        }
    }

    if (fieldName === "e1") {
        const eAll = dropdownSubjects.filter(s => s.group === "Elective");
        return eAll.filter(s => s.name !== e2Name && s.name !== e3Name);
    }
    if (fieldName === "e2") {
        const eAll = dropdownSubjects.filter(s => s.group === "Elective");
        return eAll.filter(s => s.name !== e1Name && s.name !== e3Name);
    }
    if (fieldName === "e3") {
        const eAll = dropdownSubjects.filter(s => s.group === "Elective");
        return eAll.filter(s => s.name !== e1Name && s.name !== e2Name);
    }

    if (fieldName === "add") {
        const selectedNames = [
            l1Name,
            getSubjName(l2),
            e1Name,
            e2Name,
            e3Name
        ].filter(Boolean);
        return dropdownSubjects.filter(s => s.group === "Additional" && !selectedNames.includes(s.name));
    }

    return [];
};

/**
 * Creates custom select component layout trigger using native select.
 */
const renderSelectTrigger = (containerEl, student, fieldName, classNum) => {
    containerEl.innerHTML = "";
    
    const value = student.current[fieldName];
    const isError = student.errors[fieldName] !== "";
    containerEl.classList.toggle("dropdown-error", isError);

    const selectEl = document.createElement("select");
    selectEl.className = "custom-select-trigger";
    
    if (isError) {
        selectEl.title = student.errors[fieldName];
    }

    const options = getFieldOptions(student, fieldName, classNum);

    // If it's the "additional" field, we add a "None" option at the top
    if (fieldName === "add") {
        const optEl = document.createElement("option");
        optEl.value = "";
        optEl.textContent = "None";
        selectEl.appendChild(optEl);
    } else if (options.length > 0 && value === "") {
        // If there's no selected value, show a placeholder option
        const optEl = document.createElement("option");
        optEl.value = "";
        optEl.textContent = `Select ${fieldName.toUpperCase()}`;
        optEl.disabled = true;
        optEl.selected = true;
        selectEl.appendChild(optEl);
    }

    options.forEach((opt) => {
        const optEl = document.createElement("option");
        optEl.value = opt.subjectId;
        optEl.textContent = `${opt.name} (${opt.code})`;
        if (opt.subjectId === value) {
            optEl.selected = true;
        }
        selectEl.appendChild(optEl);
    });

    // Disable if there are no options available (not editable)
    if (options.length === 0) {
        selectEl.setAttribute("disabled", "disabled");
        // Add a "None" or placeholder so it's not empty
        const optEl = document.createElement("option");
        optEl.value = "";
        optEl.textContent = fieldName === "add" ? "None" : "N/A";
        selectEl.appendChild(optEl);
    }

    selectEl.addEventListener("change", (e) => {
        handleValueChange(student.studentId, fieldName, e.target.value);
    });

    containerEl.appendChild(selectEl);
};

/**
 * Handle state updates and selective row/card updates.
 */
const handleValueChange = (studentId, fieldName, newValue) => {
    const student = studentsState.find(s => s.studentId === studentId);
    if (!student) return;

    student.current[fieldName] = newValue;
    updateStudentDOM(studentId);
};

/**
 * Performs selective update on target table row and mobile card.
 */
const updateStudentDOM = (studentId) => {
    const student = studentsState.find(s => s.studentId === studentId);
    if (!student) return;

    const classNum = currentFilters.classNum;
    validateStudent(student, classNum);

    // 1. Update Desktop Row
    const tr = document.querySelector(`tr[data-student-id="${studentId}"]`);
    if (tr) {
        // Update status badge
        const badge = tr.querySelector(".row-status");
        updateStatusBadge(badge, student);

        // Re-render select triggers
        renderSelectTrigger(tr.querySelector(".td-l1"), student, "l1", classNum);
        renderSelectTrigger(tr.querySelector(".td-l2"), student, "l2", classNum);
        if (Number(classNum) >= 11) {
            renderSelectTrigger(tr.querySelector(".td-e1"), student, "e1", classNum);
            renderSelectTrigger(tr.querySelector(".td-e2"), student, "e2", classNum);
            renderSelectTrigger(tr.querySelector(".td-e3"), student, "e3", classNum);
            renderSelectTrigger(tr.querySelector(".td-add"), student, "add", classNum);
        }
    }

    // 2. Update Mobile Card
    const card = document.querySelector(`.student-mobile-card[data-student-id="${studentId}"]`);
    if (card) {
        // Update status badge
        const badge = card.querySelector(".row-status");
        updateStatusBadge(badge, student);

        // Re-render select triggers
        renderSelectTrigger(card.querySelector(".mc-l1"), student, "l1", classNum);
        renderSelectTrigger(card.querySelector(".mc-l2"), student, "l2", classNum);
        if (Number(classNum) >= 11) {
            renderSelectTrigger(card.querySelector(".mc-e1"), student, "e1", classNum);
            renderSelectTrigger(card.querySelector(".mc-e2"), student, "e2", classNum);
            renderSelectTrigger(card.querySelector(".mc-e3"), student, "e3", classNum);
            renderSelectTrigger(card.querySelector(".mc-add"), student, "add", classNum);
        }
    }

    // Update overall counts
    updateStatsAndProgress();
};

/**
 * Helper to style status badges.
 */
const updateStatusBadge = (badgeEl, student) => {
    if (!badgeEl) return;
    
    let text = "Pending";
    let css = "badge-status badge-pending";

    if (student.hasError) {
        text = "Error";
        css = "badge-status badge-error";
    } else if (student.isChanged) {
        text = "Unsaved";
        css = "badge-status badge-unsaved";
    } else if (student.isComplete) {
        text = "Completed";
        css = "badge-status badge-completed";
    }

    badgeEl.className = css;
    badgeEl.textContent = text;

    // Detail tooltip if error exists
    const errorMsg = Object.values(student.errors).filter(Boolean).join(" ");
    badgeEl.title = errorMsg || text;
};



/**
 * Full redraw of workspace data for loaded state.
 */
const renderWorkspaceData = () => {
    const classNum = currentFilters.classNum;
    const isSrSec = Number(classNum) >= 11;

    // 1. Desktop Render
    const desktopTbody = document.querySelector("#desktop-table-body");
    desktopTbody.innerHTML = "";

    // Toggle desktop table header elective columns
    const electiveHeaders = document.querySelectorAll(".elective-col");
    electiveHeaders.forEach(el => el.style.display = isSrSec ? "table-cell" : "none");
    const additionalHeaders = document.querySelectorAll(".additional-col");
    additionalHeaders.forEach(el => el.style.display = isSrSec ? "table-cell" : "none");

    // 2. Mobile Render
    const mobileWorkspace = document.querySelector("#mobile-workspace");
    mobileWorkspace.innerHTML = "";

    studentsState.forEach((student) => {
        // Build Desktop Table Row
        const tr = document.createElement("tr");
        tr.dataset.studentId = student.studentId;

        tr.innerHTML = `
            <td class="col-sticky col-roll"><strong>${student.rollNo}</strong></td>
            <td class="col-sticky col-name">${student.studentName}</td>
            <td><div style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${student.fatherName || "—"}</div></td>
            <td class="td-l1"><div class="custom-select-container"></div></td>
            <td class="td-l2"><div class="custom-select-container"></div></td>
        `;

        if (isSrSec) {
            tr.innerHTML += `
                <td class="td-e1"><div class="custom-select-container"></div></td>
                <td class="td-e2"><div class="custom-select-container"></div></td>
                <td class="td-e3"><div class="custom-select-container"></div></td>
                <td class="td-add"><div class="custom-select-container"></div></td>
            `;
        }

        tr.innerHTML += `
            <td class="col-center"><span class="row-status">Pending</span></td>
        `;

        desktopTbody.appendChild(tr);

        // Initialize Desktop Select Triggers
        renderSelectTrigger(tr.querySelector(".td-l1"), student, "l1", classNum);
        renderSelectTrigger(tr.querySelector(".td-l2"), student, "l2", classNum);
        if (isSrSec) {
            renderSelectTrigger(tr.querySelector(".td-e1"), student, "e1", classNum);
            renderSelectTrigger(tr.querySelector(".td-e2"), student, "e2", classNum);
            renderSelectTrigger(tr.querySelector(".td-e3"), student, "e3", classNum);
            renderSelectTrigger(tr.querySelector(".td-add"), student, "add", classNum);
        }

        // Build Mobile Student Card
        const card = document.createElement("div");
        card.className = "student-mobile-card";
        card.dataset.studentId = student.studentId;

        card.innerHTML = `
            <div class="mobile-card-header">
                <div class="mobile-card-meta">
                    <span class="mobile-card-roll">Roll No: ${student.rollNo}</span>
                    <span class="mobile-card-name">${student.studentName}</span>
                    <span class="mobile-card-father">Father: ${student.fatherName || "—"}</span>
                </div>
                <span class="row-status">Pending</span>
            </div>

            <div class="mobile-card-fields">
                <div class="mobile-field-group">
                    <span class="mobile-field-label">Language 1</span>
                    <div class="mc-l1"><div class="custom-select-container"></div></div>
                </div>
                <div class="mobile-field-group">
                    <span class="mobile-field-label">Language 2</span>
                    <div class="mc-l2"><div class="custom-select-container"></div></div>
                </div>
                ${isSrSec ? `
                <div class="mobile-field-group">
                    <span class="mobile-field-label">Elective 1</span>
                    <div class="mc-e1"><div class="custom-select-container"></div></div>
                </div>
                <div class="mobile-field-group">
                    <span class="mobile-field-label">Elective 2</span>
                    <div class="mc-e2"><div class="custom-select-container"></div></div>
                </div>
                <div class="mobile-field-group">
                    <span class="mobile-field-label">Elective 3</span>
                    <div class="mc-e3"><div class="custom-select-container"></div></div>
                </div>
                <div class="mobile-field-group">
                    <span class="mobile-field-label">Additional</span>
                    <div class="mc-add"><div class="custom-select-container"></div></div>
                </div>
                ` : ""}
            </div>
        `;

        mobileWorkspace.appendChild(card);

        // Initialize Mobile Select Triggers
        renderSelectTrigger(card.querySelector(".mc-l1"), student, "l1", classNum);
        renderSelectTrigger(card.querySelector(".mc-l2"), student, "l2", classNum);
        if (isSrSec) {
            renderSelectTrigger(card.querySelector(".mc-e1"), student, "e1", classNum);
            renderSelectTrigger(card.querySelector(".mc-e2"), student, "e2", classNum);
            renderSelectTrigger(card.querySelector(".mc-e3"), student, "e3", classNum);
            renderSelectTrigger(card.querySelector(".mc-add"), student, "add", classNum);
        }

        // Apply status formatting
        validateStudent(student, classNum);
        updateStatusBadge(tr.querySelector(".row-status"), student);
        updateStatusBadge(card.querySelector(".row-status"), student);
    });

    updateStatsAndProgress();
};

/**
 * Handle student loading process.
 */
const handleLoadStudents = async () => {
    const yearInput = document.querySelector("#filter-academic-year");
    const classSelect = document.querySelector("#filter-class");
    const sectionSelect = document.querySelector("#filter-section");
    const streamSelect = document.querySelector("#filter-stream");

    const academicYear = String(yearInput.value || "").trim();
    const classNum = String(classSelect.value || "").trim();
    const section = String(sectionSelect.value || "").trim();
    const stream = String(streamSelect.value || "").trim();

    if (!academicYear) {
        showToast("Academic Year is required.", "error");
        return;
    }
    if (!classNum) {
        showToast("Class is required.", "error");
        return;
    }
    if (!section) {
        showToast("Section is required.", "error");
        return;
    }
    if ((classNum === "11" || classNum === "12") && !stream) {
        showToast("Stream is required for class 11 and 12.", "error");
        return;
    }

    const emptyState = document.querySelector("#subject-tag-empty-state");
    const desktopWorkspace = document.querySelector("#desktop-workspace");
    const mobileWorkspace = document.querySelector("#mobile-workspace");
    const statsProgressSec = document.querySelector("#stats-progress-section");
    const searchContainer = document.querySelector("#student-search-container");
    const tableToggle = document.querySelector("#mobile-table-toggle");
    const toggleBtn = document.querySelector("#mobile-show-table-toggle");
    const loadingSkeleton = document.querySelector("#subject-tag-loading");
    const saveBtn = document.querySelector("#save-all-btn");

    emptyState.style.display = "none";
    desktopWorkspace.style.display = "none";
    mobileWorkspace.style.display = "none";
    statsProgressSec.style.display = "none";
    if (searchContainer) searchContainer.style.display = "none";
    if (tableToggle) tableToggle.style.display = "none";
    if (toggleBtn) toggleBtn.textContent = "Show Table View";
    desktopWorkspace.classList.remove("force-show-mobile");
    loadingSkeleton.style.display = "block";
    saveBtn.setAttribute("disabled", "disabled");

    try {
        currentFilters = { academicYear, classNum, section, stream };

        // 1. Fetch valid subjects for the dropdowns
        const dropResponse = await apiRequest(`subject.tag.getDropdowns?classNum=${classNum}&stream=${stream}`);
        if (!dropResponse.success) {
            throw new Error(dropResponse.error || "Failed to load subjects configuration.");
        }
        dropdownSubjects = dropResponse.subjects || [];

        // 2. Fetch student list with saved subject tags
        const queryParams = new URLSearchParams({
            academicYear,
            classNum,
            section,
            stream
        });
        const stuResponse = await apiRequest(`subject.tag.loadStudents?${queryParams.toString()}`);
        if (!stuResponse.success) {
            throw new Error(stuResponse.error || "Failed to load student records.");
        }
        
        studentsList = stuResponse.students || [];

        // 3. Initialize Unified State Array
        studentsState = studentsList.map(s => {
            const initialVal = {
                l1: s.language1 || "",
                l2: s.language2 || "",
                e1: s.elective1 || "",
                e2: s.elective2 || "",
                e3: s.elective3 || "",
                add: s.additional || ""
            };
            return {
                studentId: s.studentId,
                rollNo: s.rollNo,
                studentName: s.studentName,
                fatherName: s.fatherName,
                original: { ...initialVal },
                current: { ...initialVal },
                errors: { l1: "", l2: "", e1: "", e2: "", e3: "", add: "" },
                isValid: false,
                isChanged: false
            };
        });

        // 4. Render Layouts
        if (studentsState.length === 0) {
            emptyState.style.display = "flex";
            showToast("No student records found matching filters.", "warning");
        } else {
            desktopWorkspace.style.display = "";
            mobileWorkspace.style.display = "";
            statsProgressSec.style.display = "flex";
            if (searchContainer) {
                searchContainer.style.display = "";
                const searchInput = document.querySelector("#student-search-input");
                if (searchInput) searchInput.value = ""; // Reset search
            }
            if (tableToggle) tableToggle.style.display = "";
            
            renderWorkspaceData();
            showToast(`Loaded ${studentsState.length} students.`, "success");
        }
    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
        emptyState.style.display = "flex";
    } finally {
        loadingSkeleton.style.display = "none";
    }
};

/**
 * Handle saving subject tag records.
 * Only saves modified rows.
 */
const handleSaveAll = async () => {
    const saveBtn = document.querySelector("#save-all-btn");
    const classNum = currentFilters.classNum;

    // Check active logic validation errors across all records
    const errorStudent = studentsState.find(s => s.hasError);
    if (errorStudent) {
        showToast(`Please resolve validation errors for student ${errorStudent.studentName} (Roll ${errorStudent.rollNo}) before saving.`, "error");
        return;
    }

    // Only submit changed records
    const changedStudents = studentsState.filter(s => s.isChanged);
    if (changedStudents.length === 0) {
        showToast("No changes detected to save.", "warning");
        return;
    }

    // Ensure all changed records are fully complete before saving
    const incompleteChanged = changedStudents.find(s => !s.isComplete);
    if (incompleteChanged) {
        showToast(`Please complete all required subject selections for student ${incompleteChanged.studentName} (Roll ${incompleteChanged.rollNo}) before saving.`, "error");
        return;
    }

    const payload = changedStudents.map(s => ({
        studentId: s.studentId,
        academicYear: currentFilters.academicYear,
        classNum: Number(classNum),
        section: currentFilters.section,
        stream: currentFilters.stream || "",
        language1: s.current.l1,
        language2: s.current.l2,
        elective1: s.current.e1,
        elective2: s.current.e2,
        elective3: s.current.e3,
        additional: s.current.add
    }));

    saveBtn.textContent = "Saving...";
    saveBtn.setAttribute("disabled", "disabled");

    try {
        const response = await apiRequest("subject.tag.save", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (!response.success) {
            throw new Error(response.error || "Failed to save subject assignments.");
        }

        saveBtn.textContent = "Saved ✓";
        
        // Reload student records to refresh originally loaded values state
        await handleLoadStudents();

        setTimeout(() => {
            if (saveBtn.textContent === "Saved ✓") {
                saveBtn.textContent = "Save";
            }
        }, 2000);
    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
        saveBtn.textContent = "Save";
        saveBtn.removeAttribute("disabled");
    }
};

/**
 * Initializes the subject tagging view panel.
 */
export async function initSubjectTagView() {
    try {
        renderNavbar(document.querySelector("#navbar-subject-tag"));
        
        // Initialize default academic year value
        const yearInput = document.querySelector("#filter-academic-year");
        if (yearInput) {
            yearInput.value = getDefaultAcademicYear();
        }

        // Dropdown listeners to dynamically query sections
        const classSelect = document.querySelector("#filter-class");
        if (classSelect) {
            classSelect.addEventListener("change", (e) => {
                updateStreamFilterVisibility(e.target.value);
                updateAvailableSections();
            });
        }
        if (yearInput) {
            yearInput.addEventListener("change", updateAvailableSections);
            yearInput.addEventListener("blur", updateAvailableSections);
        }

        // Button click bindings
        document.querySelector("#load-students-btn")?.addEventListener("click", handleLoadStudents);
        document.querySelector("#save-all-btn")?.addEventListener("click", handleSaveAll);

        // Search input binding
        document.querySelector("#student-search-input")?.addEventListener("input", (e) => {
            const query = String(e.target.value || "").trim().toLowerCase();
            const rows = document.querySelectorAll("#desktop-table-body tr");
            const cards = document.querySelectorAll("#mobile-workspace .student-mobile-card");

            rows.forEach(row => {
                const name = String(row.querySelector(".col-name")?.textContent || "").toLowerCase();
                const roll = String(row.querySelector(".col-roll")?.textContent || "").toLowerCase();
                const matches = name.includes(query) || roll.includes(query);
                row.style.display = matches ? "" : "none";
            });

            cards.forEach(card => {
                const name = String(card.querySelector(".mobile-card-name")?.textContent || "").toLowerCase();
                const roll = String(card.querySelector(".mobile-card-roll")?.textContent || "").toLowerCase();
                const matches = name.includes(query) || roll.includes(query);
                card.style.display = matches ? "" : "none";
            });
        });

        // Mobile show table view toggle binding
        const toggleBtn = document.querySelector("#mobile-show-table-toggle");
        toggleBtn?.addEventListener("click", () => {
            const desktopWorkspace = document.querySelector("#desktop-workspace");
            if (desktopWorkspace) {
                const isHidden = !desktopWorkspace.classList.contains("force-show-mobile");
                if (isHidden) {
                    desktopWorkspace.classList.add("force-show-mobile");
                    toggleBtn.textContent = "Hide Table View";
                } else {
                    desktopWorkspace.classList.remove("force-show-mobile");
                    toggleBtn.textContent = "Show Table View";
                }
            }
        });

        // Run section lookup initially
        updateAvailableSections();

    } catch (error) {
        console.error(error);
        showToast("Failed to initialize subject tagging view.", "error");
    }
}
