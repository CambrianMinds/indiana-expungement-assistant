import { AppState } from './state.js';
import { $, $$ } from './utils.js';

// Tab Navigation
export function switchTab(tabName) {
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  $$('.tab-panel').forEach(p => p.classList.remove('active'));
  const btn = $(`[data-tab="${tabName}"]`);
  const panel = $(`#tab-${tabName}`);
  if (btn) btn.classList.add('active');
  if (panel) panel.classList.add('active');
}

// Bind click events on tab buttons
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

// Toast Notifications
export function showToast(message, type = 'info', duration = 4000) {
  const container = $('#toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  toast.addEventListener('click', () => toast.remove());
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Checklist Updates
export function updateChecklist() {
  const profileReady = Boolean(
    AppState.petitionerProfile?.fullName?.length > 0 &&
    (AppState.petitionerProfile?.streetAddress || AppState.petitionerProfile?.currentAddress)
  );
  const casesReady = Boolean(AppState.currentReport && AppState.currentReport.summary?.eligible > 0);
  const acksReady = Boolean(
    $('#ackOneShot')?.checked &&
    $('#ackAllCounties')?.checked &&
    $('#ackNotLawyer')?.checked &&
    $('#ackProSe')?.checked
  );

  setChecklistItem('checkProfile', profileReady);
  setChecklistItem('checkCases', casesReady);
  setChecklistItem('checkBackendReady', true); // In-browser engine active
  setChecklistItem('checkAcknowledgments', acksReady);

  // Enable generate button only when ALL checks pass including legal acknowledgments
  const generateBtn = $('#btnGenerate');
  if (generateBtn) {
    generateBtn.disabled = !(profileReady && casesReady && acksReady);
  }
}

export function setChecklistItem(id, ready) {
  const el = $(`#${id}`);
  if (!el) return;
  el.classList?.toggle('ready', ready);
  const icon = el.querySelector?.('.check-icon');
  if (icon) icon.textContent = ready ? '✓' : '○';
}
