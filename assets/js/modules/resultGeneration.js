"use strict";

import { showToast } from "../../../components/toast.js";
import { showLoader, hideLoader } from "../../../components/loader.js?t=17892929155";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=17892929155";

let currentResults = [];
let activeClassVal = null;
let searchQuery = "";

const getDefaultAcademicYear = () => {
    const year = new Date().getFullYear();
    return `${year}-${String(year + 1).slice(-2)}`;
};

/**
 * Returns an array of currently checked class numbers.
 */
const getCheckedClasses = () => {
    return Array.from(document.querySelectorAll('input[name="classes"]:checked')).map(el => el.value);
};

/**
 * Checks and updates the visibility of the Stream filter.
 */
const updateStreamFilterVisibility = () => {
    const streamContainer = document.querySelector("#stream-filter-container");
    const streamSelect = document.querySelector("#filter-stream");
    const checked = getCheckedClasses();
    
    // Show stream if Class 11 or Class 12 is checked
    const hasSrSec = checked.includes("11") || checked.includes("12");
    
    if (hasSrSec && streamContainer && streamSelect) {
        streamContainer.style.display = "flex";
        streamSelect.setAttribute("required", "required");
    } else if (streamContainer && streamSelect) {
        streamContainer.style.display = "none";
        streamSelect.removeAttribute("required");
        streamSelect.value = "";
    }
};

/**
 * Dynamically queries available sections for the selected year and the first checked class.
 */
const updateAvailableSections = async () => {
    const yearInput = document.querySelector("#filter-academic-year");
    const sectionSelect = document.querySelector("#filter-section");

    if (!yearInput || !sectionSelect) return;

    const year = String(yearInput.value || "").trim();
    const checked = getCheckedClasses();

    if (!year || checked.length === 0) {
        sectionSelect.innerHTML = '<option value="">Select Section</option>';
        return;
    }

    // Query sections using the first checked class as reference
    const classNum = checked[0];

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
                if (response.sections.includes("A")) {
                    sectionSelect.value = "A";
                } else {
                    sectionSelect.value = response.sections[0];
                }
            }
        }
    } catch (error) {
        console.error("Failed to load sections:", error);
    }
};

/**
 * Renders the tabs list of generated class results.
 */
const renderTabs = () => {
    const tabsContainer = document.querySelector("#results-tabs-container");
    if (!tabsContainer) return;

    tabsContainer.innerHTML = "";

    currentResults.forEach(classRes => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `class-tab${activeClassVal === classRes.classVal ? " active" : ""}`;
        btn.style.padding = "10px 20px";
        btn.style.border = "none";
        btn.style.background = "none";
        btn.style.fontWeight = activeClassVal === classRes.classVal ? "700" : "600";
        btn.style.color = activeClassVal === classRes.classVal ? "var(--color-primary)" : "var(--color-muted)";
        btn.style.borderBottom = activeClassVal === classRes.classVal ? "3px solid var(--color-primary)" : "3px solid transparent";
        btn.style.cursor = "pointer";
        btn.style.transition = "all 0.2s";
        btn.textContent = `Class ${classRes.classVal}`;

        btn.addEventListener("click", () => {
            activeClassVal = classRes.classVal;
            renderTabs();
            renderTable();
        });
        tabsContainer.appendChild(btn);
    });
};

/**
 * Helper to extract a score value from the structured subjectScores object.
 * subjectScores[subjectId] is now { displayVal, theoryObt, practicalObt, totalObt, tMax, pMax }
 */
const getScore = (subjectScores, subjectId, field = "displayVal") => {
    const obj = subjectScores[subjectId];
    if (!obj) return "";
    if (typeof obj === "string") return obj; // backward compat
    return obj[field] !== undefined ? obj[field] : "";
};

/**
 * Determines the BSEB abbreviation for a Class 9-10 subject based on its group or name.
 */
const getSubjectAbbrev910 = (sub) => {
    const g = String(sub.group || "").toLowerCase();
    if (g === "language1") return "MIL";
    if (g === "language2") return "SIL";

    const name = String(sub.name || "").toLowerCase();
    if (name.includes("math")) return "MAT";
    if (name.includes("science") && !name.includes("social")) return "SCI";
    if (name.includes("social") || name.includes("ssc") || name.includes("sst")) return "SSC";
    if (name.includes("english") || name.includes("eng")) return "ENG";
    if (name.includes("opt") && name.includes("voc")) return "OPT.SUB(VO C.)";
    if (name.includes("opt")) return "OPT SUB";

    // Fallback to code or name
    return sub.code || sub.name;
};

/**
 * Checks if ANY subject in the active list has practical marks configured > 0.
 */
const hasPracticalExam = (activeSubjects) => {
    return activeSubjects.some(sub => (sub.pMax || 0) > 0);
};

// ── Shared style constants ──
const TH = "padding: 8px 10px; font-weight: 700; color: var(--color-text); font-size: 0.85rem; line-height: 1.2;";
const TH_C = TH + " text-align: center;";
const TD = "padding: 8px 10px; font-size: 0.85rem; line-height: 1.2;";
const TD_C = TD + " text-align: center;";
const BL = "border-left: 1px solid var(--color-border);";
const BB = "border-bottom: 1px solid var(--color-border);";

/**
 * Renders the results grid table for the active class tab.
 */
const renderTable = () => {
    const thead = document.querySelector("#results-table-thead");
    const tbody = document.querySelector("#results-table-tbody");
    const statsSummary = document.querySelector("#result-stats-summary");

    if (!thead || !tbody) return;

    thead.innerHTML = "";
    tbody.innerHTML = "";

    const activeData = currentResults.find(r => r.classVal === activeClassVal);
    if (!activeData) {
        tbody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 20px; color: var(--color-muted);">No results data found.</td></tr>';
        if (statsSummary) statsSummary.textContent = "0 Students Listed";
        return;
    }

    const { activeSubjects, studentResults } = activeData;

    // Filter students by search query
    const filteredStudents = studentResults.filter(stud => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return (
            String(stud.studentName || "").toLowerCase().includes(query) ||
            String(stud.rollNo || "").toLowerCase().includes(query) ||
            String(stud.fatherName || "").toLowerCase().includes(query)
        );
    });

    // Sort students
    const sortSelect = document.querySelector("#result-sort-select");
    const sortBy = sortSelect ? sortSelect.value : "roll";
    if (sortBy === "aggregate") {
        filteredStudents.sort((a, b) => (b.grandTotal || 0) - (a.grandTotal || 0));
    } else {
        filteredStudents.sort((a, b) => {
            const rollA = parseInt(a.rollNo, 10);
            const rollB = parseInt(b.rollNo, 10);
            if (isNaN(rollA) && isNaN(rollB)) return 0;
            if (isNaN(rollA)) return 1;
            if (isNaN(rollB)) return -1;
            return rollA - rollB;
        });
    }

    if (statsSummary) {
        statsSummary.textContent = `${filteredStudents.length} Students Listed`;
    }

    const isSenior = (activeClassVal === 11 || activeClassVal === 12);

    if (isSenior) {
        renderSeniorTable(thead, tbody, activeSubjects, filteredStudents);
    } else {
        renderJuniorTable(thead, tbody, activeSubjects, filteredStudents);
    }
};


// ═══════════════════════════════════════════
//  CLASS 9-10 (Junior) BSEB Layout
// ═══════════════════════════════════════════
const renderJuniorTable = (thead, tbody, activeSubjects, filteredStudents) => {
    // 6 fixed standard BSEB Class 9-10 slots (OPT SUB and OPT.SUB(VOC.) removed as requested)
    const juniorSlots = [
        { label: "MIL", slotId: "language1", defaultSubId: "" },
        { label: "SIL", slotId: "language2", defaultSubId: "" },
        { label: "MAT", slotId: "compulsory", defaultSubId: `${activeClassVal}_MAT` },
        { label: "SCI", slotId: "compulsory", defaultSubId: `${activeClassVal}_SCI` },
        { label: "SSC", slotId: "compulsory", defaultSubId: `${activeClassVal}_SST` },
        { label: "ENG", slotId: "compulsory", defaultSubId: `${activeClassVal}_ENG` }
    ];

    // Helper to check if a junior slot has practical marks configured
    const slotHasPractical = (slot) => {
        return filteredStudents.some(res => {
            let subId = "";
            if (slot.slotId === "compulsory") {
                subId = slot.defaultSubId;
            } else {
                subId = res[slot.slotId];
            }
            if (!subId) return false;
            const details = res.subjectDetails.find(s => String(s.subjectId) === String(subId));
            return details && (details.pMax || 0) > 0;
        });
    };

    const hasPrac = juniorSlots.some(slotHasPractical);

    let row1 = "";
    let row2 = "";
    let row3 = "";

    if (hasPrac) {
        // ── Three-row header (for Practical/Internal exams) ──
        row1 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th rowspan="3" style="${TH_C} width: 3%;">SL NO</th>
            <th rowspan="3" style="${TH_C} width: 4%;">ROLL NO.</th>
            <th rowspan="3" style="${TH_C} width: 4%;">CLASS</th>
            <th rowspan="3" style="${TH} width: 15%;">STUDENT NAME</th>
            <th rowspan="3" style="${TH} width: 13%;">MOTHER'S NAME</th>
            <th rowspan="3" style="${TH} width: 13%;">FATHER'S NAME</th>
            <th rowspan="3" style="${TH_C} width: 3%;">GENDER</th>
            <th colspan="6" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED(THEORY)</th>
            <th colspan="3" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED (INTERNAL ASSEMENT & PRACTICAL)</th>
            <th rowspan="3" style="${TH_C} width: 7%; ${BL}">AGGREGATE</th>
            <th rowspan="3" style="${TH_C} width: 7%;">RESULT</th>
        </tr>`;

        // Row 2: theory labels and practical category labels
        row2 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} width: 4.5%;">MIL</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">SIL</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">MAT</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">SCI</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">SSC</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">ENG</th>
            
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} width: 4%;">SCI</th>
            <th colspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BB}">SSC</th>
        </tr>`;

        // Row 3: sub-columns for SSC practicals (LIT.ACT and Project Wrok)
        row3 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th style="padding: 6px; font-weight: 600; text-align: center; font-size: 0.8em; ${BL} width: 4%;">LIT.ACT</th>
            <th style="padding: 6px; font-weight: 600; text-align: center; font-size: 0.8em; width: 4%;">Project Wrok</th>
        </tr>`;

    } else {
        // ── Two-row header (for Theory-only exams) ──
        row1 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th rowspan="2" style="${TH_C} width: 3%;">SL NO</th>
            <th rowspan="2" style="${TH_C} width: 4%;">ROLL NO.</th>
            <th rowspan="2" style="${TH_C} width: 4%;">CLASS</th>
            <th rowspan="2" style="${TH} width: 17%;">STUDENT NAME</th>
            <th rowspan="2" style="${TH} width: 14%;">MOTHER'S NAME</th>
            <th rowspan="2" style="${TH} width: 14%;">FATHER'S NAME</th>
            <th rowspan="2" style="${TH_C} width: 4%;">GENDER</th>
            <th colspan="6" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED(THEORY)</th>
            <th rowspan="2" style="${TH_C} width: 7%; ${BL}">AGGREGATE</th>
            <th rowspan="2" style="${TH_C} width: 7%;">RESULT</th>
        </tr>`;

        row2 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} width: 5%;">MIL</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">SIL</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">MAT</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">SCI</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">SSC</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">ENG</th>
        </tr>`;
    }

    thead.innerHTML = row1 + row2 + row3;

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 30px; color: var(--color-muted);">No matching student results found.</td></tr>`;
        return;
    }

    filteredStudents.forEach((res, index) => {
        const genderRaw = String(res.gender || "").toLowerCase().trim();
        const genderText = (genderRaw === "female" || genderRaw === "f") ? "F" : ((genderRaw === "male" || genderRaw === "m") ? "M" : "");

        let resultBadgeStyle = "color: var(--color-success); font-weight: bold;";
        if (res.result === "Fail") {
            resultBadgeStyle = "color: var(--color-danger); font-weight: bold;";
        } else if (res.result === "Compartmental") {
            resultBadgeStyle = "color: #e67e22; font-weight: bold;";
        }

        const classNumeral = activeClassVal === 10 ? 'X' : 'IX';

        // Get subject IDs
        const milId = res.language1;
        const silId = res.language2;
        const matId = `${activeClassVal}_MAT`;
        const sciId = `${activeClassVal}_SCI`;
        const sscId = `${activeClassVal}_SST`;
        const engId = `${activeClassVal}_ENG`;

        // Get theory obt marks
        const milTheory = milId ? getScore(res.subjectScores, milId, "theoryObt") : "";
        const silTheory = silId ? getScore(res.subjectScores, silId, "theoryObt") : "";
        const matTheory = getScore(res.subjectScores, matId, "theoryObt");
        const sciTheory = getScore(res.subjectScores, sciId, "theoryObt");
        const sscTheory = getScore(res.subjectScores, sscId, "theoryObt");
        const engTheory = getScore(res.subjectScores, engId, "theoryObt");

        let rowHtml = `<tr style="border-bottom: 1px solid var(--color-border); ${index % 2 === 0 ? 'background: #FFFFFF;' : 'background: #F9FAFB;'}">
            <td style="${TD_C} font-weight: 600;">${index + 1}</td>
            <td style="${TD_C} font-weight: 600;">${res.rollNo}</td>
            <td style="${TD_C} font-weight: 600;">${classNumeral}</td>
            <td style="${TD} font-weight: 600; max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.studentName}">${res.studentName}</td>
            <td style="${TD} font-size: 0.9em; color: var(--color-muted); max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.motherName || ""}">${res.motherName || ""}</td>
            <td style="${TD} font-size: 0.9em; color: var(--color-muted); max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.fatherName || ""}">${res.fatherName || ""}</td>
            <td style="${TD_C} font-weight: 600;">${genderText}</td>
            
            <td style="${TD_C} font-weight: 600; ${BL}">${milTheory}</td>
            <td style="${TD_C} font-weight: 600;">${silTheory}</td>
            <td style="${TD_C} font-weight: 600;">${matTheory}</td>
            <td style="${TD_C} font-weight: 600;">${sciTheory}</td>
            <td style="${TD_C} font-weight: 600;">${sscTheory}</td>
            <td style="${TD_C} font-weight: 600;">${engTheory}</td>`;

        if (hasPrac) {
            // SCI Practical (from practicalObt)
            const sciPrac = getScore(res.subjectScores, sciId, "practicalObt");
            // SSC LIT.ACT (from practicalObt) and SSC Project Wrok (from internalObt)
            const sscLitAct = getScore(res.subjectScores, sscId, "practicalObt");
            const sscProjectWork = getScore(res.subjectScores, sscId, "internalObt");

            rowHtml += `
                <td style="${TD_C} font-weight: 600; ${BL}">${sciPrac}</td>
                <td style="${TD_C} font-weight: 600;">${sscLitAct}</td>
                <td style="${TD_C} font-weight: 600;">${sscProjectWork}</td>`;
        }
        rowHtml += `
            <td style="${TD_C} font-weight: 700; ${BL}">${res.grandTotal}</td>
            <td style="${TD_C} ${resultBadgeStyle}">${res.division || res.result}</td>
        </tr>`;
        tbody.innerHTML += rowHtml;
    });
};


// ═══════════════════════════════════════════
//  CLASS 11-12 (Senior) BSEB Layout
// ═══════════════════════════════════════════
const renderSeniorTable = (thead, tbody, activeSubjects, filteredStudents) => {
    // Helper to check if ANY student in the list takes a subject with practicals in this slot
    const slotHasPractical = (slotId) => {
        return filteredStudents.some(res => {
            const subId = res[slotId];
            if (!subId) return false;
            const config = activeSubjects.find(s => String(s.subjectId) === String(subId));
            return config && (config.pMax || 0) > 0;
        });
    };

    const e1HasPrac = slotHasPractical("elective1");
    const e2HasPrac = slotHasPractical("elective2");
    const e3HasPrac = slotHasPractical("elective3");
    const addHasPrac = slotHasPractical("additional");

    const e1ColSpan = e1HasPrac ? 4 : 2;
    const e2ColSpan = e2HasPrac ? 4 : 2;
    const e3ColSpan = e3HasPrac ? 4 : 2;
    const addColSpan = addHasPrac ? 4 : 2;

    const electiveColSpan = e1ColSpan + e2ColSpan + e3ColSpan;
    const additionalColSpan = addColSpan;

    // ── Row 1 ──
    let headerRow = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
        <th rowspan="2" style="${TH_C} width: 4%;">Roll no.</th>
        <th rowspan="2" style="${TH_C} width: 4%;">Class</th>
        <th rowspan="2" style="${TH} width: 18%;">Student's Name<br>Mother's Name<br>Father's Name</th>
        <th rowspan="2" style="${TH_C} width: 4%;">M/F</th>
        <th colspan="4" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB} width: 16%;">Compulsory Language Subjects</th>
        <th colspan="${electiveColSpan}" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB} width: 36%;">Elective Subjects</th>
        <th colspan="${additionalColSpan}" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB} width: 10%;">Additional Subjects</th>
        <th rowspan="2" style="${TH_C} width: 8%; ${BL}">Aggregate & Result</th>
        <th rowspan="2" style="${TH_C} width: 10%;">Result</th>
    </tr>`;

    // ── Row 2: Sub-headers ──
    let subRow = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">`;
    // Compulsory languages: always Subject | Marks
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 5%;">Subject - 1</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 3%;">Marks</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 5%;">Subject - 2</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 3%;">Marks</th>`;

    // Elective 1
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject - 1</th>`;
    if (e1HasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    // Elective 2
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject - 2</th>`;
    if (e2HasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    // Elective 3
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject - 3</th>`;
    if (e3HasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    // Additional
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject</th>`;
    if (addHasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    subRow += `</tr>`;
    thead.innerHTML = headerRow + subRow;

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 30px; color: var(--color-muted);">No matching student results found.</td></tr>`;
        return;
    }

    filteredStudents.forEach((res, index) => {
        const getSubDetails = (subId) => {
            if (!subId) return null;
            return res.subjectDetails.find(s => String(s.subjectId) === String(subId)) || null;
        };

        const l1 = getSubDetails(res.language1);
        const l2 = getSubDetails(res.language2);
        const e1 = getSubDetails(res.elective1);
        const e2 = getSubDetails(res.elective2);
        const e3 = getSubDetails(res.elective3);
        const add = getSubDetails(res.additional);

        const getSubData = (subObj) => {
            if (!subObj) return { name: "", theoryObt: "", practicalObt: "", totalObt: "", score: "", tMax: "", pMax: 0 };
            const scoreObj = res.subjectScores[subObj.subjectId];
            return {
                name: subObj.name,
                theoryObt: scoreObj ? scoreObj.theoryObt : "",
                practicalObt: scoreObj ? scoreObj.practicalObt : "",
                totalObt: scoreObj ? scoreObj.totalObt : "",
                score: scoreObj ? scoreObj.displayVal : "",
                tMax: subObj.tMax || "",
                pMax: subObj.pMax || 0
            };
        };

        const sdL1 = getSubData(l1);
        const sdL2 = getSubData(l2);
        const sdE1 = getSubData(e1);
        const sdE2 = getSubData(e2);
        const sdE3 = getSubData(e3);
        const sdAdd = getSubData(add);

        let combinedName = `<div style="text-align:left; font-weight:600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.studentName}">${res.studentName}</div>`;
        if (res.motherName && res.motherName !== "-") {
            combinedName += `<div style="text-align:left; font-size: 0.8em; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.motherName}">${res.motherName}</div>`;
        }
        if (res.fatherName && res.fatherName !== "-") {
            combinedName += `<div style="text-align:left; font-size: 0.8em; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.fatherName}">${res.fatherName}</div>`;
        }
        const genderRaw = String(res.gender || "").toLowerCase().trim();
        const genderText = (genderRaw === "female" || genderRaw === "f") ? "F" : ((genderRaw === "male" || genderRaw === "m") ? "M" : "");

        let resultBadgeStyle = "color: var(--color-success); font-weight: bold;";
        if (res.result === "Fail") {
            resultBadgeStyle = "color: var(--color-danger); font-weight: bold;";
        } else if (res.result === "Compartmental") {
            resultBadgeStyle = "color: #e67e22; font-weight: bold;";
        }

        let rowHtml = `<tr style="border-bottom: 1px solid var(--color-border); ${index % 2 === 0 ? 'background: #FFFFFF;' : 'background: #F9FAFB;'}">
            <td style="${TD_C} font-weight: 600; color: var(--color-primary);">${res.rollNo}</td>
            <td style="${TD_C} font-weight: 600; color: var(--color-primary);">${activeClassVal}</td>
            <td style="${TD} line-height: 1.3; max-width: 0;">${combinedName}</td>
            <td style="${TD_C} font-weight: 600;">${genderText}</td>`;

        // Compulsory Language 1
        rowHtml += `<td style="${TD_C} font-size: 0.85em; ${BL}">${sdL1.name}</td>`;
        rowHtml += `<td style="${TD_C} font-weight: 600;">${sdL1.totalObt}</td>`;

        // Compulsory Language 2
        rowHtml += `<td style="${TD_C} font-size: 0.85em;">${sdL2.name}</td>`;
        rowHtml += `<td style="${TD_C} font-weight: 600;">${sdL2.totalObt}</td>`;

        // Helper to output cells for a slot based on whether slot has practical
        const renderSlotCells = (sd, slotHasPrac, isLeftBorder = false) => {
            let cellsHtml = `<td style="${TD_C} font-size: 0.85em; ${isLeftBorder ? BL : ''}">${sd.name}</td>`;
            if (slotHasPrac) {
                if (sd.pMax > 0) {
                    cellsHtml += `<td style="${TD_C} font-weight: 600;">${sd.theoryObt}</td>`;
                    cellsHtml += `<td style="${TD_C} font-weight: 600;">${sd.practicalObt}</td>`;
                } else {
                    cellsHtml += `<td style="${TD_C} color: var(--color-muted);">-</td>`;
                    cellsHtml += `<td style="${TD_C} color: var(--color-muted);">-</td>`;
                }
            }
            cellsHtml += `<td style="${TD_C} font-weight: 600;">${sd.totalObt}</td>`;
            return cellsHtml;
        };

        // Elective 1
        rowHtml += renderSlotCells(sdE1, e1HasPrac, true);

        // Elective 2
        rowHtml += renderSlotCells(sdE2, e2HasPrac, false);

        // Elective 3
        rowHtml += renderSlotCells(sdE3, e3HasPrac, false);

        // Additional
        rowHtml += renderSlotCells(sdAdd, addHasPrac, true);

        rowHtml += `
            <td style="${TD_C} font-weight: 700; ${BL}">${res.grandTotal}</td>
            <td style="${TD_C} ${resultBadgeStyle}">${res.division || res.result}</td>
        </tr>`;
        tbody.innerHTML += rowHtml;
    });
};


/**
 * Calls backend to compile results and displays them in-page.
 */
const handleGenerateResults = async () => {
    const yearSelect = document.querySelector("#filter-academic-year");
    const examSelect = document.querySelector("#filter-exam");
    const sectionSelect = document.querySelector("#filter-section");
    const streamSelect = document.querySelector("#filter-stream");
    const checkedClasses = getCheckedClasses();

    const filters = {
        academicYear: yearSelect.value,
        examName: examSelect.value,
        classes: checkedClasses.join(","),
        section: sectionSelect.value,
        stream: streamSelect ? streamSelect.value : ""
    };

    if (!filters.academicYear || !filters.examName || !filters.classes || !filters.section) {
        showToast("Please select at least one class and fill all filters.", "error");
        return;
    }

    const outputCard = document.querySelector("#results-output-card");
    if (outputCard) outputCard.style.display = "none";

    showLoader();

    try {
        const query = new URLSearchParams(filters).toString();
        const response = await apiRequest(`exam.results.generate?${query}`);

        if (response.success && response.classesResults) {
            currentResults = response.classesResults;

            if (currentResults.length > 0) {
                activeClassVal = currentResults[0].classVal;
                renderTabs();
                renderTable();

                if (outputCard) {
                    outputCard.style.display = "block";
                    setTimeout(() => {
                        outputCard.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 100);
                }
                showToast("Results compiled successfully!", "success");
            } else {
                showToast("No results compiled. Please verify filters.", "warning");
            }
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to generate results.", "error");
    } finally {
        hideLoader();
    }
};

/**
 * Exports the currently displayed HTML table to an Excel file with exact formatting.
 */
const handleExportToExcel = () => {
    const table = document.querySelector(".data-table");
    if (!table) {
        showToast("No data available to export.", "error");
        return;
    }

    const yearSelect = document.querySelector("#filter-academic-year");
    const examSelect = document.querySelector("#filter-exam");
    const sectionSelect = document.querySelector("#filter-section");

    const year = yearSelect ? yearSelect.value : "";
    const examName = examSelect ? examSelect.value : "";
    const section = sectionSelect ? sectionSelect.value : "";

    const filename = `Results_Class_${activeClassVal}_${examName.replace(/\s+/g, '_')}_Section_${section}_${year}.xls`;

    // Clone table to clean styles
    const clonedTable = table.cloneNode(true);
    const html = clonedTable.outerHTML;
    const template = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Class ${activeClassVal} Results</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; }
    th { background-color: #F3F4F6; color: #111827; border: 1px solid #D1D5DB; font-weight: bold; text-align: center; font-size: 11px; padding: 6px; }
    td { border: 1px solid #E5E7EB; padding: 6px; text-align: center; font-size: 11px; }
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `;

    const blob = new Blob([template], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Excel spreadsheet exported successfully!", "success");
};


/**
 * Initializes the Result Generation module view.
 */
export async function initResultGenerationView() {
    try {
        renderNavbar(document.querySelector("#navbar-result-generation"));

        // Setup defaults
        const yearInput = document.querySelector("#filter-academic-year");
        if (yearInput) {
            yearInput.value = getDefaultAcademicYear();
        }

        const examSelect = document.querySelector("#filter-exam");
        if (examSelect) {
            try {
                const res = await apiRequest("exam.list");
                if (res.success && res.exams) {
                    examSelect.innerHTML = '<option value="">Select Exam</option>';
                    res.exams.forEach(exam => {
                        examSelect.innerHTML += `<option value="${exam.name}">${exam.name}</option>`;
                    });
                }
            } catch (err) {
                console.error("Failed to load exams list:", err);
            }
        }

        // Setup filter listeners
        const generateBtn = document.querySelector("#generate-results-btn");
        const searchInput = document.querySelector("#result-search-input");

        document.querySelectorAll('input[name="classes"]').forEach(el => {
            el.addEventListener("change", async () => {
                updateStreamFilterVisibility();
                await updateAvailableSections();
            });
        });

        if (yearInput) {
            yearInput.addEventListener("input", async () => {
                await updateAvailableSections();
            });
        }

        if (generateBtn) {
            generateBtn.addEventListener("click", handleGenerateResults);
        }

        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                searchQuery = e.target.value;
                renderTable();
            });
        }

        const sortSelect = document.querySelector("#result-sort-select");
        if (sortSelect) {
            sortSelect.addEventListener("change", () => {
                renderTable();
            });
        }

        const exportBtn = document.querySelector("#export-excel-btn");
        if (exportBtn) {
            exportBtn.addEventListener("click", handleExportToExcel);
        }

        // Initial setup
        updateStreamFilterVisibility();
        await updateAvailableSections();

    } catch (error) {
        console.error(error);
        showToast("Result Generation could not be initialized.", "error");
    }
}
