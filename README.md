# Trace by MITE

A single-page React + Tailwind CSS web application built for the MITE college hackathon. It provides a unified **Student Portal** and **Admin Dashboard** backed by a persistent browser `localStorage` data service (`src/storageBackend.js`)—requiring no external server or build step.

## Features

- **Top Navigation View Switcher:** Toggle seamlessly between **Student Portal** and **Admin Dashboard** with a live Pending Claim counter badge.
- **Simulated LocalStorage Backend (`src/storageBackend.js`):**
  - Persists items across page reloads and syncs across browser tabs (`storage` event).
  - Sequential unique ID generation (`MITE-LF-1001`, `MITE-LF-1002`, ...).
  - Full CRUD, search/filtering, claim verification workflow, audit history timeline, analytics aggregation, JSON export, and demo reset.
- **Pre-Seeded Demo Database (`src/seedData.js`):**
  1. `MITE-LF-1001` — Lost **iQOO 12 Pro** (`Electronics`, `Active`)
  2. `MITE-LF-1002` — Found **MITE Central Library Card** (`ID & Cards`, `Pending Claim`)
  3. `MITE-LF-1003` — Lost **Hostel & Two-Wheeler Keys** (`Keys`, `Active`)
- **Student Portal:**
  - Report Lost or Found items with MITE campus location quick-picks and instant Tracking ID receipt.
  - Quick Track lookup by unique ID with a 3-stage progress bar (`Active` → `Pending Claim` → `Resolved`), Smart Potential Matches, and activity timeline.
  - Search, filter by Type (`Lost` / `Found`), Category, Status, and Sort (`Newest First`, `Oldest First`, `Pending Claims First`, `ID Ascending`).
  - Submit ownership claims or found sightings directly from item cards.
- **Admin Dashboard:**
  - Live KPI cards and SVG analytics charts (Workflow Status Donut Chart & Category Breakdown Bar Chart).
  - Pending Claim Verification Queue with optional verification remarks and one-click **Approve & Resolve** or **Reject (Reopen)**.
  - Full management table with search, filters, sorting, inline status switching, record editing, deletion confirmation, JSON export, and Demo Data reset.
  - **Global Audit History** feed aggregating all reports, claims, verifications, and status changes chronologically.

## How to Run

### Option 1: Localhost Server (Recommended)
1. Double-click `start-localhost.bat` (or run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File server.ps1 -Port 8080`).
2. Open `http://localhost:8080/` in Chrome, Edge, or Firefox.

### Option 2: Direct File Execution
1. Open `index.html` directly in Chrome, Edge, or Firefox (works directly over `file://` with zero `npm` install or build step).
2. Ensure an active internet connection on initial load for React 18, Babel Standalone, and Tailwind CSS CDN scripts.

