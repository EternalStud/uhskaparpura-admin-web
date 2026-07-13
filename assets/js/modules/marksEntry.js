"use strict";

import { showToast } from "../../../components/toast.js";
import { showLoader, hideLoader, showLocalLoader, hideLocalLoader } from "../../../components/loader.js";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=17892929125";

// Local state variables
let dropdownSubjects = [];  // Available subjects for selected class & stream
let studentsState = [];     // State tracking loaded students and their marks
let currentFilters = {};    // Active filters
let maxMarks = { theory: 100, practical: 0, internal: 0 }; // Maximum marks config
let isExamLockedForTeacher = false; // Lock flag based on system settings

/**
 * Enforces numeric keypress and maximum value restrictions on a mark input field.
 */
const enforceMarkInputRules = (input, max) => {
    if (max === 0) return;

    let lastValidValue = input.value;

    const validateAndNormalize = (val) => {
        let s = String(val).trim();
        if (s === "") return { valid: true, val: "" };
        if (s.toUpperCase() === "A") return { valid: true, val: "A" };
        if (!/^\d+$/.test(s)) return { valid: false };
        
        const num = Number(s);
        if (num < 0 || num > max) return { valid: false };
        return { valid: true, val: num };
    };

    input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" || e.key === "Delete" || e.key === "Tab" || e.key === "Escape" || e.key === "Enter" || 
            e.key === "ArrowLeft" || e.key === "ArrowRight" || e.ctrlKey || e.metaKey) {
            return;
        }

        const isDigit = /^[0-9]$/.test(e.key);
        const isA = e.key === "a" || e.key === "A";

        if (!isDigit && !isA) {
            e.preventDefault();
        }
    });

    input.addEventListener("input", () => {
        let rawVal = input.value;
        if (rawVal.toLowerCase() === "a") {
            rawVal = "A";
            input.value = "A";
        }

        const res = validateAndNormalize(rawVal);
        if (res.valid) {
            lastValidValue = rawVal;
        } else {
            input.value = lastValidValue;
        }
    });
};

const getDefaultAcademicYear = () => {
    const year = new Date().getFullYear();
    return `${year}-${String(year + 1).slice(-2)}`;
};

/**
 * Derives maximum BSEB marks for theory/practical/internal based on class, subject code, and exam.
 */
const deriveMaxMarks = (classNum, subjectId, examName = "Annual") => {
    const cls = Number(classNum);
    const id = String(subjectId || "").toUpperCase();
    const exam = String(examName || "").trim();

    // Defaults
    let theory = 100;
    let practical = 0;
    let internal = 0;

    if (exam === "Trimester") {
        return { theory: 80, practical: 0, internal: 0 };
    }

    if (cls <= 10) {
        // Classes 9 & 10
        if (exam === "Half yearly") {
            return { theory: 80, practical: 0, internal: 0 };
        } else {
            // Annual & Sent-up
            if (id.endsWith("_SCI") || id.endsWith("_SST")) {
                theory = 80;
                practical = 20; // BSEB internal/practicals
            }
        }
    } else {
        // Classes 11 & 12
        if (exam === "Half yearly") {
            return { theory: 100, practical: 0, internal: 0 };
        } else {
            // Annual & Sent-up
            // Science electives with practicals
            const hasPracticalArtsOrSci = [
                "_PHY", "_CHE", "_BIO", "_GEO", "_HSC", "_PSY", "_MUS", "_AGR", "_CSC", "_MWT"
            ].some(suffix => id.endsWith(suffix));

            if (hasPracticalArtsOrSci) {
                theory = 70;
                practical = 30;
            }
        }
    }

    return { theory, practical, internal };
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

    const cacheKey = `${year}_${classNum}`;
    if (metadataCache.sections[cacheKey]) {
        renderSections(metadataCache.sections[cacheKey]);
        return;
    }

    showLocalLoader('#filter-section');
    try {
        const response = await apiRequest(`subject.tag.getSections?academicYear=${year}&classNum=${classNum}`);
        if (response.success && response.sections) {
            metadataCache.sections[cacheKey] = response.sections;
            renderSections(response.sections);
        }
    } catch (error) {
        console.error("Failed to load sections:", error);
    } finally {
        hideLocalLoader('#filter-section');
    }

    function renderSections(sections) {
        sectionSelect.innerHTML = '<option value="">Select Section</option>';
        sections.forEach(sec => {
            sectionSelect.innerHTML += `<option value="${sec}">Section ${sec}</option>`;
        });
        
        if (sections.length === 0) {
            sectionSelect.innerHTML = '<option value="">No sections available</option>';
        } else {
            if (sections.includes("A")) {
                sectionSelect.value = "A";
            } else {
                sectionSelect.value = sections[0];
            }
        }
    }
};

/**
 * Load subjects list based on class and stream.
 */
const updateSubjectsDropdown = async () => {
    const classSelect = document.querySelector("#filter-class");
    const streamSelect = document.querySelector("#filter-stream");
    const subjectSelect = document.querySelector("#filter-subject");
    const sectionSelect = document.querySelector("#filter-section");
    const yearInput = document.querySelector("#filter-academic-year");

    if (!classSelect || !subjectSelect) return;

    const classNum = classSelect.value;
    const stream = streamSelect ? streamSelect.value : "";
    const section = sectionSelect ? sectionSelect.value : "";
    const academicYear = yearInput ? yearInput.value : "";

    if (!classNum) {
        subjectSelect.innerHTML = '<option value="">Select Subject</option>';
        return;
    }

    const cacheKey = `${classNum}_${stream}_${section}_${academicYear}`;
    if (metadataCache.subjects[cacheKey]) {
        renderSubjects(metadataCache.subjects[cacheKey]);
        return;
    }

    showLocalLoader('#filter-subject');
    try {
        const response = await apiRequest(`subject.tag.getDropdowns?classNum=${classNum}&stream=${stream}&section=${section}&academicYear=${academicYear}`);
        if (response.success && response.subjects) {
            metadataCache.subjects[cacheKey] = response.subjects;
            renderSubjects(response.subjects);
        }
    } catch (error) {
        console.error("Failed to load subjects:", error);
        showToast("Error loading subjects list", "error");
    } finally {
        hideLocalLoader('#filter-subject');
    }

    function renderSubjects(subjects) {
        dropdownSubjects = subjects;
        subjectSelect.innerHTML = '<option value="">Select Subject</option>';
        subjects.forEach(sub => {
            subjectSelect.innerHTML += `<option value="${sub.subjectId}">${sub.name} (${sub.code})</option>`;
        });
    }
};

/**
 * Validates mark input values for a student.
 */
const validateStudentMarks = (student) => {
    const parseVal = (v, max) => {
        if (v === "" || v === null || v === undefined) return { valid: true, val: "", err: "" };
        const s = String(v).trim().toUpperCase();
        if (s === "A") return { valid: true, val: "A", err: "" };
        
        const num = Number(s);
        if (isNaN(num) || num < 0 || num > max) {
            return { valid: false, val: s, err: `Must be 0-${max} or A` };
        }
        return { valid: true, val: num, err: "" };
    };

    const theoryRes = parseVal(student.current.theory, maxMarks.theory);
    const practicalRes = parseVal(student.current.practical, maxMarks.practical);
    const internalRes = parseVal(student.current.internal, maxMarks.internal);

    student.errors = {
        theory: theoryRes.err,
        practical: practicalRes.err,
        internal: internalRes.err
    };

    student.hasError = Boolean(theoryRes.err || practicalRes.err || internalRes.err);
    
    // Compute total
    let total = 0;
    let allAbsent = true;
    let hasEntry = false;

    const addVal = (res) => {
        if (res.val !== "") {
            hasEntry = true;
            if (res.val !== "A") {
                total += res.val;
                allAbsent = false;
            }
        }
    };

    if (maxMarks.theory > 0) addVal(theoryRes);
    if (maxMarks.practical > 0) addVal(practicalRes);
    if (maxMarks.internal > 0) addVal(internalRes);

    student.current.total = hasEntry ? (allAbsent ? "A" : total) : "";

    // Complete state (all active inputs filled)
    const theoryDone = maxMarks.theory === 0 || theoryRes.val !== "";
    const practicalDone = maxMarks.practical === 0 || practicalRes.val !== "";
    const internalDone = maxMarks.internal === 0 || internalRes.val !== "";

    student.isComplete = theoryDone && practicalDone && internalDone;
    student.isValid = student.isComplete && !student.hasError;

    student.isChanged = (
        String(student.original.theory) !== String(student.current.theory) ||
        String(student.original.practical) !== String(student.current.practical) ||
        String(student.original.internal) !== String(student.current.internal)
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

    // Update stats text
    const summaryContainer = document.querySelector("#stats-summary-text-container");
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <strong>📊 Stats Summary:</strong> 
            Total: <span>${total}</span> | 
            Completed: <span style="color:var(--color-success); font-weight:bold;">${completed}</span> | 
            Pending: <span style="color:var(--color-muted);">${pending}</span> | 
            Progress: <span style="color:var(--color-primary);">${rate}%</span>
        `;
    }

    // Save button state
    const saveBtn = document.querySelector("#save-all-btn");
    const unsavedBadge = document.querySelector("#unsaved-indicator");
    if (saveBtn) {
        saveBtn.disabled = isExamLockedForTeacher || changedCount === 0 || studentsState.some(s => s.hasError);
    }
    if (unsavedBadge) {
        unsavedBadge.style.display = changedCount > 0 ? "inline-flex" : "none";
    }
};

/**
 * Setup double-axis sticky elements horizontal scrolls
 */
const syncStickyColumnsPositions = () => {
    const container = document.querySelector(".desktop-workspace-container");
    if (!container) return;

    const stickiesRoll = container.querySelectorAll(".col-sticky.col-roll");
    const stickiesName = container.querySelectorAll(".col-sticky.col-name");

    container.addEventListener("scroll", () => {
        const left = container.scrollLeft;
        stickiesRoll.forEach(el => { el.style.left = `${left}px`; });
        stickiesName.forEach(el => { el.style.left = `${left + 80}px`; });
    }, { passive: true });
};

/**
 * Renders the Workspace (both Desktop table and Mobile card list).
 */
const renderWorkspace = () => {
    const desktopWorkspace = document.querySelector("#desktop-workspace");
    const mobileWorkspace = document.querySelector("#mobile-workspace");
    const emptyState = document.querySelector("#subject-tag-empty-state");
    const loadingState = document.querySelector("#subject-tag-loading");
    const lockBanner = document.querySelector("#lock-warning-banner");

    loadingState.style.display = "none";

    // Show/hide lock warning banner
    if (lockBanner) {
        lockBanner.style.display = isExamLockedForTeacher ? "flex" : "none";
    }

    if (studentsState.length === 0) {
        emptyState.style.display = "flex";
        desktopWorkspace.style.display = "none";
        mobileWorkspace.style.display = "none";
        return;
    }

    emptyState.style.display = "none";

    // Set columns headers max limits
    document.querySelector("#hdr-theory").textContent = `Theory (${maxMarks.theory})`;
    document.querySelector("#hdr-practical").textContent = `Practical (${maxMarks.practical})`;
    document.querySelector("#hdr-internal").textContent = `Internal (${maxMarks.internal})`;

    // Hide inactive columns header
    document.querySelector("#hdr-practical").style.display = maxMarks.practical > 0 ? "table-cell" : "none";
    document.querySelector("#hdr-internal").style.display = maxMarks.internal > 0 ? "table-cell" : "none";

    // 1. Desktop Render
    const desktopTbody = document.querySelector("#desktop-table-body");
    desktopTbody.innerHTML = studentsState.map((student, idx) => {
        const hasErr = student.hasError;
        const theoryError = student.errors.theory ? `<span class="field-error-text">${student.errors.theory}</span>` : "";
        const practicalError = student.errors.practical ? `<span class="field-error-text">${student.errors.practical}</span>` : "";
        const internalError = student.errors.internal ? `<span class="field-error-text">${student.errors.internal}</span>` : "";

        // Status Badge
        let statusBadge = `<span class="badge badge-grey">Pending</span>`;
        if (student.hasError) {
            statusBadge = `<span class="badge badge-red">Error</span>`;
        } else if (student.isValid) {
            statusBadge = `<span class="badge badge-green">Completed</span>`;
        }

        return `
            <tr class="${hasErr ? "row-error" : ""} ${student.isChanged ? "row-changed" : ""}" data-student-id="${student.studentId}">
                <td class="col-sticky col-roll">${student.rollNo}</td>
                <td class="col-sticky col-name">
                    <div class="student-name-main">${student.studentName}</div>
                </td>
                <td><div class="student-father-name">${student.fatherName}</div></td>
                
                <td style="text-align: center;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                        <input type="text" class="mark-input input-theory" value="${student.current.theory}" 
                               inputmode="numeric" placeholder="0-${maxMarks.theory}" ${maxMarks.theory === 0 || isExamLockedForTeacher ? "disabled" : ""}>
                        ${maxMarks.theory > 0 && !isExamLockedForTeacher ? `<button type="button" class="btn-absent-toggle ${student.current.theory === "A" ? "active" : ""}" data-field="theory" style="padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--color-border); font-weight: bold; cursor: pointer; background: var(--color-bg);">AB</button>` : ""}
                    </div>
                    ${theoryError}
                </td>
                <td style="text-align: center; display: ${maxMarks.practical > 0 ? "table-cell" : "none"};">
                    <div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                        <input type="text" class="mark-input input-practical" value="${student.current.practical}" 
                               inputmode="numeric" placeholder="0-${maxMarks.practical}" ${maxMarks.practical === 0 || isExamLockedForTeacher ? "disabled" : ""}>
                        ${maxMarks.practical > 0 && !isExamLockedForTeacher ? `<button type="button" class="btn-absent-toggle ${student.current.practical === "A" ? "active" : ""}" data-field="practical" style="padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--color-border); font-weight: bold; cursor: pointer; background: var(--color-bg);">AB</button>` : ""}
                    </div>
                    ${practicalError}
                </td>
                <td style="text-align: center; display: ${maxMarks.internal > 0 ? "table-cell" : "none"};">
                    <div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                        <input type="text" class="mark-input input-internal" value="${student.current.internal}" 
                               inputmode="numeric" placeholder="0-${maxMarks.internal}" ${maxMarks.internal === 0 || isExamLockedForTeacher ? "disabled" : ""}>
                        ${maxMarks.internal > 0 && !isExamLockedForTeacher ? `<button type="button" class="btn-absent-toggle ${student.current.internal === "A" ? "active" : ""}" data-field="internal" style="padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--color-border); font-weight: bold; cursor: pointer; background: var(--color-bg);">AB</button>` : ""}
                    </div>
                    ${internalError}
                </td>
                
                <td style="text-align: center; font-weight: bold; color: var(--color-text);">
                    <span class="mark-total-display">${student.current.total}</span>
                </td>
                <td style="text-align: center;">${statusBadge}</td>
            </tr>
        `;
    }).join("");

    // 2. Mobile Cards Render
    mobileWorkspace.innerHTML = studentsState.map((student) => {
        let statusBadge = `<span class="badge badge-grey">Pending</span>`;
        if (student.hasError) {
            statusBadge = `<span class="badge badge-red">Error</span>`;
        } else if (student.isValid) {
            statusBadge = `<span class="badge badge-green">Completed</span>`;
        }

        return `
            <div class="student-mobile-card ${student.hasError ? "card-error" : ""} ${student.isChanged ? "card-changed" : ""}" data-student-id="${student.studentId}">
                <div class="card-header">
                    <div class="roll-badge">Roll ${student.rollNo}</div>
                    <div class="student-meta">
                        <h3>${student.studentName}</h3>
                        <p>Father: ${student.fatherName}</p>
                    </div>
                    <div class="status-wrap">${statusBadge}</div>
                </div>
                
                <div class="card-body">
                    <div class="field-item">
                        <span class="field-label">Theory (Max ${maxMarks.theory}):</span>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                            <input type="text" class="mark-input input-theory" value="${student.current.theory}" 
                                   inputmode="numeric" placeholder="0-${maxMarks.theory}" ${maxMarks.theory === 0 || isExamLockedForTeacher ? "disabled" : ""}
                                   style="flex: 1; height: 42px; font-size: 1.1rem; font-weight: bold; text-align: center;">
                            ${maxMarks.theory > 0 && !isExamLockedForTeacher ? `<button type="button" class="btn-absent-toggle ${student.current.theory === "A" ? "active" : ""}" data-field="theory" style="height: 42px; padding: 0 16px; font-weight: bold; border-radius: var(--radius-md); border: 1px solid var(--color-border); cursor: pointer; background: var(--color-bg);">AB</button>` : ""}
                        </div>
                        ${student.errors.theory ? `<span class="field-error-text">${student.errors.theory}</span>` : ""}
                    </div>
                    
                    ${maxMarks.practical > 0 ? `
                    <div class="field-item">
                        <span class="field-label">Practical (Max ${maxMarks.practical}):</span>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                            <input type="text" class="mark-input input-practical" value="${student.current.practical}" 
                                   inputmode="numeric" placeholder="0-${maxMarks.practical}" ${isExamLockedForTeacher ? "disabled" : ""}
                                   style="flex: 1; height: 42px; font-size: 1.1rem; font-weight: bold; text-align: center;">
                            ${!isExamLockedForTeacher ? `<button type="button" class="btn-absent-toggle ${student.current.practical === "A" ? "active" : ""}" data-field="practical" style="height: 42px; padding: 0 16px; font-weight: bold; border-radius: var(--radius-md); border: 1px solid var(--color-border); cursor: pointer; background: var(--color-bg);">AB</button>` : ""}
                        </div>
                        ${student.errors.practical ? `<span class="field-error-text">${student.errors.practical}</span>` : ""}
                    </div>` : ""}

                    ${maxMarks.internal > 0 ? `
                    <div class="field-item">
                        <span class="field-label">Internal (Max ${maxMarks.internal}):</span>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                            <input type="text" class="mark-input input-internal" value="${student.current.internal}" 
                                   inputmode="numeric" placeholder="0-${maxMarks.internal}" ${isExamLockedForTeacher ? "disabled" : ""}
                                   style="flex: 1; height: 42px; font-size: 1.1rem; font-weight: bold; text-align: center;">
                            ${!isExamLockedForTeacher ? `<button type="button" class="btn-absent-toggle ${student.current.internal === "A" ? "active" : ""}" data-field="internal" style="height: 42px; padding: 0 16px; font-weight: bold; border-radius: var(--radius-md); border: 1px solid var(--color-border); cursor: pointer; background: var(--color-bg);">AB</button>` : ""}
                        </div>
                        ${student.errors.internal ? `<span class="field-error-text">${student.errors.internal}</span>` : ""}
                    </div>` : ""}

                    <div class="field-item total-item" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(0,0,0,0.04); padding-top: 8px;">
                        <span class="field-label">Total Marks:</span>
                        <span class="mark-total-display" style="font-weight: 800; font-size: 1.1rem; color: var(--color-primary);">${student.current.total}</span>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    desktopWorkspace.style.display = "block";
    mobileWorkspace.style.display = "block";

    syncStickyColumnsPositions();
    bindWorkspaceInputListeners();
};

/**
 * Binds dynamically rendered input listeners to keep state synchronized.
 */
const bindWorkspaceInputListeners = () => {
    const handleInput = (element, field) => {
        const tr = element.closest("[data-student-id]");
        if (!tr) return;

        const studentId = tr.dataset.studentId;
        const student = studentsState.find(s => s.studentId === studentId);
        if (!student) return;

        const rawVal = element.value.trim();
        student.current[field] = rawVal;
        
        validateStudentMarks(student);

        // Update total display in both desktop and mobile row/card
        const allDisplays = document.querySelectorAll(`[data-student-id="${studentId}"] .mark-total-display`);
        allDisplays.forEach(disp => {
            disp.textContent = student.current.total;
        });

        // Re-render status and input error styling without full redraw
        const allStatusWraps = document.querySelectorAll(`[data-student-id="${studentId}"]`);
        allStatusWraps.forEach(wrap => {
            // Update row/card classes
            wrap.classList.toggle("row-error", student.hasError);
            wrap.classList.toggle("card-error", student.hasError);
            wrap.classList.toggle("row-changed", student.isChanged);
            wrap.classList.toggle("card-changed", student.isChanged);

            // Update status badge
            const badge = wrap.querySelector(".badge");
            if (badge) {
                badge.className = "badge " + (student.hasError ? "badge-red" : (student.isValid ? "badge-green" : "badge-grey"));
                badge.textContent = student.hasError ? "Error" : (student.isValid ? "Completed" : "Pending");
            }

            // Sync values to other matching inputs (desktop to mobile sync)
            const input = wrap.querySelector(`.input-${field}`);
            if (input && input !== element) {
                input.value = rawVal;
            }

            // Sync AB button active class
            const toggle = wrap.querySelector(`.btn-absent-toggle[data-field="${field}"]`);
            if (toggle) {
                toggle.classList.toggle("active", rawVal === "A");
            }

            // Show field errors
            const errSpan = input ? input.parentElement.querySelector(".field-error-text") : null;
            if (errSpan) {
                errSpan.textContent = student.errors[field] || "";
            }
        });

        updateStatsAndProgress();
    };

    const inputs = document.querySelectorAll(".workspace-card .mark-input");
    inputs.forEach(input => {
        let field = "theory";
        let max = maxMarks.theory;
        if (input.classList.contains("input-practical")) {
            field = "practical";
            max = maxMarks.practical;
        }
        if (input.classList.contains("input-internal")) {
            field = "internal";
            max = maxMarks.internal;
        }

        // Apply typing enforcement
        enforceMarkInputRules(input, max);

        input.addEventListener("input", () => handleInput(input, field));

        // Enter key navigation
        // Excel-like navigation (Arrow keys and Enter)
        input.addEventListener("keydown", (e) => {
            const tr = input.closest("tr");
            if (!tr) return; // Only desktop supports this grid navigation
            
            const tbody = tr.parentNode;
            const rows = Array.from(tbody.querySelectorAll("tr"));
            const currentRowIndex = rows.indexOf(tr);
            
            let targetRowIndex = currentRowIndex;
            let targetClass = "";

            if (input.classList.contains("input-theory")) targetClass = ".input-theory";
            else if (input.classList.contains("input-practical")) targetClass = ".input-practical";
            else if (input.classList.contains("input-internal")) targetClass = ".input-internal";

            if (e.key === "Enter" || e.key === "ArrowDown") {
                e.preventDefault();
                targetRowIndex = currentRowIndex + 1;
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                targetRowIndex = currentRowIndex - 1;
            } else if (e.key === "ArrowRight") {
                // Focus next input in same row
                const nextInput = input.parentElement.parentElement.nextElementSibling?.querySelector(".mark-input:not([disabled])");
                if (nextInput) {
                    e.preventDefault();
                    nextInput.focus();
                    nextInput.select();
                }
                return;
            } else if (e.key === "ArrowLeft") {
                // Focus previous input in same row
                const prevInput = input.parentElement.parentElement.previousElementSibling?.querySelector(".mark-input:not([disabled])");
                if (prevInput) {
                    e.preventDefault();
                    prevInput.focus();
                    prevInput.select();
                }
                return;
            } else {
                return;
            }

            if (targetRowIndex >= 0 && targetRowIndex < rows.length) {
                const targetRow = rows[targetRowIndex];
                const targetInput = targetRow.querySelector(targetClass);
                if (targetInput && !targetInput.disabled) {
                    targetInput.focus();
                    targetInput.select();
                }
            }
        });
    });

    // AB Button toggle click handlers
    const abToggles = document.querySelectorAll(".workspace-card .btn-absent-toggle");
    abToggles.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const container = e.target.closest("[data-student-id]");
            if (!container) return;
            const studentId = container.dataset.studentId;
            const student = studentsState.find(s => s.studentId === studentId);
            if (!student) return;

            const field = e.target.dataset.field;
            const inputGroup = e.target.parentElement;
            const input = inputGroup.querySelector(".mark-input");
            if (!input || input.disabled) return;

            // Toggle absent
            const currentVal = student.current[field];
            const newVal = currentVal === "A" ? "" : "A";

            input.value = newVal;
            handleInput(input, field);
            
            // Advance focus on toggle click
            const allInputs = Array.from(document.querySelectorAll(".workspace-card .mark-input:not([disabled])"));
            const idx = allInputs.indexOf(input);
            if (idx !== -1 && idx < allInputs.length - 1) {
                allInputs[idx + 1].focus();
                allInputs[idx + 1].select();
            }
        });
    });
};

/**
 * Query students list and saved marks from Google Apps Script.
 */
const loadStudentMarks = async () => {
    const yearSelect = document.querySelector("#filter-academic-year");
    const examSelect = document.querySelector("#filter-exam");
    const classSelect = document.querySelector("#filter-class");
    const sectionSelect = document.querySelector("#filter-section");
    const streamSelect = document.querySelector("#filter-stream");
    const subjectSelect = document.querySelector("#filter-subject");

    const filters = {
        academicYear: yearSelect.value,
        examName: examSelect.value,
        classNum: classSelect.value,
        section: sectionSelect.value,
        stream: streamSelect ? streamSelect.value : "",
        subjectId: subjectSelect.value
    };

    if (!filters.academicYear || !filters.examName || !filters.classNum || !filters.section || !filters.subjectId) {
        showToast("Please fill all required filters.", "error");
        return;
    }

    currentFilters = { ...filters };
    maxMarks = deriveMaxMarks(filters.classNum, filters.subjectId, filters.examName);

    // Check if the exam is locked for teachers
    try {
        const settingsRes = await apiRequest("settings.load");
        if (settingsRes.success && settingsRes.settings) {
            const key = `exam_status_${filters.examName}`;
            const status = settingsRes.settings[key];
            const session = getSession();
            const role = (session?.user?.role || "").toUpperCase();
            isExamLockedForTeacher = (role === "TEACHER" && status === "CLOSED");
        } else {
            isExamLockedForTeacher = false;
        }
    } catch (e) {
        console.warn("Could not load settings:", e);
        isExamLockedForTeacher = false;
    }

    // Show skeleton
    document.querySelector("#subject-tag-empty-state").style.display = "none";
    document.querySelector("#desktop-workspace").style.display = "none";
    document.querySelector("#mobile-workspace").style.display = "none";
    document.querySelector("#stats-progress-section").style.display = "none";
    document.querySelector("#subject-tag-loading").style.display = "block";

    showLoader({ blocking: false });
    try {
        const query = new URLSearchParams(filters).toString();
        const response = await apiRequest(`exam.marks.load?${query}`);

        if (response.success && response.students) {
            studentsState = response.students.map(s => {
                const theory = s.theory !== null && s.theory !== undefined ? String(s.theory) : "";
                const practical = s.practical !== null && s.practical !== undefined ? String(s.practical) : "";
                const internal = s.internal !== null && s.internal !== undefined ? String(s.internal) : "";
                
                const studentObj = {
                    studentId: s.studentId,
                    rollNo: s.rollNo,
                    studentName: s.studentName,
                    fatherName: s.fatherName,
                    original: { theory, practical, internal, total: s.total || "" },
                    current: { theory, practical, internal, total: s.total || "" },
                    errors: { theory: "", practical: "", internal: "" },
                    hasError: false,
                    isComplete: false,
                    isValid: false,
                    isChanged: false
                };

                validateStudentMarks(studentObj);
                return studentObj;
            });

            renderWorkspace();
            document.querySelector("#stats-progress-section").style.display = "flex";
            updateStatsAndProgress();
            showToast("Student marks loaded successfully.", "success");
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to load marks.", "error");
        document.querySelector("#subject-tag-loading").style.display = "none";
        document.querySelector("#subject-tag-empty-state").style.display = "flex";
    } finally {
        hideLoader();
    }
};

/**
 * Submit changes to GAS
 */
const saveAllMarks = async () => {
    const dirtyStudents = studentsState.filter(s => s.isChanged);
    if (dirtyStudents.length === 0) return;

    // Strict client-side check
    const hasAnyError = studentsState.some(s => s.hasError);
    if (hasAnyError) {
        showToast("Please fix validation errors before saving.", "error");
        return;
    }

    const saveBtn = document.querySelector("#save-all-btn");
    if (saveBtn) saveBtn.disabled = true;

    showLoader();

    const payload = dirtyStudents.map(s => ({
        studentId: s.studentId,
        academicYear: currentFilters.academicYear,
        examName: currentFilters.examName,
        classNum: currentFilters.classNum,
        section: currentFilters.section,
        stream: currentFilters.stream,
        subjectId: currentFilters.subjectId,
        theory: s.current.theory,
        practical: s.current.practical,
        internal: s.current.internal
    }));

    try {
        const response = await apiRequest("exam.marks.save", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (response.success) {
            showToast(`Saved ${response.count} student marks successfully!`, "success");
            
            // Sync current to original state
            studentsState.forEach(s => {
                if (s.isChanged) {
                    s.original = { ...s.current };
                    s.isChanged = false;
                }
            });
            
            // Update table rendering classes
            studentsState.forEach(student => {
                const trs = document.querySelectorAll(`[data-student-id="${student.studentId}"]`);
                trs.forEach(tr => {
                    tr.classList.remove("row-changed", "card-changed");
                });
            });

            updateStatsAndProgress();
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to save marks.", "error");
    } finally {
        hideLoader();
        if (saveBtn) saveBtn.disabled = false;
    }
};

/**
 * Initializes the Marks Entry module view shell.
 */
export async function initMarksEntryView() {
    try {
        renderNavbar(document.querySelector("#navbar-marks-entry"));

        // Setup filter defaults
        const yearInput = document.querySelector("#filter-academic-year");
        if (yearInput) {
            yearInput.value = getDefaultAcademicYear();
        }

        const classSelect = document.querySelector("#filter-class");
        const streamSelect = document.querySelector("#filter-stream");
        const sectionSelect = document.querySelector("#filter-section");
        const loadBtn = document.querySelector("#load-students-btn");
        const saveBtn = document.querySelector("#save-all-btn");

        if (classSelect) {
            classSelect.addEventListener("change", async () => {
                const val = classSelect.value;
                updateStreamFilterVisibility(val);
                await updateAvailableSections();
                await updateSubjectsDropdown();
            });
        }

        if (streamSelect) {
            streamSelect.addEventListener("change", async () => {
                await updateSubjectsDropdown();
            });
        }

        if (sectionSelect) {
            sectionSelect.addEventListener("change", async () => {
                await updateSubjectsDropdown();
            });
        }

        // Section dropdown updates on year input change
        if (yearInput) {
            yearInput.addEventListener("input", async () => {
                await updateAvailableSections();
                await updateSubjectsDropdown();
            });
        }

        if (loadBtn) {
            loadBtn.addEventListener("click", loadStudentMarks);
        }

        if (saveBtn) {
            saveBtn.addEventListener("click", saveAllMarks);
        }

        // Initial setup
        updateStreamFilterVisibility("");
        await updateAvailableSections();

    } catch (error) {
        console.error(error);
        showToast("Marks Entry could not be initialized.", "error");
    }
}
