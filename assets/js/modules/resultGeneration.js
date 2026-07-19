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
const TH = "padding: 12px 16px; font-weight: 700; color: var(--color-text);";
const TH_C = TH + " text-align: center;";
const TD = "padding: 12px 16px;";
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
            <th rowspan="3" style="${TH_C} width: 50px;">SL NO</th>
            <th rowspan="3" style="${TH_C} width: 80px;">ROLL NO.</th>
            <th rowspan="3" style="${TH_C} width: 60px;">CLASS</th>
            <th rowspan="3" style="${TH} min-width: 150px; max-width: 200px;">STUDENT NAME</th>
            <th rowspan="3" style="${TH} min-width: 150px; max-width: 200px;">MOTHER'S NAME</th>
            <th rowspan="3" style="${TH} min-width: 150px; max-width: 200px;">FATHER'S NAME</th>
            <th rowspan="3" style="${TH_C} width: 50px;">GENDER</th>
            <th colspan="6" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED(THEORY)</th>
            <th colspan="3" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED (INTERNAL ASSEMENT & PRACTICAL)</th>
            <th rowspan="3" style="${TH_C} width: 100px; ${BL}">AGGREGATE</th>
            <th rowspan="3" style="${TH_C} width: 100px;">RESULT</th>
        </tr>`;

        // Row 2: theory labels and practical category labels
        row2 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th rowspan="2" style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL}">MIL</th>
            <th rowspan="2" style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center;">SIL</th>
            <th rowspan="2" style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center;">MAT</th>
            <th rowspan="2" style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center;">SCI</th>
            <th rowspan="2" style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center;">SSC</th>
            <th rowspan="2" style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center;">ENG</th>
            
            <th rowspan="2" style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL}">SCI</th>
            <th colspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BB}">SSC</th>
        </tr>`;

        // Row 3: sub-columns for SSC practicals (LIT.ACT and Project Wrok)
        row3 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th style="padding: 6px; font-weight: 600; text-align: center; font-size: 0.8em; ${BL}">LIT.ACT</th>
            <th style="padding: 6px; font-weight: 600; text-align: center; font-size: 0.8em;">Project Wrok</th>
        </tr>`;

    } else {
        // ── Two-row header (for Theory-only exams) ──
        row1 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th rowspan="2" style="${TH_C} width: 50px;">SL NO</th>
            <th rowspan="2" style="${TH_C} width: 80px;">ROLL NO.</th>
            <th rowspan="2" style="${TH_C} width: 60px;">CLASS</th>
            <th rowspan="2" style="${TH} min-width: 150px; max-width: 200px;">STUDENT NAME</th>
            <th rowspan="2" style="${TH} min-width: 150px; max-width: 200px;">MOTHER'S NAME</th>
            <th rowspan="2" style="${TH} min-width: 150px; max-width: 200px;">FATHER'S NAME</th>
            <th rowspan="2" style="${TH_C} width: 50px;">GENDER</th>
            <th colspan="6" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED(THEORY)</th>
            <th rowspan="2" style="${TH_C} width: 100px; ${BL}">AGGREGATE</th>
            <th rowspan="2" style="${TH_C} width: 100px;">RESULT</th>
        </tr>`;

        row2 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL}">MIL</th>
            <th style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center;">SIL</th>
            <th style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center;">MAT</th>
            <th style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center;">SCI</th>
            <th style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center;">SSC</th>
            <th style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center;">ENG</th>
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
            <td style="${TD} font-weight: 600; min-width: 150px; max-width: 200px;">${res.studentName}</td>
            <td style="${TD} font-size: 0.9em; color: var(--color-muted); min-width: 150px; max-width: 200px;">${res.motherName || ""}</td>
            <td style="${TD} font-size: 0.9em; color: var(--color-muted); min-width: 150px; max-width: 200px;">${res.fatherName || ""}</td>
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
    // Determine if elective/additional subjects have practical exams configured
    const buildElectiveSubHeaders = (sub) => {
        if (!sub) return { headers: "", colSpan: 2 };
        const hasPrac = (sub.pMax || 0) > 0;
        if (hasPrac) {
            return { headers: "Theory|Practical|Marks", colSpan: 4 }; // Subject (1) + Theory (1) + Practical (1) + Marks (1)
        } else {
            return { headers: "Theory|Marks", colSpan: 2 }; // Subject (1) + Marks (1)
        }
    };

    // Find subject configurations from activeSubjects for elective and additional slots
    const firstStudent = filteredStudents[0];
    const getSubjectConfig = (slotId) => {
        if (!slotId) return null;
        return activeSubjects.find(s => String(s.subjectId) === String(slotId)) || null;
    };

    const e1Config = firstStudent ? getSubjectConfig(firstStudent.elective1) : null;
    const e2Config = firstStudent ? getSubjectConfig(firstStudent.elective2) : null;
    const e3Config = firstStudent ? getSubjectConfig(firstStudent.elective3) : null;
    const addConfig = firstStudent ? getSubjectConfig(firstStudent.additional) : null;

    const e1Cols = buildElectiveSubHeaders(e1Config);
    const e2Cols = buildElectiveSubHeaders(e2Config);
    const e3Cols = buildElectiveSubHeaders(e3Config);
    const addCols = buildElectiveSubHeaders(addConfig);

    const electiveColSpan = e1Cols.colSpan + e2Cols.colSpan + e3Cols.colSpan;
    const additionalColSpan = addCols.colSpan;

    // ── Row 1 ──
    let headerRow = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
        <th rowspan="2" style="${TH_C}">Roll no.</th>
        <th rowspan="2" style="${TH_C}">Class</th>
        <th rowspan="2" style="${TH}">Student's Name<br>Mother's Name<br>Father's Name</th>
        <th rowspan="2" style="${TH_C}">M/F</th>
        <th colspan="4" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">Compulsory Language Subjects</th>
        <th colspan="${electiveColSpan}" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">Elective Subjects</th>
        <th colspan="${additionalColSpan}" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">Additional Subjects</th>
        <th rowspan="2" style="${TH_C} ${BL}">Aggregate & Result</th>
        <th rowspan="2" style="${TH_C}">Result</th>
    </tr>`;

    // ── Row 2: Sub-headers ──
    let subRow = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">`;
    // Compulsory languages: always Subject | Marks
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL}">Subject - 1</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Marks</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Subject - 2</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Marks</th>`;

    // Elective 1
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL}">Subject - 1</th>`;
    if (e1Cols.colSpan === 4) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Marks</th>`;

    // Elective 2
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL}">Subject - 2</th>`;
    if (e2Cols.colSpan === 4) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Marks</th>`;

    // Elective 3
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL}">Subject - 3</th>`;
    if (e3Cols.colSpan === 4) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Marks</th>`;

    // Additional
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL}">Subject</th>`;
    if (addCols.colSpan === 4) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Marks</th>`;

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

        let combinedName = `<div style="text-align:left; font-weight:600;">${res.studentName}</div>`;
        if (res.motherName && res.motherName !== "-") {
            combinedName += `<div style="text-align:left; font-size: 0.85em; color: var(--color-muted);">${res.motherName}</div>`;
        }
        if (res.fatherName && res.fatherName !== "-") {
            combinedName += `<div style="text-align:left; font-size: 0.85em; color: var(--color-muted);">${res.fatherName}</div>`;
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
            <td style="padding: 8px 16px; line-height: 1.4;">${combinedName}</td>
            <td style="${TD_C} font-weight: 600;">${genderText}</td>
            
            <td style="padding: 12px 8px; text-align: center; ${BL} font-size: 0.9em;">${sdL1.name}</td>
            <td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdL1.totalObt}</td>
            <td style="padding: 12px 8px; text-align: center; font-size: 0.9em;">${sdL2.name}</td>
            <td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdL2.totalObt}</td>

            <td style="padding: 12px 8px; text-align: center; ${BL} font-size: 0.9em;">${sdE1.name}</td>`;

        // Elective 1
        if (e1Config && (e1Config.pMax || 0) > 0) {
            rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdE1.theoryObt}</td>`;
            rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdE1.practicalObt}</td>`;
        }
        rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdE1.totalObt}</td>`;

        // Elective 2
        rowHtml += `<td style="padding: 12px 8px; text-align: center; font-size: 0.9em;">${sdE2.name}</td>`;
        if (e2Config && (e2Config.pMax || 0) > 0) {
            rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdE2.theoryObt}</td>`;
            rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdE2.practicalObt}</td>`;
        }
        rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdE2.totalObt}</td>`;

        // Elective 3
        rowHtml += `<td style="padding: 12px 8px; text-align: center; font-size: 0.9em;">${sdE3.name}</td>`;
        if (e3Config && (e3Config.pMax || 0) > 0) {
            rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdE3.theoryObt}</td>`;
            rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdE3.practicalObt}</td>`;
        }
        rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdE3.totalObt}</td>`;

        // Additional
        rowHtml += `<td style="padding: 12px 8px; text-align: center; ${BL} font-size: 0.9em;">${sdAdd.name}</td>`;
        if (addConfig && (addConfig.pMax || 0) > 0) {
            rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdAdd.theoryObt}</td>`;
            rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdAdd.practicalObt}</td>`;
        }
        rowHtml += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sdAdd.totalObt}</td>`;

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

        // Initial setup
        updateStreamFilterVisibility();
        await updateAvailableSections();

    } catch (error) {
        console.error(error);
        showToast("Result Generation could not be initialized.", "error");
    }
}
