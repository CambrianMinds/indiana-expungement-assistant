/**
 * Indiana Expungement Assistant - Sidepanel Controller
 * Manages tab navigation, case display, profile persistence,
 * and orchestrates the scan → review → generate workflow.
 */

(() => {
  'use strict';

  // ─── State ─────────────────────────────────────────────────────────
  let currentCases = [];
  let currentReport = null;
  let petitionerProfile = null;
  let backendOnline = false;

  // ─── DOM References ────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── Tab Navigation ────────────────────────────────────────────────
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`#tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  function switchTab(tabName) {
    $$('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    $(`#tab-${tabName}`).classList.add('active');
  }

  // ─── Toast Notifications ───────────────────────────────────────────
  function showToast(message, type = 'info', duration = 4000) {
    const container = $('#toastContainer');
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

  // ─── Page Status Check ─────────────────────────────────────────────
  async function checkPageStatus() {
    const statusDot = $('#pageStatusIndicator .status-dot');
    const statusText = $('#pageStatusText');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url?.includes('public.courts.in.gov/mycase')) {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Navigate to mycase.in.gov to begin';
        return false;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageStatus' });
      if (response?.isSearchResults) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'MyCase search results detected ✓';
        return true;
      } else if (response?.isCaseSummary) {
        statusDot.className = 'status-dot checking';
        statusText.textContent = 'On case summary page — go to search results';
        return false;
      } else {
        statusDot.className = 'status-dot checking';
        statusText.textContent = 'On MyCase — navigate to search results';
        return false;
      }
    } catch (e) {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Content script not loaded — refresh the MyCase page';
      return false;
    }
  }

  // ─── Backend Health Check ──────────────────────────────────────────
  async function checkBackend() {
    const statusEl = $('#backendStatus');
    const dot = statusEl.querySelector('.status-dot');
    dot.className = 'status-dot checking';

    try {
      const result = await chrome.runtime.sendMessage({ action: 'checkBackend' });
      backendOnline = result?.success || false;
      dot.className = `status-dot ${backendOnline ? 'online' : 'offline'}`;
      updateChecklist();
    } catch {
      backendOnline = false;
      dot.className = 'status-dot offline';
    }
  }

  // ─── Scan Action ───────────────────────────────────────────────────
  $('#btnScan').addEventListener('click', async () => {
    const btn = $('#btnScan');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> Scanning...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'analyzeEligibility' });

      if (response?.success) {
        currentCases = response.cases;
        currentReport = response.report;
        renderResults();
        showToast(`Found ${response.cases.length} cases`, 'success');

        // Save scan results
        chrome.runtime.sendMessage({
          action: 'saveScanResults',
          cases: currentCases,
          report: currentReport
        });

        // Enable deep scrape
        $('#btnDeepScrape').disabled = false;

        // Switch to results tab
        switchTab('results');
        updateChecklist();
      } else {
        throw new Error(response?.error || 'Scan failed');
      }
    } catch (e) {
      showToast(e.message, 'error');
      console.error('[Sidepanel] Scan error:', e);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        Scan Page & Check Eligibility
      `;
    }
  });

  // ─── Deep Scrape Action ────────────────────────────────────────────
  $('#btnDeepScrape').addEventListener('click', async () => {
    const btn = $('#btnDeepScrape');
    btn.disabled = true;

    const progress = $('#scanProgress');
    const progressFill = $('#progressFill');
    const progressText = $('#progressText');
    progress.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Starting deep scrape...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'deepScrape' });

      if (response?.success) {
        currentCases = response.cases;
        currentReport = response.report;
        renderResults();
        showToast('Deep scrape complete — CCS details enriched', 'success');
        progressFill.style.width = '100%';
        progressText.textContent = 'Complete!';

        chrome.runtime.sendMessage({
          action: 'saveScanResults',
          cases: currentCases,
          report: currentReport
        });
      } else {
        throw new Error(response?.error || 'Deep scrape failed');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      btn.disabled = false;
      setTimeout(() => { progress.style.display = 'none'; }, 2000);
    }
  });

  // ─── Deep Scrape Progress Listener ─────────────────────────────────
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'deepScrapeProgress') {
      const pct = Math.round((request.current / request.total) * 100);
      $('#progressFill').style.width = `${pct}%`;
      $('#progressText').textContent = `Fetching CCS ${request.current}/${request.total}: ${request.caseNum}`;
    }
  });

  // ─── Render Results ────────────────────────────────────────────────
  function renderResults() {
    if (!currentReport) return;

    $('#noResults').style.display = 'none';
    $('#resultsContent').style.display = 'block';

    const s = currentReport.summary;
    $('#summaryEligible').textContent = s.eligible;
    $('#summaryIneligible').textContent = s.ineligible;
    $('#summaryExcluded').textContent = s.excluded;
    $('#summaryFee').textContent = s.totalFilingFee ? `~$${s.totalFilingFee}` : '$0';

    // Update badge
    const badge = $('#resultsBadge');
    badge.style.display = 'inline-flex';
    badge.textContent = currentCases.length;

    // Statute breakdown
    const breakdownEl = $('#statuteBreakdown');
    breakdownEl.innerHTML = '';
    for (const [statute, count] of Object.entries(s.byStatute)) {
      const tag = document.createElement('span');
      tag.className = 'statute-tag';
      tag.innerHTML = `${escapeHtml(statute)} <span class="statute-tag-count">${count}</span>`;
      breakdownEl.appendChild(tag);
    }

    // Case list
    const listEl = $('#caseList');
    listEl.innerHTML = '';

    // Flatten all county cases
    const allCases = [];
    for (const county of Object.values(currentReport.counties)) {
      for (const c of county.cases) {
        allCases.push(c);
      }
    }

    // Sort: eligible first, then by case number
    allCases.sort((a, b) => {
      const aElig = a.eligibility?.eligible ? 0 : 1;
      const bElig = b.eligibility?.eligible ? 0 : 1;
      if (aElig !== bElig) return aElig - bElig;
      return (a.case_number || '').localeCompare(b.case_number || '');
    });

    for (const c of allCases) {
      listEl.appendChild(createCaseCard(c));
    }
  }

  function createCaseCard(caseData) {
    const el = caseData.eligibility;
    const card = document.createElement('div');
    card.className = 'case-card';

    // Badge
    let badgeClass = 'excluded';
    let badgeText = 'EXCLUDED';
    if (el) {
      if (el.eligible) {
        badgeClass = 'eligible';
        badgeText = 'ELIGIBLE';
      } else if (el.statute === 'N/A') {
        badgeClass = 'excluded';
        badgeText = 'CIVIL';
      } else if (el.isPending) {
        badgeClass = 'pending';
        badgeText = 'PENDING';
      } else {
        badgeClass = 'ineligible';
        badgeText = 'NOT ELIGIBLE';
      }
    }

    const chargesDisplay = caseData.charges || caseData.case_type || 'No charges listed';
    const typeCode = el?.typeCode || '';

    card.innerHTML = `
      <div class="case-card-header">
        <span class="case-number">${escapeHtml(caseData.case_number || '')}</span>
        <span class="case-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="case-charges">${escapeHtml(chargesDisplay)}</div>
      <div class="case-meta">
        <span>${escapeHtml(typeCode)}</span>
        <span>Filed: ${escapeHtml(caseData.filed || 'N/A')}</span>
        <span>${escapeHtml(caseData.court || '')}</span>
      </div>
      <div class="case-detail">
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">${escapeHtml(caseData.status || 'N/A')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Statute</span>
          <span class="detail-value statute">${escapeHtml(el?.statute || 'N/A')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Years Elapsed</span>
          <span class="detail-value">${el?.yearsElapsed ?? 'N/A'} years</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Waiting Period</span>
          <span class="detail-value">${el?.waitingPeriod ? `≥${el.waitingPeriod} years` : 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Grant Type</span>
          <span class="detail-value">${escapeHtml(el?.grantType || 'N/A')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Reason</span>
          <span class="detail-value">${escapeHtml(el?.reason || '')}</span>
        </div>
        ${el?.warnings?.length ? `
          <div class="case-warnings">
            ${el.warnings.map(w => `<span class="warning-tag">⚠ ${escapeHtml(w)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;

    card.addEventListener('click', () => card.classList.toggle('expanded'));
    return card;
  }

  // ─── Profile Form ──────────────────────────────────────────────────
  const profileForm = $('#profileForm');
  const addressContainer = $('#addressHistory');

  // Load saved profile
  async function loadProfile() {
    const result = await chrome.runtime.sendMessage({ action: 'loadPetitionerProfile' });
    if (result?.profile) {
      petitionerProfile = result.profile;
      fillProfileForm(result.profile);
    } else {
      addAddressEntry(); // Start with one empty entry
    }
    updateChecklist();
  }

  function fillProfileForm(profile) {
    if (profile.fullName) $('#fullName').value = profile.fullName;
    if (profile.dob) $('#dob').value = profile.dob;
    if (profile.ssn) $('#ssn').value = profile.ssn;
    if (profile.driverLicense) $('#driverLicense').value = profile.driverLicense;
    if (profile.currentAddress) $('#currentAddress').value = profile.currentAddress;
    if (profile.phone) $('#phone').value = profile.phone;
    if (profile.email) $('#email').value = profile.email;

    // Addresses
    addressContainer.innerHTML = '';
    if (profile.addresses && profile.addresses.length > 0) {
      profile.addresses.forEach(addr => addAddressEntry(addr));
    } else {
      addAddressEntry();
    }
  }

  function addAddressEntry(value = '') {
    const entry = document.createElement('div');
    entry.className = 'address-entry';
    entry.innerHTML = `
      <input type="text" placeholder="e.g. 123 Main St, Huntington, IN 46750 (1994-2000)" value="${escapeHtml(value)}">
      <button type="button" class="btn-remove" title="Remove">&times;</button>
    `;
    entry.querySelector('.btn-remove').addEventListener('click', () => {
      entry.remove();
    });
    addressContainer.appendChild(entry);
  }

  $('#btnAddAddress').addEventListener('click', () => addAddressEntry());

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const addresses = Array.from(addressContainer.querySelectorAll('input'))
      .map(input => input.value.trim())
      .filter(v => v.length > 0);

    petitionerProfile = {
      fullName: $('#fullName').value.trim(),
      dob: $('#dob').value,
      ssn: $('#ssn').value.trim(),
      driverLicense: $('#driverLicense').value.trim(),
      currentAddress: $('#currentAddress').value.trim(),
      phone: $('#phone').value.trim(),
      email: $('#email').value.trim(),
      addresses
    };

    await chrome.runtime.sendMessage({ action: 'savePetitionerProfile', profile: petitionerProfile });
    showToast('Profile saved securely to local storage', 'success');
    updateChecklist();
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
    if (!petitionerProfile?.fullName) {
      showToast('Please fill in the Petitioner Profile first', 'error');
      switchTab('profile');
      return;
    }
    if (!currentReport || currentReport.summary.eligible === 0) {
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
      if (!petitionerProfile?.fullName) {
        throw new Error('Please fill in the Petitioner Profile first');
      }
      if (!currentReport || currentReport.summary.eligible === 0) {
        throw new Error('No eligible cases found. Scan a MyCase page first.');
      }

      // Build payload for the backend
      const eligibleCases = [];
      for (const county of Object.values(currentReport.counties)) {
        for (const c of county.cases) {
          if (c.eligibility?.eligible) {
            eligibleCases.push({
              caseNumber: c.case_number,
              type: c.eligibility.typeCode,
              statute: c.eligibility.statute,
              charges: c.charges || c.case_type,
              filed: c.filed,
              dispositionDate: c.eligibility.dispositionDate?.toISOString()?.split('T')[0] || c.filed,
              court: c.court,
              grantType: c.eligibility.grantType
            });
          }
        }
      }

      // Determine primary county
      const primaryCounty = Object.values(currentReport.counties)[0];

      const payload = {
        petitioner: petitionerProfile,
        county: primaryCounty?.courtName?.replace(/\s*(Superior|Circuit|Court)\s*/gi, '').trim() || 'Unknown',
        court: primaryCounty?.courtName || 'Unknown Court',
        courtCode: primaryCounty?.courtCode || 'XXXXX',
        cases: eligibleCases,
        includeFeeWaiver: $('#includeFeeWaiver')?.checked ?? true,
        includeAddressSupplement: $('#includeAddressSupplement')?.checked ?? true,
        acknowledgedOneShot: $('#ackOneShot')?.checked ?? true,
        acknowledgedNotLawyer: $('#ackNotLawyer')?.checked ?? true,
        acknowledgedAllCases: $('#ackAllCounties')?.checked ?? true,
        acknowledgedProSeLiability: $('#ackProSe')?.checked ?? true
      };

      statusText.textContent = 'Generating court documents & warnings...';

      const result = await chrome.runtime.sendMessage({
        action: 'generatePacket',
        payload
      });

      if (result?.success) {
        showToast(`Packet generated: ${result.filename}`, 'success', 6000);
        statusText.textContent = `✓ Download started: ${result.filename}`;
      } else {
        throw new Error(result?.error || 'Generation failed');
      }
    } catch (e) {
      showToast(e.message, 'error');
      statusText.textContent = `✗ ${e.message}`;
    } finally {
      btn.disabled = false;
      setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
    }
  }

  // ─── Checklist Updates ─────────────────────────────────────────────
  function updateChecklist() {
    const profileReady = Boolean(petitionerProfile?.fullName?.length > 0);
    const casesReady = Boolean(currentReport && currentReport.summary.eligible > 0);
    const acksReady = Boolean(
      $('#ackOneShot')?.checked &&
      $('#ackAllCounties')?.checked &&
      $('#ackNotLawyer')?.checked &&
      $('#ackProSe')?.checked
    );

    setChecklistItem('checkProfile', profileReady);
    setChecklistItem('checkCases', casesReady);
    setChecklistItem('checkBackendReady', backendOnline);
    setChecklistItem('checkAcknowledgments', acksReady);

    // Enable generate button only when ALL checks pass including legal acknowledgments
    $('#btnGenerate').disabled = !(profileReady && casesReady && backendOnline && acksReady);
  }

  function setChecklistItem(id, ready) {
    const el = $(`#${id}`);
    if (!el) return;
    el.classList.toggle('ready', ready);
    const icon = el.querySelector('.check-icon');
    if (icon) icon.textContent = ready ? '✓' : '○';
  }

  // ─── Utilities ─────────────────────────────────────────────────────
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── Initialization ────────────────────────────────────────────────
  async function init() {
    // Load saved state
    await loadProfile();
    await checkBackend();
    await checkPageStatus();

    // Load last scan results
    const lastScan = await chrome.runtime.sendMessage({ action: 'loadLastScan' });
    if (lastScan?.scan) {
      currentCases = lastScan.scan.cases || [];
      currentReport = lastScan.scan.report || null;
      if (currentReport) {
        renderResults();
      }
    }

    updateChecklist();

    // Periodic checks
    setInterval(checkPageStatus, 5000);
    setInterval(checkBackend, 15000);
  }

  init();

})();
