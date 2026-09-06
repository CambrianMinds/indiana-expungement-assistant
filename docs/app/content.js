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
    const dispMatch = (statusDate || fullStatus).match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
    const dispositionDate = dispMatch ? dispMatch[1] : (statusDate || '');

    return {
      index: index + 1,
      case_number: caseNumber,
      title: cleanHtml(style),
      court: court,
      case_type: fullCaseType,
      filed: fileDate,
      status: fullStatus,
      dispositionDate: dispositionDate,
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
          dispositionDate: '',
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

        if (caseData.status) {
          const dispMatch = caseData.status.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (dispMatch) caseData.dispositionDate = dispMatch[1];
        }

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

        // Knockout row-level fallback
        if (!caseData.caseToken && typeof ko !== 'undefined' && ko.dataFor) {
           try {
             const ctx = ko.dataFor(row);
             if (ctx) {
               caseData.caseToken = ctx.CaseToken || ctx.CaseID || (ctx.model && (ctx.model.CaseToken || ctx.model.CaseID)) || '';
             }
           } catch (e) {}
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
      const url = `https://public.courts.in.gov/mycase/Case/CaseSummary?SRCT=&CaseToken=${encodeURIComponent(caseToken)}&_=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        console.warn(`[Expungement] CCS fetch failed for ${caseToken}: ${response.status}`);
        return null;
      }

      const json = await response.json();
      if (json.InvalidToken || json.CaseNotFound || json.AccessDenied) return null;
      return parseCCSJson(json);
    } catch (e) {
      console.warn(`[Expungement] CCS fetch error for ${caseToken}:`, e);
      return null;
    }
  }

  /**
   * Parse CCS JSON response to extract detailed charge information, disposition details,
   * financial summary, and docket entries from the MyCase API.
   */
  function parseCCSJson(json) {
    const ccsData = {
      charges: [],
      docketEntries: [],
      financialSummary: null,
      arrestingAgency: null,
      sentenceDetails: null,
      dispositionDate: ''
    };

    // Extract charges from the JSON Charges array
    if (Array.isArray(json.Charges)) {
      json.Charges.forEach(charge => {
        let offense = charge.OffenseDescription || '';

        // For old converted cases, OffenseDescription is the useless placeholder
        // "SEE CCS ENTRY FOR OFFENSE DESCRIPTION". The real offense text is buried
        // in the CCS Events array inside CaseEvent.Comment fields like:
        //   "COUNT 1 75/55 SPEED X I  (RJO? N) | JTS Minute Entry Date: ..."
        if (offense.toUpperCase().includes('SEE CCS ENTRY') && Array.isArray(json.Events)) {
          const chargeNum = charge.ChargeNumber || '01';

          // First pass: look for a COUNT comment matching this charge number
          for (const evt of json.Events) {
            if (evt.CaseEvent && evt.CaseEvent.Comment) {
              const comment = evt.CaseEvent.Comment;
              const pat = new RegExp('COUNT\\s*' + chargeNum + '\\s+(.+?)(?:\\s*\\(RJO|\\s*\\||$)', 'i');
              const m = comment.match(pat);
              if (m) {
                offense = m[1].trim();
                break;
              }
            }
          }

          // Second pass: if still placeholder, try any COUNT pattern
          if (offense.toUpperCase().includes('SEE CCS ENTRY')) {
            for (const evt of json.Events) {
              if (evt.CaseEvent && evt.CaseEvent.Comment) {
                const comment = evt.CaseEvent.Comment;
                const m = comment.match(/COUNT\s*\d+\s+(.+?)(?:\s*\(RJO|\s*\||$)/i);
                if (m) {
                  offense = m[1].trim();
                  break;
                }
              }
            }
          }

          // Third pass: use the first non-calendar event comment as a description
          if (offense.toUpperCase().includes('SEE CCS ENTRY')) {
            for (const evt of json.Events) {
              if (evt.CaseEvent && evt.CaseEvent.Comment) {
                const comment = evt.CaseEvent.Comment;
                if (!comment.includes('Calendar:') && !comment.includes('ALL FILINGS')) {
                  const clean = comment.split('|')[0].replace(/\(RJO\?\s*\w\)/g, '').trim();
                  if (clean.length > 5 && clean.length < 200) {
                    offense = clean;
                    break;
                  }
                }
              }
            }
          }
        }

        ccsData.charges.push({
          count: charge.ChargeNumber || '',
          offense: offense,
          statute: charge.OffenseStatute || '',
          level: charge.OffenseDegree || '',
          disposition: ''
        });
      });
    }

    // Extract disposition info from disposition events
    if (Array.isArray(json.Events)) {
      json.Events.forEach(evt => {
        if (evt.DispEvent) {
          if (evt.EventDate && !ccsData.dispositionDate) {
            ccsData.dispositionDate = evt.EventDate;
          }
          if (Array.isArray(evt.DispEvent.Charges)) {
            evt.DispEvent.Charges.forEach(dc => {
              const match = ccsData.charges.find(c => c.count === dc.ChargeNumber);
              if (match) {
                if (dc.DispositionType) match.disposition = dc.DispositionType;
                if (evt.EventDate && !match.dispositionDate) match.dispositionDate = evt.EventDate;
              }
            });
          }
        }
      });
    }

    // Extract docket entries from events
    if (Array.isArray(json.Events)) {
      json.Events.forEach(evt => {
        ccsData.docketEntries.push({
          date: evt.EventDate || '',
          type: evt.EventType || '',
          description: evt.Description || '',
          text: evt.CaseEvent ? evt.CaseEvent.Comment || '' : ''
        });
      });
    }

    // Extract financial summary from the defendant party
    if (Array.isArray(json.Parties)) {
      const defendant = json.Parties.find(p => p.BaseConnKey === 'DF');
      if (defendant && defendant.FeeSummary) {
        ccsData.financialSummary = {
          balance: defendant.FeeSummary.Balance || 'N/A',
          asOf: defendant.FeeSummary.AsOf || '',
          categories: defendant.FeeSummary.Categories || []
        };
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
        const dispositionDate = c.dispositionDate || ccs?.dispositionDate || '';
        enriched.push({ ...c, dispositionDate, ccs });

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
    _parseCCSJson: parseCCSJson
  };

})();

// ─── Message Handler: Respond to sidepanel and background script (Extension only) ──
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
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

  try {
    chrome.runtime.sendMessage({ action: 'contentScriptLoaded', url: window.location.href });
  } catch (_) {}
}

// Export for browser and node
if (typeof window !== 'undefined') {
  window.MyCaseScraper = MyCaseScraper;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MyCaseScraper;
}
