"use strict";

import { showToast } from "../../../components/toast.js";
import { showLoader, hideLoader } from "../../../components/loader.js?t=17892929190";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=17892929190";

export const initPortalControlView = async () => {
    const navbarContainer = document.querySelector("#navbar-portal-control");
    if (navbarContainer) {
        renderNavbar(navbarContainer);
    }

    const toggleAdmission = document.querySelector("#toggle-admission-open");
    const toggleResult = document.querySelector("#toggle-result-published");
    const admissionText = document.querySelector("#admission-status-text");
    const resultText = document.querySelector("#result-status-text");

    if (!toggleAdmission || !toggleResult) return;

    // Load initial settings
    showLoader();
    try {
        const response = await apiRequest("settings.load");
        if (response.success && response.settings) {
            const settings = response.settings;

            // Admission Open setting
            const isAdmissionOpen = settings["admission_open"] === "ON" || settings["admission_open"] === "true";
            toggleAdmission.checked = isAdmissionOpen;
            updateStatusText(admissionText, isAdmissionOpen);

            // Result Published setting
            const isResultPublished = settings["result_published"] === "ON" || settings["result_published"] === "true";
            toggleResult.checked = isResultPublished;
            updateStatusText(resultText, isResultPublished);

            // Sync backend settings to localStorage for issue date & assets
            if (settings["report_card_issue_date"]) {
                localStorage.setItem("report_card_issue_date", settings["report_card_issue_date"]);
            }
            Object.keys(settings).forEach(key => {
                if (key.startsWith("report_card_")) {
                    localStorage.setItem(key, settings[key]);
                }
            });
        } else {
            showToast("Failed to load settings.", "error");
        }
    } catch (err) {
        console.error("Failed to load portal settings:", err);
        showToast("Error loading portal settings.", "error");
    } finally {
        hideLoader();
    }

    // Set change listeners
    toggleAdmission.addEventListener("change", async () => {
        const checked = toggleAdmission.checked;
        const value = checked ? "ON" : "OFF";
        
        showLoader();
        try {
            const res = await apiRequest("settings.save", {
                method: "POST",
                body: JSON.stringify({ "admission_open": value })
            });
            if (res.success) {
                updateStatusText(admissionText, checked);
                showToast(`Admission status set to ${value}.`, "success");
            } else {
                toggleAdmission.checked = !checked;
                showToast("Failed to save settings.", "error");
            }
        } catch (err) {
            toggleAdmission.checked = !checked;
            showToast("Error updating settings.", "error");
        } finally {
            hideLoader();
        }
    });

    toggleResult.addEventListener("change", async () => {
        const checked = toggleResult.checked;
        const value = checked ? "ON" : "OFF";
        
        showLoader();
        try {
            const res = await apiRequest("settings.save", {
                method: "POST",
                body: JSON.stringify({ "result_published": value })
            });
            if (res.success) {
                updateStatusText(resultText, checked);
                showToast(`Result publication set to ${value}.`, "success");
            } else {
                toggleResult.checked = !checked;
                showToast("Failed to save settings.", "error");
            }
        } catch (err) {
            toggleResult.checked = !checked;
            showToast("Error updating settings.", "error");
        } finally {
            hideLoader();
        }
    });

    // Populate Academic Session and Exam Name dropdowns for Asset Control
    const assetYearSelect = document.querySelector("#asset-academic-year");
    const assetExamSelect = document.querySelector("#asset-exam-name");

    const getAcademicYears = () => {
        const currentYear = new Date().getFullYear();
        const month = new Date().getMonth() + 1;
        let startYear = month >= 4 ? currentYear : currentYear - 1;
        const current = `${startYear}-${String(startYear + 1).slice(-2)}`;
        const next = `${startYear + 1}-${String(startYear + 2).slice(-2)}`;
        const prev = `${startYear - 1}-${String(startYear).slice(-2)}`;
        return [current, next, prev];
    };

    if (assetYearSelect) {
        const years = getAcademicYears();
        assetYearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
    }

    if (assetExamSelect) {
        try {
            const res = await apiRequest("exam.list");
            if (res.success && res.exams && res.exams.length) {
                assetExamSelect.innerHTML = res.exams.map(e => `<option value="${e.name}">${e.name}</option>`).join("");
            } else {
                assetExamSelect.innerHTML = `
                    <option value="Quarterly">Quarterly</option>
                    <option value="Half Yearly">Half Yearly</option>
                    <option value="Annual">Annual</option>
                `;
            }
        } catch (err) {
            console.error("Failed to load exams for asset control:", err);
            assetExamSelect.innerHTML = `
                <option value="Quarterly">Quarterly</option>
                <option value="Half Yearly">Half Yearly</option>
                <option value="Annual">Annual</option>
            `;
        }
    }

    const refreshAssetControls = [];

    // Signatures and Stamp Asset Management
    setupAssetControl("teacher-sig", "report_card_teacher_sig", "Teacher Signature");
    setupAssetControl("school-stamp", "report_card_school_stamp", "School Rubber-Stamp");
    setupAssetControl("hm-sig", "report_card_hm_sig", "Headmaster Signature");

    const onFilterChange = () => {
        refreshAssetControls.forEach(fn => fn());
    };

    if (assetYearSelect) assetYearSelect.addEventListener("change", onFilterChange);
    if (assetExamSelect) assetExamSelect.addEventListener("change", onFilterChange);

    // Issue Date Control
    const inputIssueDate = document.querySelector("#input-issue-date");
    if (inputIssueDate) {
        const savedDate = localStorage.getItem("report_card_issue_date");
        const todayStr = new Date().toISOString().split("T")[0];
        inputIssueDate.value = savedDate || todayStr;

        inputIssueDate.addEventListener("change", async () => {
            const val = inputIssueDate.value || todayStr;
            localStorage.setItem("report_card_issue_date", val);
            try {
                await apiRequest("settings.save", {
                    method: "POST",
                    body: JSON.stringify({ "report_card_issue_date": val })
                });
                showToast("Issue date updated successfully.", "success");
            } catch (err) {
                console.error("Failed to save issue date to settings:", err);
                showToast("Issue date saved locally.", "info");
            }
        });
    }

    function getEffectiveKey(baseKey) {
        const year = assetYearSelect ? assetYearSelect.value : "";
        const exam = assetExamSelect ? assetExamSelect.value : "";
        if (year && exam) {
            const cleanExam = exam.trim().replace(/\s+/g, '_');
            return `${baseKey}_${year}_${cleanExam}`;
        }
        return baseKey;
    }

const compressImage = (base64Str, maxWidth, maxHeight) => {
    return new Promise((resolve) => {
        if (!base64Str || !base64Str.startsWith("data:image")) {
            resolve(base64Str);
            return;
        }
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxWidth || height > maxHeight) {
                if (width > height) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => {
            resolve(base64Str);
        };
        img.src = base64Str;
    });
};

    function setupAssetControl(type, storageKey, label) {
        const btnUpload = document.querySelector(`#btn-upload-${type}`);
        const fileInput = document.querySelector(`#file-${type}`);
        const previewEl = document.querySelector(`#preview-${type}`);
        const btnRemove = document.querySelector(`#btn-remove-${type}`);

        if (!btnUpload || !fileInput || !previewEl || !btnRemove) return;

        const refreshPreview = () => {
            const currentKey = getEffectiveKey(storageKey);
            let savedData = localStorage.getItem(currentKey);
            if (!savedData) savedData = localStorage.getItem(storageKey);

            if (savedData && savedData !== "REMOVED") {
                previewEl.innerHTML = `<img src="${savedData}" style="max-height: 55px; max-width: 100%; object-fit: contain;">`;
                btnRemove.style.display = "inline-block";
            } else {
                previewEl.innerHTML = `<span style="font-size: 0.8rem; color: var(--color-muted);">No ${label}</span>`;
                btnRemove.style.display = "none";
            }
        };

        refreshPreview();
        refreshAssetControls.push(refreshPreview);

        btnUpload.addEventListener("click", () => fileInput.click());

        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                showToast("File size must be under 2MB.", "error");
                return;
            }
            const reader = new FileReader();
            reader.onload = async (evt) => {
                showLoader();
                let b64 = evt.target.result;
                const isStamp = type.includes("stamp");
                b64 = await compressImage(b64, isStamp ? 250 : 300, isStamp ? 250 : 150);
                const currentKey = getEffectiveKey(storageKey);
                localStorage.setItem(currentKey, b64);
                localStorage.setItem(storageKey, b64);
                refreshPreview();

                try {
                    await apiRequest("settings.save", {
                        method: "POST",
                        body: JSON.stringify({ [currentKey]: b64, [storageKey]: b64 })
                    });
                } catch (err) {
                    console.error("Failed to sync asset to backend settings:", err);
                } finally {
                    hideLoader();
                }
                showToast(`${label} uploaded successfully!`, "success");
            };
            reader.readAsDataURL(file);
        });

        btnRemove.addEventListener("click", async () => {
            const currentKey = getEffectiveKey(storageKey);
            localStorage.setItem(currentKey, "REMOVED");
            localStorage.setItem(storageKey, "REMOVED");
            fileInput.value = "";
            refreshPreview();

            try {
                await apiRequest("settings.save", {
                    method: "POST",
                    body: JSON.stringify({ [currentKey]: "REMOVED", [storageKey]: "REMOVED" })
                });
            } catch (err) {
                console.error("Failed to sync asset removal to backend settings:", err);
            }
            showToast(`${label} removed successfully!`, "info");
        });
    }

    function updateStatusText(el, checked) {
        if (!el) return;
        if (checked) {
            el.textContent = "ON";
            el.className = "status-indicator-text status-open";
        } else {
            el.textContent = "OFF";
            el.className = "status-indicator-text status-closed";
        }
    }
};
