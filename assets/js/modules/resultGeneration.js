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

    // Build Headers
    let headerRow = `<tr style="border-bottom: 2px solid var(--color-border);">
        <th style="padding: 12px 16px; font-weight: 700; color: var(--color-text); text-align: center; width: 80px;">Roll No</th>
        <th style="padding: 12px 16px; font-weight: 700; color: var(--color-text);">Student Name</th>
        <th style="padding: 12px 16px; font-weight: 700; color: var(--color-text);">Father Name</th>`;
    
    activeSubjects.forEach(sub => {
        let label = sub.name;
        if (sub.code) {
            label += ` (${sub.code})`;
        }
        if (sub.group) {
            const g = sub.group.toLowerCase();
            if (g === "language1") {
                label += " [L1]";
            } else if (g === "language2") {
                label += " [L2]";
            } else if (g === "additional") {
                label += " [Add]";
            } else if (g.startsWith("elective")) {
                label += " [Ele]";
            }
        }
        headerRow += `<th style="padding: 12px 16px; font-weight: 700; color: var(--color-text); text-align: center; white-space: nowrap;">${label}</th>`;
    });

    headerRow += `
        <th style="padding: 12px 16px; font-weight: 700; color: var(--color-text); text-align: center; width: 120px;">Grand Total</th>
        <th style="padding: 12px 16px; font-weight: 700; color: var(--color-text); text-align: center; width: 90px;">Percentage</th>
        <th style="padding: 12px 16px; font-weight: 700; color: var(--color-text); text-align: center; width: 180px;">Result / Division</th>
        <th style="padding: 12px 16px; font-weight: 700; color: var(--color-text); text-align: center; width: 70px;">Rank</th>
    </tr>`;

    thead.innerHTML = headerRow;

    // Build Rows
    if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 30px; color: var(--color-muted);">No matching student results found.</td></tr>`;
        return;
    }

    filteredStudents.forEach((res, index) => {
        let rowHtml = `<tr style="border-bottom: 1px solid var(--color-border); ${index % 2 === 0 ? 'background: #FFFFFF;' : 'background: #F9FAFB;'}">
            <td style="padding: 12px 16px; text-align: center; font-weight: 600; color: var(--color-primary);">${res.rollNo}</td>
            <td style="padding: 12px 16px; font-weight: 600; color: var(--color-text);">${res.studentName}</td>
            <td style="padding: 12px 16px; color: var(--color-muted);">${res.fatherName}</td>`;

        activeSubjects.forEach(sub => {
            const score = res.subjectScores[sub.subjectId] || "-";
            rowHtml += `<td style="padding: 12px 16px; text-align: center; font-weight: 600;">${score}</td>`;
        });

        // Pass/Fail badge style for Result / Division
        let resultBadgeStyle = "color: var(--color-success); font-weight: bold;";
        if (res.result === "Fail") {
            resultBadgeStyle = "color: var(--color-danger); font-weight: bold;";
        } else if (res.result === "Compartmental") {
            resultBadgeStyle = "color: #e67e22; font-weight: bold;";
        }

        rowHtml += `
            <td style="padding: 12px 16px; text-align: center; font-weight: 700; color: var(--color-text);">${res.grandTotal} / ${res.totalMaxMarks}</td>
            <td style="padding: 12px 16px; text-align: center; font-weight: 600; color: var(--color-muted);">${res.percentage}</td>
            <td style="padding: 12px 16px; text-align: center; ${resultBadgeStyle}">${res.division}</td>
            <td style="padding: 12px 16px; text-align: center; font-weight: 700; color: var(--color-primary);">${res.rank}</td>
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
