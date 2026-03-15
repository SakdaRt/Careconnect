/**
 * Z-Index Layering Scheme — CareConnect
 *
 * Central reference for z-index values used across the application.
 * Components MUST use these constants or Tailwind classes that match this scale.
 *
 * Layer hierarchy (lowest → highest):
 *
 *  10  Base elevated content (cards, dropdowns within flow)
 *  20  (reserved)
 *  30  Page-level sticky elements (section headers, inline toolbars)
 *  40  App navigation (BottomBar, TopBar dropdown backdrop, page-level sticky nav)
 *  50  Global chrome (TopBar header, AdminLayout sidebar, Modals, Loading overlays)
 *  60  Blocking overlays (unsaved-changes blocker, critical confirmations)
 * 100  Accessibility (skip-navigation link)
 *
 * Rules:
 * - Page-level sticky actions (wizard nav, form submit bars) → z-40
 * - BottomBar and TopBar backdrops → z-40
 * - TopBar, Modals, full-screen overlays → z-50
 * - Only critical blocking UI (blocker modals) → z-60
 * - Never use z-index > 60 except accessibility skip-nav
 * - If a page sets showBottomBar={false}, its own sticky nav replaces BottomBar at z-40
 */

export const Z_INDEX = {
  BASE_ELEVATED: 10,
  PAGE_STICKY: 30,
  APP_NAV: 40,
  GLOBAL_CHROME: 50,
  BLOCKER: 60,
  ACCESSIBILITY: 100,
} as const;
