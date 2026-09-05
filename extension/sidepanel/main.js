import { AppState } from './state.js';
import { setupInputFormatting, loadProfile } from './profile.js';
import { checkBackend } from './generator.js';
import { checkPageStatus, updateBatchPanelUI, renderResults } from './scanner.js';
import { updateChecklist } from './ui.js';


  // ─── Initialization ────────────────────────────────────────────────
  async function init() {
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


