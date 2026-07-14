"use strict";

import { showToast } from "../../../components/toast.js";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=17892929155";
import { hideLoader, showLoader } from "../../../components/loader.js?t=17892929155";

let parsedStudents = [];
let fileAcademicYear = "";

/**
 * Initializes the Sync SchoolDB view.
 */
export function initSyncSchoolDBView() {
    try {
        renderNavbar(document.querySelector("#navbar-sync-schooldb"));

        const dropZone = document.getElementById("drop-zone");
        const fileInput = document.getElementById("excel-file-input");
        const summaryCard = document.getElementById("summary-card");
        const btnCancel = document.getElementById("btn-cancel-sync");
        const btnStart = document.getElementById("btn-start-sync");

        if (!dropZone || !fileInput) return;

        // Reset elements
        if (summaryCard) summaryCard.style.display = "none";
        dropZone.style.display = "block";

        // Prevent default drag behaviors
        ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // Highlight drop zone when item is dragged over it
        ["dragenter", "dragover"].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.style.borderColor = "var(--color-primary)";
                dropZone.style.background = "rgba(79, 70, 229, 0.05)";
            }, false);
        });

        ["dragleave", "drop"].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.style.borderColor = "var(--color-border)";
                dropZone.style.background = "rgba(249, 250, 251, 0.3)";
            }, false);
        });

        // Handle dropped files
        dropZone.addEventListener("drop", (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                fileInput.files = files;
                handleFileSelect(files[0]);
            }
        });

        // Click to browse
        dropZone.addEventListener("click", () => {
            fileInput.click();
        });

        fileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });

        if (btnCancel) {
            btnCancel.onclick = () => {
                resetUpload();
            };
        }

        if (btnStart) {
            btnStart.onclick = async () => {
                if (parsedStudents.length === 0) {
                    showToast("No parsed student data to sync.", "error");
                    return;
                }
                await performSync();
            };
        }

    } catch (error) {
        console.error(error);
        showToast("Sync SchoolDB view could not be initialized.", "error");
    }
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function resetUpload() {
    parsedStudents = [];
    fileAcademicYear = "";
    const fileInput = document.getElementById("excel-file-input");
    if (fileInput) fileInput.value = "";
    
    const summaryCard = document.getElementById("summary-card");
    if (summaryCard) summaryCard.style.display = "none";
    
    const dropZone = document.getElementById("drop-zone");
    if (dropZone) dropZone.style.display = "block";
    
    showToast("File selection reset.", "info");
}

function handleFileSelect(file) {
    if (!file) return;

    // Check if XLSX global is available (loaded via CDN in index.html)
    if (typeof XLSX === "undefined") {
        showToast("Excel parsing library is not loaded. Please try refreshing.", "error");
        return;
    }

    showLoader();

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            
            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            // Parse as JSON
            const rows = XLSX.utils.sheet_to_json(sheet);
            if (rows.length === 0) {
                throw new Error("The selected sheet is empty.");
            }

            // Verify some key columns
            const firstRow = rows[0];
            const keys = Object.keys(firstRow);
            
            // Validate required columns
            const required = ["studentName", "academicYear", "className", "rollNo"];
            const missing = required.filter(col => !keys.includes(col));
            
            if (missing.length > 0) {
                throw new Error(`Invalid scraper output file. Missing required columns: ${missing.join(", ")}`);
            }

            parsedStudents = rows.map(row => {
                // Ensure proper types and string sanitation
                return {
                    udiseCode: row.udiseCode ? String(row.udiseCode).trim() : "",
                    studentCode: row.studentCode ? String(row.studentCode).trim() : "",
                    schoolName: row.schoolName ? String(row.schoolName).trim() : "",
                    academicYear: row.academicYear ? String(row.academicYear).trim() : "",
                    className: row.className ? String(row.className).trim() : "",
                    stream: row.stream ? String(row.stream).trim() : "",
                    section: row.section ? String(row.section).trim() : "",
                    rollNo: row.rollNo !== undefined ? row.rollNo : "",
                    genderName: row.genderName ? String(row.genderName).trim() : "",
                    studentName: row.studentName ? String(row.studentName).trim() : "",
                    fatherName: row.fatherName ? String(row.fatherName).trim() : "",
                    motherName: row.motherName ? String(row.motherName).trim() : "",
                    dob: row.dob ? String(row.dob).trim() : "",
                    mobile: row.mobile ? String(row.mobile).trim() : "",
                    admissionNo: row.admissionNo ? String(row.admissionNo).trim() : "",
                    admissionDate: row.admissionDate ? String(row.admissionDate).trim() : "",
                    detail__accHolderName: row.detail__accHolderName ? String(row.detail__accHolderName).trim() : "",
                    detail__accHolderType: row.detail__accHolderType ? String(row.detail__accHolderType).trim() : "",
                    detail__bankAccNo: row.detail__bankAccNo ? String(row.detail__bankAccNo).trim() : "",
                    detail__IFSC: row.detail__IFSC ? String(row.detail__IFSC).trim() : "",
                    detail__bankName: row.detail__bankName ? String(row.detail__bankName).trim() : "",
                    detail__otherBankName: row.detail__otherBankName ? String(row.detail__otherBankName).trim() : "",
                    aadhaar: row.aadhaar ? String(row.aadhaar).trim() : "",
                    detail__aadhaarName: row.detail__aadhaarName ? String(row.detail__aadhaarName).trim() : ""
                };
            });

            // Detect Academic Session
            const sessions = [...new Set(parsedStudents.map(s => s.academicYear).filter(Boolean))];
            fileAcademicYear = sessions.join(", ");

            // Detect Schools / UDISE codes
            const schools = [...new Set(parsedStudents.map(s => `${s.schoolName || "Unknown"} (${s.udiseCode || "N/A"})`).filter(Boolean))];

            // Render summary info
            document.getElementById("summary-filename").textContent = file.name;
            document.getElementById("summary-session").textContent = fileAcademicYear || "Not Detected";
            document.getElementById("summary-count").textContent = `${parsedStudents.length} Students`;
            document.getElementById("summary-schools").textContent = schools.slice(0, 3).join(" | ") + (schools.length > 3 ? "..." : "");

            // Toggle cards
            document.getElementById("summary-card").style.display = "block";
            document.getElementById("drop-zone").style.display = "none";
            showToast("Excel file loaded and verified successfully.", "success");

        } catch (error) {
            console.error(error);
            showToast(error.message || "Failed to parse Excel file.", "error");
            resetUpload();
        } finally {
            hideLoader();
        }
    };
    reader.readAsArrayBuffer(file);
}

async function performSync() {
    showLoader();
    try {
        const response = await apiRequest("student.master.sync", {
            method: "POST",
            body: JSON.stringify({
                students: parsedStudents
            })
        });

        if (response.success) {
            showToast(response.message || "Database synchronized successfully.", "success");
            resetUpload();
        } else {
            throw new Error(response.error || "Failed to synchronize database.");
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || "Sync failed. Please try again.", "error");
    } finally {
        hideLoader();
    }
}
