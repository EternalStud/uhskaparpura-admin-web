"use strict";

import { renderNavbar } from "../../../components/navbar.js?t=202608030555";
import { showToast } from "../../../components/toast.js";
import { hideLoader, showLoader } from "../../../components/loader.js?t=202608030555";
import { apiRequest } from "../../../services/api.js";

let allAdmissions = [];
let classWiseStats = {};

// Verhoeff Checksum Algorithm
const Verhoeff = {
    d: [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
        [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
        [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
        [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
        [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
        [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
        [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
        [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
        [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    ],
    p: [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
        [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
        [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
        [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
        [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
        [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
        [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
    ],
    validate(num) {
        if (!num) return false;
        const clean = String(num).replace(/\D/g, '');
        if (clean.length !== 12) return false;
        if (/^(\d)\1{11}$/.test(clean)) return false;

        let c = 0;
        const invertedArray = clean.split('').map(Number).reverse();
        for (let i = 0; i < invertedArray.length; i++) {
            c = this.d[c][this.p[i % 8][invertedArray[i]]];
        }
        return c === 0;
    }
};

function driveThumbnailUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    return url;
}

export async function initAdmissionMgmtView() {
    renderNavbar(document.querySelector("#navbar-admission-mgmt"));
    await loadAdmissions();

    // Event listeners for filters
    const filterClass = document.getElementById("filterAdmClass");
    const filterStatus = document.getElementById("filterAdmStatus");
    const searchInput = document.getElementById("searchAdmInput");
    const btnRefresh = document.getElementById("btnRefreshAdmList");

    if (filterClass) filterClass.addEventListener("change", applyFilters);
    if (filterStatus) filterStatus.addEventListener("change", applyFilters);
    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (btnRefresh) btnRefresh.addEventListener("click", loadAdmissions);

    // Modal listeners
    const btnCloseModal = document.getElementById("btnCloseAdmModal");
    const btnCancelModal = document.getElementById("btnCancelAdmModal");
    if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener("click", closeModal);

    const btnPrintModal = document.getElementById("btnAdmModalPrintReceipt");
    if (btnPrintModal) {
        btnPrintModal.addEventListener("click", () => {
            const appId = document.getElementById("modalAdmAppId")?.value;
            if (appId) {
                window.open(`../uhskaparpurakanti-website/admission-receipt.html?id=${encodeURIComponent(appId)}`, '_blank');
            }
        });
    }

    const verifyForm = document.getElementById("verifyAdmForm");
    if (verifyForm) {
        verifyForm.addEventListener("submit", handleVerifySubmit);
    }
}

async function loadAdmissions() {
    showLoader("नामांकन सूची लोड हो रही है...");
    try {
        const response = await apiRequest("admission.getAll");
        if (response && response.success) {
            allAdmissions = response.list || [];
            classWiseStats = response.byClass || {};
            
            // Update Stats
            document.getElementById("adm-total-count").textContent = response.total || 0;
            document.getElementById("adm-verified-count").textContent = response.verified || 0;
            document.getElementById("adm-pending-count").textContent = response.pending || 0;

            renderClassWiseStats(classWiseStats);
            applyFilters();
        } else {
            showToast(response?.error || "नामांकन सूची लोड करने में विफलता।", "error");
        }
    } catch(err) {
        console.error(err);
        showToast("सर्वर त्रुटि।", "error");
    } finally {
        hideLoader();
    }
}

function renderClassWiseStats(byClass) {
    const container = document.getElementById("classWiseStatsContainer");
    if (!container) return;

    const classes = Object.keys(byClass).sort((a,b) => parseInt(a) - parseInt(b));
    if (classes.length === 0) {
        container.innerHTML = `<span style="color: #94a3b8; font-size: 0.9rem;">कोई डेटा उपलब्ध नहीं है।</span>`;
        return;
    }

    let html = "";
    classes.forEach(cls => {
        const stat = byClass[cls];
        html += `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 10px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 700; color: #1e293b;">Class ${cls}:</span>
                <span style="color: #475569;">कुल: <strong>${stat.total}</strong></span>
                <span style="color: #059669; font-weight: 600;">✓ ${stat.verified}</span>
                <span style="color: #d97706; font-weight: 600;">⏳ ${stat.pending}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

function applyFilters() {
    const classVal = document.getElementById("filterAdmClass")?.value || "";
    const statusVal = document.getElementById("filterAdmStatus")?.value || "";
    const query = (document.getElementById("searchAdmInput")?.value || "").toLowerCase().trim();

    const filtered = allAdmissions.filter(item => {
        if (classVal && item.admissionClass !== classVal) return false;
        if (statusVal && item.status.toLowerCase() !== statusVal.toLowerCase()) return false;
        if (query) {
            const searchStr = `${item.applicationId} ${item.studentNameEnglish} ${item.fatherName} ${item.mobile} ${item.studentAadhaar || ''} ${item.penNumber || ''}`.toLowerCase();
            if (!searchStr.includes(query)) return false;
        }
        return true;
    });

    renderTable(filtered);
}

function renderTable(list) {
    const tbody = document.getElementById("admListTableBody");
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: #94a3b8;">कोई नामांकन रिकॉर्ड नहीं मिला। (No admission records found.)</td></tr>`;
        return;
    }

    let html = "";
    list.forEach(item => {
        const isVerified = (item.status || "").toLowerCase() === "verified";
        const statusBadge = isVerified 
            ? `<span style="background: #d1fae5; color: #047857; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 0.8rem;">✓ Verified</span>`
            : `<span style="background: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 0.8rem;">⏳ Pending</span>`;

        let formattedDate = item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-IN") : "-";

        html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 15px; font-weight: 700; color: #0284c7;">${item.applicationId || '-'}</td>
                <td style="padding: 12px 15px; font-weight: 600; color: #1e293b;">
                    ${item.studentNameEnglish}
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: 400;">M: ${item.motherName}</div>
                </td>
                <td style="padding: 12px 15px; font-weight: 600;">${item.fatherName || '-'}</td>
                <td style="padding: 12px 15px;">Class ${item.admissionClass} ${item.stream ? '(' + item.stream + ')' : ''}</td>
                <td style="padding: 12px 15px;">${item.mobile || '-'}</td>
                <td style="padding: 12px 15px; font-size: 0.85rem; color: #64748b;">${formattedDate}</td>
                <td style="padding: 12px 15px;">${statusBadge}</td>
                <td style="padding: 12px 15px; text-align: center;">
                    <button type="button" class="btn btn-sm btn-open-adm-detail" data-appid="${item.applicationId}" style="background: #e0f2fe; color: #0369a1; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-right: 5px;">👁️ जांचें / संपादित करें</button>
                    ${!isVerified ? `<button type="button" class="btn btn-sm btn-quick-verify-adm" data-appid="${item.applicationId}" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">✅ Verify</button>` : ''}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // Attach row button listeners
    tbody.querySelectorAll(".btn-open-adm-detail").forEach(btn => {
        btn.addEventListener("click", () => openModal(btn.dataset.appid));
    });

    tbody.querySelectorAll(".btn-quick-verify-adm").forEach(btn => {
        btn.addEventListener("click", () => quickVerify(btn.dataset.appid));
    });
}

function openModal(appId) {
    const item = allAdmissions.find(r => r.applicationId === appId);
    if (!item) return;

    const isVerified = (item.status || "").toLowerCase() === "verified";

    // Header Badges
    document.getElementById("modalAdmStudentTitle").textContent = `${item.studentNameEnglish} - नामांकन आवेदन सत्यापन`;
    document.getElementById("modalAdmAppIdBadge").textContent = item.applicationId || "-";
    document.getElementById("modalAdmClassBadge").textContent = `Class ${item.admissionClass} ${item.stream ? '(' + item.stream + ')' : ''}`;

    const statusBadge = document.getElementById("modalAdmStatusBadge");
    if (statusBadge) {
        statusBadge.textContent = isVerified ? "Verified (सत्यापित)" : "Pending (लंबित)";
        statusBadge.style.background = isVerified ? "#d1fae5" : "#fef3c7";
        statusBadge.style.color = isVerified ? "#047857" : "#92400e";
    }

    // Section 0: Identifiers
    document.getElementById("modalAdmAppId").value = item.applicationId || "";
    document.getElementById("modalAdmAppIdDisplay").value = item.applicationId || "";
    document.getElementById("modalAdmClassStream").value = `Class ${item.admissionClass} ${item.stream ? '(' + item.stream + ')' : ''}`;
    document.getElementById("modalAdmPen").value = item.penNumber || "";
    document.getElementById("modalAdmApaar").value = item.apaarId || item.eshikshakoshId || "";

    // Section 1: Basic Details
    document.getElementById("modalAdmStudentName").value = item.studentNameEnglish || "";

    let formattedDob = "";
    if (item.dob) {
        try {
            const d = new Date(item.dob);
            if (!isNaN(d.getTime())) {
                formattedDob = d.toISOString().split("T")[0];
            }
        } catch(e) {}
    }
    document.getElementById("modalAdmDob").value = formattedDob || item.dob || "";
    document.getElementById("modalAdmGender").value = item.gender || "Male";
    document.getElementById("modalAdmAadhaar").value = item.studentAadhaar || "";
    document.getElementById("modalAdmMobile").value = item.mobile || "";
    document.getElementById("modalAdmCategory").value = item.category || "GEN";
    document.getElementById("modalAdmReligion").value = item.religion || "Hindu";
    document.getElementById("modalAdmBloodGroup").value = item.bloodGroup || "";

    // Photo & Signature with Drive Thumbnail Resolver
    const photoBox = document.getElementById("modalAdmPhotoPreview");
    const sigBox = document.getElementById("modalAdmSignaturePreview");
    const photoLink = document.getElementById("modalAdmPhotoLink");
    const signLink = document.getElementById("modalAdmSignLink");

    if (item.photoUrl && item.photoUrl !== "UPLOAD_FAILED") {
        const thumbPhoto = driveThumbnailUrl(item.photoUrl);
        const match = item.photoUrl.match(/id=([a-zA-Z0-9_-]+)/) || item.photoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const fileId = match ? match[1] : "";
        photoBox.innerHTML = `<img src="${thumbPhoto}" referrerpolicy="no-referrer" alt="Photo" style="width: 100%; height: 100%; object-fit: cover;" onerror="if(!this.dataset.tried){this.dataset.tried='1'; this.src='https://drive.google.com/thumbnail?id=${fileId}&sz=w800';} else if(this.dataset.tried==='1'){this.dataset.tried='2'; this.src='https://drive.google.com/uc?export=view&id=${fileId}';} else {this.onerror=null; this.parentElement.innerHTML='<span style=\\'color:#ef4444;font-size:0.75rem;\\'>Image error</span>';}">`;
        if (photoLink) {
            photoLink.href = item.photoUrl;
            photoLink.style.display = "inline-block";
        }
    } else {
        photoBox.innerHTML = '<span style="color: #94a3b8; font-size: 0.8rem;">No Photo</span>';
        if (photoLink) photoLink.style.display = "none";
    }

    if (item.signatureUrl && item.signatureUrl !== "UPLOAD_FAILED") {
        const thumbSig = driveThumbnailUrl(item.signatureUrl);
        const match = item.signatureUrl.match(/id=([a-zA-Z0-9_-]+)/) || item.signatureUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const fileId = match ? match[1] : "";
        sigBox.innerHTML = `<img src="${thumbSig}" referrerpolicy="no-referrer" alt="Signature" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1'; this.src='https://drive.google.com/thumbnail?id=${fileId}&sz=w800';} else if(this.dataset.tried==='1'){this.dataset.tried='2'; this.src='https://drive.google.com/uc?export=view&id=${fileId}';} else {this.onerror=null; this.parentElement.innerHTML='<span style=\\'color:#ef4444;font-size:0.75rem;\\'>Sig error</span>';}">`;
        if (signLink) {
            signLink.href = item.signatureUrl;
            signLink.style.display = "inline-block";
        }
    } else {
        sigBox.innerHTML = '<span style="color: #94a3b8; font-size: 0.8rem;">No Sig</span>';
        if (signLink) signLink.style.display = "none";
    }

    // Section 2: Parent Details
    document.getElementById("modalAdmFatherName").value = item.fatherName || "";
    document.getElementById("modalAdmMotherName").value = item.motherName || "";
    document.getElementById("modalAdmParentAadhaarType").value = item.parentAadhaarType || "Father";
    document.getElementById("modalAdmParentAadhaar").value = item.parentAadhaar || "";

    // Section 3: Address & Distance
    document.getElementById("modalAdmAddress").value = item.address || "";
    document.getElementById("modalAdmPinCode").value = item.pinCode || "";
    document.getElementById("modalAdmDistance").value = item.distance || "";
    document.getElementById("modalAdmPreviousUdise").value = item.previousUdise || "";

    // Section 4: Bank Details
    document.getElementById("modalAdmBankName").value = item.bankName || "";
    document.getElementById("modalAdmBankAccount").value = item.accountNumber || item.bankAccount || "";
    document.getElementById("modalAdmBankIFSC").value = item.ifscCode || item.bankIFSC || "";
    document.getElementById("modalAdmAccountHolder").value = item.accountHolder || "";

    // Section 5: Health & CWSN
    document.getElementById("modalAdmCwsn").value = item.cwsn || "No";
    document.getElementById("modalAdmIncome").value = item.income || "";
    document.getElementById("modalAdmHeight").value = item.height || "";
    document.getElementById("modalAdmWeight").value = item.weight || "";

    const modal = document.getElementById("admDetailModal");
    if (modal) {
        modal.style.display = "flex";
    }
}

function closeModal() {
    const modal = document.getElementById("admDetailModal");
    if (modal) {
        modal.style.display = "none";
    }
}

async function quickVerify(appId) {
    if (!confirm(`क्या आप एप्लीकेशन आईडी ${appId} को सत्यापित (Verify) करना चाहते हैं?`)) return;

    showLoader("सत्यापित किया जा रहा है...");
    try {
        const response = await apiRequest("admission.verify", {
            body: { applicationId: appId, status: "Verified" }
        });
        if (response && response.success) {
            showToast("नामांकन सफलतापूर्वक सत्यापित हुआ!", "success");
            await loadAdmissions();
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
    const appId = document.getElementById("modalAdmAppId").value;
    if (!appId) return;

    const aadhaarVal = document.getElementById("modalAdmAadhaar").value.trim();
    if (aadhaarVal && !Verhoeff.validate(aadhaarVal)) {
        showToast("कृपया 12 अंकों का वैध आधार नंबर दर्ज करें (Aadhaar Checksum Failed)!", "error");
        return;
    }

    showLoader("संशोधन सहेजा जा रहा है एवं सत्यापित किया जा रहा है...");

    const payload = {
        applicationId: appId,
        status: "Verified",
        studentNameEnglish: document.getElementById("modalAdmStudentName").value.trim(),
        dob: document.getElementById("modalAdmDob").value,
        gender: document.getElementById("modalAdmGender").value,
        studentAadhaar: aadhaarVal,
        mobile: document.getElementById("modalAdmMobile").value.trim(),
        category: document.getElementById("modalAdmCategory").value,
        religion: document.getElementById("modalAdmReligion").value,
        bloodGroup: document.getElementById("modalAdmBloodGroup").value,
        fatherName: document.getElementById("modalAdmFatherName").value.trim(),
        motherName: document.getElementById("modalAdmMotherName").value.trim(),
        parentAadhaarType: document.getElementById("modalAdmParentAadhaarType").value,
        parentAadhaar: document.getElementById("modalAdmParentAadhaar").value.trim(),
        address: document.getElementById("modalAdmAddress").value.trim(),
        pinCode: document.getElementById("modalAdmPinCode").value.trim(),
        distance: document.getElementById("modalAdmDistance").value.trim(),
        previousUdise: document.getElementById("modalAdmPreviousUdise").value.trim(),
        bankName: document.getElementById("modalAdmBankName").value.trim(),
        accountNumber: document.getElementById("modalAdmBankAccount").value.trim(),
        ifscCode: document.getElementById("modalAdmBankIFSC").value.trim(),
        accountHolder: document.getElementById("modalAdmAccountHolder").value.trim(),
        cwsn: document.getElementById("modalAdmCwsn").value,
        income: document.getElementById("modalAdmIncome").value.trim(),
        height: document.getElementById("modalAdmHeight").value.trim(),
        weight: document.getElementById("modalAdmWeight").value.trim(),
        penNumber: document.getElementById("modalAdmPen").value.trim(),
        apaarId: document.getElementById("modalAdmApaar").value.trim()
    };

    try {
        const response = await apiRequest("admission.verify", {
            body: payload
        });
        if (response && response.success) {
            showToast("संशोधन सहेजा गया एवं नामांकन सफलतापूर्वक सत्यापित हुआ!", "success");
            closeModal();
            await loadAdmissions();
        } else {
            showToast(response?.error || "विफलता।", "error");
        }
    } catch(err) {
        showToast("सर्वर त्रुटि।", "error");
    } finally {
        hideLoader();
    }
}
