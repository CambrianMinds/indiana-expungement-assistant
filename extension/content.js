/**
 * Indiana Expungement Assistant - Content Script
 * Runs in the context of public.courts.in.gov/mycase/* pages.
 * 
 * Scrapes case data directly from the DOM and Knockout.js observables.
 * All parsing is done 100% client-side within the user's authenticated session.
 * No external HTTP requests — zero bot-detection footprint.
 */

const MyCaseScraper = (() => {

  // ─── DOM Scraping: Search Results Page ───────────────────────────────

  /**
   * Scrape all case records from the current MyCase search results page.
   * Works on both the list view and the expanded detail view.
   * 
   * Strategy:
   *  1. Try Knockout.js observable model first (cleanest data)
   *  2. Fall back to DOM text extraction from result rows
   * 
   * @returns {Array} Array of normalized case objects
   */
  function scrapeSearchResults(rootElement = document) {
    if (!isSearchResultsPage(rootElement)) {
      throw new Error("Not on a MyCase search results page.");
    }
    // Strategy 1: Knockout Observable (preferred) - only works if rootElement is document
    const koResults = tryKnockoutExtraction(rootElement);
    if (koResults && koResults.length > 0) {
      console.log(`[Expungement] Extracted ${koResults.length} cases via Knockout observables`);
      return koResults;
    }

    // Strategy 2: DOM scraping (fallback)
    const domResults = tryScrapeDOM(rootElement);
    
    if (domResults.length === 0) {
      // Check if there are no cases at all, vs a layout change
      const text = rootElement.body ? rootElement.body.innerText.toLowerCase() : rootElement.innerText.toLowerCase();
      if (!text.includes('no cases matched') && !text.includes('0 cases found')) {
        throw new Error("MyCase layout has changed. Unable to parse search results.");
      }
    }
    
    console.log(`[Expungement] Extracted ${domResults.length} cases via DOM scraping`);
    return domResults;
  }

  /**
   * Try to extract case data from the Knockout.js view model.
   * MyCase uses Tyler Technologies Odyssey SPA with Knockout bindings.
   * The search results are bound to an observable array.
   */
  function tryKnockoutExtraction(rootElement = document) {
    try {
      // Knockout is only available in the live DOM
      if (rootElement !== document) return null;

      // The Odyssey SPA stores its view model in a known container
      const container = document.getElementById('OD_BODY');
      if (!container) return null;

      // Try accessing the Knockout context
      const koContext = ko && ko.dataFor ? ko.dataFor(container) : null;
      if (!koContext) return null;

      // Navigate to the search results observable
      let results = null;
      if (koContext.ob && koContext.ob.Results) {
        results = typeof koContext.ob.Results === 'function'
          ? koContext.ob.Results()
          : koContext.ob.Results;
      }

      if (!results || !Array.isArray(results)) return null;

      return results.map((model, index) => normalizeKnockoutModel(model, index));
    } catch (e) {
      console.log('[Expungement] Knockout extraction unavailable:', e.message);
      return null;
    }
  }

  /**
   * Normalize a Knockout model object into our standard case format.
   */
  function normalizeKnockoutModel(model, index) {
    const getValue = (prop) => {
      if (!prop) return '';
      return typeof prop === 'function' ? prop() : prop;
    };

    const caseNumber = getValue(model.CaseNumber) || '';
    const style = getValue(model.Style) || '';
    const court = getValue(model.Court) || '';
    const caseType = getValue(model.CaseType) || '';
    const caseSubType = getValue(model.CaseSubType) || '';
    const fileDate = getValue(model.FileDate) || '';
    const statusDate = getValue(model.CaseStatusDate) || '';
    const status = getValue(model.CaseStatus) || '';
    const charges = getValue(model.Charges) || '';
    const parties = getValue(model.Parties) || '';
    const attorneys = getValue(model.Attorneys) || '';
    const caseToken = getValue(model.CaseToken) || getValue(model.CaseID) || '';

    const fullCaseType = caseSubType
      ? `${caseType}, ${caseSubType}`
      : caseType;

    const fullStatus = statusDate
      ? `${statusDate}, ${status}`
      : status;

    return {
      index: index + 1,
      case_number: caseNumber,
      title: cleanHtml(style),
      court: court,
      case_type: fullCaseType,
      filed: fileDate,
      status: fullStatus,
      charges: cleanCharges(charges),
      parties: parties,
      attorneys: attorneys,
      caseToken: caseToken,  // Used for CCS deep-scraping
      _source: 'knockout'
    };
  }

  /**
   * Fall back to DOM scraping when Knockout context is unavailable.
   * Extracts data from the rendered .result-row elements.
   */
  function tryScrapeDOM(rootElement = document) {
    const rows = rootElement.querySelectorAll('tr.result-row');
    const cases = [];

    rows.forEach((row, index) => {
      try {
        const titleEl = row.querySelector('.result-title');
        const caseNumEl = row.querySelector('.result-subtitle[title="Case Number"]');
        const detailRows = row.querySelectorAll('.result-row-details .row');

        const caseData = {
          index: index + 1,
          case_number: caseNumEl ? caseNumEl.textContent.trim() : '',
          title: titleEl ? cleanHtml(titleEl.textContent.trim()) : '',
          court: '',
          case_type: '',
          filed: '',
          status: '',
          charges: '',
          parties: '',
          attorneys: '',
          caseToken: '',
          _source: 'dom'
        };

        // Parse detail rows (Court, Case Type, Filed, Status, Charges, Parties, Attorneys)
        detailRows.forEach(detailRow => {
          const label = detailRow.querySelector('.text-muted');
          const value = detailRow.querySelector('.col-sm-10 .small, .col-xs-11 .small');
          if (!label || !value) return;

          const labelText = label.textContent.trim().toLowerCase();
          const valueText = value.textContent.trim();

          switch (labelText) {
            case 'court': caseData.court = valueText; break;
            case 'case type': caseData.case_type = valueText; break;
            case 'filed': caseData.filed = valueText; break;
            case 'status': caseData.status = valueText; break;
            case 'charges': caseData.charges = cleanCharges(valueText); break;
            case 'parties': caseData.parties = valueText; break;
            case 'attorneys': caseData.attorneys = valueText; break;
          }
        });

        // If details weren't expanded, try to get filed date from the right column
        if (!caseData.filed) {
          const rightCol = row.querySelector('.result-col-right .small[data-bind*="FileDate"]');
          if (rightCol) caseData.filed = rightCol.textContent.trim();
        }

        // Try to extract case token from the title link
        if (titleEl) {
          let href = titleEl.getAttribute('href') || '';
          if (!href) {
             const a = titleEl.querySelector('a');
             if (a) href = a.getAttribute('href') || '';
          }
          const hrefMatch = href.match(/CaseToken=([^&]+)/i);
          if (hrefMatch) {
            caseData.caseToken = hrefMatch[1];
          } else {
            const onclick = titleEl.getAttribute('onclick') || '';
            const tokenMatch = onclick.match(/CaseToken[=:][\s'"]*([^'"&]+)/i);
            if (tokenMatch) caseData.caseToken = tokenMatch[1];
          }
        }
        
        // Ultimate fallback: regex the row's innerHTML
        if (!caseData.caseToken) {
           const htmlMatch = row.innerHTML.match(/CaseToken=([^&"'>\s]+)/i);
           if (htmlMatch) caseData.caseToken = htmlMatch[1];
        }

        if (caseData.case_number) {
          cases.push(caseData);
        }
      } catch (e) {
        console.warn(`[Expungement] Error parsing row ${index}:`, e);
      }
    });

    return cases;
  }

  // ─── CCS Deep-Scrape (In-Session Fetch) ──────────────────────────────

  /**
   * Fetch the Chronological Case Summary (CCS) for a specific case.
   * Uses the user's existing session cookies — no external authentication.
   * 
   * This performs a same-origin fetch within the user's browser session,
   * which is indistinguishable from the user clicking a case link.
   * 
   * @param {string} caseToken - The CaseToken identifier from search results
   * @returns {Promise<Object>} Parsed CCS data
   */
  async function fetchCCS(caseToken) {
    if (!caseToken) return null;

    try {
      const url = `https://public.courts.in.gov/mycase/Case/CaseSummary?CaseToken=${encodeURIComponent(caseToken)}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'text/html, application/xhtml+xml',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        console.warn(`[Expungement] CCS fetch failed for ${caseToken}: ${response.status}`);
        return null;
      }

      const html = await response.text();
      return parseCCSHtml(html);
    } catch (e) {
      console.warn(`[Expungement] CCS fetch error for ${caseToken}:`, e);
      return null;
    }
  }

  /**
   * Parse CCS HTML to extract detailed charge information, disposition details,
   * arresting agency, financial summary, and sentence information.
   */
  function parseCCSHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const ccsData = {
      charges: [],
      docketEntries: [],
      financialSummary: null,
      arrestingAgency: null,
      sentenceDetails: null
    };

    // Extract charges from the charge/count table
    const chargeRows = doc.querySelectorAll('.case-charges-table tr, table.charges tr');
    chargeRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        ccsData.charges.push({
          count: cells[0]?.textContent?.trim() || '',
          offense: cells[1]?.textContent?.trim() || '',
          statute: cells[2]?.textContent?.trim() || '',
          level: cells[3]?.textContent?.trim() || '',
          disposition: cells[4]?.textContent?.trim() || ''
        });
      }
    });

    // Extract docket / CCS entries
    const docketRows = doc.querySelectorAll('.od-ccs-entry, .ccs-entry, .docket-entry');
    docketRows.forEach(row => {
      const dateEl = row.querySelector('.ccs-date, .entry-date');
      const textEl = row.querySelector('.ccs-text, .entry-text');
      if (dateEl && textEl) {
        ccsData.docketEntries.push({
          date: dateEl.textContent.trim(),
          text: textEl.textContent.trim()
        });
      }
    });

    // Extract financial summary
    const financialEl = doc.querySelector('.financial-summary, .case-financial');
    if (financialEl) {
      const totalOwed = financialEl.querySelector('.total-owed, .amount-owed');
      const totalPaid = financialEl.querySelector('.total-paid, .amount-paid');
      ccsData.financialSummary = {
        owed: totalOwed ? totalOwed.textContent.trim() : 'N/A',
        paid: totalPaid ? totalPaid.textContent.trim() : 'N/A'
      };
    }

    // Try to find arresting agency in docket entries
    for (const entry of ccsData.docketEntries) {
      const text = entry.text.toUpperCase();
      if (text.includes('ARRESTING AGENCY') || text.includes('ARRESTED BY')) {
        ccsData.arrestingAgency = entry.text;
        break;
      }
    }

    return ccsData;
  }

  /**
   * Deep-scrape CCS details for all cases (throttled to avoid overloading).
   * Adds a natural delay between requests to mimic human browsing.
   * 
   * @param {Array} cases - Array of case objects with caseToken
   * @param {Function} onProgress - Callback for progress updates
   * @returns {Promise<Array>} Cases enriched with CCS data
   */
  async function deepScrapeCCS(cases, onProgress) {
    const enriched = [];
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      if (c.caseToken) {
        if (onProgress) onProgress(i + 1, cases.length, c.case_number);

        const ccs = await fetchCCS(c.caseToken);
        enriched.push({ ...c, ccs });

        // Natural delay: 800–1500ms between requests (mimics human pace)
        if (i < cases.length - 1) {
          await sleep(800 + Math.random() * 700);
        }
      } else {
        enriched.push({ ...c, ccs: null });
      }
    }
    return enriched;
  }

  // ─── Utility Functions ───────────────────────────────────────────────

  function cleanHtml(text) {
    return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }

  function cleanCharges(charges) {
    if (!charges) return '';
    // Remove reference placeholders
    let clean = charges.replace(/\*{3}\s*REFERENCE CCS ENTRY\s*\*{3}/gi, '').trim();
    // Normalize whitespace
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if the current page is a MyCase search results page.
   */
  function isSearchResultsPage(rootElement = document) {
    const isDoc = rootElement === document;
    return (isDoc && window.location.href.includes('SearchResults')) ||
      rootElement.querySelector('tr.result-row') !== null;
  }

  /**
   * Check if the current page is a MyCase case summary (CCS) page.
   */
  function isCaseSummaryPage(rootElement = document) {
    const isDoc = rootElement === document;
    return (isDoc && window.location.href.includes('CaseSummary')) ||
      rootElement.querySelector('.od-ccs-entry, .ccs-entry') !== null;
  }

  /**
   * Extract search context or party name query from the active MyCase page.
   * Useful for tracking multiple maiden/married name or alias searches.
   */
  function getSearchContext(rootElement = document) {
    try {
      // 1. Try search inputs (e.g. Last Name, First Name)
      const last = rootElement.querySelector('input[id*="LastName" i], input[name*="LastName" i]')?.value?.trim();
      const first = rootElement.querySelector('input[id*="FirstName" i], input[name*="FirstName" i]')?.value?.trim();
      const nameParts = [last, first].filter(Boolean);
      if (nameParts.length > 0) {
        return nameParts.join(', ');
      }

      // 2. Try breadcrumb or search summary headers
      const summaryEl = rootElement.querySelector('.search-summary, .search-criteria, .k-header-column-menu, .breadcrumb');
      if (summaryEl && summaryEl.innerText?.trim()) {
        const text = summaryEl.innerText.trim().replace(/\s+/g, ' ');
        if (text.length > 0 && text.length < 60) return text;
      }

      // 3. Fallback to page title or timestamp
      const title = rootElement.title || (rootElement === document ? document.title : '');
      const titleMatch = title.match(/MyCase\s*[-–]\s*(.+)/i);
      if (titleMatch && titleMatch[1]) return titleMatch[1].trim();
    } catch (_) {}
    return 'MyCase Search';
  }

  // ─── Public API ──────────────────────────────────────────────────────
  return {
    scrapeSearchResults,
    fetchCCS,
    deepScrapeCCS,
    isSearchResultsPage,
    isCaseSummaryPage,
    getSearchContext,
    // Expose internals for testing
    _tryKnockoutExtraction: tryKnockoutExtraction,
    _tryScrapeDOM: tryScrapeDOM,
    _parseCCSHtml: parseCCSHtml
  };

})();

// ─── Message Handler: Respond to sidepanel and background script ────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeSearchResults') {
    const cases = MyCaseScraper.scrapeSearchResults();
    const searchContext = MyCaseScraper.getSearchContext();
    cases.forEach(c => { c.searchContext = searchContext; });
    sendResponse({ success: true, cases, searchContext });
    return true;
  }

  if (request.action === 'analyzeEligibility') {
    try {
      const cases = MyCaseScraper.scrapeSearchResults();
      const searchContext = MyCaseScraper.getSearchContext();
      cases.forEach(c => { c.searchContext = searchContext; });
      const report = IndianaExpungement.analyzeAll(cases);
      sendResponse({ success: true, report, cases, searchContext });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }

  if (request.action === 'deepScrape') {
    const cases = MyCaseScraper.scrapeSearchResults();
    MyCaseScraper.deepScrapeCCS(cases, (current, total, caseNum) => {
      chrome.runtime.sendMessage({
        action: 'deepScrapeProgress',
        current, total, caseNum
      });
    }).then(enrichedCases => {
      const report = IndianaExpungement.analyzeAll(enrichedCases);
      sendResponse({ success: true, report, cases: enrichedCases });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'getPageStatus') {
    sendResponse({
      isSearchResults: MyCaseScraper.isSearchResultsPage(),
      isCaseSummary: MyCaseScraper.isCaseSummaryPage(),
      url: window.location.href
    });
    return true;
  }
});

// Notify background script that content script is loaded
chrome.runtime.sendMessage({ action: 'contentScriptLoaded', url: window.location.href });

// Export for testing
if (typeof window !== 'undefined') {
  window.MyCaseScraper = MyCaseScraper;
}
