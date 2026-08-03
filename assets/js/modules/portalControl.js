"use strict";

import { showToast } from "../../../components/toast.js";
import { showLoader, hideLoader } from "../../../components/loader.js?t=202608030610";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=202608030610";

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
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const startYear = (currentMonth < 3) ? currentYear - 1 : currentYear;
        const current = `${startYear}-${String(startYear + 1).slice(-2)}`;
        const next = `${startYear + 1}-${String(startYear + 2).slice(-2)}`;
        return [current, next];
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

    // Issue Date & Place Controls + class/stream/section (shared with teacher sig keys)
    const inputIssueDate = document.querySelector("#input-issue-date");
    const inputIssuePlace = document.querySelector("#input-issue-place");
    const assetClassSelect = document.querySelector("#asset-class");
    const assetStreamSelect = document.querySelector("#asset-stream");
    const assetSectionSelect = document.querySelector("#asset-section");

    function getEffectiveKey(baseKey) {
        const year = assetYearSelect ? assetYearSelect.value : "";
        const exam = assetExamSelect ? assetExamSelect.value : "";
        
        let key = baseKey;
        if (year && exam) {
            const cleanExam = exam.trim().replace(/\s+/g, '_');
            key = `${baseKey}_${year}_${cleanExam}`;
        }

        // Apply class/section/stream to teacher sig; class only to issue date/place
        if (baseKey === "report_card_teacher_sig") {
            const cls = assetClassSelect ? assetClassSelect.value : "9";
            const stream = assetStreamSelect && assetStreamSelect.value ? assetStreamSelect.value : "ALL";
            const sec = assetSectionSelect ? assetSectionSelect.value : "A";
            key = `${key}_${cls}_${stream}_${sec}`;
        } else if (baseKey === "report_card_issue_date" || baseKey === "report_card_issue_place") {
            const cls = assetClassSelect ? assetClassSelect.value : "9";
            key = `${key}_${cls}`;
        }
        
        return key;
    }

    const refreshIssuePlaceAndDate = () => {
        const year = assetYearSelect ? assetYearSelect.value : "";
        const exam = assetExamSelect ? assetExamSelect.value : "";
        const cleanExam = exam ? exam.trim().replace(/\s+/g, '_') : "";
        const yearExamPlace = (year && cleanExam) ? `report_card_issue_place_${year}_${cleanExam}` : "";
        const yearExamDate = (year && cleanExam) ? `report_card_issue_date_${year}_${cleanExam}` : "";

        if (inputIssuePlace) {
            const currentPlaceKey = getEffectiveKey("report_card_issue_place");
            let placeVal = localStorage.getItem(currentPlaceKey);
            if (!placeVal && yearExamPlace) placeVal = localStorage.getItem(yearExamPlace);
            if (!placeVal) placeVal = localStorage.getItem("report_card_issue_place") || "MUZAFFARPUR";
            inputIssuePlace.value = placeVal;
        }
        if (inputIssueDate) {
            const currentDateKey = getEffectiveKey("report_card_issue_date");
            let dateVal = localStorage.getItem(currentDateKey);
            // Do not inherit stale bare/global dates — blank means "today on print"
            if (dateVal === null || dateVal === undefined) dateVal = "";
            inputIssueDate.value = dateVal;
        }
    };

    refreshIssuePlaceAndDate();
    refreshAssetControls.push(refreshIssuePlaceAndDate);

    // Unified Save Handler for Signatures, Rubber Stamp, Place & Issue Date
    const btnSaveAllAssets = document.querySelector("#btn-save-all-assets");
    if (btnSaveAllAssets) {
        btnSaveAllAssets.addEventListener("click", async () => {
            showLoader();
            const year = assetYearSelect ? assetYearSelect.value : "";
            const exam = assetExamSelect ? assetExamSelect.value : "";
            const payload = {};

            // 1. Signatures & Stamp — only send newly staged uploads/removals (avoid re-POSTing huge base64 every save)
            for (const ctrl of assetControls) {
                if (!ctrl) continue;
                const data = ctrl.getPendingChange();
                if (data !== null) {
                    const currentKey = ctrl.getEffectiveKey();
                    localStorage.setItem(currentKey, data);
                    payload[currentKey] = data;
                    // HM sig & stamp are session/exam scoped (not class); keep bare key too
                    if (ctrl.storageKey === "report_card_hm_sig" || ctrl.storageKey === "report_card_school_stamp") {
                        localStorage.setItem(ctrl.storageKey, data);
                        payload[ctrl.storageKey] = data;
                    }
                }
            }

            // 2. Issue Place & Date per session, exam & class (optional — blank date = use today on print)
            if (inputIssuePlace) {
                const placeVal = (inputIssuePlace.value || "MUZAFFARPUR").trim().toUpperCase();
                const placeKey = getEffectiveKey("report_card_issue_place");
                localStorage.setItem(placeKey, placeVal);
                payload[placeKey] = placeVal;
            }

            if (inputIssueDate) {
                const dateVal = (inputIssueDate.value || "").trim();
                const dateKey = getEffectiveKey("report_card_issue_date");
                // Empty means "use today's date when printing" — clear any previous class-scoped date
                localStorage.setItem(dateKey, dateVal);
                payload[dateKey] = dateVal;
            }

            if (Object.keys(payload).length > 0) {
                try {
                    await apiRequest("settings.save", {
                        method: "POST",
                        body: JSON.stringify(payload)
                    });
                    try { sessionStorage.removeItem("uhs_report_card_settings_v2"); } catch (_) {}
                    const clsLabel = assetClassSelect && assetClassSelect.value ? ` · Class ${assetClassSelect.value}` : "";
                    const sessionExamLabel = (year && exam) ? ` for ${year} (${exam})${clsLabel}` : clsLabel;
                    showToast(`Report Card details saved & synced successfully${sessionExamLabel}!`, "success");
                } catch (err) {
                    console.error("Failed to sync report card details to backend settings:", err);
                    showToast("Report card details saved locally on device.", "info");
                } finally {
                    hideLoader();
                    assetControls.forEach(ctrl => ctrl && ctrl.refreshPreview());
                    refreshIssuePlaceAndDate();
                }
            } else {
                hideLoader();
                showToast("All report card details are up to date.", "info");
            }
        });
    }

    const onFilterChange = () => {
        refreshAssetControls.forEach(fn => fn());
    };

    if (assetYearSelect) assetYearSelect.addEventListener("change", onFilterChange);
    if (assetExamSelect) assetExamSelect.addEventListener("change", onFilterChange);
    if (assetClassSelect) assetClassSelect.addEventListener("change", onFilterChange);
    if (assetStreamSelect) assetStreamSelect.addEventListener("change", onFilterChange);
    if (assetSectionSelect) assetSectionSelect.addEventListener("change", onFilterChange);

    // Toggle stream visibility based on class selection
    const syncStreamVisibility = () => {
        if (!assetStreamSelect) return;
        const streamWrap = assetStreamSelect.closest("div");
        if (parseInt(assetClassSelect && assetClassSelect.value, 10) >= 11) {
            assetStreamSelect.style.display = "block";
            if (streamWrap) streamWrap.style.display = "flex";
        } else {
            assetStreamSelect.style.display = "none";
            assetStreamSelect.value = "";
            if (streamWrap) streamWrap.style.display = "none";
        }
    };
    if (assetClassSelect) {
        assetClassSelect.addEventListener("change", syncStreamVisibility);
        syncStreamVisibility();
    }

    function setupAssetControl(type, storageKey, label) {
        const btnUpload = document.querySelector(`#btn-upload-${type}`);
        const fileInput = document.querySelector(`#file-${type}`);
        const previewEl = document.querySelector(`#preview-${type}`);
        const btnRemove = document.querySelector(`#btn-remove-${type}`);

        if (!btnUpload || !fileInput || !previewEl || !btnRemove) return null;

        let pendingBase64 = null;

        const refreshPreview = () => {
            pendingBase64 = null;
            const currentKey = getEffectiveKey(storageKey);
            let savedData = localStorage.getItem(currentKey);

            // Explicit removal at this scope must not fall back to an older bare key
            if (savedData === "REMOVED") {
                previewEl.innerHTML = `<span style="font-size: 0.8rem; color: var(--color-muted);">No ${label}</span>`;
                btnRemove.style.display = "none";
                return;
            }

            if (!savedData) {
                savedData = localStorage.getItem(storageKey);
                if (savedData === "REMOVED") savedData = "";
            }

            if (savedData) {
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
            reader.onload = (evt) => {
                showLoader();
                let b64 = evt.target.result;
                
                // Use raw uncompressed image for premium print quality
                pendingBase64 = b64;
                hideLoader();

                previewEl.innerHTML = `<img src="${pendingBase64}" style="max-height: 60px; max-width: 100%; object-fit: contain; border: 2px solid var(--color-primary); border-radius: 4px;">`;
                showToast(`${label} selected. Click 'Save All Assets' below to apply changes!`, "info");
            };
            reader.readAsDataURL(file);
        });

        btnRemove.addEventListener("click", () => {
            pendingBase64 = "REMOVED";
            fileInput.value = "";
            previewEl.innerHTML = `<span style="font-size: 0.8rem; color: var(--color-danger); font-weight: 600;">[Marked for Removal]</span>`;
            showToast(`${label} marked for removal. Click 'Save All Assets' below to confirm!`, "info");
        });

        return {
            storageKey,
            getEffectiveKey: () => getEffectiveKey(storageKey),
            /** Returns pending upload/removal only; null means unchanged this session */
            getPendingChange: () => pendingBase64,
            getStagedData: () => {
                if (pendingBase64 !== null) return pendingBase64;
                const currentKey = getEffectiveKey(storageKey);
                return localStorage.getItem(currentKey) || localStorage.getItem(storageKey) || "";
            },
            refreshPreview
        };
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

    const assetControls = [
        setupAssetControl("teacher-sig", "report_card_teacher_sig", "Teacher Signature"),
        setupAssetControl("school-stamp", "report_card_school_stamp", "School Stamp"),
        setupAssetControl("hm-sig", "report_card_hm_sig", "HM Signature")
    ];
};
