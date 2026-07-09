"use strict";

import { openModal } from "../../../components/modal.js";
import { showToast } from "../../../components/toast.js";
import { apiRequest } from "../../../services/api.js";

const VIEW_PATH = "views/prepareExam.html";

const getDefaultAcademicYear = () => {
    const year = new Date().getFullYear();
    return `${year}-${String(year + 1).slice(-2)}`;
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

const submitPrepareExam = async (form, closeModal) => {
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

        const response = await apiRequest("/api/exam/prepare", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        showToast("Exam sheets prepared successfully.", "success");
        closeModal();
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

    form.elements.academicYear.value = getDefaultAcademicYear();
    form.querySelector("[data-modal-cancel]")?.addEventListener("click", () => closeModal());
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        void submitPrepareExam(form, closeModal);
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
