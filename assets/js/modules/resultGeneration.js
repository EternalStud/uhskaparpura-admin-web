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
    const hasPrac = hasPracticalExam(activeSubjects);

    // Compute total subject column span
    let subColSpan = 0;
    activeSubjects.forEach(sub => {
        subColSpan += 1; // always at least 1 marks column
        if (hasPrac && (sub.pMax || 0) > 0) {
            subColSpan += 1; // extra practical column for subjects that have it
        }
    });

    const marksHeader = hasPrac ? "MARKS OBTAINED" : "MARKS OBTAINED(THEORY)";

    // ── Row 1: Top headers ──
    let row1 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
        <th rowspan="2" style="${TH_C} width: 50px;">SL NO</th>
        <th rowspan="2" style="${TH_C} width: 80px;">ROLL NO.</th>
        <th rowspan="2" style="${TH_C} width: 60px;">CLASS</th>
        <th rowspan="2" style="${TH}">STUDENT NAME</th>
        <th rowspan="2" style="${TH}">MOTHER'S NAME</th>
        <th rowspan="2" style="${TH}">FATHER'S NAME</th>
        <th rowspan="2" style="${TH_C} width: 50px;">GENDER</th>
        <th colspan="${subColSpan}" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">${marksHeader}</th>
        <th rowspan="2" style="${TH_C} width: 100px; ${BL}">AGGREGATE</th>
        <th rowspan="2" style="${TH_C} width: 100px;">RESULT</th>
    </tr>`;

    // ── Row 2: Subject abbreviation sub-headers ──
    let row2 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">`;
    activeSubjects.forEach((sub, i) => {
        const label = getSubjectAbbrev910(sub);
        const subHasPrac = hasPrac && (sub.pMax || 0) > 0;
        if (subHasPrac) {
            // Two sub-columns for this subject: Theory and Practical (under one subject header)
            row2 += `<th colspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${i === 0 ? BL : ''} ${BB}">${label}</th>`;
        } else {
            row2 += `<th rowspan="1" style="padding: 12px 8px; font-weight: 700; color: var(--color-text); text-align: center; white-space: nowrap; ${i === 0 ? BL : ''}">${label}</th>`;
        }
    });
    row2 += `</tr>`;

    // If we have practicals, add a 3rd row showing Th/Pr sub-headers only for subjects that have practicals
    let row3 = "";
    if (hasPrac) {
        row3 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">`;
        activeSubjects.forEach((sub, i) => {
            const subHasPrac = (sub.pMax || 0) > 0;
            if (subHasPrac) {
                row3 += `<th style="padding: 6px; font-weight: 600; text-align: center; font-size: 0.8em; ${i === 0 ? BL : ''}">Th</th>`;
                row3 += `<th style="padding: 6px; font-weight: 600; text-align: center; font-size: 0.8em;">Pr</th>`;
            } else {
                row3 += `<th style="padding: 6px; font-weight: 600; text-align: center; font-size: 0.8em; ${i === 0 ? BL : ''}">Marks</th>`;
            }
        });
        row3 += `</tr>`;

        // Adjust: Row 1 fixed rowspans need to be 3 now
        row1 = row1.replace(/rowspan="2"/g, 'rowspan="3"');
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

        let rowHtml = `<tr style="border-bottom: 1px solid var(--color-border); ${index % 2 === 0 ? 'background: #FFFFFF;' : 'background: #F9FAFB;'}">
            <td style="${TD_C} font-weight: 600;">${index + 1}</td>
            <td style="${TD_C} font-weight: 600;">${res.rollNo}</td>
            <td style="${TD_C} font-weight: 600;">${classNumeral}</td>
            <td style="${TD} font-weight: 600;">${res.studentName}</td>
            <td style="${TD} font-size: 0.9em; color: var(--color-muted);">${res.motherName || ""}</td>
            <td style="${TD} font-size: 0.9em; color: var(--color-muted);">${res.fatherName || ""}</td>
            <td style="${TD_C} font-weight: 600;">${genderText}</td>`;

        activeSubjects.forEach((sub, i) => {
            const subHasPrac = hasPrac && (sub.pMax || 0) > 0;
            if (subHasPrac) {
                const th = getScore(res.subjectScores, sub.subjectId, "theoryObt");
                const pr = getScore(res.subjectScores, sub.subjectId, "practicalObt");
                rowHtml += `<td style="${TD_C} font-weight: 600; ${i === 0 ? BL : ''}">${th}</td>`;
                rowHtml += `<td style="${TD_C} font-weight: 600;">${pr}</td>`;
            } else {
                const totalOrTheory = getScore(res.subjectScores, sub.subjectId, "totalObt");
                rowHtml += `<td style="${TD_C} font-weight: 600; ${i === 0 ? BL : ''}">${totalOrTheory}</td>`;
            }
        });

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

    // Determine if elective subjects have practical exams configured
    // We check from the first student's subject details since all students share the same exam config
    // But we already have pMax in activeSubjects now from backend
    const buildElectiveSubHeaders = (sub) => {
        if (!sub) return { headers: "", colSpan: 1 };
        const hasPrac = (sub.pMax || 0) > 0;
        if (hasPrac) {
            return { headers: "Theory|Practical|Marks", colSpan: 3 };
        } else {
            return { headers: "Theory|Marks", colSpan: 2 };
        }
    };

    // Find subject configs from activeSubjects for the elective slots
    // We use the first student's slot IDs to get the actual subject configs
    const firstStudent = filteredStudents[0];
    const getSubjectConfig = (slotId) => {
        if (!slotId) return null;
        return activeSubjects.find(s => String(s.subjectId) === String(slotId)) || null;
    };

    // Get elective configs for column headers
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
    if (e1Cols.colSpan === 3) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Marks</th>`;

    // Elective 2
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Subject - 2</th>`;
    if (e2Cols.colSpan === 3) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Marks</th>`;

    // Elective 3
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Subject - 3</th>`;
    if (e3Cols.colSpan === 3) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center;">Marks</th>`;

    // Additional
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL}">Subject</th>`;
    if (addCols.colSpan === 3) {
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

        // Build elective data cells
        const renderElectiveCell = (sd, config) => {
            let cells = "";
            cells += `<td style="padding: 12px 8px; text-align: center; font-size: 0.9em;">${sd.name}</td>`;
            if (config && (config.pMax || 0) > 0) {
                cells += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sd.theoryObt}</td>`;
                cells += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sd.practicalObt}</td>`;
            }
            cells += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sd.totalObt}</td>`;
            return cells;
        };

        const renderAdditionalCell = (sd, config) => {
            let cells = "";
            cells += `<td style="padding: 12px 8px; text-align: center; ${BL} font-size: 0.9em;">${sd.name}</td>`;
            if (config && (config.pMax || 0) > 0) {
                cells += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sd.theoryObt}</td>`;
                cells += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sd.practicalObt}</td>`;
            }
            cells += `<td style="padding: 12px 8px; text-align: center; font-weight: 600;">${sd.totalObt}</td>`;
            return cells;
        };

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
