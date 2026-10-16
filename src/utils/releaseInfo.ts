/**
 * Single authoritative source of truth for product release identity, versioning,
 * support contact, and verified runtime boundaries.
 * (AUDIT_REPORT.md LP-15, LP-16, LP-17)
 */

export const APP_NAME = 'Our Life Planner';
export const APP_VERSION = '1.0.0';
export const APP_RELEASE_NAME = 'Version 1.0.0 Stable Offline Release';
export const APP_RELEASE_DATE = '2026-10-16';
export const APP_BUILD_ID = 'olp-2026.10.16-v1.0.0';
export const APP_COMMIT_HASH = '35dafd0b444594ee391a2d17ec378f6449da482c';
export const APP_SHORT_COMMIT = '35dafd0';

export const PRODUCTION_HOSTED_URL = 'https://ridahidsi07.github.io/our-life-planner/';
export const REPOSITORY_URL = 'https://github.com/ridahidsi07/our-life-planner';

export const BACKUP_SCHEMA_VERSION = '1.0.0';
export const CALENDAR_SPEC_VERSION = '2.0';

export const OFFLINE_FILE_NAME = 'Our-Life-Planner-Offline.html';
export const DELIVERY_ZIP_NAME = 'Our-Life-Planner-v1.0.0-Delivery.zip';
export const GETTING_STARTED_PDF_NAME = 'Our-Life-Planner-Getting-Started-Guide.pdf';

export const SUPPORT_EMAIL = 'support@ourlifeplanner.app';
export const SUPPORT_HOURS = 'Monday to Friday (responses within 24–48 business hours)';

export const VERIFIED_PLATFORMS = {
  desktop: [
    'Microsoft Edge 120+ (Windows 10/11)',
    'Google Chrome 120+ (macOS, Windows, Linux)',
    'Apple Safari 17+ (macOS Sonoma / Sequoia)',
    'Mozilla Firefox 120+ (Windows, macOS, Linux)',
  ],
  mobile: [
    'Safari on iOS 17+ (iPhone / iPad — PWA Add-to-Home-Screen recommended for persistent storage)',
    'Chrome on Android 12+ (Android phones / tablets — PWA install supported)',
  ],
  offlineNotes:
    'Standalone HTML file persists data in browser localStorage under its local origin. Relocating files or opening in private/incognito mode uses separate storage; regular JSON backup export/import is the recommended upgrade and transfer route.',
} as const;

export const FEATURE_SUMMARY = [
  {
    category: 'Daily Momentum',
    items: ['Today dashboard with daily rhythm', 'Calendar schedule', 'Tasks & insights with pagination', 'Routines with series scope', 'Brain Dump inbox'],
  },
  {
    category: 'Progress & Wellness',
    items: ['Habits with forgiving rest days & streaks', 'Goals & milestones', 'Workout session logger', 'Weight & CDC BMI with progressive disclosures', 'Hydration water tracker'],
  },
  {
    category: 'Money & Food',
    items: ['Budget & bills cash flow ledger', 'Savings pots', 'Debt payoff forecaster', 'Weekly meal planner', 'Aggregated grocery list with unit normalization'],
  },
  {
    category: 'Privacy & Safety',
    items: ['100% offline standalone HTML operation', 'Zero third-party tracking or remote telemetry', 'Transactional atomic localStorage saves with readback verification', 'Pre-restore backup safety snapshots & quarantine preservation'],
  },
] as const;
