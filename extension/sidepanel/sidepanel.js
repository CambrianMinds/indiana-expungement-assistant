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
  async function checkBackend(showFeedback = false) {
    const statusEl = $('#backendStatus');
    const dot = statusEl.querySelector('.status-dot');
    const label = statusEl.querySelector('.status-label');
    dot.className = 'status-dot checking';
    if (label) label.textContent = 'Checking...';

    let online = false;
    let details = null;

    // 1. Try checking via background service worker
    try {
      const bgResult = await chrome.runtime.sendMessage({ action: 'checkBackend' });
      if (bgResult?.success) {
        online = true;
        details = bgResult.status;
      }
    } catch (_) {
      // Service worker may be idle or transitioning
    }

    // 2. Direct fetch fallback from sidepanel (uses host_permissions for localhost)
    if (!online) {
      for (const host of ['http://127.0.0.1:8000', 'http://localhost:8000']) {
        try {
          const res = await fetch(`${host}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(1800)
          });
          if (res.ok) {
            online = true;
            details = await res.json();
            break;
          }
        } catch (_) {}
      }
    }

    backendOnline = online;
    dot.className = `status-dot ${backendOnline ? 'online' : 'offline'}`;
    if (label) {
      label.textContent = backendOnline ? 'Backend Online' : 'Backend Offline';
    }
    statusEl.title = backendOnline
      ? 'Local Form Engine is running and ready (http://127.0.0.1:8000)'
      : 'Form Engine offline. Click to retry or launch: python backend/app.py';

    updateChecklist();

    if (showFeedback) {
      if (backendOnline) {
        showToast('✓ Form Engine detected at http://127.0.0.1:8000', 'success', 3000);
      } else {
        showToast('Backend offline. Run: python backend/app.py', 'error', 4000);
      }
    }

    return backendOnline;
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
  if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'deepScrapeProgress') {
        const pct = Math.round((request.current / request.total) * 100);
        $('#progressFill').style.width = `${pct}%`;
        $('#progressText').textContent = `Fetching CCS ${request.current}/${request.total}: ${request.caseNum}`;
      }
    });
  }

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
    try {
      const result = await chrome?.runtime?.sendMessage?.({ action: 'loadPetitionerProfile' });
      if (result?.profile) {
        petitionerProfile = result.profile;
        fillProfileForm(result.profile);
      } else {
        addAddressEntry(); // Start with one empty entry
      }
    } catch (_) {
      addAddressEntry();
    }
    updateChecklist();
  }

  // ─── Input Formatting & Validation Helpers ─────────────────────────
  function formatSSN(val) {
    const digits = val.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  function formatDL(val) {
    const clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
    if (clean.length <= 4) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6)}`;
  }

  function formatPhone(val) {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function formatZIP(val) {
    const digits = val.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  function setFieldError(fieldId, errorMsg) {
    const input = $(`#${fieldId}`);
    const errSpan = $(`#err-${fieldId}`);
    if (input) {
      input.classList.remove('is-valid');
      input.classList.add('is-invalid');
    }
    if (errSpan) {
      errSpan.textContent = errorMsg;
      errSpan.classList.add('active');
    }
  }

  function clearFieldError(fieldId) {
    const input = $(`#${fieldId}`);
    const errSpan = $(`#err-${fieldId}`);
    if (input) {
      input.classList.remove('is-invalid');
      if (input.value.trim().length > 0) {
        input.classList.add('is-valid');
      } else {
        input.classList.remove('is-valid');
      }
    }
    if (errSpan) {
      errSpan.textContent = '';
      errSpan.classList.remove('active');
    }
  }

  // Set up real-time mask formatters and toggle buttons
  function setupInputFormatting() {
    const ssnInput = $('#ssn');
    const dlInput = $('#driverLicense');
    const phoneInput = $('#phone');
    const dobInput = $('#dob');
    const zipInput = $('#zipCode');
    const toggleSSN = $('#btnToggleSSN');

    // DOB age constraint (at least 18 years old)
    if (dobInput) {
      const today = new Date();
      const maxYear = today.getFullYear() - 18;
      const maxMonth = String(today.getMonth() + 1).padStart(2, '0');
      const maxDay = String(today.getDate()).padStart(2, '0');
      dobInput.max = `${maxYear}-${maxMonth}-${maxDay}`;
      dobInput.min = '1900-01-01';

      dobInput.addEventListener('change', () => {
        validateField('dob');
      });
    }

    // SSN format as user types
    if (ssnInput) {
      ssnInput.addEventListener('input', (e) => {
        e.target.value = formatSSN(e.target.value);
        clearFieldError('ssn');
      });
      ssnInput.addEventListener('blur', () => validateField('ssn'));
    }

    // Toggle SSN visibility
    if (toggleSSN && ssnInput) {
      toggleSSN.addEventListener('click', () => {
        const isPass = ssnInput.type === 'password';
        ssnInput.type = isPass ? 'text' : 'password';
        toggleSSN.textContent = isPass ? '🔒' : '👁';
      });
    }

    // DL format as user types
    if (dlInput) {
      dlInput.addEventListener('input', (e) => {
        e.target.value = formatDL(e.target.value);
        clearFieldError('driverLicense');
      });
      dlInput.addEventListener('blur', () => validateField('driverLicense'));
    }

    // ZIP format as user types
    if (zipInput) {
      zipInput.addEventListener('input', (e) => {
        e.target.value = formatZIP(e.target.value);
        clearFieldError('zipCode');
      });
      zipInput.addEventListener('blur', () => validateField('zipCode'));
    }

    // Phone format as user types
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        e.target.value = formatPhone(e.target.value);
        clearFieldError('phone');
      });
      phoneInput.addEventListener('blur', () => validateField('phone'));
    }

    // Full name, street address, city, state, email live checks
    $('#fullName')?.addEventListener('blur', () => validateField('fullName'));
    $('#streetAddress')?.addEventListener('blur', () => validateField('streetAddress'));
    $('#city')?.addEventListener('blur', () => validateField('city'));
    $('#state')?.addEventListener('change', () => validateField('state'));
    $('#email')?.addEventListener('blur', () => validateField('email'));
  }

  function validateField(fieldId) {
    const input = $(`#${fieldId}`);
    if (!input) return true;
    const val = input.value.trim();

    if (fieldId === 'fullName') {
      if (!val) {
        setFieldError('fullName', 'Full legal name is required');
        return false;
      }
      const words = val.split(/\s+/).filter(Boolean);
      if (words.length < 2) {
        setFieldError('fullName', 'Please enter full first and last name');
        return false;
      }
      if (!/^[A-Za-z\s.'-]+$/.test(val)) {
        setFieldError('fullName', 'Name contains invalid characters');
        return false;
      }
      clearFieldError('fullName');
      return true;
    }

    if (fieldId === 'dob') {
      if (!val) {
        setFieldError('dob', 'Date of birth is required');
        return false;
      }
      const d = new Date(val + 'T00:00:00');
      if (isNaN(d.getTime())) {
        setFieldError('dob', 'Invalid date format');
        return false;
      }
      const today = new Date();
      if (d > today) {
        setFieldError('dob', 'DOB cannot be in the future');
        return false;
      }
      const ageYears = (today - d) / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears < 18) {
        setFieldError('dob', 'Petitioner must be at least 18 years old');
        return false;
      }
      if (ageYears > 120) {
        setFieldError('dob', 'Please enter a valid birth year');
        return false;
      }
      clearFieldError('dob');
      return true;
    }

    if (fieldId === 'ssn') {
      if (!val) {
        setFieldError('ssn', 'SSN is required for the confidential ACR form');
        return false;
      }
      if (!/^\d{3}-\d{2}-\d{4}$/.test(val)) {
        setFieldError('ssn', 'Must be a 9-digit SSN (XXX-XX-XXXX)');
        return false;
      }
      if (val === '000-00-0000') {
        setFieldError('ssn', 'Invalid SSN');
        return false;
      }
      clearFieldError('ssn');
      return true;
    }

    if (fieldId === 'driverLicense') {
      if (!val) {
        clearFieldError('driverLicense');
        return true; // Optional on some pleadings
      }
      // Indiana DL: 10 digits formatted as XXXX-XX-XXXX or 9-10 alphanumeric
      const clean = val.replace(/[^A-Za-z0-9]/g, '');
      if (clean.length < 9 || clean.length > 10) {
        setFieldError('driverLicense', 'Indiana DL must be 9–10 digits (XXXX-XX-XXXX)');
        return false;
      }
      clearFieldError('driverLicense');
      return true;
    }

    if (fieldId === 'streetAddress') {
      if (!val) {
        setFieldError('streetAddress', 'Street address is required');
        return false;
      }
      if (val.length < 4) {
        setFieldError('streetAddress', 'Please enter a valid street address');
        return false;
      }
      clearFieldError('streetAddress');
      return true;
    }

    if (fieldId === 'city') {
      if (!val) {
        setFieldError('city', 'City is required');
        return false;
      }
      if (!/^[A-Za-z\s.'-]+$/.test(val)) {
        setFieldError('city', 'City contains invalid characters');
        return false;
      }
      clearFieldError('city');
      return true;
    }

    if (fieldId === 'state') {
      if (!val) {
        setFieldError('state', 'State is required');
        return false;
      }
      clearFieldError('state');
      return true;
    }

    if (fieldId === 'zipCode') {
      if (!val) {
        setFieldError('zipCode', 'ZIP code is required');
        return false;
      }
      const clean = val.replace(/\D/g, '');
      if (clean.length !== 5 && clean.length !== 9) {
        setFieldError('zipCode', 'Must be 5 or 9 digits (XXXXX or XXXXX-XXXX)');
        return false;
      }
      clearFieldError('zipCode');
      return true;
    }

    if (fieldId === 'phone') {
      if (!val) {
        clearFieldError('phone');
        return true; // Optional
      }
      if (!/^\(\d{3}\)\s\d{3}-\d{4}$/.test(val)) {
        setFieldError('phone', 'Must be a complete 10-digit number: (XXX) XXX-XXXX');
        return false;
      }
      clearFieldError('phone');
      return true;
    }

    if (fieldId === 'email') {
      if (!val) {
        clearFieldError('email');
        return true; // Optional
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        setFieldError('email', 'Please enter a valid email address');
        return false;
      }
      clearFieldError('email');
      return true;
    }

    return true;
  }

  function fillProfileForm(profile) {
    if (profile.fullName) $('#fullName').value = profile.fullName;
    if (profile.dob) $('#dob').value = profile.dob;
    if (profile.ssn) $('#ssn').value = formatSSN(profile.ssn);
    if (profile.driverLicense) $('#driverLicense').value = formatDL(profile.driverLicense);
    if (profile.streetAddress) $('#streetAddress').value = profile.streetAddress;
    if (profile.city) $('#city').value = profile.city;
    if (profile.state) $('#state').value = profile.state;
    if (profile.zipCode) $('#zipCode').value = formatZIP(profile.zipCode);

    // Fallback if legacy profile only had single currentAddress
    if (!profile.streetAddress && profile.currentAddress) {
      const match = profile.currentAddress.match(/^([^,]+),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (match) {
        $('#streetAddress').value = match[1].trim();
        $('#city').value = match[2].trim();
        $('#state').value = match[3].toUpperCase().trim();
        $('#zipCode').value = match[4].trim();
      } else {
        $('#streetAddress').value = profile.currentAddress;
      }
    }

    if (profile.phone) $('#phone').value = formatPhone(profile.phone);
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
      <input type="text" placeholder="e.g. 100 N Senate Ave, Indianapolis, IN 46204 (2015-2020)" value="${escapeHtml(value)}">
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

    // Enforce validation on all fields
    const fieldsToValidate = [
      'fullName', 'dob', 'ssn', 'driverLicense',
      'streetAddress', 'city', 'state', 'zipCode',
      'phone', 'email'
    ];
    let firstInvalid = null;
    let hasError = false;

    for (const f of fieldsToValidate) {
      const isValid = validateField(f);
      if (!isValid) {
        hasError = true;
        if (!firstInvalid) firstInvalid = $(`#${f}`);
      }
    }

    if (hasError) {
      showToast('Please correct the highlighted form errors', 'error', 4000);
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const street = $('#streetAddress').value.trim();
    const city = $('#city').value.trim();
    const state = $('#state').value.trim();
    const zip = $('#zipCode').value.trim();
    const fullAddress = `${street}, ${city}, ${state} ${zip}`;

    const addresses = Array.from(addressContainer.querySelectorAll('input'))
      .map(input => input.value.trim())
      .filter(v => v.length > 0);

    petitionerProfile = {
      fullName: $('#fullName').value.trim(),
      dob: $('#dob').value,
      ssn: $('#ssn').value.trim(),
      driverLicense: $('#driverLicense').value.trim(),
      streetAddress: street,
      city: city,
      state: state,
      zipCode: zip,
      currentAddress: fullAddress,
      phone: $('#phone').value.trim(),
      email: $('#email').value.trim(),
      addresses
    };

    try {
      await chrome?.runtime?.sendMessage?.({ action: 'savePetitionerProfile', profile: petitionerProfile });
    } catch (_) {}

    showToast('✓ Profile validated & saved to secure local storage', 'success', 3500);
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
    const profileReady = Boolean(
      petitionerProfile?.fullName?.length > 0 &&
      (petitionerProfile?.streetAddress || petitionerProfile?.currentAddress)
    );
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
    // Load saved state & bind formatters
    setupInputFormatting();
    await loadProfile();
    await checkBackend();
    await checkPageStatus();

    // Load last scan results
    try {
      const lastScan = await chrome?.runtime?.sendMessage?.({ action: 'loadLastScan' });
      if (lastScan?.scan) {
        currentCases = lastScan.scan.cases || [];
        currentReport = lastScan.scan.report || null;
        if (currentReport) {
          renderResults();
        }
      }
    } catch (_) {}

    updateChecklist();

    // Periodic checks: poll rapidly (every 4s) when offline so newly launched backend is caught instantly
    setInterval(checkPageStatus, 5000);
    setInterval(() => {
      // If offline, check frequently to catch when user runs python backend/app.py
      checkBackend(false);
    }, backendOnline ? 12000 : 4000);
  }

  init();

})();
