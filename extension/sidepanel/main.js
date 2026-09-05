import { AppState } from './state.js';
import { setupInputFormatting, loadProfile } from './profile.js';
import { checkBackend } from './generator.js';
import { checkPageStatus, updateBatchPanelUI, renderResults } from './scanner.js';
import { updateChecklist } from './ui.js';


export const SITE_GUIDE_URL = 'https://cambrianminds.github.io/indiana-expungement-assistant/#instructions';

// Auto-open site guide tab on first launch / first open of the extension
async function checkWelcomeGuide() {
  try {
    const data = await chrome?.storage?.local?.get('hasSeenWelcomeGuide');
    if (!data?.hasSeenWelcomeGuide) {
      await chrome?.storage?.local?.set({ hasSeenWelcomeGuide: true });
      chrome?.tabs?.create?.({ url: SITE_GUIDE_URL });
    }
  } catch (err) {
    console.debug('[Guide Auto-Open]', err);
  }
}

// Setup guide button click listeners
function setupGuideListeners() {
  const openGuide = () => {
    chrome?.tabs?.create?.({ url: SITE_GUIDE_URL });
  };
  document.getElementById('btnUserGuide')?.addEventListener('click', openGuide);
  document.getElementById('btnOpenGuideBanner')?.addEventListener('click', openGuide);
}

// ─── Initialization ────────────────────────────────────────────────
async function init() {
  // Bind guide actions and check first-open onboarding
  setupGuideListeners();
  await checkWelcomeGuide();

  // Load saved state & bind formatters
  setupInputFormatting();
  await loadProfile();
  await checkBackend();
  await checkPageStatus();

  // Load last scan results
  try {
    const lastScan = await chrome?.runtime?.sendMessage?.({ action: 'loadLastScan' });
    if (lastScan?.scan) {
      AppState.currentCases = lastScan.scan.cases || [];
      AppState.currentReport = lastScan.scan.report || null;
      AppState.searchBatches = lastScan.scan.searchBatches || [];
      updateBatchPanelUI();
      if (AppState.currentReport) {
        renderResults();
      }
    }
  } catch (_) {}

  updateChecklist();

  // Periodic checks: poll page status to detect when user navigates MyCase tabs
  setInterval(checkPageStatus, 5000);
}

init();


