# ABHEDYA — Complete Project Audit, Feature Inventory & Improvement Report

**Audit Date:** November 7, 2026  
**Auditor:** Senior Software Architect, Full-Stack Developer, Disaster Systems Specialist & Hackathon Evaluator  
**Target Platform:** ABHEDYA (Flood-Focused Disaster Intelligence and Response Platform for Udupi District, Karnataka)  
**Repository State:** Local snapshot (`ABEDYA-T5-main`), Vite 8 + React 19 + TypeScript + Tailwind CSS v4  

---

## 1. Executive Summary

**ABHEDYA** (Sanskrit: *अभेद्य* — "Impenetrable / Invulnerable") is conceptualized as an end-to-end flood disaster intelligence and emergency response platform tailored specifically for the monsoon vulnerabilities of **Udupi District, coastal Karnataka**. The design frames disaster management across three chronological operational horizons: **Before** (preparedness & environmental intelligence), **During** (emergency reporting & field response), and **Beyond** (relief & recovery), organized into five named modules: **DRISHTI**, **SANKET**, **MEDHA**, **SENA**, and **PUNARJEEV**.

### Core Audit Finding
The codebase currently represents a **polished, high-fidelity frontend prototype with partial data scaffolding**, rather than a functioning, production-ready emergency management system.

| Evaluation Metric | Status / Reality |
| :--- | :--- |
| **Operational Architecture** | **~25% Functional / ~75% Simulated or Placeholder** |
| **Production Database** | **Local Migrations Drafted; Zero Remote Migrations Applied; No Live Credentials** |
| **Authentication Flow** | **AuthContext & Security Guards Written; Not Connected in Router/App Mount** |
| **DRISHTI (Intelligence)** | **GeoJSON Leaflet map functional; all live weather/river feeds return hardcoded "Unavailable"** |
| **SANKET (Reporting)** | **In-memory queue & form workflow functional; Supabase repository drafted but unmounted** |
| **MEDHA (Intelligence)** | **0% implemented** (`ModulePage.tsx` placeholder shell) |
| **SENA (Coordination)** | **0% implemented** (`ModulePage.tsx` placeholder shell) |
| **PUNARJEEV (Recovery)**| **0% implemented** (`ModulePage.tsx` placeholder shell) |
| **Test Coverage** | **0% Unit / Integration / E2E Automated Test Coverage** |

### Key Strengths
1. **Honest Architectural Provenance:** Unlike typical hackathon prototypes that fake live data with deceptive random number generators, the DRISHTI provider subsystem (`src/features/drishti/data/providers.ts`) explicitly states data provenance, marking government feeds (IMD, KSNDMC, CWC, DDMA) as `unavailable` or `portal-only`, and labeling sample data as synthetic demonstration scenarios.
2. **Cohesive Emergency UI Language:** The Tailwind v4 design system (`src/styles/app.css`, `drishti.css`, `sanket.css`) delivers an emergency command-center aesthetic with high contrast, crisp typography, and strict color-coded urgency tokens.
3. **Drafted Relational & RLS Foundations:** PostgreSQL schemas (`supabase/migrations/`) establish rigorous constraints, security-definer helper verification, incident audit trails, and privacy protection for citizen contact numbers.

### Critical Deficits
1. **The "Three Missing Modules":** Three of the five headline modules (MEDHA, SENA, PUNARJEEV) do not contain a single line of business logic or domain components; they render a generic "Under Development" placeholder card.
2. **Landing Page SOS Disconnect:** The prominent emergency SOS form on the home page (`src/components/EmergencyRequestForm.tsx`) executes an isolated simulation toast (`"Simulation complete. No emergency services or rescue teams were contacted."`) without persisting reports to SANKET or notifying any responder queue.
3. **Unwired Infrastructure:** Core architectural upgrades—including `AuthProvider` (`src/features/auth/AuthContext.tsx`), route guards (`src/components/ProtectedRoute.tsx`), admin pages (`AdminHelpersPage.tsx`), and the Supabase SANKET repository (`sanketRepository.ts`)—exist as detached files unmounted in `src/app/App.tsx` and `src/app/router.tsx`.

---

## 2. Project Overview

ABHEDYA is situated in Udupi District, Karnataka—a coastal and Western Ghats foothill district bisected by major rivers (Swarna, Sita, Varahi, Gangolli/Haladi, Shambhavi) subject to flash flooding, tidal ingress, and seasonal monsoon inundation across 7 taluks: Udupi, Kapu, Brahmavara, Kundapura, Byndoor, Karkala, and Hebri.

```
                              ┌───────────────────────────────────┐
                              │          ABHEDYA PLATFORM         │
                              └─────────────────┬─────────────────┘
                                                │
         ┌──────────────────────────────┬───────┴──────────────────────┬──────────────────────────────┐
         ▼                              ▼                              ▼                              ▼
  [ PUBLIC LANDING ]           [ VICTIM WORKSPACE ]           [ HELPER WORKSPACE ]           [ ADMIN COMMAND ]
  • Landing Hero               • Role: 'victim'               • Role: 'helper'               • Role: 'admin'
  • Simulated SOS Form         • DRISHTI (Map & Weather)      • DRISHTI (Monitoring)         • Helper Approvals
  • Role Selector              • SANKET (Report Intake)       • SANKET (Queue & Triage)      • District Oversight
                               • PUNARJEEV (Placeholder)      • MEDHA (Placeholder)
                                                              • SENA (Placeholder)
                                                              • PUNARJEEV (Placeholder)
```

### Module Roles & Responsibilities

| Module | Sanskrit Meaning | Intended Role | Current Code Implementation Status |
| :--- | :--- | :--- | :--- |
| **DRISHTI** | *दृष्टि* (Vision / Sight) | Geospatial flood monitoring, river water level gauges, rainfall telemetry, district boundaries. | **Partially Implemented**: Working Leaflet map with GeoJSON boundary; hardcoded "Unavailable" state for live feeds; 6-point synthetic rainfall demo. |
| **SANKET** | *संकेत* (Signal / Indicator)| Citizen incident reporting, emergency SOS, assistance requests, helper verification and triage queue. | **Partially Implemented**: Full frontend UI with in-memory store (`reportStore.ts`); repository created (`sanketRepository.ts`); not yet wired to live Supabase backend. |
| **MEDHA** | *मेधा* (Intellect / Wisdom)| Incident clustering, duplicate report detection, severity heuristics, automated risk scoring. | **Planned Only (0%)**: Renders placeholder panel via `ModulePage.tsx`. No clustering or deduplication algorithms exist. |
| **SENA** | *सेना* (Army / Response Force)| Dispatch coordination, volunteer rescue team assignment, relief inventory, vehicle/boat logistics. | **Planned Only (0%)**: Renders placeholder panel via `ModulePage.tsx`. No team models or dispatch queues exist. |
| **PUNARJEEV**| *पुनर्जीव* (Revival / Recovery)| Post-disaster rehabilitation, temporary shelter directory, food/ration logistics, compensation claims. | **Planned Only (0%)**: Renders placeholder panel via `ModulePage.tsx`. No relief workflow implemented. |

---

## 3. Technology Stack

### Current Codebase Inventory

```
ABEDYA-T5-main/
├── .env.example                               # Supabase URL & anon key environment template
├── .gitignore                                 # Git ignore rules (updated for .env & build artifacts)
├── .oxlintrc.json                             # Oxlint linter rules
├── components.json                            # Shadcn UI configuration
├── index.html                                 # HTML entry point (title: "ABHEDYA")
├── package.json                               # Dependencies & build scripts
├── package-lock.json                          # Pinned dependency tree
├── tsconfig.json / tsconfig.app.json          # TypeScript 7.0 / Strict compiler options
├── vite.config.ts                             # Vite 8 build config with Tailwind CSS v4
├── public/
│   └── data/drishti/
│       ├── README.md                          # Data attribution documentation
│       └── udupi-district.geojson             # GeoBoundaries ADM2 polygon (24.6 KB)
├── src/
│   ├── app/
│   │   ├── App.tsx                            # Root router provider
│   │   └── router.tsx                         # Client-side route declarations
│   ├── assets/
│   │   └── hero.png                           # Graphic asset
│   ├── components/
│   │   ├── Brand.tsx                          # Platform logo & name
│   │   ├── DashboardLayout.tsx                # Sidebar + topbar layout
│   │   ├── EmergencyRequestForm.tsx           # Home page SOS form
│   │   ├── FormField.tsx                      # Form input wrapper
│   │   ├── ModuleCard.tsx                     # Module card on dashboards
│   │   ├── PageHeader.tsx                     # Standard page title header
│   │   ├── ProtectedRoute.tsx                 # Role & approval route guard
│   │   ├── SiteHeader.tsx                     # Public landing header
│   │   ├── StatusIndicator.tsx                # Status pill indicator
│   │   └── ui/                                # Shadcn UI primitives (13 components)
│   ├── data/
│   │   └── modules.ts                         # Module metadata definitions
│   ├── features/
│   │   ├── auth/
│   │   │   └── AuthContext.tsx                # Supabase Auth provider & state management
│   │   ├── drishti/
│   │   │   ├── data/providers.ts              # Data source abstraction layer
│   │   │   ├── drishti.css                    # DRISHTI custom styles
│   │   │   ├── DrishtiPage.tsx                # Geospatial dashboard & Leaflet map
│   │   │   └── types.ts                       # DRISHTI domain types
│   │   └── sanket/
│   │       ├── data/
│   │       │   ├── reportStore.ts             # In-memory prototype store
│   │       │   ├── sampleReports.ts           # 5 pre-seeded incident reports
│   │       │   └── sanketRepository.ts        # Supabase repository implementation
│   │       ├── sanket.css                     # SANKET custom styles
│   │       ├── SanketPage.tsx                 # Incident intake & helper queue page
│   │       └── types.ts                       # SANKET domain types
│   ├── hooks/
│   │   └── use-mobile.ts                      # Viewport breakpoint hook
│   ├── lib/
│   │   ├── supabase.ts                        # Supabase client initializer
│   │   └── utils.ts                           # Classnames helper (cn)
│   ├── pages/
│   │   ├── AdminDashboardPage.tsx             # District administrator overview
│   │   ├── AdminHelpersPage.tsx               # Helper application review table
│   │   ├── AuthPage.tsx                       # Login & registration flows
│   │   ├── DashboardPage.tsx                  # Victim & Helper dashboards
│   │   ├── LandingPage.tsx                    # Public home page
│   │   ├── ModulePage.tsx                     # Module router & placeholder view
│   │   ├── NotFoundPage.tsx                   # 404 handler
│   │   ├── PendingApprovalPage.tsx            # Helper pending review state
│   │   ├── ResetPasswordPage.tsx              # Password reset flow
│   │   └── RoleSelectionPage.tsx              # Victim vs. Helper role switcher
│   ├── styles/
│   │   └── app.css                            # Global theme & layout CSS
│   └── types/
│       └── domain.ts                          # Shared domain entities
└── supabase/
    └── migrations/
        ├── 00001_auth_and_profiles.sql        # Profiles, roles, helper approval & RLS
        └── 00002_sanket_incidents_and_rls.sql # Incident schema, sequence, RLS & audit
```

### Technology Evaluation

| Layer | Technologies Selected | Architectural Assessment |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19.3, Vite 8.3 | Cutting-edge build pipeline. HMR is instantaneous (<100ms), production bundle compiles in 581ms. React 19 warnings regarding non-component exports exist in Shadcn primitives. |
| **Styling & Design System** | Tailwind CSS v4 (`@tailwindcss/vite`), Radix UI primitives, Lucide Icons | Modern utility-first CSS architecture with CSS variables. High design fidelity with custom dark/light emergency color palettes. |
| **Mapping Engine** | Leaflet 1.9, React-Leaflet 5.0 | Lightweight, robust basemap handling. Relies on standard OpenStreetMap raster tiles, which fail when internet access is disrupted during severe storms. |
| **State Management** | React `useState`, Context API | Sufficient for current view scope, but lacks server cache invalidation (e.g. TanStack Query), resulting in manual fetch management and potential stale states. |
| **Backend & Database** | Supabase JS v2, PostgreSQL 15+ (Migrations drafted) | Ideal architecture for real-time collaborative disaster operations; currently disconnected due to lack of deployed instances and credentials. |
| **Linter & Code Quality** | Oxlint 1.89 | Ultra-fast Rust-based linter. 42 files analyzed in 29ms with 0 errors and 3 Fast Refresh warnings. |

---

## 4. Complete Feature Inventory

Below is the verified inventory of all platform features based on code inspection:

| Component / Feature | Intended Function | Actual Code Implementation Status | Verification Reference |
| :--- | :--- | :--- | :--- |
| **Public Landing Page** | Introduce platform, provide quick links to roles and SOS. | **Implemented & Tested** | `src/pages/LandingPage.tsx` |
| **Emergency SOS (Home)** | Open-access distress signal submission with geolocation. | **Simulated Only** (Logs simulated success toast; does not record report anywhere). | `src/components/EmergencyRequestForm.tsx#L59` |
| **Role Selector** | Choose between Citizen (Victim) and Responder (Helper). | **Implemented & Tested** | `src/pages/RoleSelectionPage.tsx` |
| **User Registration** | Sign up with email, password, name, and organization. | **Partially Implemented** (UI complete; AuthContext written; unmounted from router). | `src/pages/AuthPage.tsx` |
| **User Sign-In** | Authenticate via email/password. | **Partially Implemented** (UI complete with simulator; Supabase unconfigured). | `src/pages/AuthPage.tsx` |
| **Password Reset** | Self-service password recovery flow. | **Partially Implemented** (Component complete; unmounted from `router.tsx`). | `src/pages/ResetPasswordPage.tsx` |
| **Helper Verification** | Admin review of volunteer and responder credentials. | **Partially Implemented** (Component complete; SQL functions drafted; unmounted). | `src/pages/AdminHelpersPage.tsx` |
| **Protected Routes** | Enforce login, role access, and approved helper state. | **Partially Implemented** (Component exists; not wrapping routes in `router.tsx`). | `src/components/ProtectedRoute.tsx` |
| **District Boundary Map**| Visual polygon of Udupi District on OSM tiles. | **Implemented & Tested** | `src/features/drishti/DrishtiPage.tsx#L219` |
| **Taluk Boundary Layers**| Zoom to specific taluks (Kundapura, Karkala, etc.). | **Broken / Unavailable** (All 7 taluks marked `boundaryState: 'unavailable'`). | `src/features/drishti/data/providers.ts#L27-34` |
| **Weather Telemetry** | Current temperature, humidity, wind speed. | **Simulated Only** (1 hardcoded demo object; live API returns `unavailableResult`). | `src/features/drishti/data/providers.ts#L203` |
| **Rainfall History** | 6-hour rainfall accumulation timeseries. | **Simulated Only** (6 static synthetic float values in demonstration mode). | `src/features/drishti/data/providers.ts#L179` |
| **River Water Levels** | Gauge readings for Swarna, Sita, Varahi rivers. | **Not Implemented** (Hardcoded `unavailableResult`). | `src/features/drishti/data/providers.ts#L289` |
| **Official Alerts Feed** | Real-time warnings from IMD / KSNDMC / DDMA. | **Not Implemented** (External hyperlinks only). | `src/features/drishti/data/providers.ts#L307` |
| **Citizen Incident Form**| Submit structured incident with category and urgency. | **Implemented & Tested (In-Memory)** | `src/features/sanket/SanketPage.tsx#L454` |
| **Report ID Generator** | Auto-incrementing identifier (`SNK-XXXX`). | **Implemented (In-Memory Math.random / PostgreSQL sequence drafted)**. | `src/features/sanket/data/reportStore.ts#L18` |
| **Helper Incident Queue**| Triage queue with multi-facet filters. | **Implemented & Tested (In-Memory)** | `src/features/sanket/SanketPage.tsx#L206` |
| **Incident Assignment** | Helper self-assignment to an incident. | **Implemented & Tested (In-Memory)** | `src/features/sanket/data/reportStore.ts#L94` |
| **Status Progression** | Advancing incident through lifecycle stages. | **Implemented & Tested (In-Memory)** | `src/features/sanket/data/reportStore.ts#L110` |
| **Contact Info Masking** | Hiding victim phone numbers from unauthorized callers. | **Drafted in SQL & UI logic; not live in production DB**. | `supabase/migrations/00002_sanket_incidents_and_rls.sql#L192` |
| **Incident Deduplication**| Grouping duplicate reports from identical localities. | **Not Implemented (0%)** | `src/pages/ModulePage.tsx#L50` |
| **Response Dispatch** | Assigning vehicles, rescue boats, NDRF/SDRF teams. | **Not Implemented (0%)** | `src/pages/ModulePage.tsx#L57` |
| **Shelter & Relief Mgmt**| Tracking relief camps, capacity, and ration distribution.| **Not Implemented (0%)** | `src/pages/ModulePage.tsx#L65` |

---

## 5. Five-Module Analysis

### Module 1: DRISHTI (Environmental Intelligence)
*Location:* `src/features/drishti/`

```
  ┌────────────────────────────────────────────────────────┐
  │                 DRISHTI ARCHITECTURE                   │
  ├────────────────────────────────────────────────────────┤
  │ [Data Mode Switcher]: Demonstration | Live | Historical│
  ├────────────────────────────────────────────────────────┤
  │  Leaflet Map Container                                 │
  │  ├── TileLayer: OpenStreetMap                          │
  │  └── GeoJSON: udupi-district.geojson (ADM2 Polygon)    │
  ├────────────────────────────────────────────────────────┤
  │  Data Provider Subsystem (src/.../providers.ts)        │
  │  ├── LiveProvider       --> Returns 'unavailableResult'│
  │  ├── HistoricalProvider --> Returns 'unavailableResult'│
  │  └── DemoProvider       --> Returns 6 static floats    │
  └────────────────────────────────────────────────────────┘
```

1. **Flood and Environmental Monitoring:**
   - The interactive map accurately renders the outer polygon of Udupi District from GeoBoundaries gbOpen ADM2 data (`public/data/drishti/udupi-district.geojson`).
   - The map centers and auto-fits bounds via the `FitDistrict` component (`src/features/drishti/DrishtiPage.tsx#L97`).
   - However, **no flood hazard layers, inundation extents, flood return-period zones, or digital elevation models (DEM) exist**.
2. **Taluk & Locality Mapping:**
   - All 7 taluks are enumerated in `taluks` array (`src/features/drishti/data/providers.ts#L26-34`), but every entry has `boundaryState: 'unavailable'`. When a user selects a taluk from the dropdown, a disclaimer states: *"Selected · no current geometry"*.
   - The locality search input is permanently `disabled` with note *"No verified locality gazetteer or boundaries are connected"* (`DrishtiPage.tsx#L384`).
3. **Weather and Rainfall Telemetry:**
   - Live Mode explicitly returns `unavailableResult` because no backend API proxy or API keys for IMD or KSNDMC are present.
   - Demonstration Mode displays 6 static rainfall values (`[4.2, 8.6, 12.1, 7.4, 18.3, 11.6] mm/6h`) and 1 static weather reading (`27.1°C, 78% RH, 9.4 km/h wind`). These do not update or correlate with geographic coordinates.
4. **River Water Level Monitoring:**
   - Section `river` renders `UnavailablePanel` stating: *"CWC’s official Flood Forecast portal is reachable, but no public Udupi gauge feed or station coordinates were verified. No gauge markers are plotted."* (`DrishtiPage.tsx#L290`). Major flood-causing rivers (Swarna, Sita, Varahi) have no gauge tracking.
5. **Architectural Assessment:**
   - **Maturity Level:** **Simulated / Scaffolded**.
   - **Verdict:** Highly transparent design that refuses to show fake data as real observations, but lacks functional meteorological or hydrological connectivity.

---

### Module 2: SANKET (Citizen Emergency Reporting)
*Location:* `src/features/sanket/`

```
  ┌───────────────────────────────────────────────────────────────┐
  │                      SANKET WORKFLOW                          │
  ├───────────────────────────────────────────────────────────────┤
  │ [CITIZEN PERSPECTIVE]                                         │
  │ 1. Form Intake: Type (SOS/Incident/Assistance) + Urgency      │
  │ 2. Location: Locality + Taluk + Geo Coordinates               │
  │ 3. Needs: Food/Water, Rescue, Evacuation, Shelter, Medical   │
  │ 4. Store: Dispatched to In-Memory 'reportStore'               │
  │ 5. History: Instant view of submitted incidents               │
  ├───────────────────────────────────────────────────────────────┤
  │ [HELPER / RESPONDER PERSPECTIVE]                              │
  │ 1. Queue Triage: Filter by Status, Urgency, Category, Taluk   │
  │ 2. Detailed View: Situation, Needs, Reporter Info             │
  │ 3. Assignment: Helper self-assignment ('Assign to me')       │
  │ 4. Lifecycle: Advance status (incoming -> under_review -> ...)│
  └───────────────────────────────────────────────────────────────┘
```

1. **Citizen Incident & SOS Submission:**
   - Functional multi-option reporting form supporting three report types (`sos`, `incident`, `assistance`), 8 incident categories (`flooding`, `waterlogging`, `blocked_road`, etc.), 4 urgency tiers (`low`, `medium`, `high`, `critical`), and 7 assistance needs (`rescue`, `medical`, etc.).
   - Includes client-side input validation (`validateDraft()` at `SanketPage.tsx#L138`).
   - Automatically generates report IDs via `makeReportId()` (`SNK-XXXX`).
2. **Location Capture:**
   - Allows manual input of locality, taluk dropdown selection, and optional latitude/longitude inputs.
   - Does not include a reverse-geocoding map picker or automatic GPS coordinate fetching on the form itself.
3. **Helper Triage Queue:**
   - Robust filtering subsystem in `SanketPage.tsx#L82-99` supporting composite filters across status, urgency, category, assignment state, and free-text locality matching.
   - Pre-seeded with 5 realistic Udupi incident scenarios (`src/features/sanket/data/sampleReports.ts`), including flooded roads in Karkala, waterlogging in Udupi town, and family evacuation needs in Brahmavara.
4. **Lifecycle State Transitions:**
   - Enforces sequential progression: `incoming` → `under_review` → `assigned` → `in_progress` → `resolved` → `closed` (`reportStore.ts#L7-16`).
   - Appends audit entries to `assignmentHistory` recording timestamp, actor name, and operational notes.
5. **Deficits:**
   - **No Photo or Media Attachment:** No file upload input or Supabase Storage integration exists.
   - **Frontend Disconnect:** `SanketPage.tsx` currently imports directly from `reportStore.ts` instead of using the drafted `sanketRepository.ts`.
   - **No Offline Sync:** If mobile network connectivity drops during an evacuation, report submissions fail without IndexedDB queuing or Service Worker background sync.

---

### Module 3: MEDHA (Incident Intelligence)
*Location:* `src/pages/ModulePage.tsx#L50-55`

1. **Intended Role:**
   - Incident aggregation across taluks.
   - Priority assessment and automated urgency scoring.
   - Duplicate detection for multiple calls reporting the same road block or culvert collapse.
   - Verification and intelligence handoff to response teams.
2. **Current Reality:**
   - **100% Unimplemented.**
   - When a helper navigates to `/helper/medha`, `ModulePage.tsx` checks `if (moduleId === 'medha')` and falls through to the generic placeholder:
     ```tsx
     <StatusIndicator tone="warning">DEVELOPMENT PREVIEW</StatusIndicator>
     <h2>MEDHA is under development</h2>
     <p className="module-purpose">A future workspace for reviewing incident patterns and possible duplicate reports.</p>
     ```
   - No clustering algorithms (e.g. DBSCAN, spatial radius grouping), no text-similarity comparison (e.g. Levenshtein or embedding distance), and no heuristic prioritization formulas exist in the project.

---

### Module 4: SENA (Emergency Response Coordination)
*Location:* `src/pages/ModulePage.tsx#L57-62`

1. **Intended Role:**
   - Response force roster and team dispatch.
   - Tracking agency deployment (Udupi District Police, Fire & Emergency Services, SDRF, Home Guards, coastal volunteer rescue teams).
   - Resource allocation (inflatable rescue boats, dewatering pumps, heavy earthmovers).
   - Live dispatch tracking and progress reporting.
2. **Current Reality:**
   - **100% Unimplemented.**
   - Navigating to `/helper/sena` renders the placeholder panel with zero operational controls, no responder database tables, no equipment inventory, and no GPS tracking of rescue assets.

---

### Module 5: PUNARJEEV (Relief and Recovery)
*Location:* `src/pages/ModulePage.tsx#L64-70`

1. **Intended Role:**
   - Rehabilitation and relief camp management.
   - Shelter capacity and occupancy tracking across Udupi taluks.
   - Food packet, clean drinking water, and medical supply inventory.
   - Citizen compensation claims, flood loss assessment, and community rebuilding.
2. **Current Reality:**
   - **100% Unimplemented.**
   - Navigating to `/victim/punarjeev` or `/helper/punarjeev` renders the placeholder card with message *"Placeholder only · No module functionality is connected"*.

---

## 6. Architecture and Database Audit

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND & ARCHITECTURE STATUS                          │
├──────────────────────────────────────┬───────────────────────────────────────────┤
│ ARCHITECTURAL COMPONENT              │ STATUS & INTEGRITY                        │
├──────────────────────────────────────┼───────────────────────────────────────────┤
│ Vite + React 19 Client Engine        │ Operational, 0 build errors (581ms)       │
│ Supabase JS SDK Installation         │ Installed (@supabase/supabase-js v2.95)   │
│ Environment Configuration            │ .env.example present; .env unpopulated    │
│ Migration 00001 (Auth & Profiles)    │ Drafted locally; RLS valid; Not applied   │
│ Migration 00002 (SANKET Incidents)   │ Drafted locally; RPCs valid; Not applied  │
│ AuthContext / State Provider         │ Written; Not wrapped around App root      │
│ ProtectedRoute Guards                │ Written; Not mounted in router.tsx        │
│ Admin Helper Review Table            │ Written; Not mounted in router.tsx        │
│ SANKET Supabase Repository           │ Written; SanketPage still uses mock store │
└──────────────────────────────────────┴───────────────────────────────────────────┘
```

### 1. Database Schema & Migration Review

The repository contains two drafted migration files in `supabase/migrations/`:

#### Migration 00001: `00001_auth_and_profiles.sql`
- **Table:** `public.profiles`
  - Columns: `id (UUID FK to auth.users)`, `email`, `full_name`, `role ('victim'|'helper'|'admin')`, `organization`, `approval_status ('pending'|'approved'|'rejected')`, `created_at`, `updated_at`.
- **Integrity Assessment:**
  - Includes `is_admin()` and `is_approved_helper()` security-definer helper functions with explicit search paths (`SET search_path = public`).
  - Row Level Security (RLS) policies correctly prevent users from elevating their own `role` or approving their own `approval_status`.
  - Trigger `handle_new_user()` automatically creates profile rows on `auth.users` insert, setting `victim` to auto-approved and `helper` to `pending`.
  - Admin RPC `set_helper_approval(target_user_id, new_status)` enforces admin-only status modification.

#### Migration 00002: `00002_sanket_incidents_and_rls.sql`
- **Tables:** `public.sanket_reports` and `public.sanket_status_history`.
- **Integrity Assessment:**
  - Automated ID generation sequence: `generate_sanket_report_id()` (`SNK-1001`, `SNK-1002`).
  - RLS Policies:
    - `public.sanket_reports`: Public `INSERT` allowed so unauthenticated distress victims can submit SOS. Authenticated victims can `SELECT` where `created_by = auth.uid()`. Responders (`is_responder()`) can `SELECT` and `UPDATE` all records.
    - `public.sanket_status_history`: Responders can view all history; victims can only view history for reports where `created_by = auth.uid()`.
  - RPC Functions:
    - `assign_sanket_report(p_report_id, p_note)`: Atomically updates `assigned_to`, sets status to `'assigned'`, and creates audit row.
    - `update_sanket_status(p_report_id, p_new_status, p_note)`: Validates lifecycle transition, updates report timestamp, and inserts audit row.
    - `get_report_contact(p_report_id)`: Restricts citizen phone numbers to approved responders or the original author.

#### Reality Check on Database Deployment
- **None of these migrations are deployed.** No live PostgreSQL database is running.
- In `src/lib/supabase.ts`, `isSupabaseConfigured` evaluates to `false` because `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not set.
- Per strict instructions, migrations have not been applied to any remote instance without explicit user credentials and authorization.

---

## 7. Security and Privacy Audit

### 1. Exposure of Credentials
- **Finding:** Clean.
- `.gitignore` was updated to explicitly ignore `.env`, `.env.*`, and `*.local`, while keeping `.env.example` committed.
- No Supabase service-role keys, database passwords, or secret tokens are present anywhere in the frontend code.

### 2. Citizen Contact Privacy
- **Critical Risk in Emergency Platforms:** In disaster situations, distressed citizens submit phone numbers and exact household locations. If unvetted users register as "helpers" and gain immediate access to these numbers, vulnerable individuals are exposed to harassment, scams, or extortion.
- **Architectural Defense:**
  - Migration 00001 requires all `helper` accounts to remain in `approval_status = 'pending'` until approved by a district administrator.
  - Migration 00002 wraps citizen phone numbers in security-definer function `get_report_contact(p_report_id)`, returning an exception if called by an unapproved user.
  - In `src/pages/AdminHelpersPage.tsx` and `src/components/ProtectedRoute.tsx`, pending helpers are barred from the incident queue and routed to `PendingApprovalPage.tsx`.

### 3. Client-Side Bypass Vulnerabilities in Current Snapshot
- While SQL policies are well-crafted, **client-side route protection is currently disabled** in `src/app/router.tsx`. Anyone can type `/helper/dashboard` or `/helper/sanket` into the browser address bar and view the prototype incident queue and sample citizen contact details because `ProtectedRoute` is not actively wrapping those routes.
- `App.tsx` does not wrap `<RouterProvider>` in `<AuthProvider>`, meaning authentication state does not propagate globally until mounted.

---

## 8. UI/UX and Product Experience Audit

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UI / UX DESIGN SCORECARD                        │
├──────────────────────────────┬─────────┬───────────────────────────────┤
│ CRITERIA                     │ RATING  │ NOTES                         │
├──────────────────────────────┼─────────┼───────────────────────────────┤
│ Emergency Visual Hierarchy   │ 8.5/10  │ Crisp typography, alert badges│
│ Design Consistency           │ 8.0/10  │ Unified sidebar and palette   │
│ Accessibility & High Contrast│ 7.5/10  │ Good contrast; lacks ARIA live│
│ Mobile Evacuation Usability  │ 6.0/10  │ Sidebars collapse, maps rigid │
│ Offline Resilience           │ 1.0/10  │ Fails without network         │
│ Multilingual (Kannada)       │ 2.0/10  │ English only (unusable rural) │
│ Form Simplicity in Panic     │ 6.5/10  │ Too many fields for SOS       │
└──────────────────────────────┴─────────┴───────────────────────────────┘
```

### Detailed UX Observations

1. **Emergency SOS Panic Flow:**
   - In an actual flood emergency (e.g. rising floodwaters at 2:00 AM in Kaup taluk), a victim holding a wet mobile device cannot fill out detailed text fields like *"Summary"*, *"Situation details"*, *"Locality"*, and *"Contact preference"*.
   - The platform lacks a **One-Tap Emergency SOS** that immediately transmits GPS coordinates, battery level, and family count with a single button press.
2. **Language Barrier:**
   - Udupi District predominantly speaks **Kannada** and **Tulu**, with English used in administrative circles.
   - The entire platform—including alerts, form inputs, status labels, and instructions—is exclusively in English. This is a severe usability flaw for rural residents along the Varahi and Sita river basins.
3. **Map Experience (DRISHTI):**
   - The Leaflet map occupies a large portion of the viewport, but lacks essential interactive layers: no satellite toggle (crucial for spotting submerged bridges), no flood contour overlay, and no pin cluster visualization for incoming SANKET reports.
4. **Empty and Error States:**
   - Empty queue states (`"No reports match the current filters"`) and loading skeletons are implemented cleanly.
   - However, when the user is disconnected from the internet, the interface does not show a persistent *"Offline Mode"* indicator.

---

## 9. Disaster-Management Feasibility

Evaluating ABHEDYA against the operational realities of Indian disaster management guidelines (NDRF / KSDMA / Udupi DDMA standard operating procedures):

| Operational Reality | ABHEDYA Platform Readiness | Analysis & Deficit |
| :--- | :--- | :--- |
| **Monsoon Power & Cell Outages** | **Extremely Vulnerable** | Mobile towers frequently collapse or run out of backup generator fuel during coastal cyclones. ABHEDYA has no SMS fallback, USSD integration, or offline mesh caching. |
| **Official Agency Interoperability** | **Simulated / Disconnected** | Does not ingest standard CAP (Common Alerting Protocol) XML feeds from NDMA's Sachet system or CWC telemetry. Relies on external hyperlinks. |
| **False & Duplicate Report Spikes** | **Vulnerable** | During floods, dozens of residents call or post about the same waterlogged road. Without MEDHA's deduplication, helper queues will become flooded with duplicate entries, paralyzing response. |
| **Vulnerable Population Tracking** | **Partial** | SANKET collects assistance categories (medical, rescue), but does not track infants, elderly, bedridden patients, or livestock requiring evacuation transport. |
| **Shelter Management & Relief** | **Missing** | District emergency cells operate dozens of *Kaloji Kendras* (relief camps). PUNARJEEV is currently an empty placeholder, leaving camp managers with no digital tools. |

---

## 10. Missing and Incomplete Features Summary

### The "Top Incomplete Items" Checklist

```markdown
- [ ] 1. App.tsx: AuthProvider is not mounted around RouterProvider.
- [ ] 2. router.tsx: ProtectedRoute is not applied to /victim/*, /helper/*, or /admin/* routes.
- [ ] 3. router.tsx: Admin pages (/admin/dashboard, /admin/helpers) are unrouted.
- [ ] 4. router.tsx: Helper verification flow (/helper/pending-approval) is unrouted.
- [ ] 5. router.tsx: Password recovery (/reset-password) is unrouted.
- [ ] 6. EmergencyRequestForm.tsx: Landing page SOS does not persist to SANKET database.
- [ ] 7. SanketPage.tsx: Still imports from reportStore.ts instead of sanketRepository.ts.
- [ ] 8. Supabase: Database migrations 00001 and 00002 not executed against a live database.
- [ ] 9. Supabase: Storage bucket for disaster photo evidence not created or integrated.
- [ ] 10. DRISHTI: No live weather API proxy (IMD / Open-Meteo fallback) connected.
- [ ] 11. DRISHTI: Taluk boundary GeoJSON geometries missing for all 7 Udupi taluks.
- [ ] 12. MEDHA: Zero implementation (incident clustering, priority scoring, duplicate detection).
- [ ] 13. SENA: Zero implementation (volunteer teams, vehicle tracking, resource allocation).
- [ ] 14. PUNARJEEV: Zero implementation (relief camps, supply distribution, recovery tracking).
- [ ] 15. Testing: Zero automated unit tests, component tests, or end-to-end tests exist.
```

---

## 11. Improvement Recommendations

### A. Critical Fixes (Correctness, Security & Core Reliability)

#### Fix A1: Mount AuthProvider and Apply ProtectedRoute in Router
- **Problem:** Auth state is isolated; protected routes can be bypassed via direct URL navigation.
- **Why It Matters:** Fundamental access control flaw. Pending helpers or unauthenticated users can access responder workflows.
- **Proposed Implementation:**
  - Wrap `RouterProvider` inside `<AuthProvider>` in `src/app/App.tsx`.
  - In `src/app/router.tsx`, wrap `/victim/*` in `<ProtectedRoute allowedRole="victim">`, `/helper/*` in `<ProtectedRoute allowedRole="helper" requireApprovedHelper={true}>`, and add `/admin/*` wrapped in `<ProtectedRoute allowedRole="admin">`.
- **Files Affected:** `src/app/App.tsx`, `src/app/router.tsx`.
- **Complexity:** Low. **Impact:** High.

#### Fix A2: Connect Landing Page Emergency Form to SANKET Repository
- **Problem:** Submissions on the home page do nothing except display a simulated toast notice.
- **Why It Matters:** In an emergency, any form labeled "Emergency SOS" that discards user submissions is a severe safety hazard.
- **Proposed Implementation:**
  - Modify `src/components/EmergencyRequestForm.tsx` to construct a `SanketReportDraft` and call `sanketRepository.submitReport()`, returning an immediate tracking code (`SNK-XXXX`) to the citizen.
- **Files Affected:** `src/components/EmergencyRequestForm.tsx`.
- **Complexity:** Low. **Impact:** Critical.

#### Fix A3: Switch SanketPage from In-Memory Store to Repository
- **Problem:** `SanketPage.tsx` directly modifies `prototypeReports` in `reportStore.ts`, bypassing Supabase.
- **Why It Matters:** Database persistence fails to engage even when credentials are configured.
- **Proposed Implementation:**
  - Refactor `SanketPage.tsx` to asynchronously fetch and mutate data via `sanketRepository`, rendering error banners on failure without silent fallback.
- **Files Affected:** `src/features/sanket/SanketPage.tsx`.
- **Complexity:** Medium. **Impact:** High.

---

### B. High-Impact Features (Functional Credibility & Value)

#### Feature B1: Live Weather Fallback via Open-Meteo API in DRISHTI
- **Problem:** IMD and KSNDMC feeds require closed government credentials, leaving DRISHTI permanently disabled in Live Mode.
- **Why It Matters:** Judges and evaluators see only "Unavailable" error banners.
- **Proposed Implementation:**
  - Integrate **Open-Meteo API** (free, public, no API key required, WMO-compliant, with high-resolution hourly rainfall and weather forecasts for Udupi: lat `13.3409`, long `74.7421`).
  - Keep IMD as the official primary attribution with Open-Meteo as the verified open-telemetry live feed.
- **Files Affected:** `src/features/drishti/data/providers.ts`.
- **Complexity:** Medium. **Impact:** Very High.

#### Feature B2: Functional MEDHA Incident Deduplication Engine
- **Problem:** MEDHA is an empty placeholder shell.
- **Why It Matters:** Incident intelligence is the core differentiating value proposition of ABHEDYA over a generic ticketing system.
- **Proposed Implementation:**
  - Implement an explainable incident clustering algorithm:
    1. **Spatial Proximity:** Reports within a 500-meter radius in the same taluk.
    2. **Temporal Window:** Submitted within 3 hours of each other.
    3. **Category Match:** Identical emergency category (e.g. `flooding` or `blocked_road`).
  - Present clusters in a dedicated MEDHA review table allowing helpers to group duplicates under a single primary incident.
- **Files Affected:** Create `src/features/medha/MedhaPage.tsx`, update `src/pages/ModulePage.tsx`.
- **Complexity:** Medium. **Impact:** Very High.

#### Feature B3: Photo & Evidence Upload with Supabase Storage
- **Problem:** Reports contain only text descriptions; responders cannot verify water depth or structural collapse.
- **Why It Matters:** Emergency coordinators prioritize rescue boats based on visual water level verification.
- **Proposed Implementation:**
  - Add image capture/upload input to SANKET forms.
  - Upload compressed images to Supabase Storage bucket `sanket-evidence` and store image URLs in `sanket_reports`.
- **Files Affected:** `src/features/sanket/SanketPage.tsx`, `supabase/migrations/00002_sanket_incidents_and_rls.sql`.
- **Complexity:** Medium. **Impact:** High.

---

### C. UI/UX Improvements

#### UX C1: Kannada Language Localization (i18n)
- **Problem:** Platform is English-only, alienating local Udupi populations.
- **Why It Matters:** Immediate real-world necessity for coastal Karnataka.
- **Proposed Implementation:**
  - Implement a lightweight localization dictionary (`en` / `kn`) covering emergency keywords: SOS (*ತುರ್ತು ಸಹಾಯ*), Flood (*ಪ್ರವಾಹ*), Waterlogging (*ನೀರು ತುಂಬಿರುವುದು*), Rescue (*ರಕ್ಷಣೆ*).
- **Complexity:** Medium. **Impact:** High.

#### UX C2: Interactive SANKET Live Incident Map
- **Problem:** SANKET only shows incidents in an administrative table list; DRISHTI only shows the district boundary.
- **Why It Matters:** Disaster commanders need to see incident clusters geographically mapped across river basins.
- **Proposed Implementation:**
  - Plot active SANKET reports as color-coded urgency pins directly on the Leaflet map, linking pins to incident detail drawers.
- **Complexity:** Medium. **Impact:** High.

---

### D. Advanced Opportunities

#### Opportunity D1: Offline-First PWA & IndexedDB Queue
- Service Worker registration caching app shell and GeoJSON boundary.
- Offline submission queue storing SOS reports in browser IndexedDB, automatically dispatching when network connectivity restores.

#### Opportunity D2: Automated Common Alerting Protocol (CAP) Ingestion
- Serverless edge function polling Karnataka SDMA CAP RSS feeds, converting official district flood warnings into active DRISHTI emergency banners.

---

## 12. Hackathon Competitiveness Assessment

| Evaluation Dimension | Score (1-10) | Honest Evaluator Assessment |
| :--- | :---: | :--- |
| **Problem Relevance** | **9.5 / 10** | Monsoon flooding in Udupi is an urgent, real-world regional problem with recurring loss of life, infrastructure damage, and economic displacement. |
| **Design & UI Fidelity** | **8.5 / 10** | Professional aesthetic, cohesive typography, high-contrast visual hierarchy, emergency-grade color palettes. |
| **Technical Implementation**| **5.0 / 10** | Excellent TypeScript strictness and solid drafted SQL schema, but severely penalized by unmounted auth guards, mock store disconnect, and 3 unimplemented modules. |
| **Innovation & Intelligence**| **4.0 / 10** | Promoted as an "intelligence" platform, but MEDHA (analytics), SENA (dispatch), and hydrological modeling are currently absent. |
| **Real-World Feasibility** | **5.5 / 10** | High respect for data provenance (no fake data in live mode), but lack of offline mode, SMS channel, and Kannada localization limits practical field deployment. |
| **Overall Hackathon Rating** | **6.5 / 10** | **Strong Foundation with High Potential.** If the top 10 priorities below are executed, this project easily elevates to an **8.8 - 9.2 / 10 winning contender**. |

### What Would Make Judges Remember This Project?
1. **Closing the Loop:** An incident submitted on the public landing page immediately appears in real time on the Helper Triage Map and is processed through MEDHA's deduplication engine.
2. **Authentic District Nuance:** Explicitly showcasing Udupi's specific rivers (Swarna and Sita) and taluk-level flood vulnerability zones rather than generic placeholder maps.
3. **Data Integrity Stance:** Highlighting that ABHEDYA refuses to hallucinate synthetic flood forecasts when human lives are at stake.

---

## 13. Top 10 Priorities

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                   TOP 10 IMPLEMENTATION PRIORITIES                     │
  ├────┬───────────────────────────────────────────┬──────────┬────────────┤
  │ #  │ Action Item                               │ Effort   │ Impact     │
  ├────┼───────────────────────────────────────────┼──────────┼────────────┤
  │ 01 │ Mount AuthProvider & Wire Protected Routes│ 2 hours  │ Critical   │
  │ 02 │ Route Admin Dashboard & Helper Review UI  │ 2 hours  │ High       │
  │ 03 │ Wire Landing Page SOS to SANKET DB Store  │ 3 hours  │ Critical   │
  │ 04 │ Switch SanketPage to sanketRepository     │ 4 hours  │ High       │
  │ 05 │ Add Open-Meteo Live Weather in DRISHTI    │ 4 hours  │ Very High  │
  │ 06 │ Plot SANKET Incidents on DRISHTI Map      │ 5 hours  │ Very High  │
  │ 07 │ Build Functional MEDHA Deduplication Page │ 6 hours  │ Very High  │
  │ 08 │ Build SENA Response Team Dispatch Page    │ 6 hours  │ High       │
  │ 09 │ Add Photo Attachment Upload (Storage)     │ 4 hours  │ High       │
  │ 10 │ Add Kannada Language Toggle (EN / KN)     │ 4 hours  │ Very High  │
  └────┴───────────────────────────────────────────┴──────────┴────────────┘
```

---

## 14. Development Roadmap

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           DEVELOPMENT ROADMAP                          │
  └────────────────────────────────────────────────────────────────────────┘
  
  [PHASE 1] Plumbing & Wire Integrity (Days 1 - 2)
  ├── Mount AuthProvider in App.tsx
  ├── Wrap routes with ProtectedRoute in router.tsx
  ├── Register /admin/*, /helper/pending-approval, /reset-password
  ├── Connect Landing Emergency SOS form to database repository
  └── Refactor SanketPage to use sanketRepository with explicit error states

  [PHASE 2] Intelligence & Environmental Telemetry (Days 3 - 4)
  ├── Connect live Open-Meteo API in DRISHTI for Udupi District weather
  ├── Ingest taluk boundary GeoJSONs for all 7 Udupi taluks
  └── Plot active SANKET incident markers dynamically on the Leaflet map

  [PHASE 3] Implement Missing Modules: MEDHA & SENA (Days 5 - 6)
  ├── Build MEDHA: Proximity + category clustering for duplicate detection
  ├── Build SENA: Responder team roster and one-click incident dispatch
  └── Add photo upload capability to SANKET incident forms

  [PHASE 4] Polish, Localization & Hackathon Demo (Day 7)
  ├── Add Kannada / English localization switcher
  ├── Add automated end-to-end smoke test (Playwright or Vitest)
  └── Stage 3 end-to-end demonstration scenarios for presentation
```

---

## 15. Final Verdict

ABHEDYA possesses **exceptional thematic depth, thoughtful conceptual architecture, and a remarkably clean visual design system**. Its ethical approach to data provenance—refusing to disguise synthetic examples as genuine government observations—is a refreshing and professional engineering stance rarely seen in hackathons.

However, in its current state, **the project is half-assembled**: its authentication guards, administrative interfaces, and database repositories exist as standalone files disconnected from the active runtime router, while three of its five core modules remain placeholder cards.

By methodically following the 7-day sprint outlined below, the engineering team can transition ABHEDYA from an impressive visual prototype into a **cohesive, live-integrated, and competition-winning disaster intelligence platform**.

---

## The 7-Day Action Plan

> **"If we had to spend the next 7 days improving ABHEDYA, exactly what should we build, fix, and polish to maximize its technical quality, real-world usefulness, and hackathon impact?"**

### Day 1: Wire All Plumbing, Routes & Auth Guards
1. In `src/app/App.tsx`, wrap `<RouterProvider>` inside `<AuthProvider>`.
2. In `src/app/router.tsx`, register `/admin/dashboard`, `/admin/helpers`, `/helper/pending-approval`, `/reset-password`, and wrap all role-specific routes with `<ProtectedRoute>`.
3. In `src/components/EmergencyRequestForm.tsx`, replace the simulated notice with an actual call to `sanketRepository.submitReport()`, returning a generated tracking code (`SNK-XXXX`) directly on screen.

### Day 2: Complete the SANKET Database Integration
1. Refactor `src/features/sanket/SanketPage.tsx` to read from and write to `sanketRepository` with async loading skeletons and explicit user-facing database error alerts.
2. Verify the Helper Approval workflow end-to-end: register a helper → verify they land on the pending review screen → sign in as admin → approve helper → verify helper gains full queue access.

### Day 3: Bring DRISHTI to Life with Live Telemetry
1. Add an Open-Meteo live API integration in `src/features/drishti/data/providers.ts` for Udupi District coordinates (`lat: 13.3409`, `lon: 74.7421`), pulling live rainfall, temperature, and wind data into Live Mode.
2. Add interactive incident markers to DRISHTI’s Leaflet map so incoming SANKET emergency calls appear directly on the district map.

### Day 4: Build Module 3 — MEDHA (Incident Deduplication Engine)
1. Replace `ModulePage.tsx`’s placeholder for MEDHA with a functional `MedhaPage.tsx`.
2. Implement spatial and category grouping logic: when 2 or more reports occur within 1 km in the same taluk with identical categories, group them into a "Cluster Alert" with an explainable confidence score and a "Merge Duplicate" button.

### Day 5: Build Module 4 — SENA (Emergency Dispatch Coordination)
1. Replace `ModulePage.tsx`’s placeholder for SENA with a functional `SenaPage.tsx`.
2. Implement a responder team registry (Udupi Fire & Rescue, Malpe Coastal Lifeguards, Red Cross Kundapura, Home Guards).
3. Allow coordinators to assign an entire rescue unit to an incident with dispatch status tracking (`dispatched` → `on_scene` → `evacuating` → `completed`).

### Day 6: Photo Uploads & Kannada Localization
1. Add camera/photo file input to SANKET so citizens can attach water level evidence.
2. Implement an English / Kannada (`ಕನ್ನಡ`) toggle in the site header, translating core emergency buttons and distress forms.

### Day 7: Demo Rehearsal, Smoke Testing & Polish
1. Write 5 Vitest tests covering authentication role guards, report ID generation, and deduplication logic.
2. Prepare a 3-minute hackathon presentation script demonstrating the complete loop:
   *Citizen files SOS on phone in Kannada → Appears live on DRISHTI map → MEDHA flags duplicate reports → SENA dispatches rescue team → Citizen tracks resolution.*
