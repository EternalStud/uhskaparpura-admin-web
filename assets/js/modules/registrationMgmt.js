"use strict";

import { renderNavbar } from "../../../components/navbar.js?t=202608030555";
import { showToast } from "../../../components/toast.js";
import { hideLoader, showLoader } from "../../../components/loader.js?t=202608030555";
import { apiRequest } from "../../../services/api.js";

let allRegistrations = [];
let currentFilteredRegistrations = [];

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

function getPublicSiteBaseUrl() {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "http://localhost:8080";
    }
    return "https://uhskaparpurakanti.in";
}

function driveThumbnailUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    return url;
}

export async function initRegistrationMgmtView() {
    renderNavbar(document.querySelector("#navbar-registration-mgmt"));

    // Event listeners for filters - attach immediately so controls are responsive
    const filterClass = document.getElementById("filterRegClass");
    const filterStatus = document.getElementById("filterRegStatus");
    const searchInput = document.getElementById("searchRegInput");
    const btnRefresh = document.getElementById("btnRefreshRegList");
    const btnPrintAll = document.getElementById("btnPrintAllReg");

    if (filterClass) filterClass.addEventListener("change", applyFilters);
    if (filterStatus) filterStatus.addEventListener("change", applyFilters);
    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (btnRefresh) btnRefresh.addEventListener("click", loadRegistrations);
    if (btnPrintAll) {
        btnPrintAll.addEventListener("click", () => {
            handlePrintAllRegistrations(currentFilteredRegistrations);
        });
    }

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
                window.open(`${getPublicSiteBaseUrl()}/registration-receipt.html?id=${encodeURIComponent(regId)}`, '_blank');
            } else {
                showToast("रजिस्ट्रेशन आईडी नहीं मिली।", "error");
            }
        });
    }

    const verifyForm = document.getElementById("verifyRegForm");
    if (verifyForm) {
        verifyForm.addEventListener("submit", handleVerifySubmit);
    }

    await loadRegistrations();
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

    currentFilteredRegistrations = filtered;
    const printBtnText = document.getElementById("printAllBtnText");
    if (printBtnText) {
        printBtnText.textContent = `सभी प्रिंट करें (Print All - ${filtered.length})`;
    }

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
                <td style="padding: 12px 15px; text-align: center; white-space: nowrap;">
                    <button type="button" class="btn btn-sm btn-open-detail" data-regid="${item.regId}" style="background: #e0f2fe; color: #0369a1; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-right: 5px;">👁️ जांचें / संपादित करें</button>
                    <button type="button" class="btn btn-sm btn-print-reg-direct" data-regid="${item.regId}" style="background: #e2e8f0; color: #1e293b; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-right: 5px;" title="प्रपत्र प्रिंट करें">🖨️</button>
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
                        👁️ विवरण जांचें
                    </button>
                    <button type="button" class="btn-print-reg-direct" data-regid="${item.regId}" style="background: #e2e8f0; color: #1e293b; max-width: 50px;" title="प्रपत्र प्रिंट करें">
                        🖨️
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

    document.querySelectorAll(".btn-print-reg-direct").forEach(btn => {
        btn.addEventListener("click", () => {
            const regId = btn.dataset.regid;
            if (regId) {
                window.open(`${getPublicSiteBaseUrl()}/registration-receipt.html?id=${encodeURIComponent(regId)}`, '_blank');
            }
        });
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
        let raw = String(item.dob).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            formattedDob = raw;
        } else if (raw.includes("/")) {
            const parts = raw.split("/");
            if (parts.length === 3) {
                if (parts[2].length === 4) formattedDob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                else formattedDob = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
        } else if (raw.includes("T")) {
            try {
                const d = new Date(raw);
                if (!isNaN(d.getTime())) {
                    const ist = new Date(d.getTime() + (5.5 * 3600 * 1000));
                    const year = ist.getUTCFullYear();
                    const month = String(ist.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(ist.getUTCDate()).padStart(2, '0');
                    formattedDob = `${year}-${month}-${day}`;
                }
            } catch(e) {}
        } else {
            try {
                const d = new Date(raw);
                if (!isNaN(d.getTime())) {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    formattedDob = `${year}-${month}-${day}`;
                }
            } catch(e) {}
        }
    }
    document.getElementById("modalDob").value = formattedDob || item.dob || "";

    let g = String(item.gender || "").trim().toLowerCase();
    let gVal = "";
    if (g === "m" || g === "male" || g === "पुरुष" || g === "पु.") gVal = "Male";
    else if (g === "f" || g === "female" || g === "महिला" || g === "म.") gVal = "Female";
    else if (g === "transgender" || g === "other" || g === "तृतीय लिंग") gVal = "Transgender";
    else gVal = item.gender || "";
    if (document.getElementById("modalGender")) {
        document.getElementById("modalGender").value = gVal;
    }

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
    if (document.getElementById("modalReligion")) {
        document.getElementById("modalReligion").value = item.religion || "";
    }
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
        gender: document.getElementById("modalGender") ? document.getElementById("modalGender").value : "",
        aadhaar: aadhaarVal,
        mobile: document.getElementById("modalMobile").value.trim(),
        email: document.getElementById("modalEmail").value.trim(),
        bankName: document.getElementById("modalBankName").value.trim(),
        bankAccount: document.getElementById("modalBankAccount").value.trim(),
        bankIFSC: document.getElementById("modalBankIFSC").value.trim(),
        apaarId: document.getElementById("modalApaarId").value.trim(),
        caste: document.getElementById("modalCaste").value,
        religion: document.getElementById("modalReligion") ? document.getElementById("modalReligion").value : "",
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

// ── Batch Print Engine ────────────────────────────────────────────────────────

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function resolveDirectCdnUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    return url;
}

function formatReceiptDate(dobStr) {
    if (!dobStr) return '-';
    let raw = String(dobStr).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const parts = raw.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (raw.includes('T')) {
        const dt = new Date(raw);
        if (!isNaN(dt.getTime())) {
            const ist = new Date(dt.getTime() + (5.5 * 3600 * 1000));
            const day = String(ist.getUTCDate()).padStart(2, '0');
            const month = String(ist.getUTCMonth() + 1).padStart(2, '0');
            const year = ist.getUTCFullYear();
            return `${day}/${month}/${year}`;
        }
    }
    const dateRegex = /([a-zA-Z]{3}) (\d{1,2}) (\d{4})/;
    const match = raw.match(dateRegex);
    if (match) {
        const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
        return `${match[2].padStart(2, '0')}/${months[match[1]] || '01'}/${match[3]}`;
    }
    return raw;
}

function formatReceiptGender(g) {
    let raw = String(g || '').trim();
    if (raw.toLowerCase() === 'male' || raw === 'पुरुष') return 'Male (पुरुष)';
    if (raw.toLowerCase() === 'female' || raw === 'महिला') return 'Female (महिला)';
    if (raw.toLowerCase() === 'transgender' || raw === 'तृतीय लिंग') return 'Transgender (तृतीय लिंग)';
    return raw || 'Not Specified';
}

function renderReceiptSubjectsHtml(subjects, className) {
    const classNum = parseInt(className, 10);
    const subjectsList = Array.isArray(subjects)
        ? subjects
        : String(subjects || "").split(",").map(s => s.trim()).filter(Boolean);

    let html = '';
    if (classNum === 9 || classNum === 10) {
        const compulsory = ["Mathematics", "Science", "Social Science", "English"];
        compulsory.forEach(sub => {
            html += `<tr><td>अनिवार्य (Compulsory)</td><td style="text-align:left; padding-left:12px;">${escapeHtml(sub)}</td><td>100</td></tr>`;
        });

        subjectsList.forEach(sub => {
            if (!compulsory.includes(sub)) {
                html += `<tr><td>भाषा / ऐच्छिक (Language/Opt)</td><td style="text-align:left; padding-left:12px;">${escapeHtml(sub)}</td><td>100</td></tr>`;
            }
        });
    } else {
        subjectsList.forEach((sub, idx) => {
            let grp = 'ऐच्छिक (Elective)';
            if (idx === 0) grp = 'अनिवार्य भाषा 1 (MIL)';
            else if (idx === 1) grp = 'अनिवार्य भाषा 2 (SIL)';
            else if (idx >= 5) grp = 'अतिरिक्त विषय (Additional)';
            html += `<tr><td>${grp}</td><td style="text-align:left; padding-left:12px;">${escapeHtml(sub)}</td><td>100</td></tr>`;
        });
    }

    if (!html) {
        html = `<tr><td colspan="3" style="color:#64748b; padding:10px;">कोई विषय दर्ज नहीं है।</td></tr>`;
    }
    return html;
}

function generateRegistrationReceiptPageHtml(data) {
    const isSenior = parseInt(data.className, 10) >= 11;
    const bsebCode = isSenior ? '31445' : '51375';
    const streamDisplay = data.stream || (isSenior ? 'General' : 'Matric General');
    const classDisplay = data.className ? `Class ${data.className}` : '-';
    const formattedDob = formatReceiptDate(data.dob);
    const genderDisplay = formatReceiptGender(data.gender);
    const fullAddress = [data.address, data.townCity, data.district, data.pinCode ? `PIN: ${data.pinCode}` : ''].filter(Boolean).join(', ') || '-';
    const subjectsTableRows = renderReceiptSubjectsHtml(data.subjects, data.className);

    const photoSrc = resolveDirectCdnUrl(data.photoUrl);
    const signSrc = resolveDirectCdnUrl(data.signatureUrl);

    return `
    <div class="page-wrap">
        <div class="receipt-body">
            <!-- Board Header -->
            <div class="rc-header">
                <div class="rc-board-hi">बिहार विद्यालय परीक्षा समिति, पटना</div>
                <div class="rc-board-en">BIHAR SCHOOL EXAMINATION BOARD, PATNA</div>
                <div class="rc-school-name">उच्च माध्यमिक विद्यालय कपरपुरा, काँटी, मुजफ्फरपुर</div>
                <div class="rc-doc-title">पंजीयन अनुमति-सह-आवेदन प्रपत्र रसीद (Registration Application Receipt)</div>
            </div>

            <!-- Meta Strip -->
            <div class="rc-meta-strip">
                <div class="rc-meta-item">
                    UDISE: <strong>10140616812</strong> | BSEB Code: <strong>${bsebCode}</strong>
                </div>
                <div class="rc-meta-item">
                    सत्र (Session): <strong>${escapeHtml(data.academicSession || '2026-28')}</strong>
                </div>
                <div class="rc-meta-item">
                    पंजीयन आईडी: <span class="reg-id-badge">${escapeHtml(data.regId || '-')}</span>
                </div>
            </div>

            <!-- Top Profile Grid (Info + Photo Corner) -->
            <div style="display: flex; gap: 10px; align-items: stretch; margin-bottom: 4px;">
                <div style="flex: 1;">
                    <div class="sec-title">1. विद्यार्थी का व्यक्तिगत विवरण (Personal Details)</div>
                    <table class="data-table">
                        <tr>
                            <td class="lbl">छात्र कोड (Student Code)</td>
                            <td class="val-bold">${escapeHtml(data.studentCode || '-')}</td>
                            <td class="lbl">क्रमांक (Roll No.)</td>
                            <td class="val-bold">${escapeHtml(data.rollNo || '-')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">कक्षा (Class)</td>
                            <td class="val-bold">${escapeHtml(classDisplay)}</td>
                            <td class="lbl">संकाय (Stream/Faculty)</td>
                            <td class="val-bold">${escapeHtml(streamDisplay)}</td>
                        </tr>
                        <tr>
                            <td class="lbl">विद्यार्थी का नाम (Name)</td>
                            <td class="val-bold" colspan="3" style="text-transform: uppercase;">${escapeHtml(data.studentName || '-')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">पिता का नाम (Father's Name)</td>
                            <td class="val" colspan="3" style="text-transform: uppercase;">${escapeHtml(data.fatherName || '-')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">माता का नाम (Mother's Name)</td>
                            <td class="val" colspan="3" style="text-transform: uppercase;">${escapeHtml(data.motherName || '-')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">जन्म तिथि (DOB)</td>
                            <td class="val-bold">${escapeHtml(formattedDob)}</td>
                            <td class="lbl">लिंग (Gender)</td>
                            <td class="val">${escapeHtml(genderDisplay)}</td>
                        </tr>
                        <tr>
                            <td class="lbl">आधार संख्या (Aadhaar No.)</td>
                            <td class="val-bold">${escapeHtml(data.aadhaar || '-')}</td>
                            <td class="lbl">मोबाइल (Mobile No.)</td>
                            <td class="val-bold">${escapeHtml(data.mobile || '-')}</td>
                        </tr>
                    </table>
                </div>

                <!-- Photo & Signature Box -->
                <div class="photo-sign-block" style="width: 38mm; flex-shrink: 0; justify-content: flex-start; padding-top: 18px;">
                    <div class="photo-frame">
                        ${photoSrc ? `<img src="${photoSrc}" referrerpolicy="no-referrer" alt="Photo" onerror="this.style.display='none'">` : `<div style="color: #94a3b8; font-size: 6pt;">No Photo</div>`}
                    </div>
                    <div style="font-size: 6.5pt; color: #64748b; font-weight: 700; text-align: center;">PHOTO (3cm × 3.5cm)</div>
                    
                    <div class="sign-frame" style="margin-top: 4px;">
                        ${signSrc ? `<img src="${signSrc}" referrerpolicy="no-referrer" alt="Signature" onerror="this.style.display='none'">` : `<div style="color: #94a3b8; font-size: 6pt;">No Sign</div>`}
                    </div>
                    <div style="font-size: 6.5pt; color: #64748b; font-weight: 700; text-align: center;">SIGNATURE (3.5cm × 1cm)</div>
                </div>
            </div>

            <!-- Contact & Additional Details -->
            <div class="cols-2">
                <div>
                    <div class="sec-title">2. बैंक एवं अतिरिक्त विवरण (Bank & Identifiers)</div>
                    <table class="data-table">
                        <tr>
                            <td class="lbl">बैंक का नाम (Bank)</td>
                            <td class="val">${escapeHtml(data.bankName || '-')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">खाता संख्या (A/C No.)</td>
                            <td class="val-bold">${escapeHtml(data.bankAccount || '-')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">IFSC कोड</td>
                            <td class="val-bold">${escapeHtml(data.bankIFSC || '-')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">APAAR ID</td>
                            <td class="val">${escapeHtml(data.apaarId || '-')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">ईमेल (Email)</td>
                            <td class="val">${escapeHtml(data.email || '-')}</td>
                        </tr>
                    </table>
                </div>

                <div>
                    <div class="sec-title">3. सामाजिक एवं अन्य विवरण (Social & Address)</div>
                    <table class="data-table">
                        <tr>
                            <td class="lbl">कोटि / धर्म (Category/Rel.)</td>
                            <td class="val">${escapeHtml(data.caste || '-')} / ${escapeHtml(data.religion || '-')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">वैवाहिक स्थिति / दिव्यांग</td>
                            <td class="val">${escapeHtml(data.maritalStatus || '-')} / ${escapeHtml((data.differentlyAbled === 'Yes' || data.differentlyAbled === 'हाँ') ? 'दिव्यांग (Yes)' : 'सामान्य (No)')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">पहचान चिह्न 1 (Mark 1)</td>
                            <td class="val">${escapeHtml(data.mark1 || '-')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">पहचान चिह्न 2 (Mark 2)</td>
                            <td class="val">${escapeHtml(data.mark2 || '-')}</td>
                        </tr>
                        <tr>
                            <td class="lbl">स्थायी पता (Address)</td>
                            <td class="val">${escapeHtml(fullAddress)}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- Subjects Offered Section -->
            <div class="sec-title">4. चयनित विषय समूह (Subjects Offered for Board Examination)</div>
            <table class="sub-table">
                <thead>
                    <tr>
                        <th style="width: 25%;">विषय वर्ग (Subject Group)</th>
                        <th style="width: 50%; text-align: left; padding-left: 12px;">विषय का नाम (Subject Name)</th>
                        <th style="width: 25%;">पूर्णांक (Total Marks)</th>
                    </tr>
                </thead>
                <tbody>
                    ${subjectsTableRows}
                </tbody>
            </table>

            <!-- Notice & Instructions -->
            <div class="decl-box">
                <strong>📢 घोषणा एवं महत्वपूर्ण निर्देश:</strong><br>
                1. प्रमाणित किया जाता है कि उपर्युक्त सभी विवरण मेरे द्वारा दिए गए मूल अभिलेखों के अनुसार सत्य एवं सही हैं।<br>
                2. विद्यार्थी इस रसीद की <strong>हस्ताक्षरित प्रति</strong> आधार कार्ड एवं बैंक पासबुक की छायाप्रति के साथ <strong>पंजीयन प्रभारी शिक्षक</strong> के पास जमा करें।
            </div>

            <!-- Signature Row with Handsome 52px clearance -->
            <div class="sig-row">
                <div class="sig-item">
                    <div class="sig-space"></div>
                    <div class="sig-line">छात्र / छात्रा का हस्ताक्षर<br>(Student Signature)</div>
                </div>
                <div class="sig-item">
                    <div class="sig-space"></div>
                    <div class="sig-line">माता / पिता का हस्ताक्षर<br>(Parent Signature)</div>
                </div>
                <div class="sig-item">
                    <div class="sig-space"></div>
                    <div class="sig-line">पंजीयन प्रभारी के हस्ताक्षर<br>(Registration In-Charge)</div>
                </div>
                <div class="sig-item">
                    <div class="sig-space"></div>
                    <div class="sig-line">प्रधानाध्यापक के हस्ताक्षर एवं मुहर<br>(Principal Seal & Signature)</div>
                </div>
            </div>
        </div>
    </div>
    `;
}

function handlePrintAllRegistrations(list) {
    const targets = (list && list.length > 0) ? list : allRegistrations;
    if (!targets || targets.length === 0) {
        showToast("प्रिंट करने के लिए कोई पंजीयन रिकॉर्ड नहीं मिला। (No registrations available to print.)", "warning");
        return;
    }

    // Sort students: Class -> Stream -> Roll No
    const sorted = [...targets].sort((a, b) => {
        const classA = parseInt(a.className, 10) || 0;
        const classB = parseInt(b.className, 10) || 0;
        if (classA !== classB) return classA - classB;

        const streamOrder = { "science": 1, "arts": 2, "commerce": 3 };
        const stA = streamOrder[String(a.stream || "").toLowerCase()] || 99;
        const stB = streamOrder[String(b.stream || "").toLowerCase()] || 99;
        if (stA !== stB) return stA - stB;

        const rollA = parseInt(String(a.rollNo || "").replace(/\D/g, ""), 10) || 0;
        const rollB = parseInt(String(b.rollNo || "").replace(/\D/g, ""), 10) || 0;
        return rollA - rollB;
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast("पॉप-अप ब्लॉक हो गया है। कृपया ब्राउज़र में पॉप-अप की अनुमति दें। (Pop-up blocked.)", "error");
        return;
    }

    let pagesHtml = "";
    sorted.forEach(student => {
        pagesHtml += generateRegistrationReceiptPageHtml(student);
    });

    const docTitle = `Registration_Receipts_Batch_${sorted.length}_Students`;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="hi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${docTitle}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                @page {
                    size: A4 portrait;
                    margin: 4mm 6mm 4mm 6mm;
                }
                body {
                    background: #334155;
                    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
                    padding: 16px 8px;
                    color: #0f172a;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    font-size: 8pt;
                    line-height: 1.2;
                }
                .action-bar {
                    background: #0f172a;
                    color: #fff;
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 24px;
                    position: sticky;
                    top: 0;
                    z-index: 9999;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    border-radius: 8px;
                    max-width: 210mm;
                    margin: 0 auto 20px auto;
                }
                .action-bar-title {
                    font-size: 0.95rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .action-bar button {
                    border: none;
                    cursor: pointer;
                    border-radius: 6px;
                    padding: 8px 18px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.2s;
                }
                .btn-print { background: #d97706; color: #fff; }
                .btn-print:hover { background: #b45309; }
                .btn-close { background: #475569; color: #f8fafc; }
                .btn-close:hover { background: #64748b; }

                .page-wrap {
                    width: 210mm;
                    max-width: 100%;
                    margin: 0 auto 24px auto;
                    background: #fff;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
                    border-radius: 6px;
                    overflow: hidden;
                    position: relative;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                .receipt-body {
                    padding: 5mm 8mm 3mm 8mm;
                    position: relative;
                    background-color: #fff;
                    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='280' height='130' viewBox='0 0 280 130'><text x='50%' y='50%' fill='rgba(0,0,0,0.026)' font-size='12' font-family='sans-serif' font-weight='bold' text-anchor='middle' transform='rotate(-22 140 65)'>उ.मा.वि. कपरपुरा, काँटी, मुजफ्फरपुर</text></svg>");
                    background-repeat: repeat;
                }

                .rc-header {
                    text-align: center;
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 4px;
                    margin-bottom: 5px;
                }
                .rc-board-hi {
                    font-size: 13.5pt;
                    color: #1e3a8a;
                    font-weight: 800;
                    line-height: 1.15;
                }
                .rc-board-en {
                    font-size: 9pt;
                    color: #b45309;
                    font-weight: 700;
                    margin-top: 1px;
                }
                .rc-school-name {
                    font-size: 10.5pt;
                    color: #0f172a;
                    font-weight: 800;
                    margin-top: 2px;
                }
                .rc-doc-title {
                    display: inline-block;
                    background: #f1f5f9;
                    border: 1px solid #cbd5e1;
                    border-radius: 14px;
                    padding: 2px 14px;
                    font-size: 8pt;
                    font-weight: 800;
                    color: #0f172a;
                    margin-top: 3px;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                }
                .rc-meta-strip {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #f8fafc;
                    border: 1px solid #cbd5e1;
                    border-radius: 4px;
                    padding: 3px 8px;
                    margin-bottom: 4px;
                    font-size: 7.5pt;
                }
                .rc-meta-item strong { color: #0f172a; }
                .reg-id-badge {
                    background: #fef3c7;
                    border: 1px dashed #d97706;
                    color: #92400e;
                    font-weight: 800;
                    font-size: 9.5pt;
                    padding: 1px 8px;
                    border-radius: 4px;
                    letter-spacing: 0.8px;
                }
                .sec-title {
                    background: #f1f5f9;
                    color: #1e3a8a;
                    font-weight: 800;
                    font-size: 7.5pt;
                    padding: 2px 6px;
                    border-left: 3px solid #d97706;
                    margin-top: 4px;
                    margin-bottom: 2px;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }
                table.data-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 2px;
                    font-size: 7.2pt;
                }
                table.data-table td {
                    border: 1px solid #cbd5e1;
                    padding: 2px 4px;
                    vertical-align: middle;
                }
                table.data-table td.lbl {
                    font-weight: 700;
                    background: #f8fafc;
                    color: #334155;
                    width: 22%;
                    white-space: nowrap;
                }
                table.data-table td.val {
                    color: #0f172a;
                    font-weight: 600;
                }
                table.data-table td.val-bold {
                    color: #0f172a;
                    font-weight: 800;
                }
                table.sub-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 3px;
                    font-size: 7.2pt;
                    text-align: center;
                }
                table.sub-table th {
                    background: #1e3a8a;
                    color: #fff;
                    padding: 2.5px 4px;
                    font-weight: 700;
                    border: 1px solid #1e3a8a;
                    font-size: 7.2pt;
                }
                table.sub-table td {
                    border: 1px solid #cbd5e1;
                    padding: 2.2px 4px;
                    font-weight: 600;
                }
                .cols-2 {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                }
                .photo-sign-block {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 3px;
                }
                .photo-frame {
                    width: 27mm;
                    height: 32mm;
                    border: 1.2px solid #0f172a;
                    border-radius: 3px;
                    overflow: hidden;
                    background: #f8fafc;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .photo-frame img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                .sign-frame {
                    width: 32mm;
                    height: 9mm;
                    border: 1px solid #0f172a;
                    border-radius: 2px;
                    overflow: hidden;
                    background: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .sign-frame img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    display: block;
                }
                .decl-box {
                    border: 1px solid #cbd5e1;
                    background: #fffbeb;
                    border-radius: 4px;
                    padding: 3px 8px;
                    font-size: 6.8pt;
                    line-height: 1.25;
                    color: #92400e;
                    margin-top: 3px;
                    margin-bottom: 4px;
                }
                .sig-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-top: 12px;
                    margin-bottom: 2px;
                    font-size: 7pt;
                    font-weight: 700;
                    text-align: center;
                }
                .sig-item {
                    width: 23%;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                }
                .sig-space {
                    height: 52px;
                }
                .sig-line {
                    border-top: 1.2px solid #0f172a;
                    padding-top: 3px;
                    font-size: 6.8pt;
                    line-height: 1.25;
                }

                @media print {
                    html, body {
                        background: #fff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 210mm !important;
                        height: auto !important;
                        min-height: 100% !important;
                        overflow: visible !important;
                    }
                    .action-bar { display: none !important; }
                    .page-wrap {
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        height: 295mm !important;
                        max-height: 295mm !important;
                        overflow: hidden !important;
                    }
                    .page-wrap:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .receipt-body {
                        padding: 4mm 6mm 2mm 6mm !important;
                    }
                    .data-table, .sub-table, .sig-row, .decl-box, .photo-sign-block {
                        page-break-inside: avoid !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="action-bar">
                <div class="action-bar-title">
                    <span>📄</span>
                    <span>छात्र पंजीयन प्रपत्र बैच प्रिंट (Batch Registration Print) &bull; <strong>${sorted.length} विद्यार्थी</strong></span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-print" onclick="window.print()">🖨️ सभी प्रिंट करें (Print All ${sorted.length})</button>
                    <button class="btn-close" onclick="window.close()">✕ बंद करें (Close)</button>
                </div>
            </div>
            ${pagesHtml}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
}

window.handlePrintAllRegistrationsDirect = () => handlePrintAllRegistrations(currentFilteredRegistrations);
