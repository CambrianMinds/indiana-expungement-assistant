/**
 * Indiana Expungement Assistant - Background Service Worker
 * Manages sidepanel lifecycle, extension badge, and local API communication.
 */

// ─── Side Panel Configuration ──────────────────────────────────────────
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ─── Extension Icon Click: Open Side Panel ─────────────────────────────
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ─── Badge Management ──────────────────────────────────────────────────
function updateBadge(tabId, text, color = '#22c55e') {
  chrome.action.setBadgeText({ text: String(text), tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}

// ─── Message Routing ───────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Content script loaded notification
  if (request.action === 'contentScriptLoaded') {
    if (sender.tab) {
      updateBadge(sender.tab.id, '✓', '#3b82f6');
    }
    return;
  }

  // Deep scrape progress relay (content → sidepanel)
  if (request.action === 'deepScrapeProgress') {
    // Forward to sidepanel
    chrome.runtime.sendMessage(request);
    return;
  }

  // Generate expungement packet via local backend
  if (request.action === 'generatePacket') {
    generatePacketViaBackend(request.payload)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async
  }

  // Check backend availability
  if (request.action === 'checkBackend') {
    checkBackendHealth()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Save/load petitioner profile
  if (request.action === 'savePetitionerProfile') {
    chrome.storage.local.set({ petitionerProfile: request.profile }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'loadPetitionerProfile') {
    chrome.storage.local.get('petitionerProfile', (result) => {
      sendResponse({ success: true, profile: result.petitionerProfile || null });
    });
    return true;
  }

  // Save/load last scan results
  if (request.action === 'saveScanResults') {
    chrome.storage.local.set({
      lastScan: {
        timestamp: new Date().toISOString(),
        cases: request.cases,
        report: request.report
      }
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'loadLastScan') {
    chrome.storage.local.get('lastScan', (result) => {
      sendResponse({ success: true, scan: result.lastScan || null });
    });
    return true;
  }
});

// ─── Backend API Communication ─────────────────────────────────────────

const BACKEND_URL = 'http://127.0.0.1:8000';

async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    if (response.ok) {
      const data = await response.json();
      return { success: true, status: data };
    }
    return { success: false, error: `Backend returned ${response.status}` };
  } catch (e) {
    return { success: false, error: 'Backend not running. Start with: python backend/app.py' };
  }
}

async function generatePacketViaBackend(payload) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/generate-expungement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error ${response.status}: ${errorText}`);
    }

    // Response is a ZIP file
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // Trigger download
    const countyName = payload.county || 'expungement';
    const petitionerLast = (payload.petitioner?.fullName || 'packet').split(' ').pop();
    const filename = `${petitionerLast}_${countyName}_Expungement_Packet.zip`;

    // Use chrome.downloads API or fallback
    if (chrome.downloads) {
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      });
    }

    return {
      success: true,
      filename,
      downloadUrl: url
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── Tab Update Listener ───────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('public.courts.in.gov/mycase')) {
    updateBadge(tabId, '', '#3b82f6');
  }
});
