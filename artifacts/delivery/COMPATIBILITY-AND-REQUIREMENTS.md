# Compatibility & System Requirements

This document outlines verified operating systems, web browsers, accessibility standards, and mobile usage guidelines for **Our Life Planner v1.0.0**.

---

## 🖥️ Desktop Browser Support (Verified)

Our Life Planner is fully tested and verified on modern desktop environments running standard resolutions from 768px through 4K displays:

| Platform | Web Browser | Minimum Version | Offline HTML File | PWA / Web Edition |
| :--- | :--- | :--- | :--- | :--- |
| **Windows 10 / 11** | Microsoft Edge | 120+ | Fully Supported | Fully Supported |
| **Windows 10 / 11** | Google Chrome | 120+ | Fully Supported | Fully Supported |
| **Windows 10 / 11** | Mozilla Firefox | 120+ | Fully Supported | Fully Supported |
| **macOS (Sonoma / Sequoia)** | Apple Safari | 17+ | Fully Supported | Fully Supported |
| **macOS (Sonoma / Sequoia)** | Google Chrome | 120+ | Fully Supported | Fully Supported |
| **Linux (Ubuntu / Fedora / Arch)** | Chromium / Firefox | 120+ | Fully Supported | Fully Supported |

---

## 📱 Mobile & Tablet Guidelines & Caveats

Our Life Planner features an adaptive, responsive touch interface with 44×44px touch targets and full keyboard/screen reader compatibility.

### Recommended Mobile Workflow: PWA Home-Screen Install
* **iOS (iPhone & iPad - iOS 17+):**
  * Recommended method: Open the web application URL in **Apple Safari** and choose **Share > Add to Home Screen**.
  * *Important iOS File Note:* Opening raw `.html` files directly inside mobile Safari from the Apple Files app runs within a restricted read-only preview sandbox. To ensure persistent local storage on iOS devices, use the web URL and install it to your Home Screen.
* **Android (Android 12+):**
  * Recommended method: Open the web application URL in **Google Chrome** and select **Install app** or **Add to Home screen**.

---

## ♿ Accessibility Conformance (Verified Features)

Our Life Planner v1.0.0 is engineered with strict adherence to digital accessibility principles:
* **Contrast Compliance:** All primary and muted text tokens meet or exceed WCAG 2.2 AA contrast minimums (≥4.5:1 for normal text, ≥3.0:1 for large/bold text) across both light and dark themes.
* **Keyboard Navigation:** Full keyboard operability with prominent 2px high-contrast teal focus rings (`outline-offset: 2px`).
* **Dialog Focus Trap & Restoration:** All modals, sheets, and dialogs trap keyboard focus while open, support dismissal via the `Esc` key, and restore focus to the triggering element upon closing.
* **Form & Touch Semantics:** Touch targets for frequent phone actions adhere to minimum 44×44 CSS pixels. All inputs, checkboxes, and buttons have programmatic accessible names (`aria-label` or explicit labels).
* **Reduced Motion:** Fully honors the system preference `prefers-reduced-motion: reduce` by disabling non-essential transitions and animations while preserving critical state feedback.

---

## ⚙️ Hardware & Storage Requirements

* **Processor:** Any modern CPU (x86_64 or ARM64).
* **RAM:** 512 MB available system memory.
* **Disk Space:** Less than 5 MB of browser local storage for years of planning records.
* **Internet Connection:** 
  * *Offline HTML Edition:* Zero internet connection required.
  * *Web PWA Edition:* Internet connection required only for initial page load and Service Worker asset caching.
