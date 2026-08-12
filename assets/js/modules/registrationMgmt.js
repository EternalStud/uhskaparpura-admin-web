"use strict";

import { renderNavbar } from "../../components/navbar.js?t=202608030555";
import { showToast } from "../../components/toast.js";
import { hideLoader, showLoader } from "../../components/loader.js?t=202608030555";
import { apiRequest } from "../../services/api.js";

let allRegistrations = [];

export async function initRegistrationMgmtView() {
    renderNavbar();
    await loadRegistrations();

    // Event listeners for filters
    const filterClass = document.getElementById("filterRegClass");
    const filterStatus = document.getElementById("filterRegStatus");
    const searchInput = document.getElementById("searchRegInput");
    const btnRefresh = document.getElementById("btnRefreshRegList");

    if (filterClass) filterClass.addEventListener("change", applyFilters);
    if (filterStatus) filterStatus.addEventListener("change", applyFilters);
    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (btnRefresh) btnRefresh.addEventListener("click", loadRegistrations);

    // Modal listeners
    const btnCloseModal = document.getElementById("btnCloseRegModal");
    const btnCancelModal = document.getElementById("btnCancelModal");
    if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener("click", closeModal);

    const verifyForm = document.getElementById("verifyRegForm");
    if (verifyForm) {
        verifyForm.addEventListener("submit", handleVerifySubmit);
    }
}

async function loadRegistrations() {
    showLoader("पंजीयन सूची लोड हो रही है...");
    try {
        const response = await apiRequest("registration.getAll");
        if (response && response.success) {
            allRegistrations = response.list || [];
            
            // Update Stats
            document.getElementById("stat-total-count").textContent = response.total || 0;
            document.getElementById("stat-verified-count").textContent = response.verified || 0;
            document.getElementById("stat-pending-count").textContent = response.pending || 0;

            applyFilters();
        } else {
            showToast(response?.error || "पंजीयन सूची लोड करने में विफलता।", "error");
        }
    } catch(err) {
        console.error(err);
        showToast("सर्वर त्रुटि।", "error");
    } finally {
        hideLoader();
    }
}

function applyFilters() {
    const classVal = document.getElementById("filterRegClass")?.value || "";
    const statusVal = document.getElementById("filterRegStatus")?.value || "";
    const query = (document.getElementById("searchRegInput")?.value || "").toLowerCase().trim();

    const filtered = allRegistrations.filter(item => {
        if (classVal && item.className !== classVal) return false;
        if (statusVal && item.status.toLowerCase() !== statusVal.toLowerCase()) return false;
        if (query) {
            const searchStr = `${item.regId} ${item.studentName} ${item.fatherName} ${item.rollNo} ${item.studentCode}`.toLowerCase();
            if (!searchStr.includes(query)) return false;
        }
        return true;
    });

    renderTable(filtered);
}

function renderTable(list) {
    const tbody = document.getElementById("regListTableBody");
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: #94a3b8;">कोई पंजीयन रिकॉर्ड नहीं मिला। (No registrations found.)</td></tr>`;
        return;
    }

    let html = "";
    list.forEach(item => {
        const isVerified = item.status.toLowerCase() === "verified";
        const statusBadge = isVerified 
            ? `<span style="background: #d1fae5; color: #047857; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 0.8rem;">✓ Verified</span>`
            : `<span style="background: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 0.8rem;">⏳ Pending</span>`;

        let formattedDate = item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-IN") : "-";

        html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 15px; font-weight: 700; color: #d97706;">${item.regId || '-'}</td>
                <td style="padding: 12px 15px; font-weight: 600;">${item.rollNo || '-'}</td>
                <td style="padding: 12px 15px; font-weight: 600; color: #1e293b;">
                    ${item.studentName}
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: 400;">F: ${item.fatherName}</div>
                </td>
                <td style="padding: 12px 15px;">Class ${item.className} ${item.stream ? '(' + item.stream + ')' : ''}</td>
                <td style="padding: 12px 15px;">${item.mobile || '-'}</td>
                <td style="padding: 12px 15px; font-size: 0.85rem; color: #64748b;">${formattedDate}</td>
                <td style="padding: 12px 15px;">${statusBadge}</td>
                <td style="padding: 12px 15px; text-align: center;">
                    <button type="button" class="btn btn-sm btn-open-detail" data-regid="${item.regId}" style="background: #e0f2fe; color: #0369a1; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-right: 5px;">👁️ जांचें / संपादित करें</button>
                    ${!isVerified ? `<button type="button" class="btn btn-sm btn-quick-verify" data-regid="${item.regId}" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">✅ Verify</button>` : ''}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // Attach row button listeners
    tbody.querySelectorAll(".btn-open-detail").forEach(btn => {
        btn.addEventListener("click", () => openModal(btn.dataset.regid));
    });

    tbody.querySelectorAll(".btn-quick-verify").forEach(btn => {
        btn.addEventListener("click", () => quickVerify(btn.dataset.regid));
    });
}

function openModal(regId) {
    const item = allRegistrations.find(r => r.regId === regId);
    if (!item) return;

    document.getElementById("modalRegId").value = item.regId;
    document.getElementById("modalRegIdDisplay").value = item.regId;
    document.getElementById("modalRollNo").value = item.rollNo;
    document.getElementById("modalClassStream").value = `Class ${item.className} ${item.stream ? '(' + item.stream + ')' : ''}`;
    document.getElementById("modalStudentCode").value = item.studentCode;

    document.getElementById("modalStudentName").value = item.studentName;
    document.getElementById("modalFatherName").value = item.fatherName;
    document.getElementById("modalMotherName").value = item.motherName;

    // Format DOB for date input
    let formattedDob = "";
    if (item.dob) {
        try {
            const d = new Date(item.dob);
            if (!isNaN(d.getTime())) {
                formattedDob = d.toISOString().split("T")[0];
            }
        } catch(e) {}
    }
    document.getElementById("modalDob").value = formattedDob || item.dob;

    document.getElementById("modalMobile").value = item.mobile;
    document.getElementById("modalBankName").value = item.bankName;
    document.getElementById("modalBankAccount").value = item.bankAccount;
    document.getElementById("modalBankIFSC").value = item.bankIFSC;
    document.getElementById("modalSubjects").value = item.subjects;

    // Previews
    const photoBox = document.getElementById("modalPhotoPreview");
    const sigBox = document.getElementById("modalSignaturePreview");

    photoBox.innerHTML = item.photoUrl ? `<img src="${item.photoUrl}" style="max-width:100%; max-height:100%; object-fit:contain;">` : 'No Photo';
    sigBox.innerHTML = item.signatureUrl ? `<img src="${item.signatureUrl}" style="max-width:100%; max-height:100%; object-fit:contain;">` : 'No Sig';

    document.getElementById("regDetailModal").style.display = "block";
}

function closeModal() {
    document.getElementById("regDetailModal").style.display = "none";
}

async function quickVerify(regId) {
    if (!confirm(`क्या आप रजिस्ट्रेशन आईडी ${regId} को सत्यापित (Verify) करना चाहते हैं?`)) return;

    showLoader("सत्यापित किया जा रहा है...");
    try {
        const response = await apiRequest("registration.verify", {
            body: { regId: regId, status: "Verified" }
        });
        if (response && response.success) {
            showToast("रजिस्ट्रेशन सफलतापूर्वक सत्यापित हुआ!", "success");
            await loadRegistrations();
        } else {
            showToast(response?.error || "सत्यापन में विफलता।", "error");
        }
    } catch(err) {
        showToast("सर्वर त्रुटि।", "error");
    } finally {
        hideLoader();
    }
}

async function handleVerifySubmit(e) {
    e.preventDefault();
    const regId = document.getElementById("modalRegId").value;
    if (!regId) return;

    showLoader("संशोधन सहेजा जा रहा है एवं सत्यापित किया जा रहा है...");

    const payload = {
        regId: regId,
        status: "Verified",
        studentName: document.getElementById("modalStudentName").value,
        fatherName: document.getElementById("modalFatherName").value,
        motherName: document.getElementById("modalMotherName").value,
        dob: document.getElementById("modalDob").value,
        mobile: document.getElementById("modalMobile").value,
        bankName: document.getElementById("modalBankName").value,
        bankAccount: document.getElementById("modalBankAccount").value,
        bankIFSC: document.getElementById("modalBankIFSC").value,
        subjects: document.getElementById("modalSubjects").value
    };

    try {
        const response = await apiRequest("registration.verify", {
            body: payload
        });
        if (response && response.success) {
            showToast("संशोधन सहेजा गया एवं फॉर्म सत्यापित किया गया!", "success");
            closeModal();
            await loadRegistrations();
        } else {
            showToast(response?.error || "विफलता।", "error");
        }
    } catch(err) {
        showToast("सर्वर त्रुटि।", "error");
    } finally {
        hideLoader();
    }
}
