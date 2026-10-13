# Setup, Installation & Configuration Guide

This guide documents how to clone, install, develop, verify, and build **Our Life Planner** using a reproducible locked environment.

---

## 1. System Requirements

* **Node.js:** v20.x, v22.x, or v24.x
* **Package Manager:** npm v10.x or higher
* **Operating Systems:** Windows 10/11, macOS, Linux
* **Optional for PDF Compilation:** Microsoft Edge or Google Chrome (for headless print-to-pdf)

---

## 2. Reproducible Locked Installation

Always use `npm ci` to guarantee that dependencies install identically according to `package-lock.json`:

```bash
# Clone the repository
git clone https://github.com/ridahidsi07/our-life-planner.git
cd our-life-planner

# Install exact locked dependencies
npm ci
```

*(Note: Never run `npm install` in CI environments without `--package-lock-only`, to prevent unintended dependency drift.)*

---

## 3. Available npm Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts Vite local development server on `http://localhost:3000` with hot module replacement (HMR). |
| `npm run build` | Compiles client assets (`vite build`) and generates standalone offline HTML bundle (`node scripts/build-standalone.mjs`). |
| `npm run package` | Assembles buyer delivery artifacts, PDF guide, and compresses `dist/Our-Life-Planner-v1.0.0-Delivery.zip`. |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) with strict compiler settings. |
| `npm run test:all` | Executes full automated test suite (regression checks, browser E2E, accessibility, delivery integrity). |
| `npm run verify` | Single aggregate quality gate: lint + build + package + test:all. |
| `npm run preview` | Starts local production preview server for compiled `dist/` directory. |
| `npm run clean` | Deletes generated build artifacts (`dist/`). |

---

## 4. Configuration & Environment Variables

Copy `.env.example` to `.env` if local overrides are needed:

```bash
cp .env.example .env
```

### Supported Environment Variables:
* `VITE_SUPPORT_ENDPOINT_URL` *(Optional)*: An HTTP POST endpoint URL if connecting direct in-app support messaging. If omitted or blank, the app defaults safely to the local draft mailto helper (`support@ourlifeplanner.app`) without making remote network requests.
* `VITE_CONFIG_NATIVE_IGNORE_WARNING` *(Optional)*: Set to `true` to suppress Vite config deprecation notices.

---

## 5. Secret & Security Scanning

To scan the codebase for potential leaked API tokens, private keys, or credentials:

```bash
node scripts/scan-secrets.mjs
```

To run an automated dependency vulnerability audit:

```bash
npm audit --audit-level=high
```

---

## 6. Build Outputs & Artifact Locations

* `dist/index.html` & `dist/assets/`: Standard web application assets for web hosting and PWA serving.
* `dist/Our-Life-Planner-Offline.html`: Standalone offline single-file edition (100% self-contained, 0 external requests).
* `artifacts/delivery/Our-Life-Planner-Getting-Started-Guide.pdf`: Printable 2-page getting-started cheat sheet.
* `dist/Our-Life-Planner-v1.0.0-Delivery.zip`: Finished Etsy buyer delivery archive (<20 MB).
