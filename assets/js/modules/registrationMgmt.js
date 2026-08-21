"use strict";

import { renderNavbar } from "../../../components/navbar.js?t=202608030555";
import { showToast } from "../../../components/toast.js";
import { hideLoader, showLoader } from "../../../components/loader.js?t=202608030555";
import { apiRequest } from "../../../services/api.js";

let allRegistrations = [];

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

export async function initRegistrationMgmtView() {
    renderNavbar(document.querySelector("#navbar-registration-mgmt"));
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

    const btnPrintModal = document.getElementById("btnModalPrintReceipt");
    if (btnPrintModal) {
        btnPrintModal.addEventListener("click", () => {
            const regId = document.getElementById("modalRegId")?.value;
            if (regId) {
                window.open(`../uhskaparpurakanti-website/registration-receipt.html?id=${encodeURIComponent(regId)}`, '_blank');
            }
        });
    }

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
            const searchStr = `${item.regId} ${item.studentName} ${item.fatherName} ${item.rollNo} ${item.studentCode} ${item.aadhaar}`.toLowerCase();
            if (!searchStr.includes(query)) return false;
        }
        return true;
    });

    renderTable(filtered);
}

function renderTable(list) {
    const tbody = document.getElementById("regListTableBody");
    const mobileContainer = document.getElementById("regMobileCardList");
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: #94a3b8;">कोई पंजीयन रिकॉर्ड नहीं मिला। (No registrations found.)</td></tr>`;
        if (mobileContainer) {
            mobileContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: #94a3b8; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">कोई पंजीयन रिकॉर्ड नहीं मिला। (No registrations found.)</div>`;
        }
        return;
    }

    let desktopHtml = "";
    let mobileHtml = "";

    list.forEach(item => {
        const isVerified = (item.status || "").toLowerCase() === "verified";
        const statusBadge = isVerified 
            ? `<span style="background: #d1fae5; color: #047857; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 0.8rem;">✓ Verified</span>`
            : `<span style="background: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 0.8rem;">⏳ Pending</span>`;

        let formattedDate = item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-IN") : "-";

        // Desktop Row HTML
        desktopHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 15px; font-weight: 700; color: #d97706;">${item.regId || '-'}</td>
                <td style="padding: 12px 15px; font-weight: 600;">${item.rollNo || '-'}</td>
                <td style="padding: 12px 15px; font-weight: 600; color: #1e293b;">
                    ${item.studentName}
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: 400;">F: ${item.fatherName}</div>
                </td>
                <td style="padding: 12px 15px;">Class ${item.className} ${item.stream ? '(' + item.stream + ')' : ''}</td>
                <td style="padding: 12px 15px;">${item.mobile ? `<a href="tel:${item.mobile}" style="color: #2563eb; text-decoration: none;">${item.mobile}</a>` : '-'}</td>
                <td style="padding: 12px 15px; font-size: 0.85rem; color: #64748b;">${formattedDate}</td>
                <td style="padding: 12px 15px;">${statusBadge}</td>
                <td style="padding: 12px 15px; text-align: center;">
                    <button type="button" class="btn btn-sm btn-open-detail" data-regid="${item.regId}" style="background: #e0f2fe; color: #0369a1; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-right: 5px;">👁️ जांचें / संपादित करें</button>
                    ${!isVerified ? `<button type="button" class="btn btn-sm btn-quick-verify" data-regid="${item.regId}" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">✅ Verify</button>` : ''}
                </td>
            </tr>
        `;

        // Mobile Card HTML
        mobileHtml += `
            <div class="reg-mobile-card">
                <div class="reg-mobile-card-header">
                    <div>
                        <div class="reg-mobile-title">${item.studentName}</div>
                        <div class="reg-mobile-sub">पिता: ${item.fatherName} | रोल: <strong>${item.rollNo || '-'}</strong></div>
                    </div>
                    <div>${statusBadge}</div>
                </div>

                <div class="reg-mobile-grid">
                    <div>
                        <div class="reg-mobile-label">Reg ID</div>
                        <div class="reg-mobile-val" style="color: #d97706;">${item.regId || '-'}</div>
                    </div>
                    <div>
                        <div class="reg-mobile-label">Class & Stream</div>
                        <div class="reg-mobile-val">Class ${item.className} ${item.stream ? '(' + item.stream + ')' : ''}</div>
                    </div>
                    <div>
                        <div class="reg-mobile-label">मोबाइल (Mobile)</div>
                        <div class="reg-mobile-val">${item.mobile ? `<a href="tel:${item.mobile}" style="color: #2563eb; text-decoration: none;">📞 ${item.mobile}</a>` : '-'}</div>
                    </div>
                    <div>
                        <div class="reg-mobile-label">दिनांक (Date)</div>
                        <div class="reg-mobile-val">${formattedDate}</div>
                    </div>
                </div>

                <div class="reg-mobile-actions">
                    <button type="button" class="btn-open-detail" data-regid="${item.regId}" style="background: #e0f2fe; color: #0369a1;">
                        👁️ विवरण जांचें / संपादित करें
                    </button>
                    ${!isVerified ? `
                    <button type="button" class="btn-quick-verify" data-regid="${item.regId}" style="background: #10b981; color: white;">
                        ✅ Verify
                    </button>` : ''}
                </div>
            </div>
        `;
    });

    tbody.innerHTML = desktopHtml;
    if (mobileContainer) mobileContainer.innerHTML = mobileHtml;

    // Attach listeners to both desktop table and mobile cards
    document.querySelectorAll(".btn-open-detail").forEach(btn => {
        btn.addEventListener("click", () => openModal(btn.dataset.regid));
    });

    document.querySelectorAll(".btn-quick-verify").forEach(btn => {
        btn.addEventListener("click", () => quickVerify(btn.dataset.regid));
    });
}

function openModal(regId) {
    const item = allRegistrations.find(r => r.regId === regId);
    if (!item) return;

    const isVerified = (item.status || "").toLowerCase() === "verified";

    // Header Badges
    document.getElementById("modalStudentTitle").textContent = `${item.studentName} - पंजीयन सत्यापन`;
    document.getElementById("modalRegIdBadge").textContent = item.regId || "-";
    document.getElementById("modalSessionBadge").textContent = item.academicSession || "2026-28";
    
    const statusBadge = document.getElementById("modalStatusBadge");
    if (statusBadge) {
        statusBadge.textContent = isVerified ? "Verified (सत्यापित)" : "Pending (लंबित)";
        statusBadge.style.background = isVerified ? "#d1fae5" : "#fef3c7";
        statusBadge.style.color = isVerified ? "#047857" : "#92400e";
    }

    // Identifiers
    document.getElementById("modalRegId").value = item.regId || "";
    document.getElementById("modalRegIdDisplay").value = item.regId || "";
    document.getElementById("modalRollNo").value = item.rollNo || "";
    document.getElementById("modalClassStream").value = `Class ${item.className} ${item.stream ? '(' + item.stream + ')' : ''}`;
    document.getElementById("modalStudentCode").value = item.studentCode || "";

    // Section 1: Basic Details
    document.getElementById("modalStudentName").value = item.studentName || "";
    document.getElementById("modalFatherName").value = item.fatherName || "";
    document.getElementById("modalMotherName").value = item.motherName || "";

    let formattedDob = "";
    if (item.dob) {
        try {
            const d = new Date(item.dob);
            if (!isNaN(d.getTime())) {
                formattedDob = d.toISOString().split("T")[0];
            }
        } catch(e) {}
    }
    document.getElementById("modalDob").value = formattedDob || item.dob || "";
    document.getElementById("modalAadhaar").value = item.aadhaar || "";
    document.getElementById("modalMobile").value = item.mobile || "";
    document.getElementById("modalEmail").value = item.email || "";

    // Section 2: Bank Details
    document.getElementById("modalBankName").value = item.bankName || "";
    document.getElementById("modalBankAccount").value = item.bankAccount || "";
    document.getElementById("modalBankIFSC").value = item.bankIFSC || "";

    // Section 3: Additional Details
    document.getElementById("modalApaarId").value = item.apaarId || "";
    document.getElementById("modalCaste").value = item.caste || "GEN";
    document.getElementById("modalMaritalStatus").value = item.maritalStatus || "Unmarried";
    document.getElementById("modalDifferentlyAbled").value = item.differentlyAbled || "No";
    document.getElementById("modalMark1").value = item.mark1 || "";
    document.getElementById("modalMark2").value = item.mark2 || "";

    // Section 4: Address Details
    document.getElementById("modalAddress").value = item.address || "";
    document.getElementById("modalTownCity").value = item.townCity || "";
    document.getElementById("modalDistrict").value = item.district || "Muzaffarpur";
    document.getElementById("modalPinCode").value = item.pinCode || "";

    // Section 5: Interactive Subject Dropdowns
    renderModalSubjectDropdowns(item.className, item.stream, item.subjects);

    // Section 6: Photo & Signature Previews with Drive thumbnail resolver
    const photoBox = document.getElementById("modalPhotoPreview");
    const sigBox = document.getElementById("modalSignaturePreview");
    const photoLink = document.getElementById("modalPhotoLink");
    const signLink = document.getElementById("modalSignLink");

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
        sigBox.innerHTML = `<img src="${thumbSig}" referrerpolicy="no-referrer" alt="Signature" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="if(!this.dataset.tried){this.dataset.tried='1'; this.src='https://drive.google.com/thumbnail?id=${fileId}&sz=w800';} else if(this.dataset.tried==='1'){this.dataset.tried='2'; this.src='https://drive.google.com/uc?export=view&id=${fileId}';} else {this.onerror=null; this.parentElement.innerHTML='<span style=\\'color:#ef4444;font-size:0.75rem;\\'>Signature error</span>';}">`;
        if (signLink) {
            signLink.href = item.signatureUrl;
            signLink.style.display = "inline-block";
        }
    } else {
        sigBox.innerHTML = '<span style="color: #94a3b8; font-size: 0.8rem;">No Sig</span>';
        if (signLink) signLink.style.display = "none";
    }

    const modal = document.getElementById("regDetailModal");
    if (modal) {
        modal.style.display = "flex";
    }
}

function renderModalSubjectDropdowns(className, stream, currentSubjectsStr) {
    const grid = document.getElementById("modalSubjectGrid");
    const summaryText = document.getElementById("modalSubjectsSummaryText");
    const hiddenInput = document.getElementById("modalSubjects");
    if (!grid) return;

    const classNum = parseInt(className, 10);
    const existingSubs = String(currentSubjectsStr || "").split(",").map(s => s.trim()).filter(Boolean);
    const isSenior = (classNum >= 11);

    let html = "";

    if (!isSenior) {
        // Class 9 / 10
        const l1Options = ["Hindi", "Urdu", "Maithili", "Bengali"];
        const l2Options = ["Sanskrit", "Non-Hindi (NLH)", "Persian", "Arabic"];
        const optOptions = ["None", "Advance Mathematics", "Economics", "Commerce", "Music", "Home Science"];

        const curL1 = existingSubs.find(s => l1Options.includes(s)) || "Hindi";
        const curL2 = existingSubs.find(s => l2Options.includes(s)) || "Sanskrit";
        const curOpt = existingSubs.find(s => optOptions.includes(s) && s !== "None") || "None";

        html = `
            <div style="grid-column: 1 / -1; background: #e0f2fe; border: 1px solid #bae6fd; padding: 10px 14px; border-radius: 8px; font-size: 0.82rem; color: #0369a1;">
                <strong>अनिवार्य विषय (Compulsory Subjects):</strong> Mathematics, Science, Social Science, English (Fixed)
            </div>
            <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 5px;">Language 1 (MIL) <span style="color:red">*</span></label>
                <select class="modal-sub-select" id="modalSubL1" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;">
                    ${l1Options.map(opt => `<option value="${opt}" ${opt === curL1 ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 5px;">Language 2 (SIL) <span style="color:red">*</span></label>
                <select class="modal-sub-select" id="modalSubL2" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;">
                    ${l2Options.map(opt => `<option value="${opt}" ${opt === curL2 ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 5px;">ऐच्छिक विषय (Optional Subject)</label>
                <select class="modal-sub-select" id="modalSubOpt" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;">
                    ${optOptions.map(opt => `<option value="${opt}" ${opt === curOpt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </div>
        `;
    } else {
        // Senior Secondary (Class 11 / 12)
        const l1Options = ["Hindi", "Urdu", "Maithili", "English"];
        const l2Options = ["English", "Hindi", "Urdu", "Sanskrit", "Maithili"];
        
        let e1Options = ["Physics", "Chemistry", "Mathematics", "Biology"];
        let e2Options = ["Chemistry", "Physics", "Mathematics", "Biology"];
        let e3Options = ["Mathematics", "Biology", "Physics", "Chemistry", "Agriculture", "Computer Science"];
        const streamClean = (stream || "Science").toLowerCase();

        if (streamClean.includes("art")) {
            const artsList = ["History", "Political Science", "Geography", "Economics", "Psychology", "Sociology", "Philosophy", "Home Science", "Music"];
            e1Options = artsList;
            e2Options = artsList;
            e3Options = artsList;
        } else if (streamClean.includes("comm")) {
            const commList = ["Business Studies", "Accountancy", "Entrepreneurship", "Economics", "Computer Science"];
            e1Options = commList;
            e2Options = commList;
            e3Options = commList;
        }

        const addOptions = ["None", "Mathematics", "Biology", "Computer Science", "Economics", "Home Science", "Music", "History", "Political Science", "Geography", "Psychology", "Sociology", "Physics", "Chemistry"];

        const curL1 = existingSubs[0] || "Hindi";
        const curL2 = existingSubs[1] || "English";
        const curE1 = existingSubs[2] || e1Options[0];
        const curE2 = existingSubs[3] || e2Options[1] || e2Options[0];
        const curE3 = existingSubs[4] || e3Options[2] || e3Options[0];
        const curAdd = existingSubs[5] || "None";

        html = `
            <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 5px;">Compulsory Language 1 <span style="color:red">*</span></label>
                <select class="modal-sub-select" id="modalSubL1" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;">
                    ${l1Options.map(opt => `<option value="${opt}" ${opt === curL1 ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 5px;">Compulsory Language 2 <span style="color:red">*</span></label>
                <select class="modal-sub-select" id="modalSubL2" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;">
                    ${l2Options.map(opt => `<option value="${opt}" ${opt === curL2 ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 5px;">Elective Subject 1 <span style="color:red">*</span></label>
                <select class="modal-sub-select" id="modalSubE1" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;">
                    ${e1Options.map(opt => `<option value="${opt}" ${opt === curE1 ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 5px;">Elective Subject 2 <span style="color:red">*</span></label>
                <select class="modal-sub-select" id="modalSubE2" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;">
                    ${e2Options.map(opt => `<option value="${opt}" ${opt === curE2 ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 5px;">Elective Subject 3 <span style="color:red">*</span></label>
                <select class="modal-sub-select" id="modalSubE3" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;">
                    ${e3Options.map(opt => `<option value="${opt}" ${opt === curE3 ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 5px;">अतिरिक्त विषय (Additional Subject)</label>
                <select class="modal-sub-select" id="modalSubAdd" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;">
                    ${addOptions.map(opt => `<option value="${opt}" ${opt === curAdd ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </div>
        `;
    }

    grid.innerHTML = html;

    const syncSubjects = () => {
        let selected = [];
        if (!isSenior) {
            selected.push("Mathematics", "Science", "Social Science", "English");
            const l1 = document.getElementById("modalSubL1")?.value;
            const l2 = document.getElementById("modalSubL2")?.value;
            const opt = document.getElementById("modalSubOpt")?.value;
            if (l1) selected.push(l1);
            if (l2) selected.push(l2);
            if (opt && opt !== "None") selected.push(opt);
        } else {
            const l1 = document.getElementById("modalSubL1")?.value;
            const l2 = document.getElementById("modalSubL2")?.value;
            const e1 = document.getElementById("modalSubE1")?.value;
            const e2 = document.getElementById("modalSubE2")?.value;
            const e3 = document.getElementById("modalSubE3")?.value;
            const add = document.getElementById("modalSubAdd")?.value;
            [l1, l2, e1, e2, e3].forEach(s => { if (s && s !== "None") selected.push(s); });
            if (add && add !== "None") selected.push(add);
        }

        const joined = selected.join(", ");
        if (hiddenInput) hiddenInput.value = joined;
        if (summaryText) summaryText.textContent = joined || "-";
    };

    grid.querySelectorAll(".modal-sub-select").forEach(sel => {
        sel.addEventListener("change", syncSubjects);
    });

    syncSubjects();
}

function closeModal() {
    const modal = document.getElementById("regDetailModal");
    if (modal) {
        modal.style.display = "none";
    }
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

    const aadhaarVal = document.getElementById("modalAadhaar").value.trim();
    if (aadhaarVal && !Verhoeff.validate(aadhaarVal)) {
        showToast("कृपया 12 अंकों का वैध आधार नंबर दर्ज करें (Aadhaar Checksum Failed)!", "error");
        return;
    }

    showLoader("संशोधन सहेजा जा रहा है एवं सत्यापित किया जा रहा है...");

    const payload = {
        regId: regId,
        status: "Verified",
        studentName: document.getElementById("modalStudentName").value.trim(),
        fatherName: document.getElementById("modalFatherName").value.trim(),
        motherName: document.getElementById("modalMotherName").value.trim(),
        dob: document.getElementById("modalDob").value,
        aadhaar: aadhaarVal,
        mobile: document.getElementById("modalMobile").value.trim(),
        email: document.getElementById("modalEmail").value.trim(),
        bankName: document.getElementById("modalBankName").value.trim(),
        bankAccount: document.getElementById("modalBankAccount").value.trim(),
        bankIFSC: document.getElementById("modalBankIFSC").value.trim(),
        apaarId: document.getElementById("modalApaarId").value.trim(),
        caste: document.getElementById("modalCaste").value,
        maritalStatus: document.getElementById("modalMaritalStatus").value,
        differentlyAbled: document.getElementById("modalDifferentlyAbled").value,
        mark1: document.getElementById("modalMark1").value.trim(),
        mark2: document.getElementById("modalMark2").value.trim(),
        address: document.getElementById("modalAddress").value.trim(),
        townCity: document.getElementById("modalTownCity").value.trim(),
        district: document.getElementById("modalDistrict").value.trim(),
        pinCode: document.getElementById("modalPinCode").value.trim(),
        subjects: document.getElementById("modalSubjects").value.trim()
    };

    try {
        const response = await apiRequest("registration.verify", {
            body: payload
        });
        if (response && response.success) {
            showToast("संशोधन सहेजा गया एवं फॉर्म सफलतापूर्वक सत्यापित हुआ!", "success");
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
