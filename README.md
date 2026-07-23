# 🔐 UHS Kaparpura - Admin Web Portal (`uhskaparpura-admin-web`)

The Admin Web Portal is a modern Single Page Application (SPA) built for Headmasters, Teachers, and Administrative Staff of **U.H.S. Kaparpura, Kanti, Muzaffarpur**.

---

## 🛠️ Tech Stack & Architecture

* **Frontend Engine**: Vanilla JavaScript (ES6+ Modules, SPA Hash Router).
* **Styling & UI**: Custom CSS Framework with Glassmorphism, HSL color tokens, CSS Grid, and responsive flexbox layouts (No heavy external CSS frameworks required).
* **Data Layer**: Asynchronous REST API integration with `uhskaparpura-admin-api` using `fetch`.
* **Export & Print**: SheetJS (`xlsx.full.min.js`) for Excel generation; pure CSS `@media print` layout for BSEB report card printing.

---

## 🧩 Modules Overview

### 1. `studentMaster.js` (Student Master Directory)
* View, search, and edit complete student bio-data records.
* Instant filtering by Class, Stream, Section, Gender, and Roll Number.
* Real-time student count statistics.

### 2. `syncSchoolDB.js` (e-Shikshakosh Sync Tool)
* Upload raw Excel spreadsheets exported directly from Bihar Government's *e-Shikshakosh* portal.
* Automatically parses student names, parents' names, roll numbers, UDISE codes, genders, and sessions to update central database.

### 3. `subjectTag.js` (BSEB Subject Tagging)
* Assign Bihar Board subject combinations to Class 9, 10, 11, and 12 students.
* **Auto-Inheritance**: Class 10 and 12 automatically inherit subject combinations tagged in Class 9 and 11 from previous academic sessions.
* Real-time completion progress tracker and validation error checker.

### 4. `marksEntry.js` (Unified Marks Entry Module)
* Sequential Class ➡️ Stream ➡️ Section ➡️ Subject cascading filter.
* **Absent Marker ("A")**: Entering `"A"` marks the student as absent cleanly without corrupting numeric operations.
* **Class 9-10 SST Practicals**: Separate inputs for `LIT.ACT` (10 Marks) and `Project Work` (10 Marks).

### 5. `resultGeneration.js` (Result Generation & Report Cards)
* **Live Result Calculation**: Calculates grand totals, percentage, division, and ranks on the fly.
* **Sorting**: Interactive dropdown to sort results by **Roll Number** or **Aggregate Marks / Rank**.
* **Sticky Table Headers**: Headers stay fixed on screen while scrolling long rosters.
* **Excel Export**: 1-Click export to `.xlsx` formatted matching the register layout.
* **Official BSEB Report Card Generator**:
  * Print individual student marksheets or batch print whole classes.
  * Centered official BSEB emblem watermark.
  * Tiled Hindi school name background watermark (`उ.मा.वि. कपरपुरा, काँटी, मुजफ्फरपुर`).
  * Dynamic Full/Pass Marks and Today's Issue Date (`DD/MM/YYYY`).

### 6. `examControl.js` (Exam Rules & Configurations)
* Create, lock, and unlock exams (Quarterly, Half-Yearly, Annual, Sent-up).
* Set theory and practical pass/full marks boundaries per subject and class.

### 7. `portalControl.js` (Website Control Panel)
* Remote toggle for public school website features (Online Admissions, Notices, Results Publishing, Gallery).

---

## 💻 Directory Structure

```
uhskaparpura-admin-web/
├── index.html                  # Main SPA entry point
├── config/
│   └── config.js               # API endpoints & environment constants
├── views/                      # HTML View templates
│   ├── dashboard.html
│   ├── studentMaster.html
│   ├── subjectTag.html
│   ├── marksEntry.html
│   ├── resultGeneration.html
│   ├── examControl.html
│   ├── syncSchoolDB.html
│   └── portalControl.html
├── assets/
│   ├── css/                    # CSS stylesheets (main.css, dashboard.css, etc.)
│   ├── js/
│   │   ├── app.js              # Application bootstrapper
│   │   ├── router.js           # Client SPA router
│   │   └── modules/            # Feature JS modules
│   └── images/                 # BSEB logo & asset files
└── README.md
```

---

## ⚡ Local Development Setup

Run a simple local web server:
```bash
cd uhskaparpura-admin-web
python3 -m http.server 4173
```
Access the dashboard at `http://localhost:4173`.
