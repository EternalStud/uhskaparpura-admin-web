"use strict";

import { openModal } from "../../../components/modal.js";
import { showToast } from "../../../components/toast.js";
import { apiRequest } from "../../../services/api.js";

const VIEW_PATH = "views/prepareExam.html";

const getDefaultAcademicYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const startYear = (currentMonth < 3) ? currentYear - 1 : currentYear;
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const getAcademicYears = () => {
    const current = getDefaultAcademicYear();
    const startYear = parseInt(current.split("-")[0], 10);
    const next = `${startYear + 1}-${String(startYear + 2).slice(-2)}`;
    return [current, next];
};

const getFormPayload = (form) => {
    const formData = new FormData(form);
    return {
        academicYear: String(formData.get("academicYear") ?? "").trim(),
        spreadsheet: String(formData.get("spreadsheet") ?? "").trim(),
        examType: String(formData.get("examType") ?? "").trim(),
        classes: formData.getAll("classes").map(Number)
    };
};

const validatePayload = (payload) => {
    if (!payload.spreadsheet) {
        return "Spreadsheet name is required.";
    }

    if (!payload.examType) {
        return "Exam type is required.";
    }

    if (!payload.classes.length) {
        return "Select at least one class.";
    }

    return "";
};

const setFormError = (form, message) => {
    const error = form.querySelector("#prepare-exam-error");
    if (error) {
        error.textContent = message;
    }
};

const submitPrepareExam = async (form, modal, closeModal) => {
    try {
        const submitButton = form.querySelector('button[type="submit"]');
        const payload = getFormPayload(form);
        const validationMessage = validatePayload(payload);

        if (validationMessage) {
            setFormError(form, validationMessage);
            return;
        }

        submitButton.disabled = true;
        setFormError(form, "");

        const examTypeMap = {
            "त्रैमासिक परीक्षा": "Tri",
            "अर्धवार्षिक परीक्षा": "Half Yearly",
            "वार्षिक परीक्षा": "Annual",
            "सेंट-अप परीक्षा": "Sent-Up"
        };
        const mappedExamType = examTypeMap[payload.examType] || payload.examType;

        const queryParams = new URLSearchParams({
            academicYear: payload.academicYear,
            spreadsheet: payload.spreadsheet,
            examType: mappedExamType,
            classes: payload.classes.join(",")
        });
        const response = await apiRequest(`exam.prepare?${queryParams.toString()}`, {
            method: "GET"
        });

        showToast("Exam sheets prepared successfully.", "success");

        // Hide form and show success UI
        form.style.display = "none";
        const successEl = modal.element.querySelector("#prepare-exam-success");
        if (successEl) {
            successEl.removeAttribute("hidden");
            
            // Populate links list
            const linksList = successEl.querySelector("#prepared-sheets-links");
            const files = response.files || [];
            if (linksList) {
                linksList.innerHTML = files.map(file => `
                    <li class="prepared-sheet-item">
                        <span class="material-symbols-rounded item-icon">description</span>
                        <a href="${file.url}" class="sheet-link" target="_blank" rel="noopener noreferrer">${file.name}</a>
                    </li>
                `).join("");
            }

            // Bind "Open Google Sheet" primary button to the first file
            const openBtn = successEl.querySelector("#open-sheet-btn");
            if (openBtn) {
                if (files.length > 0) {
                    openBtn.href = files[0].url;
                    openBtn.style.display = "inline-flex";
                } else {
                    openBtn.style.display = "none";
                }
            }

            // Bind Close button
            successEl.querySelector("[data-modal-close]")?.addEventListener("click", () => closeModal());
        } else {
            closeModal();
        }
    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
    } finally {
        form.querySelector('button[type="submit"]')?.removeAttribute("disabled");
    }
};

const initializeForm = (modal, closeModal) => {
    const form = modal.element.querySelector("#prepare-exam-form");
    if (!form) {
        throw new Error("Prepare Exam form is missing.");
    }

    const yearSelect = form.elements.academicYear;
    if (yearSelect) {
        const years = getAcademicYears();
        yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
        yearSelect.value = getDefaultAcademicYear();
    }
    form.querySelector("[data-modal-cancel]")?.addEventListener("click", () => closeModal());
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        void submitPrepareExam(form, modal, closeModal);
    });
};

/**
 * Opens the Prepare Exam modal and wires the form lifecycle.
 * @returns {Promise<void>}
 */
export async function openPrepareExamModal() {
    try {
        const response = await fetch(VIEW_PATH, { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Prepare Exam view could not be loaded.");
        }

        const container = document.createElement("div");
        container.innerHTML = await response.text();

        const modal = openModal({
            title: "Prepare Exam",
            content: container,
            size: "large"
        });

        if (!modal) {
            throw new Error("Prepare Exam modal could not be opened.");
        }

        initializeForm(modal, modal.close);
    } catch (error) {
        console.error(error);
        showToast("Prepare Exam could not be opened.", "error");
    }
}
