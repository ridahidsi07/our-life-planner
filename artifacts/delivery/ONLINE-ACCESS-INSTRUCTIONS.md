# Online Access & Storage Expectations Guide

Our Life Planner is provided in two complementary formats:

1. **Standalone Offline HTML Application (`Our-Life-Planner-Offline.html`)**: A completely self-contained file stored locally on your device with 100% offline capabilities and zero network calls.
2. **Web Browser / PWA Edition**: An online Progressive Web App accessible via:
   **Live Web App URL**: [https://ridahidsi07.github.io/our-life-planner/](https://ridahidsi07.github.io/our-life-planner/)
   Installable to your smartphone, tablet, or desktop home screen for seamless full-screen planning.

---

## 🔒 Storage Architecture & Privacy Boundaries

To ensure user privacy, data sovereignty, and flexibility, Our Life Planner offers two storage options:

### 1. Local-First Storage (Default for Both Editions)
* All tasks, routines, habits, budgets, workouts, and personal notes are saved securely in your browser's local database (`localStorage`).
* When using the Standalone Offline HTML file or the Web Edition in Local Mode, **zero personal data leaves your device**. There are no remote tracking scripts, marketing beacons, or external database telemetry.

### 2. Optional Multi-Device Cloud Sync
* If you wish to seamlessly synchronize your planner between your phone, tablet, and computer, Our Life Planner includes optional account-based Cloud Sync.
* **Activation**: You can activate sync by creating an account in **Account & Cloud Sync** and redeeming your Etsy purchase claim code (`OLP-ETSY-XXXX-XXXX`).
* **Privacy & Security**: When Cloud Sync is activated, snapshots are transmitted over encrypted HTTPS/TLS directly to your private account for conflict-free multi-device synchronization. Data is never sold, shared with third parties, or scanned for advertising.

### 3. Offline vs. Online Storage Isolation
* Modern web browsers strictly isolate local storage between different web origins and file paths:
  * Data entered into the offline file `Our-Life-Planner-Offline.html` remains stored in that local file's origin.
  * Data entered into the web browser version (`https://ridahidsi07.github.io/our-life-planner/`) remains stored in that web domain's origin.
* If you do not use Cloud Sync, running the offline HTML file **does not automatically synchronize** to the web URL. Use the JSON backup transfer steps below to migrate your data anytime.

---

## How to Transfer Data Between Offline and Online Editions

If you start planning in the offline HTML file and later wish to transfer your data to the web app (or vice versa), follow these simple steps:

1. **Export from Source:**
   * Open the edition currently containing your data.
   * Go to **Settings** > **Data & Storage** (or press `Ctrl+B` / `Cmd+B`).
   * Click **Export JSON Backup**.
   * A `.json` file containing all your records will save to your computer or phone.

2. **Import into Target:**
   * Open the destination edition (e.g., the web app or another computer).
   * Open **Settings** > **Backup & Restore**.
   * Click **Choose File to Restore** and select your saved `.json` file.
   * Review the pre-restore summary and click **Confirm & Restore**.
   * All your data, settings, categories, and records are restored instantly.

---

## How to Install as a Phone App (PWA)

When using the web edition, you can install the planner to your phone or tablet home screen for a fast, native app experience:

### On iPhone & iPad (Safari)
1. Open the web app link in the **Safari** browser.
2. Tap the **Share** button (the square with an upward arrow) in the bottom toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the app name and tap **Add** in the top-right corner.
5. The teal planner icon will now appear on your home screen. When launched from the icon, it opens in full-screen mode without browser address bars.

### On Android (Chrome)
1. Open the web app link in **Google Chrome**.
2. Tap the three dots menu in the top-right corner.
3. Tap **Install app** or **Add to Home screen**.
4. Tap **Install** to confirm.
5. Launch the planner from your application drawer or home screen.

---

## Best Practices for Safe Data Keeping

* **Weekly Backup Habit:** We recommend exporting a JSON backup once a week from **Settings > Data & Storage**. Store this file in your personal iCloud Drive, Google Drive, OneDrive, or local backup folder.
* **Browser Cleaning Caution:** If you run automated disk cleaning tools or select "Delete all cookies and site data" in your browser settings, be sure you have a recent backup JSON file saved first.
