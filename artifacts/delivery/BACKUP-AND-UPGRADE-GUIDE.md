# Backup, Recovery & Upgrade Migration Guide

This guide explains how Our Life Planner protects your data, how to export and restore backups, and how to safely migrate your records when upgrading to newer software releases or moving between devices.

---

## 1. The Core Data Protection Architecture

Our Life Planner features a transactional local storage engine:
* **Multi-phase Atomic Writes:** When records are updated, data is serialized, written to disk, and verified with an immediate readback check before confirming save completion.
* **Pre-restore Safety Snapshots:** Before any backup file or sample data is restored, the system automatically creates an encrypted local snapshot (`olp_backup_safety_snapshot`). If a restore was initiated by mistake, you can revert immediately.
* **Corrupted Snapshot Quarantine:** If an unreadable data block is ever encountered in browser storage, it is safely preserved in an isolated quarantine key (`olp_quarantine_*`) rather than deleted or overwritten.

---

## 2. Step-by-Step: Creating a JSON Backup

Creating a backup creates an exact, human-readable JSON snapshot of your entire planner:

1. Click the **Settings** gear icon in the sidebar or bottom navigation.
2. Select **Data & Storage** (or press the keyboard shortcut `Ctrl+B` / `Cmd+B`).
3. Click the teal **Export JSON Backup** button.
4. Your browser will prompt to save a file named:
   ```
   our-life-planner-backup-YYYY-MM-DD.json
   ```
5. Save this file to a safe location (e.g., your Documents folder, an external USB drive, or private cloud storage such as iCloud, Dropbox, or Google Drive).

### What Is Stored Inside the Backup File?
* All 15 modules: tasks, subtasks, routine schedules, brain-dump inbox items, goals, milestones, habit logs, budgets, bills, savings pots, debt payoffs, meal recipes, groceries, workout sessions, and weight/BMI entries.
* User preferences: theme (light/dark), time zone, week start day, currency symbol, and custom module visibility toggles.
* Multi-profile household member lists and tags.

---

## 3. Step-by-Step: Restoring from a Backup

To restore your records into any instance of Our Life Planner:

1. Open **Settings** > **Data & Storage** > **Backup & Restore**.
2. Click **Choose File to Restore** and select your saved `.json` backup file.
3. The restore validator will inspect the file and display a summary of contents (task count, habit count, budget entries, export date).
4. Click **Confirm & Restore**.
5. The application will atomically load your data and refresh the dashboard.

---

## 4. Moving the Offline File or Upgrading to a New Release

### What Happens When You Move the HTML File?
Under modern web browser security models (Chromium and WebKit), running an HTML file directly from your local drive (`file://` protocol) partitions browser storage based on the exact file path or origin:
* If you move `Our-Life-Planner-Offline.html` from `Downloads` to `Documents`, your browser may treat the new folder as a distinct storage location.
* **Migration Rule:** Whenever you move the file to a new folder, new computer, or new drive:
  1. Open the file in its original location and **Export JSON Backup**.
  2. Move the file (or download the new version).
  3. Open the file in its new location and **Restore from Backup**.

### Safe Upgrade Procedure for Future Releases
When a new version of Our Life Planner is released:
1. Open your current planner and export a backup (`our-life-planner-backup-[date].json`).
2. Download or open the new release file (e.g., `Our-Life-Planner-Offline.html`).
3. Go to **Settings > Backup & Restore** in the new file.
4. Restore your saved backup JSON file.
5. All your data is instantly migrated to the new version without any manual re-entry.

---

## 5. Frequently Asked Questions

### Can I edit the backup JSON file directly?
Yes. The backup is formatted in standard, human-readable JSON. If you are technically inclined, you can inspect or edit values with any text editor. The import validator automatically checks schema consistency before importing.

### What if I accidentally cleared my browser history?
If you selected "Clear cookies and site data" in your browser settings, `localStorage` may have been emptied. Simply open the planner, open **Backup & Restore**, and upload your most recent weekly JSON backup file to restore everything immediately.
