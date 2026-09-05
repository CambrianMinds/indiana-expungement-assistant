import { AppState } from './state.js';
import { $, safeISOString } from './utils.js';
import { showToast, updateChecklist, switchTab } from './ui.js';
import { generateCompletePacket, generateAppearanceForm } from './pdf-generator.js';



  // ─── Engine Health & Readiness ──────────────────────────────────────
  export async function checkBackend(showFeedback = false) {
    const statusEl = $('#backendStatus');
    if (!statusEl) return true;
    const dot = statusEl.querySelector('.status-dot');
    const label = statusEl.querySelector('.status-label');

    AppState.backendOnline = true;
    if (dot) dot.className = 'status-dot online';
    if (label) label.textContent = 'Engine Ready';
    statusEl.title = 'In-Browser PDF Generator is active and ready (pdf-lib)';

    updateChecklist();

    if (showFeedback) {
      showToast('✓ In-Browser PDF Engine is active and ready', 'success', 3000);
    }

    return true;
  }


  export async function downloadPetition(blob, filename) {
    if (!chrome.downloads?.download) {
      throw new Error('Chrome downloads permission is unavailable.');
    }

    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url,
        filename,
        saveAs: true
      }, (downloadId) => {
        URL.revokeObjectURL(url);

        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(downloadId);
      });
    });
  }

  // Click on backend status pill to manually refresh / retry
  $('#backendStatus')?.addEventListener('click', () => {
    checkBackend(true);
  });
  $('#backendStatus')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      checkBackend(true);
    }
  });


  // ─── Generate Packet ───────────────────────────────────────────────

  // ─── Legal Notice & Confirmation Modals ────────────────────────────
  const legalModal = $('#legalNoticeModal');
  const confirmModal = $('#confirmModal');

  $('#btnLegalNotice')?.addEventListener('click', () => {
    if (legalModal) legalModal.style.display = 'flex';
  });

  $('#btnNoticeClose')?.addEventListener('click', () => {
    if (legalModal) legalModal.style.display = 'none';
  });

  $('#btnModalCancel')?.addEventListener('click', () => {
    if (confirmModal) confirmModal.style.display = 'none';
  });

  $('#btnModalConfirm')?.addEventListener('click', async () => {
    if (confirmModal) confirmModal.style.display = 'none';
    await executePacketGeneration();
  });

  // Acknowledgment Checkbox Listeners
  ['ackOneShot', 'ackAllCounties', 'ackNotLawyer', 'ackProSe'].forEach(id => {
    $(`#${id}`)?.addEventListener('change', () => {
      updateChecklist();
    });
  });


  // ─── Generate Packet Trigger ───────────────────────────────────────
  $('#btnGenerate').addEventListener('click', () => {
    if (!AppState.petitionerProfile?.fullName) {
      showToast('Please fill in the Petitioner Profile first', 'error');
      switchTab('profile');
      return;
    }
    if (!AppState.currentReport || AppState.currentReport.summary.eligible === 0) {
      showToast('No eligible cases found. Scan a MyCase page first.', 'error');
      switchTab('scan');
      return;
    }

    const acksReady = $('#ackOneShot')?.checked &&
                      $('#ackAllCounties')?.checked &&
                      $('#ackNotLawyer')?.checked &&
                      $('#ackProSe')?.checked;

    if (!acksReady) {
      showToast('You must acknowledge all mandatory legal notices and the one-shot rule before generating.', 'error', 5000);
      return;
    }

    // Populate the case list in the confirm modal so the user sees exactly what will be filed
    const caseListEl = $('#confirmCaseList');
    const caseCountEl = $('#confirmCaseCount');
    if (caseListEl && caseCountEl && AppState.currentCases.length > 0) {
      caseCountEl.textContent = AppState.currentCases.length;
      caseListEl.innerHTML = AppState.currentCases.map(c => {
        const num = c.case_number || 'UNKNOWN';
        const type = c.case_type || c.type || '';
        return `<div class="modal-case-item">
          <span class="modal-case-num">${num}</span>
          <span class="modal-case-type">${type}</span>
        </div>`;
      }).join('');
    }

    // Display the final confirmation modal to prevent accidental filing
    if (confirmModal) {
      confirmModal.style.display = 'flex';
    } else {
      executePacketGeneration();
    }
  });


  // ─── Execute Packet Generation (Backend Call) ──────────────────────
  async function executePacketGeneration() {
    const btn = $('#btnGenerate');
    const statusEl = $('#generateStatus');
    const statusText = $('#generateStatusText');

    btn.disabled = true;
    statusEl.style.display = 'flex';
    statusText.textContent = 'Preparing verified payload...';

    try {
      if (!AppState.petitionerProfile?.fullName) {
        throw new Error('Please fill in the Petitioner Profile first');
      }
      if (!AppState.currentReport || AppState.currentReport.summary.eligible === 0) {
        throw new Error('No eligible cases found. Scan a MyCase page first.');
      }

      // Determine target county (supports multi-county filing selection)
      const countySelectCard = $('#countySelectCard');
      const countySelectDropdown = $('#selectCountyPacket');
      const selectedCountyCode = (countySelectCard?.style.display !== 'none' && countySelectDropdown?.value)
        ? countySelectDropdown.value
        : null;

      let targetCounty = null;
      if (selectedCountyCode && AppState.currentReport.counties[selectedCountyCode]) {
        targetCounty = AppState.currentReport.counties[selectedCountyCode];
      } else {
        targetCounty = Object.values(AppState.currentReport.counties)[0];
      }

      // Build payload for the backend (filtered to targetCounty if multi-county)
      const eligibleCases = [];
      const casesToInclude = targetCounty ? targetCounty.cases : AppState.currentCases;

      for (const c of casesToInclude) {
        if (c.eligibility?.eligible) {
          eligibleCases.push({
            caseNumber: c.case_number,
            type: c.eligibility.typeCode,
            statute: c.eligibility.statute,
            charges: c.charges || c.case_type,
            filed: c.filed,
            dispositionDate: safeISOString(c.eligibility.dispositionDate)?.split('T')[0] || c.filed,
            court: c.court,
            grantType: c.eligibility.grantType
          });
        }
      }

      if (eligibleCases.length === 0) {
        throw new Error(`No eligible cases in ${targetCounty?.courtName || 'the selected county'}.`);
      }

      const payload = {
        petitioner: AppState.petitionerProfile,
        county: targetCounty?.courtName?.replace(/\s*(Superior|Circuit|Court)\s*/gi, '').trim() || 'Unknown',
        court: targetCounty?.courtName || 'Unknown Court',
        courtCode: targetCounty?.courtCode || 'XXXXX',
        cases: eligibleCases,
        includeFeeWaiver: $('#includeFeeWaiver')?.checked ?? true,
        includeAddressSupplement: $('#includeAddressSupplement')?.checked ?? true,
        acknowledgedOneShot: $('#ackOneShot')?.checked ?? true,
        acknowledgedNotLawyer: $('#ackNotLawyer')?.checked ?? true,
        acknowledgedAllCases: $('#ackAllCounties')?.checked ?? true,
        acknowledgedProSeLiability: $('#ackProSe')?.checked ?? true
      };

      statusText.textContent = 'Generating complete expungement packet (Forms 00–08)...';

      const pdfBytes = await generateCompletePacket(payload);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const countyName = (payload.county || 'expungement').replace(/\s+/g, '_');
      const petitionerLast = (payload.petitioner?.fullName || 'packet').split(/\s+/).pop();
      const filename = `${petitionerLast}_${countyName}_Expungement_Packet.pdf`;

      await downloadPetition(blob, filename);
      showToast(`Complete court packet generated: ${filename}`, 'success', 6000);
      statusText.textContent = `✓ Download started: ${filename}`;
    } catch (e) {
      showToast(e.message, 'error');
      statusText.textContent = `✗ ${e.message}`;
    } finally {
      btn.disabled = false;
      setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
    }
  }

