import { AppState } from './state.js';
import { $, $$, escapeHtml } from './utils.js';
import { showToast, updateChecklist, switchTab } from './ui.js';

// URL detection helper for Indiana MyCase
export function isMyCaseUrl(url) {
  if (!url) return false;
  return url.includes('courts.in.gov/mycase') || url.includes('mycase.in.gov');
}

// ─── Scraper Parity & Import Confirmation Modal ─────────────────────
/**
 * Show the parity confirmation modal after importing files/data.
 * Displays the extracted cases and asks the user to verify before merging.
 */
export function showParityModal(cases, searchContext, mergeMode) {
  AppState.pendingScanResult = { cases, searchContext, mergeMode };

  const countEl = $('#parityCaseCount');
  const listEl = $('#parityCaseList');

  if (countEl) countEl.textContent = cases.length;

  if (listEl) {
    listEl.innerHTML = '';
    if (cases.length === 0) {
      listEl.innerHTML = '<em style="font-size:0.75rem;color:var(--text-muted)">No cases found in this upload.</em>';
    } else {
      cases.slice(0, 30).forEach(c => {
        const item = document.createElement('div');
        item.className = 'modal-case-item';
        item.innerHTML = `
          <span class="modal-case-num">${escapeHtml(c.case_number || 'Unknown')}</span>
          <span class="modal-case-type">${escapeHtml(c.charges || c.case_type || '')}</span>
        `;
        listEl.appendChild(item);
      });
      if (cases.length > 30) {
        const overflow = document.createElement('div');
        overflow.style.fontSize = '0.72rem';
        overflow.style.color = 'var(--text-muted)';
        overflow.style.marginTop = '6px';
        overflow.textContent = `…and ${cases.length - 30} more case${cases.length - 30 === 1 ? '' : 's'}`;
        listEl.appendChild(overflow);
      }
    }
  }

  const modal = $('#parityModal');
  if (modal) modal.style.display = 'flex';
}

$('#btnParityRetry')?.addEventListener('click', () => {
  const modal = $('#parityModal');
  if (modal) modal.style.display = 'none';
  AppState.pendingScanResult = null;
  showToast('Import cancelled. You can select or drop other files.', 'info', 3000);
});

$('#btnParityConfirm')?.addEventListener('click', () => {
  const modal = $('#parityModal');
  if (modal) modal.style.display = 'none';

  if (!AppState.pendingScanResult) return;
  const { cases: incomingCases, searchContext, mergeMode } = AppState.pendingScanResult;
  AppState.pendingScanResult = null;

  if (!incomingCases || incomingCases.length === 0) return;

  applyImportedCases(incomingCases, searchContext, mergeMode);
});

/**
 * Apply imported cases to AppState with de-duplication and batch merging.
 */
export function applyImportedCases(incomingCases, searchContext = 'MyCase Import', mergeMode = true) {
  if (!incomingCases || incomingCases.length === 0) return;

  if (mergeMode && AppState.currentCases.length > 0) {
    const existingMap = new Map();
    AppState.currentCases.forEach(c => {
      const k = (c.case_number || '').trim().toUpperCase();
      if (k) existingMap.set(k, c);
    });

    let newAdded = 0;
    let overlapped = 0;

    incomingCases.forEach(ic => {
      const k = (ic.case_number || '').trim().toUpperCase();
      if (!k) return;

      if (existingMap.has(k)) {
        const existing = existingMap.get(k);
        if (!existing.searchQueries) {
          existing.searchQueries = existing.searchContext ? [existing.searchContext] : [];
        }
        if (searchContext && !existing.searchQueries.includes(searchContext)) {
          existing.searchQueries.push(searchContext);
        }
        if (!existing.charges && ic.charges) existing.charges = ic.charges;
        if (!existing.court && ic.court) existing.court = ic.court;
        if (!existing.status && ic.status) existing.status = ic.status;
        if (ic.caseToken && !existing.caseToken) existing.caseToken = ic.caseToken;
        overlapped++;
      } else {
        ic.searchQueries = [searchContext];
        AppState.currentCases.push(ic);
        existingMap.set(k, ic);
        newAdded++;
      }
    });

    AppState.searchBatches.push({
      query: searchContext,
      count: incomingCases.length,
      timestamp: Date.now()
    });

    if (window.IndianaExpungement?.analyzeAll) {
      AppState.currentReport = window.IndianaExpungement.analyzeAll(AppState.currentCases);
    }

    showToast(
      newAdded > 0
        ? `✓ Merged ${newAdded} new cases (${overlapped} already in batch). Total: ${AppState.currentCases.length} cases.`
        : `✓ All ${overlapped} cases were already in batch. Total: ${AppState.currentCases.length} cases.`,
      'success',
      4500
    );
  } else {
    AppState.currentCases = incomingCases;
    AppState.currentCases.forEach(c => {
      c.searchQueries = [searchContext];
    });
    AppState.searchBatches = [{
      query: searchContext,
      count: incomingCases.length,
      timestamp: Date.now()
    }];
    AppState.currentReport = window.IndianaExpungement?.analyzeAll
      ? window.IndianaExpungement.analyzeAll(AppState.currentCases)
      : null;

    showToast(`✓ Successfully imported ${incomingCases.length} case records.`, 'success', 4000);
  }

  checkAndSuggestAlias(searchContext);
  updateBatchPanelUI();
  renderResults();
  persistScanResults();
  switchTab('results');
  updateChecklist();
}

export function persistScanResults() {
  try {
    localStorage.setItem('lastScanResults', JSON.stringify({
      cases: AppState.currentCases,
      report: AppState.currentReport,
      searchBatches: AppState.searchBatches
    }));
  } catch (_) {}
}

// ─── Multi-Search Batch & UI State ─────────────────────────────────
export function updateBatchPanelUI() {
  const batchPanel = $('#batchPanel');
  const badge = $('#batchBadge');
  const pagesCount = $('#batchPagesCount');
  const tagsContainer = $('#batchSearchTags');
  const resultsCountPill = $('#resultsCountPill');
  const resultsSearchesPill = $('#resultsSearchesPill');

  const totalCases = AppState.currentCases.length;
  const totalSearches = AppState.searchBatches.length;

  if (totalCases > 0 || totalSearches > 0) {
    if (batchPanel) batchPanel.style.display = 'block';
    if (badge) badge.textContent = `${totalCases} Cases Accumulated`;
    if (pagesCount) {
      pagesCount.textContent = totalSearches > 0
        ? `(across ${totalSearches} source file${totalSearches === 1 ? '' : 's'})`
        : '';
    }

    if (tagsContainer) {
      tagsContainer.innerHTML = '';
      AppState.searchBatches.forEach(b => {
        const tag = document.createElement('span');
        tag.className = 'batch-tag';
        tag.innerHTML = `📄 ${escapeHtml(b.query)} <span class="batch-tag-count">${b.count}</span>`;
        tagsContainer.appendChild(tag);
      });
    }
  } else {
    if (batchPanel) batchPanel.style.display = 'none';
    if (tagsContainer) tagsContainer.innerHTML = '';
  }

  if (resultsCountPill) {
    resultsCountPill.textContent = `${totalCases} Cases`;
  }
  if (resultsSearchesPill) {
    resultsSearchesPill.textContent = totalSearches > 0
      ? `from ${totalSearches} import source${totalSearches === 1 ? '' : 's'}`
      : '';
  }
}

// Clear all accumulated records
$('#btnClearScans')?.addEventListener('click', () => {
  if (AppState.currentCases.length > 0 && !confirm('Clear all accumulated cases and imported searches to start fresh?')) {
    return;
  }
  AppState.currentCases = [];
  AppState.currentReport = null;
  AppState.searchBatches = [];

  persistScanResults();

  updateBatchPanelUI();
  const rc = $('#resultsContent');
  if (rc) rc.style.display = 'none';
  const nr = $('#noResults');
  if (nr) nr.style.display = 'block';
  const rb = $('#resultsBadge');
  if (rb) rb.style.display = 'none';
  updateChecklist();
  showToast('Accumulated cases cleared. You can upload fresh MyCase files.', 'info', 3500);
});

// Jump from Results back to Import
$('#btnScanAnotherPage')?.addEventListener('click', () => {
  switchTab('scan');
  showToast('💡 Upload HTML or JSON files for other maiden names, married names, or counties.', 'info', 4000);
});

// Auto-suggest aliases from search queries / file names (IC § 35-38-9-8(b)(1))
function checkAndSuggestAlias(query) {
  if (!query || query === 'MyCase Search' || query === 'MyCase Import' || query.length < 3) return;
  const aliasesInput = $('#aliases');
  const currentAliases = (aliasesInput?.value || AppState.petitionerProfile?.aliases || '').trim();
  const fullName = ($('#fullName')?.value || AppState.petitionerProfile?.fullName || '').trim().toLowerCase();

  const cleanQuery = query.replace(/\.(html?|json)$/i, '').replace(/[^\w\s,'-]/g, '').trim();
  if (!cleanQuery || /^(case|search|mycase|export|data)/i.test(cleanQuery)) return;

  let naturalName = cleanQuery;
  if (cleanQuery.includes(',')) {
    const parts = cleanQuery.split(',').map(s => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      naturalName = `${parts[1]} ${parts[0]}`;
    }
  }

  const normNat = naturalName.toLowerCase();
  if (fullName && !fullName.includes(normNat) && !normNat.includes(fullName)) {
    if (!currentAliases.toLowerCase().includes(normNat)) {
      if (aliasesInput && !aliasesInput.value.trim()) {
        aliasesInput.value = naturalName;
        showToast(`💡 Suggested "${naturalName}" for Petitioner Aliases (IC § 35-38-9-8(b)(1))`, 'info', 5000);
      } else if (aliasesInput && !aliasesInput.value.includes(naturalName)) {
        aliasesInput.value = `${aliasesInput.value}, ${naturalName}`;
        showToast(`💡 Added "${naturalName}" to Petitioner Aliases`, 'info', 5000);
      }
    }
  }
}

// ─── HTML & JSON Parsing Logic ─────────────────────────────────────
export function parseFileContent(text, filename = 'MyCase File') {
  const isJson = filename.endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[');

  if (isJson) {
    const parsed = JSON.parse(text);
    let cases = [];
    let searchContext = filename;

    if (Array.isArray(parsed)) {
      cases = parsed;
    } else if (parsed && Array.isArray(parsed.cases)) {
      cases = parsed.cases;
      searchContext = parsed.searchContext || filename;
    } else if (parsed && Array.isArray(parsed.currentCases)) {
      cases = parsed.currentCases;
      searchContext = parsed.searchContext || filename;
    } else {
      throw new Error(`File ${filename} does not contain a recognized case array.`);
    }
    return { cases, searchContext };
  }

  // HTML Parsing
  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(text, 'text/html');

  // Strategy 1: Check using MyCaseScraper if available
  if (window.MyCaseScraper) {
    if (window.MyCaseScraper.isSearchResultsPage(parsedDoc)) {
      const cases = window.MyCaseScraper.scrapeSearchResults(parsedDoc);
      const searchContext = window.MyCaseScraper.getSearchContext(parsedDoc) || filename;
      return { cases, searchContext };
    }

    if (window.MyCaseScraper.isCaseSummaryPage(parsedDoc)) {
      // Single CCS case view
      const caseNumEl = parsedDoc.querySelector('.case-number, .header-case-number, h2, h3');
      const caseNumber = caseNumEl ? caseNumEl.textContent.replace(/case\s*(number|#)?\s*[:\-]?\s*/gi, '').trim() : '';
      const ccsData = window.MyCaseScraper._parseCCSHtml ? window.MyCaseScraper._parseCCSHtml(text) : null;
      const charges = ccsData?.charges?.map(c => `${c.count ? 'Count ' + c.count + ': ' : ''}${c.offense} (${c.level || ''})`).join('; ') || 'See CCS';
      
      const singleCase = {
        case_number: caseNumber || 'UNKNOWN-CASE',
        case_type: 'Criminal Case',
        charges: charges,
        filed: '',
        court: parsedDoc.querySelector('.court-name, .header-court')?.textContent?.trim() || '',
        status: 'Disposed',
        ccs: ccsData
      };
      return { cases: [singleCase], searchContext: caseNumber || filename };
    }
  }

  // Strategy 2: Fallback DOM Extraction for table rows or result cards
  const resultRows = parsedDoc.querySelectorAll('tr.result-row, tr[data-bind*="CaseNumber"], .case-card-item');
  if (resultRows.length > 0) {
    const cases = [];
    resultRows.forEach((row, idx) => {
      const caseNumEl = row.querySelector('.result-subtitle[title="Case Number"], .case-number, [data-bind*="CaseNumber"]');
      const caseNum = caseNumEl ? caseNumEl.textContent.trim() : '';
      if (!caseNum) return;

      const titleEl = row.querySelector('.result-title, .case-title');
      const detailRows = row.querySelectorAll('.result-row-details .row, td');

      const caseData = {
        index: idx + 1,
        case_number: caseNum,
        title: titleEl ? titleEl.textContent.trim() : '',
        court: '',
        case_type: '',
        filed: '',
        status: '',
        charges: '',
        _source: 'html-dom'
      };

      detailRows.forEach(detailRow => {
        const text = detailRow.textContent.trim();
        if (/court[:\s]/i.test(text)) caseData.court = text.replace(/court[:\s]*/i, '').trim();
        if (/type[:\s]/i.test(text)) caseData.case_type = text.replace(/case\s*type[:\s]*/i, '').trim();
        if (/filed[:\s]/i.test(text)) caseData.filed = text.replace(/filed[:\s]*/i, '').trim();
        if (/status[:\s]/i.test(text)) caseData.status = text.replace(/status[:\s]*/i, '').trim();
        if (/charges?[:\s]/i.test(text)) caseData.charges = text.replace(/charges?[:\s]*/i, '').trim();
      });

      cases.push(caseData);
    });

    if (cases.length > 0) {
      return { cases, searchContext: filename };
    }
  }

  // Strategy 3: Regex scan for Indiana Cause Numbers (XXDXX-YYYY-CC-NNNNNN)
  const plainText = parsedDoc.body ? parsedDoc.body.innerText : text;
  const indianaCauseRegex = /\b(\d{2}[A-Z]\d{2}-\d{4}-[A-Z0-9]{2}-\d{6})\b/g;
  const matches = [...new Set(plainText.match(indianaCauseRegex) || [])];

  if (matches.length > 0) {
    const cases = matches.map((num, i) => ({
      index: i + 1,
      case_number: num,
      title: 'Scraped Cause Record',
      court: 'Indiana Court',
      case_type: 'Indiana Record',
      charges: 'Record parsed from uploaded document',
      filed: '',
      status: 'Disposed',
      _source: 'cause-regex'
    }));
    return { cases, searchContext: filename };
  }

  throw new Error(`Could not find any Indiana MyCase records in "${filename}". Please make sure this is a saved MyCase search or CCS page.`);
}

// ─── Multi-File Upload Processing ──────────────────────────────────
export async function processFiles(files) {
  if (!files || files.length === 0) return;

  const dropZone = $('#dropZone');
  const uploadStatus = $('#uploadStatus');
  const uploadStatusText = $('#uploadStatusText');

  if (uploadStatus) uploadStatus.style.display = 'flex';
  if (uploadStatusText) uploadStatusText.textContent = `Reading ${files.length} file(s)...`;

  const allParsedCases = [];
  const contexts = [];
  let errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      if (uploadStatusText) {
        uploadStatusText.textContent = `Processing (${i + 1}/${files.length}): ${file.name}`;
      }
      const text = await file.text();
      const { cases, searchContext } = parseFileContent(text, file.name);
      if (cases && cases.length > 0) {
        allParsedCases.push(...cases);
        contexts.push(searchContext);
      }
    } catch (err) {
      console.warn(`[File Parse Error] ${file.name}:`, err);
      errors.push(`${file.name}: ${err.message}`);
    }
  }

  if (uploadStatus) uploadStatus.style.display = 'none';

  if (allParsedCases.length === 0) {
    const errMsg = errors.length > 0
      ? `Failed to import: ${errors.join('; ')}`
      : 'No case records could be extracted from the uploaded file(s).';
    showToast(errMsg, 'error', 6000);
    return;
  }

  if (errors.length > 0) {
    showToast(`Note: Some files had errors (${errors.length}), but ${allParsedCases.length} cases were extracted.`, 'warning', 5000);
  }

  const combinedContext = contexts.length === 1 ? contexts[0] : `${files.length} Files (${contexts.slice(0, 2).join(', ')}${contexts.length > 2 ? '...' : ''})`;
  const mergeMode = $('#chkMergeCases')?.checked ?? true;

  showParityModal(allParsedCases, combinedContext, mergeMode);
}

// ─── Sample Demo Dataset ───────────────────────────────────────────
export function loadSampleDemoData() {
  const sampleCases = [
    {
      case_number: '49D01-1805-CM-012345',
      title: 'State of Indiana v. Sample Petitioner',
      court: 'Marion Superior Court, Criminal Division 1',
      case_type: 'CM - Misdemeanor',
      filed: '05/12/2018',
      status: '09/14/2018, Disposed - Conviction',
      charges: 'Count 1: Operating a Vehicle While Intoxicated Endangering a Person (Class A Misdemeanor) · Conviction',
      _source: 'demo'
    },
    {
      case_number: '45D02-1502-F6-000456',
      title: 'State of Indiana v. Sample Petitioner',
      court: 'Lake Superior Court, Criminal Division 2',
      case_type: 'F6 - Level 6 Felony',
      filed: '02/10/2015',
      status: '06/20/2015, Disposed - Conviction',
      charges: 'Count 1: Theft (Level 6 Felony, Non-Violent) · Conviction',
      _source: 'demo'
    },
    {
      case_number: '02D04-2001-CM-000789',
      title: 'State of Indiana v. Sample Petitioner',
      court: 'Allen Superior Court, Criminal Division 4',
      case_type: 'CM - Misdemeanor',
      filed: '01/15/2020',
      status: '04/10/2020, Dismissed by State',
      charges: 'Count 1: Public Intoxication (Class B Misdemeanor) · Dismissed with Prejudice',
      _source: 'demo'
    },
    {
      case_number: '49C01-2308-PL-005678',
      title: 'Landlord LLC v. Sample Tenant',
      court: 'Marion Circuit Court',
      case_type: 'PL - Civil Plenary',
      filed: '08/20/2023',
      status: '01/10/2024, Judgment Entered',
      charges: 'Civil Breach of Contract Dispute',
      _source: 'demo'
    }
  ];

  applyImportedCases(sampleCases, 'Indiana Demo Cases (4 Records)', false);
  showToast('✓ Loaded sample Indiana court records for demonstration.', 'success', 4000);
}

// ─── Setup Drag-and-Drop & File Upload Listeners ────────────────────
export function setupImportListeners() {
  const dropZone = $('#dropZone');
  const fileInput = $('#fileUpload');
  const btnSelectFiles = $('#btnSelectFiles');
  const btnLoadDemo = $('#btnLoadDemo');
  const btnPasteToggle = $('#btnPasteToggle');
  const pasteContainer = $('#pasteContainer');
  const btnProcessPaste = $('#btnProcessPaste');
  const pasteInput = $('#pasteInput');

  // Browse button
  btnSelectFiles?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      fileInput.value = '';
    }
  });

  // Drag and Drop
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-active');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-active');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt?.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
    });
  }

  // Demo Button
  btnLoadDemo?.addEventListener('click', () => {
    loadSampleDemoData();
  });

  // Paste Drawer Toggle
  btnPasteToggle?.addEventListener('click', () => {
    if (pasteContainer) {
      const isHidden = pasteContainer.style.display === 'none' || !pasteContainer.style.display;
      pasteContainer.style.display = isHidden ? 'block' : 'none';
      if (isHidden && pasteInput) pasteInput.focus();
    }
  });

  // Process Pasted Text
  btnProcessPaste?.addEventListener('click', () => {
    const raw = pasteInput?.value?.trim();
    if (!raw) {
      showToast('Please paste HTML source or JSON data into the text box.', 'warning');
      return;
    }

    try {
      const { cases, searchContext } = parseFileContent(raw, 'Pasted Source Data');
      if (cases && cases.length > 0) {
        const mergeMode = $('#chkMergeCases')?.checked ?? true;
        showParityModal(cases, searchContext, mergeMode);
        if (pasteInput) pasteInput.value = '';
        if (pasteContainer) pasteContainer.style.display = 'none';
      }
    } catch (err) {
      showToast(err.message, 'error', 6000);
    }
  });

  // Bookmarklet Copy Action
  $('#btnCopyAppBookmarklet')?.addEventListener('click', async () => {
    const code = "javascript:(function(){const s=document.createElement('script');s.src='https://cambrianminds.github.io/indiana-expungement-assistant/bookmarklet.js?v='+Date.now();document.body.appendChild(s);})();";
    try {
      await navigator.clipboard.writeText(code);
      showToast('✓ Bookmarklet code copied to clipboard!', 'success', 3000);
    } catch (_) {
      showToast('Please drag the blue button to your bookmarks bar.', 'info', 3000);
    }
  });

  // Result Filtering Listeners
  $$('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      $$('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.dataset.filter || 'all';
      filterCaseCards(filter);
    });
  });
}

// ─── Filter Case Cards in Results Tab ──────────────────────────────
export function filterCaseCards(filter) {
  const cards = $$('#caseList .case-card');
  cards.forEach(card => {
    if (filter === 'all') {
      card.style.display = 'block';
    } else if (filter === 'eligible') {
      card.style.display = card.dataset.eligible === 'true' ? 'block' : 'none';
    } else if (filter === 'ineligible') {
      card.style.display = card.dataset.eligible === 'false' && card.dataset.statute !== 'N/A' ? 'block' : 'none';
    } else if (filter === 'excluded') {
      card.style.display = card.dataset.statute === 'N/A' ? 'block' : 'none';
    }
  });
}

// ─── Render Results ────────────────────────────────────────────────
export function renderResults() {
  if (!AppState.currentReport) return;

  const noResults = $('#noResults');
  const resultsContent = $('#resultsContent');
  if (noResults) noResults.style.display = 'none';
  if (resultsContent) resultsContent.style.display = 'block';

  const s = AppState.currentReport.summary;
  const elEligible = $('#summaryEligible');
  const elIneligible = $('#summaryIneligible');
  const elExcluded = $('#summaryExcluded');
  const elFee = $('#summaryFee');

  if (elEligible) elEligible.textContent = s.eligible;
  if (elIneligible) elIneligible.textContent = s.ineligible;
  if (elExcluded) elExcluded.textContent = s.excluded;
  if (elFee) elFee.textContent = s.totalFilingFee ? `~$${s.totalFilingFee}` : '$0';

  // Update badge & results header pills
  const badge = $('#resultsBadge');
  if (badge) {
    badge.style.display = 'inline-flex';
    badge.textContent = AppState.currentCases.length;
  }

  const resultsCountPill = $('#resultsCountPill');
  const resultsSearchesPill = $('#resultsSearchesPill');
  if (resultsCountPill) resultsCountPill.textContent = `${AppState.currentCases.length} Cases`;
  if (resultsSearchesPill) {
    const numSearches = AppState.searchBatches.length || 1;
    resultsSearchesPill.textContent = `from ${numSearches} import source${numSearches === 1 ? '' : 's'}`;
  }

  // Statute breakdown
  const breakdownEl = $('#statuteBreakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = '';
    for (const [statute, count] of Object.entries(s.byStatute || {})) {
      const tag = document.createElement('span');
      tag.className = 'statute-tag';
      tag.innerHTML = `${escapeHtml(statute)} <span class="statute-tag-count">${count}</span>`;
      breakdownEl.appendChild(tag);
    }
  }

  // Multi-county detection & selector
  const countySelectCard = $('#countySelectCard');
  const countySelectDropdown = $('#selectCountyPacket');
  const counties = AppState.currentReport.counties ? Object.entries(AppState.currentReport.counties) : [];

  if (countySelectCard && countySelectDropdown) {
    if (counties.length > 1) {
      countySelectCard.style.display = 'block';
      countySelectDropdown.innerHTML = '';
      counties.forEach(([code, cData]) => {
        const eligCount = cData.cases.filter(c => c.eligibility?.eligible).length;
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${cData.courtName || ('County ' + code)} (${eligCount} eligible of ${cData.cases.length} cases)`;
        countySelectDropdown.appendChild(opt);
      });
    } else {
      countySelectCard.style.display = 'none';
    }
  }

  // Case list
  const listEl = $('#caseList');
  if (!listEl) return;
  listEl.innerHTML = '';

  const allCases = [];
  for (const county of Object.values(AppState.currentReport.counties || {})) {
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

  // Reset active filter
  const activePill = $('.filter-pill.active');
  if (activePill) filterCaseCards(activePill.dataset.filter || 'all');
}

export function excludeCase(caseNum) {
  if (!caseNum) return;
  const idx = AppState.currentCases.findIndex(c => (c.case_number || '').trim().toUpperCase() === caseNum.trim().toUpperCase());
  if (idx === -1) return;

  AppState.currentCases.splice(idx, 1);

  if (window.IndianaExpungement?.analyzeAll) {
    AppState.currentReport = window.IndianaExpungement.analyzeAll(AppState.currentCases);
  }

  persistScanResults();

  updateBatchPanelUI();
  renderResults();
  updateChecklist();
  showToast(`Excluded ${caseNum} from petition. Eligibility recalculated.`, 'info', 3500);
}

function createCaseCard(caseData) {
  const el = caseData.eligibility;
  const card = document.createElement('div');
  card.className = 'case-card';

  const isElig = Boolean(el?.eligible);
  const isStatuteNA = el?.statute === 'N/A';
  card.dataset.eligible = String(isElig);
  card.dataset.statute = el?.statute || '';

  // Badge
  let badgeClass = 'excluded';
  let badgeText = 'EXCLUDED';
  if (el) {
    if (el.eligible) {
      badgeClass = 'eligible';
      badgeText = 'ELIGIBLE';
    } else if (isStatuteNA) {
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
  const searchQueriesDisplay = caseData.searchQueries?.length
    ? caseData.searchQueries.join(' · ')
    : (caseData.searchContext || '');

  card.innerHTML = `
    <div class="case-card-header">
      <div class="case-card-title-group">
        <span class="case-number">${escapeHtml(caseData.case_number || '')}</span>
        <span class="case-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="case-card-header-actions">
        <button type="button" class="btn-remove-case" title="Exclude this case from petition (e.g. maiden name mismatch / not you)">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Exclude
        </button>
      </div>
    </div>
    ${searchQueriesDisplay ? `<div class="case-search-tag">📄 Source: ${escapeHtml(searchQueriesDisplay)}</div>` : ''}
    <div class="case-charges">${escapeHtml(chargesDisplay)}</div>
    <div class="case-meta">
      <span><strong>Code:</strong> ${escapeHtml(typeCode || 'N/A')}</span>
      <span><strong>Filed:</strong> ${escapeHtml(caseData.filed || 'N/A')}</span>
      <span><strong>Court:</strong> ${escapeHtml(caseData.court || 'Indiana Court')}</span>
    </div>
    <div class="case-detail">
      <div class="detail-grid">
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
      </div>
      ${el?.warnings?.length ? `
        <div class="case-warnings">
          ${el.warnings.map(w => `<span class="warning-tag">⚠ ${escapeHtml(w)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('.btn-remove-case')) return;
    card.classList.toggle('expanded');
  });

  card.querySelector('.btn-remove-case')?.addEventListener('click', (e) => {
    e.stopPropagation();
    excludeCase(caseData.case_number);
  });

  return card;
}

// Initialize listeners when scanner is loaded
setupImportListeners();
