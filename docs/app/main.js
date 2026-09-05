import { AppState } from './state.js';
import { setupInputFormatting, loadProfile } from './profile.js';
import { checkBackend } from './generator.js';
import { updateBatchPanelUI, renderResults } from './scanner.js';
import { updateChecklist } from './ui.js';

export const SITE_GUIDE_URL = 'https://cambrianminds.github.io/indiana-expungement-assistant/#instructions';

// Setup guide button click listeners
function setupGuideListeners() {
  const openGuide = () => {
    window.open(SITE_GUIDE_URL, '_blank', 'noopener,noreferrer');
  };
  document.getElementById('btnUserGuide')?.addEventListener('click', openGuide);
  document.getElementById('btnOpenGuideBanner')?.addEventListener('click', openGuide);
}

// ─── Initialization ────────────────────────────────────────────────
async function init() {
  // Bind guide actions
  setupGuideListeners();

  // Load saved state & bind formatters
  setupInputFormatting();
  await loadProfile();
  await checkBackend();

  // Load last imported/scan results from localStorage
  try {
    let lastScan = null;
    const stored = localStorage.getItem('lastScanResults');
    if (stored) {
      lastScan = { scan: JSON.parse(stored) };
    }
    if (lastScan?.scan) {
      AppState.currentCases = lastScan.scan.cases || [];
      AppState.currentReport = lastScan.scan.report || null;
      AppState.searchBatches = lastScan.scan.searchBatches || [];
      updateBatchPanelUI();
      if (AppState.currentReport) {
        renderResults();
      }
    }
  } catch (err) {
    console.debug('[Storage Init]', err);
  }

  updateChecklist();
}

init();
