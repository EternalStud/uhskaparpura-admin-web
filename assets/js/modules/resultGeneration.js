
/**
 * Generates an inline SVG QR Code representation of the certificate number.
 */
const generateQrSvg = (text) => {
    try {
        const qr = QrCode.encodeText(text, QrCode.Ecc.LOW);
        const size = qr.size;
        let path = "";
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (qr.getModule(x, y)) {
                    path += `M${x},${y}h1v1h-1z `;
                }
            }
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="-2 -2 ${size + 4} ${size + 4}" style="display: block; margin: 0 auto; background: white; border-radius: 4px; padding: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;"><path fill="#0f172a" d="${path}"/></svg>`;
    } catch (e) {
        console.error("QR Code generation failed:", e);
        return `<div style="width: 70px; height: 70px; background: #f1f5f9; border: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b; margin: 0 auto; border-radius: 4px;">QR</div>`;
    }
};

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


"use strict";

import { QrCode } from "./qrcodegen.js";

import { showToast } from "../../../components/toast.js";
import { showLoader, hideLoader } from "../../../components/loader.js?t=202608030555";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=202608030555";

const BSEB_LOGO_B64 = '/assets/images/bseb_logo_hd_transparent2.png';

/**
 * Normalize stream/faculty for BSEB report card display.
 */
const formatFacultyLabel = (raw) => {
    const t = String(raw || "").trim().toLowerCase();
    if (!t) return "";
    if (t.startsWith("sci") || t.includes("विज्ञान")) return "SCIENCE";
    if (t.startsWith("art") || t.includes("कला")) return "ARTS";
    if (t.startsWith("com") || t.includes("वाणिज्य")) return "COMMERCE";
    return String(raw).trim().toUpperCase();
};

/**
 * Match portalControl teacher-sig key stream segment (Science / Arts / ALL).
 */
const streamKeyVariant = (raw) => {
    const t = String(raw || "").trim().toLowerCase();
    if (!t || t === "all") return "ALL";
    if (t.startsWith("sci")) return "Science";
    if (t.startsWith("art")) return "Arts";
    if (t.startsWith("com")) return "Commerce";
    return String(raw).trim();
};

/**
 * Escape URL for use inside CSS url('...').
 */
const cssUrl = (url) => String(url || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

// Asset registry for deduplicating Base64 background images across batch report cards
const assetRegistry = new Map();

const getAssetClassName = (rawUrl) => {
    if (!rawUrl || rawUrl === 'REMOVED') return '';
    const cleanUrl = cssUrl(rawUrl);
    if (!cleanUrl) return '';
    
    if (!assetRegistry.has(cleanUrl)) {
        const className = `rc-img-asset-${assetRegistry.size + 1}`;
        assetRegistry.set(cleanUrl, className);
    }
    return assetRegistry.get(cleanUrl);
};

const clearAssetRegistry = () => {
    assetRegistry.clear();
};

const generateAssetCssRules = () => {
    let css = '';
    assetRegistry.forEach((className, url) => {
        css += `.${className} { background-image: url('${url}'); background-size: contain; background-repeat: no-repeat; background-position: center; }\n`;
    });
    return css;
};

/**
 * Resolve report-card asset from localStorage (year/exam/class scoped) with fallbacks.
 * Explicit REMOVED / empty at a scoped key wins (no fallback to older bare keys).
 */
const resolveReportAsset = (baseKey, academicYear, examName, activeClassVal, streamHint, sectionHint, cachedAssets = null) => {
    const cleanExamKey = examName ? examName.trim().replace(/\s+/g, '_') : "";
    const section = sectionHint || "A";
    const stream = streamKeyVariant(streamHint);

    const peek = (key) => {
        if (!key) return { found: false, value: "" };
        let val = localStorage.getItem(key);
        if ((val === null || val === undefined) && cachedAssets && Object.prototype.hasOwnProperty.call(cachedAssets, key)) {
            val = cachedAssets[key];
        }
        if (val === null || val === undefined) return { found: false, value: "" };
        if (val === "REMOVED") return { found: true, value: "" };
        return { found: true, value: String(val) };
    };

    // Teacher signature: class + stream + section scoped
    if (baseKey === "report_card_teacher_sig" && academicYear && cleanExamKey) {
        const specific = peek(`${baseKey}_${academicYear}_${cleanExamKey}_${activeClassVal}_${stream}_${section}`);
        if (specific.found) return specific.value;
        if (stream !== "ALL") {
            const allStream = peek(`${baseKey}_${academicYear}_${cleanExamKey}_${activeClassVal}_ALL_${section}`);
            if (allStream.found) return allStream.value;
        }
        const yearExam = peek(`${baseKey}_${academicYear}_${cleanExamKey}`);
        if (yearExam.found) return yearExam.value;
        const bare = peek(baseKey);
        return bare.found ? bare.value : "";
    }

    // Issue date: class-scoped only — missing means "use today's date" at print time
    if (baseKey === "report_card_issue_date" && academicYear && cleanExamKey && activeClassVal != null && activeClassVal !== "") {
        const classScoped = peek(`${baseKey}_${academicYear}_${cleanExamKey}_${activeClassVal}`);
        if (classScoped.found) return classScoped.value;
        return "";
    }

    // Issue place / HM sig / stamp: prefer class or year-exam scope, honor REMOVED
    if (academicYear && cleanExamKey && activeClassVal != null && activeClassVal !== "" &&
        (baseKey === "report_card_issue_place")) {
        const classScoped = peek(`${baseKey}_${academicYear}_${cleanExamKey}_${activeClassVal}`);
        if (classScoped.found) return classScoped.value;
    }

    if (academicYear && cleanExamKey) {
        const yearExam = peek(`${baseKey}_${academicYear}_${cleanExamKey}`);
        if (yearExam.found) return yearExam.value;
    }

    const bare = peek(baseKey);
    return bare.found ? bare.value : "";
};

/**
 * Format stored issue date (YYYY-MM-DD / Date / DD/MM/YYYY) → DD/MM/YYYY.
 * Empty / missing → today's date.
 */
const formatIssueDateDisplay = (savedDate) => {
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    if (!savedDate || !String(savedDate).trim()) return todayStr;

    const raw = String(savedDate).trim();
    const isoParts = raw.split("-");
    if (isoParts.length === 3 && isoParts[0].length === 4) {
        return `${isoParts[2]}/${isoParts[1]}/${isoParts[0]}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;

    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
        return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`;
    }
    return todayStr;
};

/**
 * Sync Drive-backed report card assets into localStorage (from Settings sheet).
 * Non-blocking friendly: uses sessionStorage cache and optional prefix filter.
 */
const REPORT_ASSET_CACHE_KEY = "uhs_report_card_settings_v2";

const applyReportCardSettings = (settings) => {
    if (!settings) return;
    Object.keys(settings).forEach((key) => {
        if (key.startsWith("report_card_")) {
            localStorage.setItem(key, settings[key]);
        }
    });
};

const syncReportCardAssetsFromApi = async ({ force = false } = {}) => {
    try {
        if (!force) {
            const cached = sessionStorage.getItem(REPORT_ASSET_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.ts && Date.now() - parsed.ts < 10 * 60 * 1000 && parsed.settings) {
                    applyReportCardSettings(parsed.settings);
                    // Refresh quietly in background
                    setTimeout(() => syncReportCardAssetsFromApi({ force: true }), 50);
                    return;
                }
            }
        }

        const response = await apiRequest("settings.load?prefix=report_card_");
        if (response.success && response.settings) {
            applyReportCardSettings(response.settings);
            try {
                sessionStorage.setItem(REPORT_ASSET_CACHE_KEY, JSON.stringify({
                    ts: Date.now(),
                    settings: response.settings
                }));
            } catch (_) { /* quota */ }
        }
    } catch (err) {
        console.warn("Could not prefetch report card assets:", err);
    }
};

let currentResults = [];
let activeClassVal = null;
let searchQuery = "";
let currentViewMode = window.innerWidth < 768 ? "cards" : "table";




/**
 * Generates Class 9-10 individual BSEB Statement of Marks HTML.
 */
const generateJuniorReportCardHtml = (res, examName, academicYear, activeClassVal, logoB64, cachedAssets = null) => {
    const classNumeral = activeClassVal === 10 ? 'X' : 'IX';

    const secSel = document.querySelector("#filter-section");
    const section = secSel && secSel.value ? secSel.value : "A";

    const getAsset = (baseKey, fallback) => {
        const val = resolveReportAsset(baseKey, academicYear, examName, activeClassVal, "ALL", section, cachedAssets);
        return val || fallback || "";
    };

    // Missing issue date → today; missing signatures/stamp → blank spacer
    const issueDate = formatIssueDateDisplay(getAsset("report_card_issue_date", ""));
    const issuePlace = (getAsset("report_card_issue_place", "MUZAFFARPUR") || "MUZAFFARPUR").toUpperCase();

    // Document Certificate Number & QR Code
    const cleanExam = examName.replace(/\s+/g, '_').toUpperCase();
    const certNo = `Academic Session = ${academicYear} ,Exam Name = ${examName} ,class = ${activeClassVal} , Student Code = ${res.studentId || res.rollNo}`;

    const teacherSig = getAsset("report_card_teacher_sig", "");
    const hmSig = getAsset("report_card_hm_sig", "");
    const schoolStamp = getAsset("report_card_school_stamp", "");

    const teacherSigHtml = teacherSig 
        ? `<img src="${teacherSig}" style="height: 44px; width: 150px; object-fit: contain; display: block; margin: 0 auto 2px auto;">` 
        : `<div style="height: 38px;"></div>`;

    const hmSigHtml = hmSig 
        ? `<img src="${hmSig}" style="position: absolute; bottom: 42px; left: 50%; transform: translateX(-50%); height: 50px; width: 160px; z-index: 2; object-fit: contain;">` 
        : `<div style="height: 38px;"></div>`;

    const stampHtml = schoolStamp
        ? `<img src="${schoolStamp}" style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: 85mm; height: 42mm; z-index: 1; opacity: 0.90; object-fit: contain;">`
        : ``;

    const fullLogoUrl = (logoB64.startsWith("http") || logoB64.startsWith("data:"))
        ? logoB64
        : new URL(logoB64, window.location.href).href;

    const getSubObj = (subId) => {
        if (!subId) return {};
        const found = (res.subjectDetails || []).find(s => String(s.subjectId) === String(subId));
        const subObj = found ? { ...found } : {};
        const sId = String(subId || "").toUpperCase();
        if (sId.endsWith("_SCI")) subObj.code = "112";
        if (sId.endsWith("_SST")) subObj.code = "111";
        if (sId.endsWith("_MAT")) subObj.code = "110";
        if (sId.endsWith("_ENG")) subObj.code = "113";
        return subObj;
    };

    const l1 = getSubObj(res.language1);
    const l2 = getSubObj(res.language2);
    const mat = getSubObj(`${activeClassVal}_MAT`);
    const sci = getSubObj(`${activeClassVal}_SCI`);
    const ssc = getSubObj(`${activeClassVal}_SST`);
    const eng = getSubObj(`${activeClassVal}_ENG`);

    const getFullMarks = (subObj) => {
        if (!subObj || Object.keys(subObj).length === 0) return 100;
        const total = (subObj.tMax || 0) + (subObj.pMax || 0);
        return total > 0 ? total : 100;
    };

    const getPassMarks = (subObj) => {
        if (!subObj || Object.keys(subObj).length === 0) return 30;
        if (subObj.passMarks) return subObj.passMarks;
        return Math.round(getFullMarks(subObj) * 0.3);
    };

    const getScoreVal = (subId) => {
        const obj = res.subjectScores ? res.subjectScores[subId] : null;
        if (!obj) return "";
        return obj.totalObt !== undefined ? obj.totalObt : "";
    };

    const getTheoryVal = (subId) => {
        const obj = res.subjectScores ? res.subjectScores[subId] : null;
        if (!obj) return "";
        return obj.theoryObt !== undefined && obj.theoryObt !== null ? obj.theoryObt : "";
    };

    const getPracVal = (subId) => {
        const isSciOrSst = String(subId || "").includes("_SCI") || String(subId || "").includes("_SST");
        if (!isSciOrSst) return "-";

        const obj = res.subjectScores ? res.subjectScores[subId] : null;
        if (!obj) return "-";
        
        let p = obj.practicalObt;
        if ((p === "" || p === null || p === undefined || p === 0 || p === "0") && obj.internalObt !== undefined && obj.internalObt !== "" && obj.internalObt !== 0 && obj.internalObt !== "0") {
            p = obj.internalObt;
        }

        if (p === 0 || p === "0" || p === "" || p === null || p === undefined) {
            return "-";
        }
        return p;
    };

    const l1Full = getFullMarks(l1), l1Pass = getPassMarks(l1);
    const l2Full = getFullMarks(l2), l2Pass = getPassMarks(l2);
    const matFull = getFullMarks(mat), matPass = getPassMarks(mat);
    const sciFull = getFullMarks(sci), sciPass = getPassMarks(sci);
    const sscFull = getFullMarks(ssc), sscPass = getPassMarks(ssc);
    const engFull = getFullMarks(eng), engPass = getPassMarks(eng);

    const totalFullMarks = l1Full + l2Full + matFull + sciFull + sscFull;
    const totalPassMarks = l1Pass + l2Pass + matPass + sciPass + sscPass;

    return `
    <div class="bseb-report-card-page" style="width: 210mm; height: 295mm; max-height: 295mm; padding: 12mm 14mm; margin: 0 auto; background-color: #ffffff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; font-family: 'Arial', 'Helvetica Neue', sans-serif; color: #1e293b; position: relative; overflow: hidden; border: 2.5px solid #0f172a;">

        <!-- Centered Emblem Watermark Layer (Single Light Seal) -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 440px; height: 440px; opacity: 0.05; pointer-events: none; z-index: 5;">
            <img src="${fullLogoUrl}" style="width: 100%; height: 100%; object-fit: contain;">
        </div>

        <!-- Main Content Area -->
        <div style="position: relative; z-index: 1;">
            <!-- Header Container -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <div style="width: 120px; text-align: left; display: flex; align-items: center;">
                    <img src="${fullLogoUrl}" style="width: 110px; height: 110px; object-fit: contain;">
                </div>
                <div style="flex: 1; text-align: center; padding: 0 10px;">
                    <h1 style="font-size: 24px; font-weight: 700; margin: 0; color: #1e3a8a; letter-spacing: 0.5px; text-shadow: 0.5px 0.5px 0px rgba(0,0,0,0.1);">बिहार विद्यालय परीक्षा समिति, पटना</h1>
                    <h2 style="font-size: 16px; font-weight: 600; margin: 3px 0; color: #dc2626;">Bihar School Examination Board, Patna</h2>
                    <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 4px;">विद्यालय: U.H.S. KAPARPURA, KANTI, MUZAFFARPUR</div>
                    
                    <!-- Pill Container for Exam Name -->
                    <div style="display: inline-block; background: linear-gradient(135deg, #f8fafc, #e2e8f0); box-shadow: inset 0 1px 2px rgba(255,255,255,0.8), 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; border-radius: 20px; padding: 5px 20px; margin-top: 8px;">
                        <span style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${examName} STATEMENT OF MARKS</span>
                    </div>
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 4px;">CLASS ${classNumeral}</div>
                </div>
                <div style="width: 120px;"></div>
            </div>

            <hr style="border: none; border-top: 1.5px solid #0f172a; margin: 0 0 12px 0;">

            <!-- Student Profile Info Grid -->
            <div style="display: flex; justify-content: space-between; font-size: 12.5px; line-height: 1.65; margin-bottom: 14px; color: #0f172a;">
                <table style="border-collapse: collapse;">
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">नाम Name</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; font-weight: 700; text-transform: uppercase;">${res.studentName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">पिता का नाम Father's Name</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; text-transform: uppercase;">${res.fatherName || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">माता का नाम Mother's Name</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; text-transform: uppercase;">${res.motherName || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">रोल नं. Roll No.</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; font-weight: 700;">${res.rollNo}</td>
                    </tr>
                </table>

                <table style="border-collapse: collapse;">
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">UDISE CODE</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; font-weight: 700;">10140616812</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">सत्र Session</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; font-weight: 700;">${academicYear}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">BSEB CODE</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; font-weight: 700;">51375</td>
                    </tr>
                </table>
            </div>

            <!-- Marks Table -->
            <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 13px; margin-bottom: 14px; border: 1.5px solid #0f172a; border-radius: 6px; overflow: hidden;" border="1">
                <thead>
                    <tr style="background: #f1f5f9; font-weight: 700; color: #0f172a; height: 38px;">
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 10%;">CODE</th>
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 30%;">SUBJECT</th>
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 12%;">FULL MARKS</th>
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 12%;">PASS MARKS</th>
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 12%;">THEORY</th>
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 12%;">INT/PRAC</th>
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 12%;">MARKS OBTAINED</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="height: 34px;">
                        <td style="border: 1px solid #0f172a; padding: 6px;">${l1.code || '101'}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px 12px; text-align: left; text-transform: uppercase;">${l1.name || 'HINDI'}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${l1Full}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${l1Pass}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getTheoryVal(res.language1)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getPracVal(res.language1)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px; font-weight: 700;">${getScoreVal(res.language1)}</td>
                    </tr>
                    <tr style="height: 34px;">
                        <td style="border: 1px solid #0f172a; padding: 6px;">${l2.code || '105'}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px 12px; text-align: left; text-transform: uppercase;">${l2.name || 'SANSKRIT'}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${l2Full}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${l2Pass}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getTheoryVal(res.language2)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getPracVal(res.language2)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px; font-weight: 700;">${getScoreVal(res.language2)}</td>
                    </tr>
                    <tr style="height: 34px;">
                        <td style="border: 1px solid #0f172a; padding: 6px;">${mat.code}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px 12px; text-align: left; text-transform: uppercase;">${mat.name || 'MATHEMATICS'}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${matFull}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${matPass}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getTheoryVal(`${activeClassVal}_MAT`)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getPracVal(`${activeClassVal}_MAT`)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px; font-weight: 700;">${getScoreVal(`${activeClassVal}_MAT`)}</td>
                    </tr>
                    <tr style="height: 34px;">
                        <td style="border: 1px solid #0f172a; padding: 6px;">${sci.code}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px 12px; text-align: left; text-transform: uppercase;">${sci.name || 'SCIENCE'}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${sciFull}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${sciPass}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getTheoryVal(`${activeClassVal}_SCI`)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getPracVal(`${activeClassVal}_SCI`)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px; font-weight: 700;">${getScoreVal(`${activeClassVal}_SCI`)}</td>
                    </tr>
                    <tr style="height: 34px;">
                        <td style="border: 1px solid #0f172a; padding: 6px;">${ssc.code}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px 12px; text-align: left; text-transform: uppercase;">${ssc.name || 'SOCIAL SCIENCE'}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${sscFull}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${sscPass}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getTheoryVal(`${activeClassVal}_SST`)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getPracVal(`${activeClassVal}_SST`)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px; font-weight: 700;">${getScoreVal(`${activeClassVal}_SST`)}</td>
                    </tr>
                    <tr style="height: 34px; font-weight: 700; background: #f8fafc;">
                        <td style="border: 1px solid #0f172a; padding: 6px;" colspan="2">TOTAL</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${totalFullMarks}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${totalPassMarks}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;" colspan="2">-</td>
                        <td style="border: 1px solid #0f172a; padding: 6px; font-weight: 800;">${res.grandTotal !== undefined ? res.grandTotal : ''}</td>
                    </tr>
                    <tr style="height: 34px;">
                        <td style="border: 1px solid #0f172a; padding: 6px;">${eng.code || '113'}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px 12px; text-align: left; text-transform: uppercase;">${eng.name || 'ENGLISH'}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${engFull}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${engPass}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getTheoryVal(`${activeClassVal}_ENG`)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px;">${getPracVal(`${activeClassVal}_ENG`)}</td>
                        <td style="border: 1px solid #0f172a; padding: 6px; font-weight: 700;">${getScoreVal(`${activeClassVal}_ENG`)}</td>
                    </tr>
                </tbody>
            </table>

            <!-- FINAL RESULT Dashboard Container matching Generated image 1.png -->
            <div style="border: 1.5px solid #0f172a; border-radius: 6px; overflow: hidden; margin-bottom: 12px; background-color: #ffffff;">
                <div style="background: #f1f5f9; padding: 5px; text-align: center; font-weight: 800; font-size: 11.5px; color: #0f172a; border-bottom: 1px solid #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                    FINAL RESULT
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); padding: 8px; gap: 4px; text-align: center; align-items: center;">
                    <div style="border-right: 1px solid #e2e8f0; padding-right: 4px;">
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">AGGREGATE MARKS</div>
                        <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-top: 2px;">${res.grandTotal !== undefined ? res.grandTotal : '-'}</div>
                    </div>
                    <div style="border-right: 1px solid #e2e8f0; padding-right: 4px;">
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">PERCENTAGE</div>
                        <div style="font-size: 13.5px; font-weight: 800; color: #2563eb; margin-top: 2px;">${res.percentage !== '0.0%' ? res.percentage : '-'}</div>
                    </div>
                    <div>
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">RESULT / DIVISION</div>
                        <div style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin-top: 2px;">${res.result} ${res.division ? '/ ' + res.division : ''}</div>
                    </div>
                </div>
            </div>

            <!-- Footer Details & Centered QR Code -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10px; font-size: 11.5px; color: #0f172a;">
                <div>
                    <div style="font-weight: 700;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" stroke-width="2.5" style="vertical-align: -1px; margin-right: 4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>PLACE : ${issuePlace}</div>
                    <div style="margin-top: 4px; font-weight: 700;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" stroke-width="2.5" style="vertical-align: -1px; margin-right: 4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>ISSUE DATE : ${issueDate}</div>
                </div>

                <!-- Centered QR Code Stamp -->
                <div style="text-align: center;">
                    <div style="border: 1px solid #0f172a; padding: 4px; background: #fff; display: inline-block; border-radius: 4px;">
                        ${generateQrSvg(certNo)}
                    </div>
                </div>

                <div style="width: 120px;"></div>
            </div>

            <!-- Signatures & Stamp Row -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; font-size: 12px; font-weight: 700; color: #0f172a;">
                <div style="text-align: center; width: 200px;">
                    ${teacherSigHtml}
                    <div style="border-top: 1px solid #0f172a; padding-top: 4px;">Class Teacher's Signature</div>
                </div>

                <div style="text-align: center; width: 200px; position: relative; height: 160px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
                    ${stampHtml}
                </div>

                <div style="text-align: center; width: 200px; position: relative; height: 160px; display: flex; flex-direction: column; justify-content: flex-end;">
                    ${hmSigHtml}
                    <div style="border-top: 1px solid #0f172a; padding-top: 4px; position: relative; z-index: 3;">Principal's Signature</div>
                </div>
            </div>

            <!-- Disclaimer Note at Very Bottom -->
            <div style="text-align: center; font-size: 10px; color: #475569; margin-top: 12px; font-weight: 600;">
                नोट: यह अंक विवरण विद्यालय द्वारा जारी किया गया है। / Note: This statement of marks is issued by the school.
            </div>
        </div>
    </div>`;
};

const generateSeniorReportCardHtml = (res, examName, academicYear, activeClassVal, streamName, logoB64, cachedAssets = null) => {
    const classNumeral = activeClassVal === 11 ? 'XI' : 'XII';

    const secSel = document.querySelector("#filter-section");
    const section = secSel && secSel.value ? secSel.value : "A";
    // Prefer per-student stream from API, then filter, for teacher-sig key + FACULTY
    const facultyLabel = formatFacultyLabel(res.stream || streamName);
    const streamHint = res.stream || streamName || "ALL";

    const getAsset = (baseKey, fallback) => {
        const val = resolveReportAsset(baseKey, academicYear, examName, activeClassVal, streamHint, section, cachedAssets);
        return val || fallback || "";
    };

    const issueDate = formatIssueDateDisplay(getAsset("report_card_issue_date", ""));
    const issuePlace = (getAsset("report_card_issue_place", "MUZAFFARPUR") || "MUZAFFARPUR").toUpperCase();

    const teacherSig = getAsset("report_card_teacher_sig", "");
    const hmSig = getAsset("report_card_hm_sig", "");
    const schoolStamp = getAsset("report_card_school_stamp", "");

    const teacherSigHtml = teacherSig 
        ? `<img src="${teacherSig}" style="height: 44px; width: 150px; object-fit: contain; display: block; margin: 0 auto 2px auto;">` 
        : `<div style="height: 38px;"></div>`;

    const hmSigHtml = hmSig 
        ? `<img src="${hmSig}" style="position: absolute; bottom: 42px; left: 50%; transform: translateX(-50%); height: 50px; width: 160px; z-index: 2; object-fit: contain;">` 
        : `<div style="height: 38px;"></div>`;

    const stampHtml = schoolStamp
        ? `<img src="${schoolStamp}" style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: 85mm; height: 42mm; z-index: 1; opacity: 0.90; object-fit: contain;">`
        : ``;

    const fullLogoUrl = (logoB64.startsWith("http") || logoB64.startsWith("data:"))
        ? logoB64
        : new URL(logoB64, window.location.href).href;

    const cleanExam = examName.replace(/\s+/g, '_').toUpperCase();
    const certNo = `Academic Session = ${academicYear} ,Exam Name = ${examName} ,class = ${activeClassVal} , Student Code = ${res.studentId || res.rollNo}`;

    const getSubDetails = (subId) => {
        if (!subId) return null;
        return (res.subjectDetails || []).find(s => String(s.subjectId) === String(subId)) || null;
    };

    const getSubData = (subObj) => {
        if (!subObj) return { name: "", theoryObt: "-", practicalObt: "-", totalObt: "-", score: "-", tMax: 100, pMax: 0, fullMarks: 100, passMarks: 30, code: "" };
        const scoreObj = res.subjectScores[subObj.subjectId];
        const tMax = subObj.tMax || 100;
        const pMax = subObj.pMax || 0;
        const fullMarks = tMax + pMax;
        const passMarks = Math.ceil(fullMarks * 0.3);

        if (!scoreObj) {
            return { name: subObj.name, theoryObt: "-", practicalObt: "-", totalObt: "-", score: "-", tMax, pMax, fullMarks, passMarks, code: subObj.code || "" };
        }

        const theoryObt = scoreObj.theoryObt !== undefined && scoreObj.theoryObt !== null ? scoreObj.theoryObt : "-";
        const practicalObt = pMax > 0 ? (scoreObj.practicalObt !== undefined && scoreObj.practicalObt !== null ? scoreObj.practicalObt : "-") : "-";
        const totalObt = scoreObj.totalObt !== undefined && scoreObj.totalObt !== null ? scoreObj.totalObt : "-";
        const score = scoreObj.score !== undefined && scoreObj.score !== null ? scoreObj.score : "-";

        return {
            name: subObj.name,
            theoryObt,
            practicalObt,
            totalObt,
            score,
            tMax,
            pMax,
            fullMarks,
            passMarks,
            code: subObj.code || ""
        };
    };

    const l1 = getSubDetails(res.language1);
    const l2 = getSubDetails(res.language2);
    const e1 = getSubDetails(res.elective1);
    const e2 = getSubDetails(res.elective2);
    const e3 = getSubDetails(res.elective3);
    const add = getSubDetails(res.additional);

    const sdL1 = getSubData(l1);
    const sdL2 = getSubData(l2);
    const sdE1 = getSubData(e1);
    const sdE2 = getSubData(e2);
    const sdE3 = getSubData(e3);
    const sdAdd = getSubData(add);

    const renderSubRow = (sd) => {
        if (!sd.name) return "";
        return `
        <tr style="height: 34px;">
            <td style="border: 1px solid #0f172a; padding: 6px;">${sd.code || '-'}</td>
            <td style="border: 1px solid #0f172a; padding: 6px 12px; text-align: left; text-transform: uppercase;">${sd.name}</td>
            <td style="border: 1px solid #0f172a; padding: 6px;">${sd.fullMarks}</td>
            <td style="border: 1px solid #0f172a; padding: 6px;">${sd.passMarks}</td>
            <td style="border: 1px solid #0f172a; padding: 6px; font-weight: 700;">${sd.theoryObt}</td>
            <td style="border: 1px solid #0f172a; padding: 6px; font-weight: 700;">${sd.pMax > 0 ? sd.practicalObt : '-'}</td>
            <td style="border: 1px solid #0f172a; padding: 6px; font-weight: 800;">${sd.totalObt}</td>
        </tr>`;
    };

    return `
    <div class="bseb-report-card-page" style="width: 210mm; height: 295mm; max-height: 295mm; padding: 12mm 14mm; margin: 0 auto; background-color: #ffffff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; font-family: 'Arial', 'Helvetica Neue', sans-serif; color: #1e293b; position: relative; overflow: hidden; border: 2.5px solid #0f172a;">

        <!-- Double Inner Border Frame -->
        <div style="position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; border: 1px solid #0f172a; pointer-events: none; z-index: 10;"></div>

        <!-- Single Centered Faint BSEB Seal Watermark (~5% opacity) -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 420px; height: 420px; opacity: 0.05; pointer-events: none; z-index: 5;">
            <img src="${fullLogoUrl}" style="width: 100%; height: 100%; object-fit: contain;">
        </div>

        <!-- Main Content Area -->
        <div style="position: relative; z-index: 1;">
            <!-- Header Container -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <div style="width: 120px; text-align: left; display: flex; align-items: center;">
                    <img src="${fullLogoUrl}" style="width: 110px; height: 110px; object-fit: contain;">
                </div>
                <div style="flex: 1; text-align: center; padding: 0 10px;">
                    <h1 style="font-size: 24px; font-weight: 700; margin: 0; color: #1e3a8a; letter-spacing: 0.5px; text-shadow: 0.5px 0.5px 0px rgba(0,0,0,0.1);">बिहार विद्यालय परीक्षा समिति, पटना</h1>
                    <h2 style="font-size: 16px; font-weight: 600; margin: 3px 0; color: #dc2626;">Bihar School Examination Board, Patna</h2>
                    <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 4px;">विद्यालय: U.H.S. KAPARPURA, KANTI, MUZAFFARPUR</div>
                    
                    <!-- Pill Container for Exam Name -->
                    <div style="display: inline-block; background: linear-gradient(135deg, #f8fafc, #e2e8f0); box-shadow: inset 0 1px 2px rgba(255,255,255,0.8), 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; border-radius: 20px; padding: 5px 20px; margin-top: 8px;">
                        <span style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${examName} STATEMENT OF MARKS</span>
                    </div>
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 4px;">CLASS ${classNumeral}</div>
                </div>
                <div style="width: 120px;"></div>
            </div>

            <hr style="border: none; border-top: 1.5px solid #0f172a; margin: 0 0 12px 0;">

            <!-- Student Profile Info Grid -->
            <div style="display: flex; justify-content: space-between; font-size: 12.5px; line-height: 1.65; margin-bottom: 14px; color: #0f172a;">
                <table style="border-collapse: collapse;">
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">नाम Name</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; font-weight: 700; text-transform: uppercase;">${res.studentName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">पिता का नाम Father's Name</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; text-transform: uppercase;">${res.fatherName || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">माता का नाम Mother's Name</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; text-transform: uppercase;">${res.motherName || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">रोल नं. Roll No.</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; font-weight: 700;">${res.rollNo}</td>
                    </tr>
                </table>

                <table style="border-collapse: collapse;">
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">UDISE CODE</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; font-weight: 700;">10140616812</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">सत्र Session</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; font-weight: 700;">${academicYear}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">INTER CODE</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; font-weight: 700;">31445</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 8px 2px 0; white-space: nowrap;">FACULTY</td>
                        <td style="padding: 2px 8px; font-weight: 700;">:</td>
                        <td style="padding: 2px 0; font-weight: 700; text-transform: uppercase;">${facultyLabel || '—'}</td>
                    </tr>
                </table>
            </div>

            <!-- Marks Table -->
            <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12.5px; margin-bottom: 14px; border: 1.5px solid #0f172a; border-radius: 6px; overflow: hidden;" border="1">
                <thead>
                    <tr style="background: #f1f5f9; font-weight: 700; color: #0f172a; height: 36px;">
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 12%;" rowspan="2">CODE</th>
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 32%;" rowspan="2">SUBJECT</th>
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 12%;" rowspan="2">FULL<br>MARKS</th>
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 12%;" rowspan="2">PASS<br>MARKS</th>
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 22%;" colspan="2">MARKS OBTAINED</th>
                        <th style="border: 1px solid #0f172a; padding: 6px; width: 12%;" rowspan="2">SUBJECT<br>TOTAL</th>
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700; color: #0f172a; height: 26px;">
                        <th style="border: 1px solid #0f172a; padding: 4px; width: 11%;">THEORY</th>
                        <th style="border: 1px solid #0f172a; padding: 4px; width: 11%;">PRACTICAL</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background: #f8fafc; font-weight: 700; text-align: left; height: 28px;">
                        <td colspan="7" style="border: 1px solid #0f172a; padding: 4px 10px; color: #0f172a;">1. अनिवार्य (Compulsory)</td>
                    </tr>
                    ${renderSubRow(sdL1)}
                    ${renderSubRow(sdL2)}
                    
                    <tr style="background: #f8fafc; font-weight: 700; text-align: left; height: 28px;">
                        <td colspan="7" style="border: 1px solid #0f172a; padding: 4px 10px; color: #0f172a;">2. ऐच्छिक (Elective)</td>
                    </tr>
                    ${renderSubRow(sdE1)}
                    ${renderSubRow(sdE2)}
                    ${renderSubRow(sdE3)}
                    
                    ${sdAdd.name ? `<tr style="background: #f8fafc; font-weight: 700; text-align: left; height: 28px;"><td colspan="7" style="border: 1px solid #0f172a; padding: 4px 10px; color: #0f172a;">3. अतिरिक्त (Additional)</td></tr>` + renderSubRow(sdAdd) : ''}
                </tbody>
            </table>

            <!-- FINAL RESULT Dashboard Container matching Generated image 1.png -->
            <div style="border: 1.5px solid #0f172a; border-radius: 6px; overflow: hidden; margin-bottom: 12px; background-color: #ffffff;">
                <div style="background: #f1f5f9; padding: 5px; text-align: center; font-weight: 800; font-size: 11.5px; color: #0f172a; border-bottom: 1px solid #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                    FINAL RESULT
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); padding: 8px; gap: 4px; text-align: center; align-items: center;">
                    <div style="border-right: 1px solid #e2e8f0; padding-right: 4px;">
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">AGGREGATE MARKS</div>
                        <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-top: 2px;">${res.grandTotal !== undefined ? res.grandTotal : '-'}</div>
                    </div>
                    <div style="border-right: 1px solid #e2e8f0; padding-right: 4px;">
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">PERCENTAGE</div>
                        <div style="font-size: 13.5px; font-weight: 800; color: #2563eb; margin-top: 2px;">${res.percentage !== '0.0%' ? res.percentage : '-'}</div>
                    </div>
                    <div>
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">RESULT / DIVISION</div>
                        <div style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin-top: 2px;">${res.result} ${res.division ? '/ ' + res.division : ''}</div>
                    </div>
                </div>
            </div>

            <!-- Footer Details & Centered QR Code -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10px; font-size: 11.5px; color: #0f172a;">
                <div>
                    <div style="font-weight: 700;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" stroke-width="2.5" style="vertical-align: -1px; margin-right: 4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>PLACE : ${issuePlace}</div>
                    <div style="margin-top: 4px; font-weight: 700;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" stroke-width="2.5" style="vertical-align: -1px; margin-right: 4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>ISSUE DATE : ${issueDate}</div>
                </div>

                <!-- Centered QR Code Stamp -->
                <div style="text-align: center;">
                    <div style="border: 1px solid #0f172a; padding: 4px; background: #fff; display: inline-block; border-radius: 4px;">
                        ${generateQrSvg(certNo)}
                    </div>
                </div>

                <div style="width: 120px;"></div>
            </div>

            <!-- Signatures & Stamp Row -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; font-size: 12px; font-weight: 700; color: #0f172a;">
                <div style="text-align: center; width: 200px;">
                    ${teacherSigHtml}
                    <div style="border-top: 1px solid #0f172a; padding-top: 4px;">Class Teacher's Signature</div>
                </div>

                <div style="text-align: center; width: 200px; position: relative; height: 160px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
                    ${stampHtml}
                </div>

                <div style="text-align: center; width: 200px; position: relative; height: 160px; display: flex; flex-direction: column; justify-content: flex-end;">
                    ${hmSigHtml}
                    <div style="border-top: 1px solid #0f172a; padding-top: 4px; position: relative; z-index: 3;">Principal's Signature</div>
                </div>
            </div>

            <!-- Disclaimer Note at Very Bottom -->
            <div style="text-align: center; font-size: 10px; color: #475569; margin-top: 12px; font-weight: 600;">
                नोट: यह अंक विवरण विद्यालय द्वारा जारी किया गया है। / Note: This statement of marks is issued by the school.
            </div>
        </div>
    </div>`;
};

const openPrintWindow = async (htmlContent, documentTitle) => {
    showLoader();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        hideLoader();
        showToast("Pop-up blocker prevented opening the print window. Please allow pop-ups.", "error");
        return;
    }

    const fullLogoUrl = (BSEB_LOGO_B64.startsWith("http") || BSEB_LOGO_B64.startsWith("data:"))
        ? BSEB_LOGO_B64
        : new URL(BSEB_LOGO_B64, window.location.href).href;

    // Signatures/stamps use deduplicated CSS classes from assetRegistry
    const assetStyles = `
        .bseb-logo-img { background-image: url("${fullLogoUrl}"); background-size: contain; background-repeat: no-repeat; background-position: center; }
        .bseb-logo-circular { width: 110px; height: 110px; background-image: url("${fullLogoUrl}"); background-size: 90%; background-repeat: no-repeat; background-position: center; }
        ${generateAssetCssRules()}
    `;

    hideLoader();

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <base href="${window.location.origin}/">
            <title>${documentTitle}</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                ${assetStyles}
                @page { size: A4 portrait; margin: 0; }
                html, body { margin: 0; padding: 0; background: #525659; font-family: 'Times New Roman', Times, serif; }
                * { box-sizing: border-box; }
                .bseb-report-card-page { 
                    margin: 20px auto !important; 
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3); 
                }
                @media print {
                    * { 
                        box-shadow: none !important; 
                        text-shadow: none !important; 
                        filter: none !important; 
                        mix-blend-mode: normal !important;
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                    }
                    html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 100% !important; overflow: visible !important; }
                    .print-wrapper { padding: 0 !important; margin: 0 !important; display: block !important; }
                    .bseb-report-card-page { 
                        margin: 0 auto !important; 
                        box-shadow: none !important; 
                        border: 2px solid #000 !important;
                        width: 210mm !important;
                        height: 295mm !important; 
                        max-height: 295mm !important; 
                        overflow: hidden !important; 
                        page-break-after: always !important; 
                        break-after: page !important; 
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .bseb-report-card-page:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .no-print-bar { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="no-print-bar" style="position: sticky; top: 0; left: 0; right: 0; background: #0f172a; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 999999; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: Arial, sans-serif;">
                <span style="font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                    📄 ${documentTitle}
                </span>
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; font-weight: 700; border-radius: 6px; cursor: pointer; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
                        🖨️ Save PDF / Print
                    </button>
                    <button onclick="window.close()" style="background: #475569; color: #fff; border: none; padding: 8px 14px; font-weight: 600; border-radius: 6px; cursor: pointer; font-size: 0.88rem;">
                        ✕ Close
                    </button>
                </div>
            </div>

            <div class="print-wrapper">
                ${htmlContent}
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
};

/**
 * Print individual report card for a single student.
 */
const handlePrintSingleReportCard = async (studentId) => {
    // Ensure assets are ready (uses cache if warm; otherwise one fast prefixed fetch)
    if (!sessionStorage.getItem(REPORT_ASSET_CACHE_KEY)) {
        await syncReportCardAssetsFromApi({ force: true });
    }

    const activeData = currentResults.find(r => r.classVal === activeClassVal);
    if (!activeData) return;

    const student = activeData.studentResults.find(s => String(s.studentId) === String(studentId));
    if (!student) return;

    const yearSelect = document.querySelector("#filter-academic-year");
    const examSelect = document.querySelector("#filter-exam");
    const streamSelect = document.querySelector("#filter-stream");

    const year = yearSelect ? yearSelect.value : "";
    const examName = examSelect ? examSelect.value : "";
    const streamName = (streamSelect && streamSelect.value) ? streamSelect.value : (student.stream || "");

    clearAssetRegistry();

    const isSenior = (activeClassVal === 11 || activeClassVal === 12);
    const cardHtml = isSenior
        ? generateSeniorReportCardHtml(student, examName, year, activeClassVal, streamName, BSEB_LOGO_B64)
        : generateJuniorReportCardHtml(student, examName, year, activeClassVal, BSEB_LOGO_B64);

    await openPrintWindow(cardHtml, `ReportCard_${student.rollNo}_${student.studentName}`);
};

/**
 * Batch print all report cards for current class selection.
 */
const handlePrintAllReportCards = async () => {
    if (!sessionStorage.getItem(REPORT_ASSET_CACHE_KEY)) {
        await syncReportCardAssetsFromApi({ force: true });
    }

    const activeData = currentResults.find(r => r.classVal === activeClassVal);
    if (!activeData || !activeData.studentResults || !activeData.studentResults.length) {
        showToast("No student results available to print.", "error");
        return;
    }

    const yearSelect = document.querySelector("#filter-academic-year");
    const examSelect = document.querySelector("#filter-exam");
    const streamSelect = document.querySelector("#filter-stream");

    const year = yearSelect ? yearSelect.value : "";
    const examName = examSelect ? examSelect.value : "";
    const streamName = (streamSelect && streamSelect.value) ? streamSelect.value : "";

    const isSenior = (activeClassVal === 11 || activeClassVal === 12);
    const secSel = document.querySelector("#filter-section");
    const section = secSel && secSel.value ? secSel.value : "A";

    // Snapshot keys currently in localStorage for bulk print (avoids repeated DOM/storage churn)
    const cachedAssets = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("report_card_")) {
            cachedAssets[key] = localStorage.getItem(key);
        }
    }
    // Ensure year/exam scoped fallbacks exist even if only bare keys were set
    ["report_card_hm_sig", "report_card_school_stamp", "report_card_issue_date", "report_card_issue_place", "report_card_teacher_sig"].forEach((baseKey) => {
        const resolved = resolveReportAsset(baseKey, year, examName, activeClassVal, streamName || "ALL", section, cachedAssets);
        if (resolved) cachedAssets[baseKey] = resolved;
    });

    // Ensure any legacy raw Base64 image (>100KB) is optimized before rendering
    for (const key of Object.keys(cachedAssets)) {
        if (cachedAssets[key] && typeof cachedAssets[key] === "string" && cachedAssets[key].startsWith("data:image") && cachedAssets[key].length > 100000) {
            cachedAssets[key] = await compressImage(cachedAssets[key], 600, 600);
        }
    }

    clearAssetRegistry();

    let allCardsHtml = "";
    activeData.studentResults.forEach(student => {
        const studentStream = student.stream || streamName;
        const cardHtml = isSenior
            ? generateSeniorReportCardHtml(student, examName, year, activeClassVal, studentStream, BSEB_LOGO_B64, cachedAssets)
            : generateJuniorReportCardHtml(student, examName, year, activeClassVal, BSEB_LOGO_B64, cachedAssets);
        allCardsHtml += cardHtml;
    });

    await openPrintWindow(allCardsHtml, `All_ReportCards_Class_${activeClassVal}_${examName}`);
};


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

/**
 * Returns an array of currently checked class numbers.
 */
const getCheckedClasses = () => {
    return Array.from(document.querySelectorAll('input[name="classes"]:checked')).map(el => el.value);
};

/**
 * Checks and updates the visibility of the Stream filter.
 */
const updateStreamFilterVisibility = () => {
    const streamContainer = document.querySelector("#stream-filter-container");
    const streamSelect = document.querySelector("#filter-stream");
    const checked = getCheckedClasses();
    
    // Show stream if Class 11 or Class 12 is checked
    const hasSrSec = checked.includes("11") || checked.includes("12");
    
    if (hasSrSec && streamContainer && streamSelect) {
        streamContainer.style.display = "flex";
        streamSelect.setAttribute("required", "required");
    } else if (streamContainer && streamSelect) {
        streamContainer.style.display = "none";
        streamSelect.removeAttribute("required");
        streamSelect.value = "";
    }
};

/**
 * Dynamically queries available sections for the selected year and the first checked class.
 */
const updateAvailableSections = async () => {
    const yearInput = document.querySelector("#filter-academic-year");
    const sectionSelect = document.querySelector("#filter-section");

    if (!yearInput || !sectionSelect) return;

    const year = String(yearInput.value || "").trim();
    const checked = getCheckedClasses();

    if (!year || checked.length === 0) {
        sectionSelect.innerHTML = '<option value="">Select Section</option>';
        return;
    }

    // Query sections using the first checked class as reference
    const classNum = checked[0];

    try {
        const response = await apiRequest(`subject.tag.getSections?academicYear=${year}&classNum=${classNum}`);
        if (response.success && response.sections) {
            if (response.sections.length === 0) {
                sectionSelect.innerHTML = '<option value="">No sections available</option>';
            } else {
                const opts = response.sections.map(sec => `<option value="${sec}">Section ${sec}</option>`).join("");
                sectionSelect.innerHTML = '<option value="">Select Section</option>' + opts;
                if (response.sections.includes("A")) {
                    sectionSelect.value = "A";
                } else {
                    sectionSelect.value = response.sections[0];
                }
            }
        }
    } catch (error) {
        console.error("Failed to load sections:", error);
    }
};

/**
 * Renders the tabs list of generated class results.
 */
const renderTabs = () => {
    const tabsContainer = document.querySelector("#results-tabs-container");
    if (!tabsContainer) return;

    tabsContainer.innerHTML = "";

    currentResults.forEach(classRes => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `class-tab${activeClassVal === classRes.classVal ? " active" : ""}`;
        btn.style.padding = "10px 20px";
        btn.style.border = "none";
        btn.style.background = "none";
        btn.style.fontWeight = activeClassVal === classRes.classVal ? "700" : "600";
        btn.style.color = activeClassVal === classRes.classVal ? "var(--color-primary)" : "var(--color-muted)";
        btn.style.borderBottom = activeClassVal === classRes.classVal ? "3px solid var(--color-primary)" : "3px solid transparent";
        btn.style.cursor = "pointer";
        btn.style.transition = "all 0.2s";
        btn.textContent = `Class ${classRes.classVal}`;

        btn.addEventListener("click", () => {
            activeClassVal = classRes.classVal;
            renderTabs();
            renderTable();
        });
        tabsContainer.appendChild(btn);
    });
};

/**
 * Helper to extract a score value from the structured subjectScores object.
 * subjectScores[subjectId] is now { displayVal, theoryObt, practicalObt, totalObt, tMax, pMax }
 */
const getScore = (subjectScores, subjectId, field = "displayVal") => {
    const obj = subjectScores[subjectId];
    if (!obj) return "";
    if (typeof obj === "string") return obj; // backward compat
    return obj[field] !== undefined ? obj[field] : "";
};

/**
 * Determines the BSEB abbreviation for a Class 9-10 subject based on its group or name.
 */
const getSubjectAbbrev910 = (sub) => {
    const g = String(sub.group || "").toLowerCase();
    if (g === "language1") return "MIL";
    if (g === "language2") return "SIL";

    const name = String(sub.name || "").toLowerCase();
    if (name.includes("math")) return "MAT";
    if (name.includes("science") && !name.includes("social")) return "SCI";
    if (name.includes("social") || name.includes("ssc") || name.includes("sst")) return "SSC";
    if (name.includes("english") || name.includes("eng")) return "ENG";
    if (name.includes("opt") && name.includes("voc")) return "OPT.SUB(VO C.)";
    if (name.includes("opt")) return "OPT SUB";

    // Fallback to code or name
    return sub.code || sub.name;
};

/**
 * Checks if ANY subject in the active list has practical marks configured > 0.
 */
const hasPracticalExam = (activeSubjects) => {
    return activeSubjects.some(sub => (sub.pMax || 0) > 0);
};

// ── Shared style constants ──
const TH = "padding: 8px 10px; font-weight: 700; color: var(--color-text); font-size: 0.85rem; line-height: 1.2;";
const TH_C = TH + " text-align: center;";
const TD = "padding: 8px 10px; font-size: 0.85rem; line-height: 1.2;";
const TD_C = TD + " text-align: center;";
const BL = "border-left: 1px solid var(--color-border);";
const BB = "border-bottom: 1px solid var(--color-border);";

/**
 * Renders the results grid table for the active class tab.
 */


/**
 * Helper to extract subject names and scores for mobile cards breakdown table.
 */
const getStudentSubjectScoreRows = (stud, activeClassVal) => {
    const isSenior = (activeClassVal === 11 || activeClassVal === 12);
    const rows = [];

    if (!stud || !stud.subjectScores) return rows;

    if (isSenior) {
        const details = stud.subjectDetails || [];
        if (details.length > 0) {
            details.forEach(sub => {
                const subId = sub.subjectId || sub.id;
                const scoreObj = stud.subjectScores[subId] || stud.subjectScores[sub.code];
                let displayVal = "-";
                if (scoreObj) {
                    if (typeof scoreObj === "object") {
                        if (scoreObj.displayVal !== undefined && scoreObj.displayVal !== "") {
                            displayVal = scoreObj.displayVal;
                        } else if (scoreObj.totalObt !== undefined && scoreObj.totalObt !== "") {
                            displayVal = scoreObj.totalObt;
                        } else if (scoreObj.theoryObt !== undefined && scoreObj.theoryObt !== "") {
                            const th = scoreObj.theoryObt === "A" ? "A" : (Number(scoreObj.theoryObt) || 0);
                            const pr = (scoreObj.practicalObt && scoreObj.practicalObt !== "A") ? (Number(scoreObj.practicalObt) || 0) : 0;
                            displayVal = th === "A" ? "A" : String(th + pr);
                        }
                    } else {
                        displayVal = String(scoreObj);
                    }
                }
                rows.push({ name: sub.name || sub.code || subId, score: displayVal });
            });
        } else {
            Object.keys(stud.subjectScores).forEach(subId => {
                const scoreObj = stud.subjectScores[subId];
                let displayVal = "-";
                if (scoreObj) {
                    if (typeof scoreObj === "object") {
                        displayVal = scoreObj.displayVal || scoreObj.totalObt || "-";
                    } else {
                        displayVal = String(scoreObj);
                    }
                }
                rows.push({ name: subId, score: displayVal });
            });
        }
    } else {
        const getSubName = (subId, defaultName) => {
            const found = (stud.subjectDetails || []).find(s => String(s.subjectId) === String(subId));
            return found ? (found.name || defaultName) : defaultName;
        };

        const milId = stud.language1;
        const silId = stud.language2;
        const matId = `${activeClassVal}_MAT`;
        const sciId = `${activeClassVal}_SCI`;
        const sscId = `${activeClassVal}_SST`;
        const engId = `${activeClassVal}_ENG`;

        const getVal = (subId) => {
            if (!subId) return "-";
            const obj = stud.subjectScores[subId];
            if (!obj) return "-";
            if (typeof obj === "object") {
                if (obj.displayVal !== undefined && obj.displayVal !== "") return obj.displayVal;
                if (obj.totalObt !== undefined && obj.totalObt !== "") return obj.totalObt;
                if (obj.theoryObt !== undefined && obj.theoryObt !== "") {
                    const th = obj.theoryObt === "A" ? "A" : (Number(obj.theoryObt) || 0);
                    const pr = (obj.practicalObt && obj.practicalObt !== "A") ? (Number(obj.practicalObt) || 0) : 0;
                    const inP = (obj.internalObt && obj.internalObt !== "A") ? (Number(obj.internalObt) || 0) : 0;
                    if (th === "A") return "A";
                    return String(th + pr + inP);
                }
                return "-";
            }
            return String(obj) || "-";
        };

        rows.push({ name: getSubName(milId, "MIL (Language 1)"), score: getVal(milId) });
        rows.push({ name: getSubName(silId, "SIL (Language 2)"), score: getVal(silId) });
        rows.push({ name: getSubName(matId, "MATHEMATICS"), score: getVal(matId) });
        rows.push({ name: getSubName(sciId, "SCIENCE"), score: getVal(sciId) });
        rows.push({ name: getSubName(sscId, "SOCIAL SCIENCE"), score: getVal(sscId) });
        rows.push({ name: getSubName(engId, "ENGLISH"), score: getVal(engId) });
    }

    return rows;
};

/**
 * Renders touch-friendly cards view for mobile screens.
 */
const renderCardsView = (container, activeSubjects, filteredStudents) => {
    if (!container) return;
    container.innerHTML = "";

    if (filteredStudents.length === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 32px; background-color: #ffffff; border-radius: 12px; border: 1px solid var(--color-border); color: var(--color-muted); font-weight: 600;">No student results match your search query.</div>';
        return;
    }

    let cardsHtml = "";
    filteredStudents.forEach(stud => {
        let divBg = "#f1f5f9";
        let divColor = "#475569";
        const divText = String(stud.division || "Incomplete").trim();

        if (divText.includes("1st")) {
            divBg = "#dcfce7"; divColor = "#15803d";
        } else if (divText.includes("2nd")) {
            divBg = "#dbeafe"; divColor = "#1d4ed8";
        } else if (divText.includes("3rd")) {
            divBg = "#fef3c7"; divColor = "#b45309";
        } else if (divText.includes("Fail")) {
            divBg = "#fee2e2"; divColor = "#b91c1c";
        }

        const scoreRows = getStudentSubjectScoreRows(stud, activeClassVal);
        let subRowsHtml = "";
        scoreRows.forEach(row => {
            subRowsHtml += `
                <tr style="border-bottom: 1px dashed var(--color-border);">
                    <td style="padding: 6px 4px; font-weight: 600; color: var(--color-text); font-size: 0.82rem; text-transform: uppercase;">${row.name}</td>
                    <td style="padding: 6px 4px; text-align: right; font-weight: 700; color: var(--color-primary); font-size: 0.85rem;">${row.score}</td>
                </tr>
            `;
        });

        cardsHtml += `
        <div class="mobile-student-card" style="background-color: #ffffff; border: 1px solid var(--color-border); border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 12px; transition: transform 0.2s, box-shadow 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="background: var(--color-primary-light, #e0e7ff); color: var(--color-primary); font-weight: 800; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem;">Roll #${stud.rollNo}</span>
                        <span style="font-weight: 800; font-size: 1.05rem; color: var(--color-text);">${stud.studentName}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--color-muted); margin-top: 4px;">
                        Father: ${stud.fatherName || '-'} | Gender: ${stud.gender || '-'}
                    </div>
                </div>
                <span style="background: ${divBg}; color: ${divColor}; font-weight: 800; padding: 4px 10px; border-radius: 20px; font-size: 0.78rem; white-space: nowrap;">
                    ${divText}
                </span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: var(--color-background); padding: 10px; border-radius: 8px; text-align: center;">
                <div>
                    <div style="font-size: 0.7rem; color: var(--color-muted); text-transform: uppercase; font-weight: 700;">Aggregate</div>
                    <div style="font-size: 0.95rem; font-weight: 800; color: var(--color-text);">${stud.grandTotal !== undefined ? stud.grandTotal : '-'}</div>
                </div>
                <div>
                    <div style="font-size: 0.7rem; color: var(--color-muted); text-transform: uppercase; font-weight: 700;">Percentage</div>
                    <div style="font-size: 0.95rem; font-weight: 800; color: var(--color-primary);">${stud.percentage !== undefined ? stud.percentage : '-'}</div>
                </div>
                <div>
                    <div style="font-size: 0.7rem; color: var(--color-muted); text-transform: uppercase; font-weight: 700;">Rank</div>
                    <div style="font-size: 0.95rem; font-weight: 800; color: #d97706;">#${stud.rank || '-'}</div>
                </div>
            </div>

            <details open style="border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 12px; background-color: #ffffff;">
                <summary style="font-weight: 700; font-size: 0.82rem; color: var(--color-primary); cursor: pointer; user-select: none;">
                    Subject Scores Breakdown
                </summary>
                <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
                    <tbody>
                        ${subRowsHtml}
                    </tbody>
                </table>
            </details>

            <button type="button" class="btn btn-secondary print-single-card-btn" data-studentid="${stud.studentId}" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; font-weight: 700; border-radius: 8px; background: var(--color-background); border: 1px solid var(--color-border); color: var(--color-text); font-size: 0.88rem; cursor: pointer; min-height: 44px;">
                <span class="material-symbols-rounded" style="font-size: 1.1rem; color: var(--color-primary);">print</span>
                Print Official Report Card
            </button>
        </div>`;
    });
    
    container.innerHTML = cardsHtml;

    container.onclick = (e) => {
        const btn = e.target.closest(".print-single-card-btn");
        if (btn) {
            e.stopPropagation();
            const studentId = btn.getAttribute("data-studentid");
            handlePrintSingleReportCard(studentId);
        }
    };
};


const renderTable = () => {
    const thead = document.querySelector("#results-table-thead");
    const tbody = document.querySelector("#results-table-tbody");
    const statsSummary = document.querySelector("#result-stats-summary");
    const tableWrapper = document.querySelector("#results-table-wrapper");
    const cardsContainer = document.querySelector("#results-cards-container");
    const btnTable = document.querySelector("#toggle-view-table");
    const btnCards = document.querySelector("#toggle-view-cards");

    if (!thead || !tbody) return;

    thead.innerHTML = "";
    tbody.innerHTML = "";

    const activeData = currentResults.find(r => r.classVal === activeClassVal);
    if (!activeData) {
        tbody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 20px; color: var(--color-muted);">No results data found.</td></tr>';
        if (statsSummary) statsSummary.textContent = "0 Students Listed";
        return;
    }

    const { activeSubjects, studentResults } = activeData;

    // Filter students by search query
    const filteredStudents = studentResults.filter(stud => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return (
            String(stud.studentName || "").toLowerCase().includes(query) ||
            String(stud.rollNo || "").toLowerCase().includes(query) ||
            String(stud.fatherName || "").toLowerCase().includes(query)
        );
    });

    // Sort students
    const sortSelect = document.querySelector("#result-sort-select");
    const sortBy = sortSelect ? sortSelect.value : "roll";
    if (sortBy === "aggregate") {
        filteredStudents.sort((a, b) => (b.grandTotal || 0) - (a.grandTotal || 0));
    } else {
        filteredStudents.sort((a, b) => {
            const rollA = parseInt(a.rollNo, 10);
            const rollB = parseInt(b.rollNo, 10);
            if (isNaN(rollA) && isNaN(rollB)) return 0;
            if (isNaN(rollA)) return 1;
            if (isNaN(rollB)) return -1;
            return rollA - rollB;
        });
    }

    if (statsSummary) {
        statsSummary.textContent = `${filteredStudents.length} Students Listed`;
    }

// View Mode Toggle Display
    if (currentViewMode === "cards") {
        if (tableWrapper) tableWrapper.style.display = "none";
        if (cardsContainer) cardsContainer.style.display = "grid";

        if (btnTable) {
            btnTable.style.background = "transparent";
            btnTable.style.color = "var(--color-muted)";
            btnTable.style.boxShadow = "none";
            btnTable.classList.remove("active");
        }
        if (btnCards) {
            btnCards.style.background = "#ffffff";
            btnCards.style.color = "var(--color-primary)";
            btnCards.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
            btnCards.classList.add("active");
        }
        renderCardsView(cardsContainer, activeSubjects, filteredStudents);
    } else {
        if (tableWrapper) tableWrapper.style.display = "block";
        if (cardsContainer) cardsContainer.style.display = "none";

        if (btnTable) {
            btnTable.style.background = "#ffffff";
            btnTable.style.color = "var(--color-primary)";
            btnTable.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
            btnTable.classList.add("active");
        }
        if (btnCards) {
            btnCards.style.background = "transparent";
            btnCards.style.color = "var(--color-muted)";
            btnCards.style.boxShadow = "none";
            btnCards.classList.remove("active");
        }
        const isSenior = (activeClassVal === 11 || activeClassVal === 12);

        if (isSenior) {
            renderSeniorTable(thead, tbody, activeSubjects, filteredStudents);
        } else {
            renderJuniorTable(thead, tbody, activeSubjects, filteredStudents);
        }
    }
};


// ═══════════════════════════════════════════
//  CLASS 9-10 (Junior) BSEB Layout
// ═══════════════════════════════════════════
const renderJuniorTable = (thead, tbody, activeSubjects, filteredStudents) => {
    // 6 fixed standard BSEB Class 9-10 slots (OPT SUB and OPT.SUB(VOC.) removed as requested)
    const juniorSlots = [
        { label: "MIL", slotId: "language1", defaultSubId: "" },
        { label: "SIL", slotId: "language2", defaultSubId: "" },
        { label: "MAT", slotId: "compulsory", defaultSubId: `${activeClassVal}_MAT` },
        { label: "SCI", slotId: "compulsory", defaultSubId: `${activeClassVal}_SCI` },
        { label: "SSC", slotId: "compulsory", defaultSubId: `${activeClassVal}_SST` },
        { label: "ENG", slotId: "compulsory", defaultSubId: `${activeClassVal}_ENG` }
    ];

    // Helper to check if a junior slot has practical marks configured
    const slotHasPractical = (slot) => {
        return filteredStudents.some(res => {
            let subId = "";
            if (slot.slotId === "compulsory") {
                subId = slot.defaultSubId;
            } else {
                subId = res[slot.slotId];
            }
            if (!subId) return false;
            const details = res.subjectDetails.find(s => String(s.subjectId) === String(subId));
            return details && (details.pMax || 0) > 0;
        });
    };

    const hasPrac = juniorSlots.some(slotHasPractical);

    let row1 = "";
    let row2 = "";
    let row3 = "";

    if (hasPrac) {
        // ── Three-row header (for Practical/Internal exams) ──
        row1 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th rowspan="3" style="${TH_C} width: 3%;">SL NO</th>
            <th rowspan="3" style="${TH_C} width: 4%;">ROLL NO.</th>
            <th rowspan="3" style="${TH_C} width: 4%;">CLASS</th>
            <th rowspan="3" style="${TH} width: 15%;">STUDENT NAME</th>
            <th rowspan="3" style="${TH} width: 13%;">MOTHER'S NAME</th>
            <th rowspan="3" style="${TH} width: 13%;">FATHER'S NAME</th>
            <th rowspan="3" style="${TH_C} width: 3%;">GENDER</th>
            <th colspan="6" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED(THEORY)</th>
            <th colspan="3" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED (INTERNAL ASSEMENT & PRACTICAL)</th>
            <th rowspan="3" style="${TH_C} width: 7%; ${BL}">AGGREGATE</th>
            <th rowspan="3" style="${TH_C} width: 7%;">RESULT</th>
            <th rowspan="3" style="${TH_C} width: 6%;">ACTION</th>
        </tr>`;

        // Row 2: theory labels and practical category labels
        row2 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} width: 4.5%;">MIL</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">SIL</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">MAT</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">SCI</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">SSC</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">ENG</th>
            
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} width: 4%;">SCI</th>
            <th colspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BB}">SSC</th>
        </tr>`;

        // Row 3: sub-columns for SSC practicals (LIT.ACT and Project Wrok)
        row3 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th style="padding: 6px; font-weight: 600; text-align: center; font-size: 0.8em; ${BL} width: 4%;">LIT.ACT</th>
            <th style="padding: 6px; font-weight: 600; text-align: center; font-size: 0.8em; width: 4%;">Project Wrok</th>
        </tr>`;

    } else {
        // ── Two-row header (for Theory-only exams) ──
        row1 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th rowspan="2" style="${TH_C} width: 3%;">SL NO</th>
            <th rowspan="2" style="${TH_C} width: 4%;">ROLL NO.</th>
            <th rowspan="2" style="${TH_C} width: 4%;">CLASS</th>
            <th rowspan="2" style="${TH} width: 17%;">STUDENT NAME</th>
            <th rowspan="2" style="${TH} width: 14%;">MOTHER'S NAME</th>
            <th rowspan="2" style="${TH} width: 14%;">FATHER'S NAME</th>
            <th rowspan="2" style="${TH_C} width: 4%;">GENDER</th>
            <th colspan="6" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED(THEORY)</th>
            <th rowspan="2" style="${TH_C} width: 7%; ${BL}">AGGREGATE</th>
            <th rowspan="2" style="${TH_C} width: 7%;">RESULT</th>
            <th rowspan="2" style="${TH_C} width: 6%;">ACTION</th>
        </tr>`;

        row2 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} width: 5%;">MIL</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">SIL</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">MAT</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">SCI</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">SSC</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">ENG</th>
        </tr>`;
    }

    thead.innerHTML = row1 + row2 + row3;

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 30px; color: var(--color-muted);">No matching student results found.</td></tr>`;
        return;
    }

    const rowsHtml = filteredStudents.map((res, index) => {
        const genderRaw = String(res.gender || "").toLowerCase().trim();
        const genderText = (genderRaw === "female" || genderRaw === "f") ? "F" : ((genderRaw === "male" || genderRaw === "m") ? "M" : "");

        let resultBadgeStyle = "color: var(--color-success); font-weight: bold;";
        if (res.result === "Fail") {
            resultBadgeStyle = "color: var(--color-danger); font-weight: bold;";
        } else if (res.result === "Compartmental") {
            resultBadgeStyle = "color: #e67e22; font-weight: bold;";
        }

        const classNumeral = activeClassVal === 10 ? 'X' : 'IX';

        // Get subject IDs
        const milId = res.language1;
        const silId = res.language2;
        const matId = `${activeClassVal}_MAT`;
        const sciId = `${activeClassVal}_SCI`;
        const sscId = `${activeClassVal}_SST`;
        const engId = `${activeClassVal}_ENG`;

        // Get theory obt marks
        const milTheory = milId ? getScore(res.subjectScores, milId, "theoryObt") : "";
        const silTheory = silId ? getScore(res.subjectScores, silId, "theoryObt") : "";
        const matTheory = getScore(res.subjectScores, matId, "theoryObt");
        const sciTheory = getScore(res.subjectScores, sciId, "theoryObt");
        const sscTheory = getScore(res.subjectScores, sscId, "theoryObt");
        const engTheory = getScore(res.subjectScores, engId, "theoryObt");

        let rowHtml = `<tr style="border-bottom: 1px solid var(--color-border); ${index % 2 === 0 ? 'background: #FFFFFF;' : 'background: #F9FAFB;'}">
            <td style="${TD_C} font-weight: 600;">${index + 1}</td>
            <td style="${TD_C} font-weight: 600;">${res.rollNo}</td>
            <td style="${TD_C} font-weight: 600;">${classNumeral}</td>
            <td style="${TD} font-weight: 600; max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.studentName}">${res.studentName}</td>
            <td style="${TD} font-size: 0.9em; color: var(--color-muted); max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.motherName || ""}">${res.motherName || ""}</td>
            <td style="${TD} font-size: 0.9em; color: var(--color-muted); max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.fatherName || ""}">${res.fatherName || ""}</td>
            <td style="${TD_C} font-weight: 600;">${genderText}</td>
            
            <td style="${TD_C} font-weight: 600; ${BL}">${milTheory}</td>
            <td style="${TD_C} font-weight: 600;">${silTheory}</td>
            <td style="${TD_C} font-weight: 600;">${matTheory}</td>
            <td style="${TD_C} font-weight: 600;">${sciTheory}</td>
            <td style="${TD_C} font-weight: 600;">${sscTheory}</td>
            <td style="${TD_C} font-weight: 600;">${engTheory}</td>`;

        if (hasPrac) {
            const sciPrac = getScore(res.subjectScores, sciId, "practicalObt");
            const sscLitAct = getScore(res.subjectScores, sscId, "practicalObt");
            const sscProjectWork = getScore(res.subjectScores, sscId, "internalObt");

            rowHtml += `
                <td style="${TD_C} font-weight: 600; ${BL}">${sciPrac}</td>
                <td style="${TD_C} font-weight: 600;">${sscLitAct}</td>
                <td style="${TD_C} font-weight: 600;">${sscProjectWork}</td>`;
        }
        rowHtml += `
            <td style="${TD_C} font-weight: 700; ${BL}">${res.grandTotal}</td>
            <td style="${TD_C} ${resultBadgeStyle}">${res.division || res.result}</td>
            <td style="${TD_C}">
                <button class="btn-print-card" data-student-id="${res.studentId}" style="padding: 4px 8px; font-size: 0.78rem; font-weight: 600; background: var(--color-primary); color: white; border: none; border-radius: var(--radius-xs); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print
                </button>
            </td>
        </tr>`;
        return rowHtml;
    }).join("");
    tbody.innerHTML = rowsHtml;

    tbody.onclick = (e) => {
        const btn = e.target.closest(".btn-print-card");
        if (btn) {
            const studentId = btn.getAttribute("data-student-id");
            handlePrintSingleReportCard(studentId);
        }
    };
};


// ═══════════════════════════════════════════
//  CLASS 11-12 (Senior) BSEB Layout
// ═══════════════════════════════════════════
const renderSeniorTable = (thead, tbody, activeSubjects, filteredStudents) => {
    // Helper to check if ANY student in the list takes a subject with practicals in this slot
    const slotHasPractical = (slotId) => {
        return filteredStudents.some(res => {
            const subId = res[slotId];
            if (!subId) return false;
            const config = activeSubjects.find(s => String(s.subjectId) === String(subId));
            return config && (config.pMax || 0) > 0;
        });
    };

    const e1HasPrac = slotHasPractical("elective1");
    const e2HasPrac = slotHasPractical("elective2");
    const e3HasPrac = slotHasPractical("elective3");
    const addHasPrac = slotHasPractical("additional");

    const e1ColSpan = e1HasPrac ? 4 : 2;
    const e2ColSpan = e2HasPrac ? 4 : 2;
    const e3ColSpan = e3HasPrac ? 4 : 2;
    const addColSpan = addHasPrac ? 4 : 2;

    const electiveColSpan = e1ColSpan + e2ColSpan + e3ColSpan;
    const additionalColSpan = addColSpan;

    // ── Row 1 ──
    let headerRow = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
        <th rowspan="2" style="${TH_C} width: 4%;">Roll no.</th>
        <th rowspan="2" style="${TH_C} width: 4%;">Class</th>
        <th rowspan="2" style="${TH} width: 18%;">Student's Name<br>Mother's Name<br>Father's Name</th>
        <th rowspan="2" style="${TH_C} width: 4%;">M/F</th>
        <th colspan="4" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB} width: 16%;">Compulsory Language Subjects</th>
        <th colspan="${electiveColSpan}" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB} width: 36%;">Elective Subjects</th>
        <th colspan="${additionalColSpan}" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB} width: 10%;">Additional Subjects</th>
        <th rowspan="2" style="${TH_C} width: 8%; ${BL}">Aggregate & Result</th>
        <th rowspan="2" style="${TH_C} width: 10%;">Result</th>
        <th rowspan="2" style="${TH_C} width: 6%;">Action</th>
    </tr>`;

    // ── Row 2: Sub-headers ──
    let subRow = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">`;
    // Compulsory languages: always Subject | Marks
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 5%;">Subject - 1</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 3%;">Marks</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 5%;">Subject - 2</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 3%;">Marks</th>`;

    // Elective 1
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject - 1</th>`;
    if (e1HasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    // Elective 2
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject - 2</th>`;
    if (e2HasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    // Elective 3
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject - 3</th>`;
    if (e3HasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    // Additional
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject</th>`;
    if (addHasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    subRow += `</tr>`;
    thead.innerHTML = headerRow + subRow;

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 30px; color: var(--color-muted);">No matching student results found.</td></tr>`;
        return;
    }

    const rowsHtml = filteredStudents.map((res, index) => {
        const getSubDetails = (subId) => {
            if (!subId) return null;
            return res.subjectDetails.find(s => String(s.subjectId) === String(subId)) || null;
        };

        const l1 = getSubDetails(res.language1);
        const l2 = getSubDetails(res.language2);
        const e1 = getSubDetails(res.elective1);
        const e2 = getSubDetails(res.elective2);
        const e3 = getSubDetails(res.elective3);
        const add = getSubDetails(res.additional);

        const getSubData = (subObj) => {
            if (!subObj) return { name: "", theoryObt: "", practicalObt: "", totalObt: "", score: "", tMax: "", pMax: 0 };
            const scoreObj = res.subjectScores[subObj.subjectId];
            return {
                name: subObj.name,
                theoryObt: scoreObj ? scoreObj.theoryObt : "",
                practicalObt: scoreObj ? scoreObj.practicalObt : "",
                totalObt: scoreObj ? scoreObj.totalObt : "",
                score: scoreObj ? scoreObj.displayVal : "",
                tMax: subObj.tMax || "",
                pMax: subObj.pMax || 0
            };
        };

        const sdL1 = getSubData(l1);
        const sdL2 = getSubData(l2);
        const sdE1 = getSubData(e1);
        const sdE2 = getSubData(e2);
        const sdE3 = getSubData(e3);
        const sdAdd = getSubData(add);

        let combinedName = `<div style="text-align:left; font-weight:600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.studentName}">${res.studentName}</div>`;
        if (res.motherName && res.motherName !== "-") {
            combinedName += `<div style="text-align:left; font-size: 0.8em; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.motherName}">${res.motherName}</div>`;
        }
        if (res.fatherName && res.fatherName !== "-") {
            combinedName += `<div style="text-align:left; font-size: 0.8em; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.fatherName}">${res.fatherName}</div>`;
        }
        const genderRaw = String(res.gender || "").toLowerCase().trim();
        const genderText = (genderRaw === "female" || genderRaw === "f") ? "F" : ((genderRaw === "male" || genderRaw === "m") ? "M" : "");

        let resultBadgeStyle = "color: var(--color-success); font-weight: bold;";
        if (res.result === "Fail") {
            resultBadgeStyle = "color: var(--color-danger); font-weight: bold;";
        } else if (res.result === "Compartmental") {
            resultBadgeStyle = "color: #e67e22; font-weight: bold;";
        }

        let rowHtml = `<tr style="border-bottom: 1px solid var(--color-border); ${index % 2 === 0 ? 'background: #FFFFFF;' : 'background: #F9FAFB;'}">
            <td style="${TD_C} font-weight: 600; color: var(--color-primary);">${res.rollNo}</td>
            <td style="${TD_C} font-weight: 600; color: var(--color-primary);">${activeClassVal}</td>
            <td style="${TD} line-height: 1.3; max-width: 0;">${combinedName}</td>
            <td style="${TD_C} font-weight: 600;">${genderText}</td>`;

        // Compulsory Language 1
        rowHtml += `<td style="${TD_C} font-size: 0.85em; ${BL}">${sdL1.name}</td>`;
        rowHtml += `<td style="${TD_C} font-weight: 600;">${sdL1.totalObt}</td>`;

        // Compulsory Language 2
        rowHtml += `<td style="${TD_C} font-size: 0.85em;">${sdL2.name}</td>`;
        rowHtml += `<td style="${TD_C} font-weight: 600;">${sdL2.totalObt}</td>`;

        // Helper to output cells for a slot based on whether slot has practical
        const renderSlotCells = (sd, slotHasPrac, isLeftBorder = false) => {
            let cellsHtml = `<td style="${TD_C} font-size: 0.85em; ${isLeftBorder ? BL : ''}">${sd.name}</td>`;
            if (slotHasPrac) {
                if (sd.pMax > 0) {
                    cellsHtml += `<td style="${TD_C} font-weight: 600;">${sd.theoryObt}</td>`;
                    cellsHtml += `<td style="${TD_C} font-weight: 600;">${sd.practicalObt}</td>`;
                } else {
                    cellsHtml += `<td style="${TD_C} color: var(--color-muted);">-</td>`;
                    cellsHtml += `<td style="${TD_C} color: var(--color-muted);">-</td>`;
                }
            }
            cellsHtml += `<td style="${TD_C} font-weight: 600;">${sd.totalObt}</td>`;
            return cellsHtml;
        };

        // Elective 1
        rowHtml += renderSlotCells(sdE1, e1HasPrac, true);

        // Elective 2
        rowHtml += renderSlotCells(sdE2, e2HasPrac, false);

        // Elective 3
        rowHtml += renderSlotCells(sdE3, e3HasPrac, false);

        // Additional
        rowHtml += renderSlotCells(sdAdd, addHasPrac, true);

        rowHtml += `
            <td style="${TD_C} font-weight: 700; ${BL}">${res.grandTotal}</td>
            <td style="${TD_C} ${resultBadgeStyle}">${res.division || res.result}</td>
            <td style="${TD_C}">
                <button class="btn-print-card" data-student-id="${res.studentId}" style="padding: 4px 8px; font-size: 0.78rem; font-weight: 600; background: var(--color-primary); color: white; border: none; border-radius: var(--radius-xs); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print
                </button>
            </td>
        </tr>`;
        return rowHtml;
    }).join("");
    tbody.innerHTML = rowsHtml;

    tbody.onclick = (e) => {
        const btn = e.target.closest(".btn-print-card");
        if (btn) {
            const studentId = btn.getAttribute("data-student-id");
            handlePrintSingleReportCard(studentId);
        }
    };
};


/**
 * Calls backend to compile results and displays them in-page.
 */
const handleGenerateResults = async () => {
    const yearSelect = document.querySelector("#filter-academic-year");
    const examSelect = document.querySelector("#filter-exam");
    const sectionSelect = document.querySelector("#filter-section");
    const streamSelect = document.querySelector("#filter-stream");
    const checkedClasses = getCheckedClasses();

    const filters = {
        academicYear: yearSelect.value,
        examName: examSelect.value,
        classes: checkedClasses.join(","),
        section: sectionSelect.value,
        stream: streamSelect ? streamSelect.value : ""
    };

    if (!filters.academicYear || !filters.examName || !filters.classes || !filters.section) {
        showToast("Please select at least one class and fill all filters.", "error");
        return;
    }

    const outputCard = document.querySelector("#results-output-card");
    if (outputCard) outputCard.style.display = "none";

    showLoader();

    try {
        // GET is reliable with Apps Script redirects; POST can yield HTML "Page not found" in some browsers
        const query = new URLSearchParams({
            academicYear: filters.academicYear,
            examName: filters.examName,
            classes: filters.classes,
            section: filters.section,
            stream: filters.stream || ""
        }).toString();
        const response = await apiRequest(`exam.results.generate?${query}`, {
            bypassCache: true
        });

        if (response.success && response.classesResults) {
            currentResults = response.classesResults;

            if (currentResults.length > 0) {
                activeClassVal = currentResults[0].classVal;
                renderTabs();
                renderTable();

                if (outputCard) {
                    outputCard.style.display = "block";
                    setTimeout(() => {
                        outputCard.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 100);
                }
                showToast("Results compiled successfully!", "success");
            } else {
                showToast("No results compiled. Please verify filters.", "warning");
            }
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to generate results.", "error");
    } finally {
        hideLoader();
    }
};

/**
 * Maps any exam code or English name to standard official Hindi exam name.
 */
const formatExamNameHindi = (raw) => {
    if (!raw) return "त्रैमासिक परीक्षा";
    const str = String(raw).trim();
    const lower = str.toLowerCase();
    
    if (lower.includes("quarterly") || lower.includes("trimasik") || lower.includes("त्रैमासिक") || lower.includes("1st terminal") || lower.includes("first terminal")) {
        return "त्रैमासिक परीक्षा";
    }
    if (lower.includes("half") || lower.includes("ardh") || lower.includes("अर्द्ध") || lower.includes("2nd terminal") || lower.includes("second terminal")) {
        return "अर्द्धवार्षिक परीक्षा";
    }
    if (lower.includes("annual") || lower.includes("varshik") || lower.includes("वार्षिक") || lower.includes("final")) {
        return "वार्षिक परीक्षा";
    }
    if (lower.includes("monthly") || lower.includes("masik") || lower.includes("मासिक")) {
        return "मासिक परीक्षा";
    }
    if (lower.includes("sent up") || lower.includes("sentup") || lower.includes("सेंटअप") || lower.includes("जांच")) {
        return "सेंट-अप परीक्षा";
    }
    return str.includes("परीक्षा") ? str : `${str} परीक्षा`;
};

/**
 * Exports the currently displayed results to an official bordered Excel file matching BSEB specification.
 */
const handleExportToExcel = () => {
    const activeData = currentResults.find(r => r.classVal === activeClassVal);
    if (!activeData || !activeData.studentResults || !activeData.studentResults.length) {
        showToast("No data available to export.", "error");
        return;
    }

    const yearSelect = document.querySelector("#filter-academic-year");
    const examSelect = document.querySelector("#filter-exam");
    const sectionSelect = document.querySelector("#filter-section");

    const year = yearSelect ? yearSelect.value : "";
    const examName = examSelect ? examSelect.value : "";
    const section = sectionSelect ? sectionSelect.value : "";

    const displayYear = (year && year.split("-")[0]) ? year.split("-")[0] : (year || new Date().getFullYear());
    const hindiExamName = formatExamNameHindi(examName);
    const schoolCode = (activeClassVal === 11 || activeClassVal === 12) ? "31445" : "51375";
    const classNumeral = activeClassVal === 10 ? "X" : (activeClassVal === 9 ? "IX" : (activeClassVal === 11 ? "XI" : "XII"));

    const { activeSubjects, studentResults } = activeData;

    // Filter students by search query
    const filteredStudents = studentResults.filter(stud => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return (
            String(stud.studentName || "").toLowerCase().includes(query) ||
            String(stud.rollNo || "").toLowerCase().includes(query) ||
            String(stud.fatherName || "").toLowerCase().includes(query)
        );
    });

    // Sort by roll number
    filteredStudents.sort((a, b) => {
        const rollA = parseInt(a.rollNo, 10);
        const rollB = parseInt(b.rollNo, 10);
        if (isNaN(rollA) && isNaN(rollB)) return 0;
        if (isNaN(rollA)) return 1;
        if (isNaN(rollB)) return -1;
        return rollA - rollB;
    });

    const isSenior = (activeClassVal === 11 || activeClassVal === 12);
    let tableHtml = "";

    if (!isSenior) {
        // ── Class 9-10 (Junior) BSEB Official Layout ──
        const juniorSlots = [
            { label: "MIL", slotId: "language1", defaultSubId: "" },
            { label: "SIL", slotId: "language2", defaultSubId: "" },
            { label: "MAT", slotId: "compulsory", defaultSubId: `${activeClassVal}_MAT` },
            { label: "SCI", slotId: "compulsory", defaultSubId: `${activeClassVal}_SCI` },
            { label: "SSC", slotId: "compulsory", defaultSubId: `${activeClassVal}_SST` },
            { label: "ENG", slotId: "compulsory", defaultSubId: `${activeClassVal}_ENG` }
        ];

        const slotHasPractical = (slot) => {
            return filteredStudents.some(res => {
                const subId = (slot.slotId === "compulsory") ? slot.defaultSubId : res[slot.slotId];
                if (!subId) return false;
                const details = res.subjectDetails && res.subjectDetails.find(s => String(s.subjectId) === String(subId));
                return details && (details.pMax || 0) > 0;
            });
        };

        const hasPrac = juniorSlots.some(slotHasPractical);
        const totalCols = hasPrac ? 17 : 15;

        // Title Header Rows
        tableHtml += `
        <tr>
            <th colspan="${totalCols}" style="text-align: center; font-size: 13pt; font-weight: bold; border: 1px solid #000000; padding: 6px; background-color: #FFFFFF; font-family: Arial, sans-serif;">
                उत्क्रमित उच्चतर माध्यमिक (+2) विद्यालय कपरपुरा ,कांटी ,मुजफ्फरपुर<br>
                विद्यालय कोड : ${schoolCode}
            </th>
        </tr>
        <tr>
            <th colspan="${totalCols}" style="text-align: center; font-size: 11pt; font-weight: bold; border: 1px solid #000000; padding: 6px; background-color: #FFFFFF; font-family: Arial, sans-serif;">
                कक्षा ${String(activeClassVal).padStart(2, '0')} की ${hindiExamName}, ${displayYear} का प्राप्तांक प्रविष्टि प्रारूप
            </th>
        </tr>`;

        if (hasPrac) {
            tableHtml += `
            <tr>
                <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">SL NO</th>
                <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">ROLL NO.</th>
                <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">CLASS</th>
                <th rowspan="3" style="text-align: left; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px 6px;">STUDENT NAME</th>
                <th rowspan="3" style="text-align: left; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px 6px;">MOTHER'S NAME</th>
                <th rowspan="3" style="text-align: left; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px 6px;">FATHER'S NAME</th>
                <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">GENDER</th>
                <th colspan="6" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">MARKS OBTAINED(THEORY)</th>
                <th colspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">MARKS OBTAINED (INTERNAL ASSEMENT &amp; PRACTICAL)</th>
                <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">AGGREGATE</th>
                <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">RESULT</th>
            </tr>
            <tr>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">MIL</th>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">SIL</th>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">MAT</th>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">SCI</th>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">SSC</th>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">ENG</th>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">SCI</th>
                <th colspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">SSC</th>
            </tr>
            <tr>
                <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">LIT.ACT</th>
                <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Project Work</th>
            </tr>`;
        } else {
            tableHtml += `
            <tr>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">SL NO</th>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">ROLL NO.</th>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">CLASS</th>
                <th rowspan="2" style="text-align: left; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px 6px;">STUDENT NAME</th>
                <th rowspan="2" style="text-align: left; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px 6px;">MOTHER'S NAME</th>
                <th rowspan="2" style="text-align: left; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px 6px;">FATHER'S NAME</th>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">GENDER</th>
                <th colspan="6" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">MARKS OBTAINED(THEORY)</th>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">AGGREGATE</th>
                <th rowspan="2" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">RESULT</th>
            </tr>
            <tr>
                <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">MIL</th>
                <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">SIL</th>
                <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">MAT</th>
                <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">SCI</th>
                <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">SSC</th>
                <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">ENG</th>
            </tr>`;
        }

        // Student Data Rows
        filteredStudents.forEach((res, index) => {
            const genderRaw = String(res.gender || "").toLowerCase().trim();
            const genderText = (genderRaw === "female" || genderRaw === "f") ? "F" : ((genderRaw === "male" || genderRaw === "m") ? "M" : "");

            const milId = res.language1;
            const silId = res.language2;
            const matId = `${activeClassVal}_MAT`;
            const sciId = `${activeClassVal}_SCI`;
            const sscId = `${activeClassVal}_SST`;
            const engId = `${activeClassVal}_ENG`;

            const milTheory = milId ? getScore(res.subjectScores, milId, "theoryObt") : "";
            const silTheory = silId ? getScore(res.subjectScores, silId, "theoryObt") : "";
            const matTheory = getScore(res.subjectScores, matId, "theoryObt");
            const sciTheory = getScore(res.subjectScores, sciId, "theoryObt");
            const sscTheory = getScore(res.subjectScores, sscId, "theoryObt");
            const engTheory = getScore(res.subjectScores, engId, "theoryObt");

            tableHtml += `
            <tr>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${index + 1}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${res.rollNo}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${classNumeral}</td>
                <td style="text-align: left; border: 1px solid #000000; padding: 4px 6px;">${res.studentName || ""}</td>
                <td style="text-align: left; border: 1px solid #000000; padding: 4px 6px;">${res.motherName || ""}</td>
                <td style="text-align: left; border: 1px solid #000000; padding: 4px 6px;">${res.fatherName || ""}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${genderText}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${milTheory}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${silTheory}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${matTheory}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sciTheory}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sscTheory}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${engTheory}</td>`;

            if (hasPrac) {
                const sciPrac = getScore(res.subjectScores, sciId, "practicalObt");
                const sscLitAct = getScore(res.subjectScores, sscId, "practicalObt");
                const sscProjectWork = getScore(res.subjectScores, sscId, "internalObt");

                tableHtml += `
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sciPrac}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sscLitAct}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sscProjectWork}</td>`;
            }

            tableHtml += `
                <td style="text-align: center; font-weight: bold; border: 1px solid #000000; padding: 4px;">${res.grandTotal}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${res.division || res.result || ""}</td>
            </tr>`;
        });

    } else {
        // ── Class 11-12 (Senior) BSEB Official Layout (Exact 19-Column Format from Screenshot) ──
        tableHtml += `
        <tr>
            <th colspan="19" style="text-align: center; font-size: 13pt; font-weight: bold; border: 1px solid #000000; padding: 6px; background-color: #FFFFFF; font-family: Arial, sans-serif;">
                ${activeClassVal}वीं की ${hindiExamName}, ${displayYear} का प्राप्तांक प्रविष्टि प्रारूप
            </th>
        </tr>
        <tr>
            <th colspan="9" style="text-align: left; font-size: 11pt; font-weight: bold; border: 1px solid #000000; padding: 5px 8px; background-color: #FFFFFF; font-family: Arial, sans-serif;">
                +2 School / College code :- 31445
            </th>
            <th colspan="10" style="text-align: right; font-size: 11pt; font-weight: bold; border: 1px solid #000000; padding: 5px 8px; background-color: #FFFFFF; font-family: Arial, sans-serif;">
                +2 School / College Name :- U.H.S. KAPARPURA
            </th>
        </tr>`;

        // Multi-level table headers
        let headerRow1 = `<tr>
            <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">sl no</th>
            <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Roll no.</th>
            <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Class</th>
            <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px 6px;">Student's Name<br>Mother's Name<br>Father's Name</th>
            <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">M<br>/<br>F</th>
            <th colspan="4" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Compulsory Language Subjects</th>
            <th colspan="9" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Elective Subjects</th>
            <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Aggregate &amp; Result</th>
            <th rowspan="3" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Result</th>
        </tr>`;

        let headerRow2 = `<tr>
            <th colspan="4" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Marks Obtained</th>
            <th colspan="9" style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Marks Obtained</th>
        </tr>`;

        let headerRow3 = `<tr>
            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Subject -1</th>
            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Marks</th>
            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Subject -2</th>
            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Marks</th>

            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Subject -1</th>
            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Theory</th>
            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Marks</th>

            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Subject -2</th>
            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Theory</th>
            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Marks</th>

            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Subject -3</th>
            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Theory</th>
            <th style="text-align: center; font-weight: bold; border: 1px solid #000000; background-color: #FFFFFF; padding: 4px;">Marks</th>
        </tr>`;

        let headerRow4 = `<tr>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">no</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">1</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">2</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">3</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">4</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">5</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">6</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">7</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">8</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">9</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">10</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">11</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">12</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">13</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">14</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">15</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">16</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">17</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">18</th>
            <th style="text-align: center; font-weight: normal; border: 1px solid #000000; background-color: #FFFFFF; padding: 2px;">19</th>
        </tr>`;

        tableHtml += headerRow1 + headerRow2 + headerRow3 + headerRow4;

        filteredStudents.forEach((res, index) => {
            const getSubDetails = (subId) => {
                if (!subId) return null;
                return res.subjectDetails && res.subjectDetails.find(s => String(s.subjectId) === String(subId)) || null;
            };

            const l1 = getSubDetails(res.language1);
            const l2 = getSubDetails(res.language2);
            const e1 = getSubDetails(res.elective1);
            const e2 = getSubDetails(res.elective2);
            const e3 = getSubDetails(res.elective3);

            const getSubData = (subObj) => {
                if (!subObj) return { name: "", totalObt: "", tMax: "100" };
                const scoreObj = res.subjectScores ? res.subjectScores[subObj.subjectId] : null;
                return {
                    name: subObj.subjectName || subObj.name || "",
                    totalObt: scoreObj ? (scoreObj.totalObt !== undefined ? scoreObj.totalObt : (scoreObj.displayVal || "")) : "",
                    tMax: subObj.tMax || "100"
                };
            };

            const sdL1 = getSubData(l1);
            const sdL2 = getSubData(l2);
            const sdE1 = getSubData(e1);
            const sdE2 = getSubData(e2);
            const sdE3 = getSubData(e3);

            const genderRaw = String(res.gender || "").toLowerCase().trim();
            const genderText = (genderRaw === "female" || genderRaw === "f") ? "F" : ((genderRaw === "male" || genderRaw === "m") ? "M" : "");
            const studentNameBlock = `${res.studentName || ""}<br>${res.motherName || ""}<br>${res.fatherName || ""}`;
            const resultText = res.result === "Fail" ? "Fail" : "Pass";

            tableHtml += `
            <tr>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${index + 1}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${res.rollNo}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${activeClassVal}</td>
                <td style="text-align: left; border: 1px solid #000000; padding: 4px 6px;">${studentNameBlock}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${genderText}</td>

                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdL1.name}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdL1.totalObt}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdL2.name}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdL2.totalObt}</td>

                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdE1.name}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdE1.tMax}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdE1.totalObt}</td>

                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdE2.name}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdE2.tMax}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdE2.totalObt}</td>

                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdE3.name}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdE3.tMax}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${sdE3.totalObt}</td>

                <td style="text-align: center; font-weight: bold; border: 1px solid #000000; padding: 4px;">${res.grandTotal}</td>
                <td style="text-align: center; border: 1px solid #000000; padding: 4px;">${resultText}</td>
            </tr>`;
        });
    }

    const filename = `Results_Class_${activeClassVal}_${examName.replace(/\s+/g, '_')}_Section_${section}_${year}.xls`;

    const template = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Class ${activeClassVal} Results</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; }
    th { border: 1px solid #000000; background-color: #FFFFFF; color: #000000; font-size: 10pt; }
    td { border: 1px solid #000000; background-color: #FFFFFF; color: #000000; font-size: 10pt; }
  </style>
</head>
<body>
  <table border="1" style="border-collapse: collapse;">
    ${tableHtml}
  </table>
</body>
</html>
    `;

    const blob = new Blob([template], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Excel spreadsheet exported successfully!", "success");
};


/**
 * Initializes the Result Generation module view.
 */
export async function initResultGenerationView() {
    try {
        renderNavbar(document.querySelector("#navbar-result-generation"));

        // Setup defaults
        const yearInput = document.querySelector("#filter-academic-year");
        if (yearInput) {
            const years = getAcademicYears();
            yearInput.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
            yearInput.value = getDefaultAcademicYear();
        }

        // Setup filter listeners
        const generateBtn = document.querySelector("#generate-results-btn");
        const searchInput = document.querySelector("#result-search-input");

        document.querySelectorAll('input[name="classes"]').forEach(el => {
            el.addEventListener("change", async () => {
                updateStreamFilterVisibility();
                await updateAvailableSections();
            });
        });

        if (yearInput) {
            yearInput.addEventListener("input", async () => {
                await updateAvailableSections();
            });
        }

        if (generateBtn) {
            generateBtn.addEventListener("click", handleGenerateResults);
        }

        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener("input", (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchQuery = e.target.value;
                    renderTable();
                }, 300);
            });
        }

        const sortSelect = document.querySelector("#result-sort-select");
        if (sortSelect) {
            sortSelect.addEventListener("change", () => {
                renderTable();
            });
        }

        const exportBtn = document.querySelector("#export-excel-btn");
        if (exportBtn) {
            exportBtn.addEventListener("click", handleExportToExcel);
        }

        const printAllBtn = document.querySelector("#print-all-cards-btn");
        if (printAllBtn) {
            printAllBtn.addEventListener("click", handlePrintAllReportCards);
        }

        // Setup view mode toggle listeners
        const btnTable = document.querySelector("#toggle-view-table");
        const btnCards = document.querySelector("#toggle-view-cards");

        if (btnTable) {
            btnTable.addEventListener("click", () => {
                currentViewMode = "table";
                renderTable();
            });
        }

        if (btnCards) {
            btnCards.addEventListener("click", () => {
                currentViewMode = "cards";
                renderTable();
            });
        }

        // Fast path: exams + sections only (blocks loader). Assets sync in background.
        updateStreamFilterVisibility();
        void syncReportCardAssetsFromApi();
        await Promise.all([
            (async () => {
                const examSelect = document.querySelector("#filter-exam");
                if (examSelect) {
                    try {
                        const res = await apiRequest("exam.list");
                        if (res.success && res.exams) {
                            const opts = res.exams.map(exam => `<option value="${exam.name}">${exam.name}</option>`).join("");
                            examSelect.innerHTML = '<option value="">Select Exam</option>' + opts;
                        }
                    } catch (err) {
                        console.error("Failed to load exams list:", err);
                    }
                }
            })(),
            updateAvailableSections()
        ]);

    } catch (error) {
        console.error(error);
        showToast("Result Generation could not be initialized.", "error");
    }
}
