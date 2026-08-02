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

    // Issue Date & Place Controls
    const inputIssueDate = document.querySelector("#input-issue-date");
    const inputIssuePlace = document.querySelector("#input-issue-place");

    if (inputIssuePlace) {
        const savedPlace = localStorage.getItem("report_card_issue_place") || "MUZAFFARPUR";
        inputIssuePlace.value = savedPlace;

        inputIssuePlace.addEventListener("change", async () => {
            const val = (inputIssuePlace.value || "MUZAFFARPUR").trim().toUpperCase();
            localStorage.setItem("report_card_issue_place", val);
            try {
                await apiRequest("settings.save", {
                    method: "POST",
                    body: JSON.stringify({ "report_card_issue_place": val })
                });
                showToast("Report card place updated successfully.", "success");
            } catch (err) {
                console.error("Failed to save issue place to settings:", err);
                showToast("Issue place saved locally.", "info");
            }
        });
    }

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
                if (width / maxWidth > height / maxHeight) {
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
        const btnSave = document.querySelector(`#btn-save-${type}`);
        const fileInput = document.querySelector(`#file-${type}`);
        const previewEl = document.querySelector(`#preview-${type}`);
        const btnRemove = document.querySelector(`#btn-remove-${type}`);

        if (!btnUpload || !fileInput || !previewEl || !btnRemove) return;

        let pendingBase64 = null;

        const refreshPreview = () => {
            pendingBase64 = null;
            if (btnSave) btnSave.disabled = true;
            const currentKey = getEffectiveKey(storageKey);
            let savedData = localStorage.getItem(currentKey);
            if (!savedData) savedData = localStorage.getItem(storageKey);

            if (savedData && savedData !== "REMOVED") {
                previewEl.innerHTML = `<img src="${savedData}" style="max-height: 60px; max-width: 100%; object-fit: contain;">`;
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
            if (file.size > 3 * 1024 * 1024) {
                showToast("File size must be under 3MB.", "error");
                return;
            }
            const reader = new FileReader();
            reader.onload = async (evt) => {
                showLoader();
                let b64 = evt.target.result;
                const isStamp = type.includes("stamp");
                const isHm = type.includes("hm");
                
                // Predefined Dimensions:
                // Stamp: 320x160 px (Rectangular)
                // HM Sig: 320x110 px
                // Teacher Sig: 300x100 px
                const maxW = isStamp ? 320 : (isHm ? 320 : 300);
                const maxH = isStamp ? 160 : (isHm ? 110 : 100);

                pendingBase64 = await compressImage(b64, maxW, maxH);
                hideLoader();

                previewEl.innerHTML = `<img src="${pendingBase64}" style="max-height: 60px; max-width: 100%; object-fit: contain; border: 1px solid var(--color-primary);">`;
                if (btnSave) btnSave.disabled = false;
                showToast(`${label} selected. Click 'Save' to apply & sync with report cards!`, "info");
            };
            reader.readAsDataURL(file);
        });

        const saveAssetAction = async () => {
            if (!pendingBase64) {
                showToast("No new image selected to save.", "info");
                return;
            }
            showLoader();
            const currentKey = getEffectiveKey(storageKey);
            localStorage.setItem(currentKey, pendingBase64);
            localStorage.setItem(storageKey, pendingBase64);

            try {
                await apiRequest("settings.save", {
                    method: "POST",
                    body: JSON.stringify({ [currentKey]: pendingBase64, [storageKey]: pendingBase64 })
                });
                showToast(`${label} saved & synced with report cards successfully!`, "success");
            } catch (err) {
                console.error("Failed to sync asset to backend settings:", err);
                showToast(`${label} saved locally on device.`, "info");
            } finally {
                hideLoader();
                refreshPreview();
            }
        };

        if (btnSave) {
            btnSave.addEventListener("click", saveAssetAction);
        }

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
