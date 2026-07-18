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
