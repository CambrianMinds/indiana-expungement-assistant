/**
 * Indiana Expungement Assistant - Web Showcase & Interactive Portal
 * Client-Side Interactive Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initEligibilityCalculator();
  initOneShotChecklist();
  initQuickstartTabs();
  initCopyButtons();
  initMobileNav();
  initPleadingCards();
});

/* ==========================================================================
   1. Statutory Eligibility Calculator (IC § 35-38-9)
   ========================================================================== */

const STATUTORY_TIERS = {
  tier1: {
    statute: 'IC § 35-38-9-1',
    name: 'Non-Convictions, Dismissals & Arrests',
    waitingYears: 1,
    grantType: 'Mandatory',
    isConviction: false,
    courtAction: 'The court SHALL grant expungement if no charges are pending.',
    details: 'Covers dropped charges, acquittals, or arrests where no charges were filed within 1 year or charges were dismissed. Completely mandatory grant with no filing fees in most circumstances.'
  },
  tier2: {
    statute: 'IC § 35-38-9-2',
    name: 'Misdemeanors & Reduced Felonies',
    waitingYears: 5,
    grantType: 'Mandatory',
    isConviction: true,
    courtAction: 'The court SHALL grant expungement if statutory criteria are met.',
    details: 'Covers Class A, B, C misdemeanors and Class D/Level 6 felonies reduced to misdemeanors. Requires 5 years from date of conviction, all fines/restitution paid, and no new convictions.'
  },
  tier3: {
    statute: 'IC § 35-38-9-3',
    name: 'Class D / Level 6 Felonies',
    waitingYears: 8,
    grantType: 'Mandatory',
    isConviction: true,
    courtAction: 'The court SHALL grant expungement if statutory criteria are met.',
    details: 'Covers Level 6 and Class D felonies that did not result in bodily injury. Requires 8 years from date of conviction (or 3 years from completion of sentence). Mandatory grant upon statutory proof.'
  },
  tier4: {
    statute: 'IC § 35-38-9-4',
    name: 'Major Felonies (Non-Violent Levels 1-5)',
    waitingYears: 8,
    grantType: 'Discretionary',
    isConviction: true,
    courtAction: 'The court MAY grant expungement in its judicial discretion.',
    details: 'Covers higher-level felonies (Class A, B, C or Levels 1-5) that did not result in serious bodily injury. Requires 8 years from conviction (or 3 years from sentence completion). Judge has discretion to grant or deny; court hearing is typically held.'
  },
  tier5: {
    statute: 'IC § 35-38-9-5',
    name: 'Serious Violent Felonies',
    waitingYears: 10,
    grantType: 'Prosecutor Consent Required',
    isConviction: true,
    courtAction: 'CANNOT be granted without written consent from the Prosecuting Attorney.',
    details: 'Covers offenses involving serious bodily injury, elected officials in official capacity, or major sexual offenses not excluded under § 35-38-9-5(b). Requires 10 years and explicit written prosecutor consent.'
  }
};

function initEligibilityCalculator() {
  const tierRadios = document.querySelectorAll('input[name="calcTier"]');
  const dateInput = document.getElementById('calcDate');
  const checkFines = document.getElementById('calcCheckFines');
  const checkPending = document.getElementById('calcCheckPending');
  const checkConvictions = document.getElementById('calcCheckConvictions');

  // Set default date to 6 years ago for immediate demonstration
  if (dateInput && !dateInput.value) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 6);
    dateInput.value = d.toISOString().split('T')[0];
  }

  function update() {
    // Determine selected tier
    const selectedRadio = document.querySelector('input[name="calcTier"]:checked');
    const tierKey = selectedRadio ? selectedRadio.value : 'tier2';
    const tier = STATUTORY_TIERS[tierKey];

    // Highlight active option card
    document.querySelectorAll('.tier-option').forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    const dateVal = dateInput.value;
    const finesPaid = checkFines.checked;
    const noPending = checkPending.checked;
    const noNewConvictions = checkConvictions.checked;

    let yearsElapsed = 0;
    let daysRemaining = 0;
    let isTimeMet = false;

    if (dateVal) {
      const inputDate = new Date(dateVal);
      const today = new Date();
      const diffMs = today - inputDate;
      yearsElapsed = diffMs / (1000 * 60 * 60 * 24 * 365.25);

      const targetDate = new Date(inputDate);
      targetDate.setFullYear(targetDate.getFullYear() + tier.waitingYears);
      const remainingMs = targetDate - today;
      daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
      isTimeMet = yearsElapsed >= tier.waitingYears;
    }

    // Determine status
    const statusBadge = document.getElementById('resBadge');
    const headline = document.getElementById('resHeadline');
    const statCitation = document.getElementById('resStatute');
    const waitingPeriodVal = document.getElementById('resWaiting');
    const elapsedVal = document.getElementById('resElapsed');
    const courtStandardVal = document.getElementById('resStandard');
    const explanation = document.getElementById('resExplanation');

    statCitation.textContent = tier.statute;
    waitingPeriodVal.textContent = `${tier.waitingYears} Year${tier.waitingYears > 1 ? 's' : ''}`;
    elapsedVal.textContent = dateVal ? `${yearsElapsed.toFixed(1)} Years elapsed` : 'Please enter date';
    courtStandardVal.textContent = tier.grantType;

    if (!isTimeMet) {
      statusBadge.className = 'result-badge result-badge-warning';
      statusBadge.innerHTML = '⏳ Waiting Period Incomplete';
      headline.textContent = `Eligible in ~${daysRemaining} days`;
      explanation.innerHTML = `Under <b>${tier.statute}</b>, you must wait at least <b>${tier.waitingYears} years</b>. Based on your date, you have completed <b>${yearsElapsed.toFixed(1)}</b> of the required <b>${tier.waitingYears}</b> years. (Unless the County Prosecutor gives written consent to file early under IC § 35-38-9-9(b)).`;
    } else if (!finesPaid || !noPending || !noNewConvictions) {
      statusBadge.className = 'result-badge result-badge-danger';
      statusBadge.innerHTML = '⚠️ Statutory Prerequisite Missing';
      headline.textContent = 'Pre-Filing Requirements Incomplete';
      let missing = [];
      if (!finesPaid) missing.push('All fines, fees, and court costs must be paid in full');
      if (!noPending) missing.push('No pending criminal charges in any jurisdiction');
      if (!noNewConvictions) missing.push(`No criminal convictions within the statutory waiting window`);
      explanation.innerHTML = `Even though your waiting period of ${tier.waitingYears} years has passed, Indiana law strictly requires:<br>• ${missing.join('<br>• ')}`;
    } else {
      // Eligible!
      if (tier.grantType === 'Mandatory') {
        statusBadge.className = 'result-badge result-badge-success';
        statusBadge.innerHTML = '✓ Fully Eligible (Mandatory Grant)';
        headline.textContent = 'Court Required By Law To Grant';
        explanation.innerHTML = `Under <b>${tier.statute}</b>, if you meet all statutory conditions, the Indiana court <b>SHALL</b> grant the expungement. The judge has no discretion to deny your petition.`;
      } else if (tier.grantType === 'Discretionary') {
        statusBadge.className = 'result-badge result-badge-warning';
        statusBadge.innerHTML = '⚖️ Eligible (Discretionary Review)';
        headline.textContent = 'Court Has Discretion To Grant';
        explanation.innerHTML = `Under <b>${tier.statute}</b>, you meet the statutory eligibility requirements to file, but the court <b>MAY</b> grant or deny in its judicial discretion after considering your rehabilitation, community ties, and prosecutor objections.`;
      } else {
        statusBadge.className = 'result-badge result-badge-warning';
        statusBadge.innerHTML = '📜 Prosecutor Consent Required';
        headline.textContent = 'Written Prosecutor Consent Mandatory';
        explanation.innerHTML = `Under <b>${tier.statute}</b>, serious violent offenses require explicit written approval from the Prosecuting Attorney before any court can consider the petition.`;
      }
    }
  }

  tierRadios.forEach(r => r.addEventListener('change', update));
  if (dateInput) dateInput.addEventListener('input', update);
  if (checkFines) checkFines.addEventListener('change', update);
  if (checkPending) checkPending.addEventListener('change', update);
  if (checkConvictions) checkConvictions.addEventListener('change', update);

  update();
}

/* ==========================================================================
   2. One-Shot Interactive Checklist
   ========================================================================== */

function initOneShotChecklist() {
  const checkboxes = document.querySelectorAll('.prep-item input[type="checkbox"]');
  const progressText = document.getElementById('prepProgressText');

  function updateProgress() {
    let checkedCount = 0;
    checkboxes.forEach(cb => {
      const parent = cb.closest('.prep-item');
      if (cb.checked) {
        checkedCount++;
        parent.classList.add('completed');
      } else {
        parent.classList.remove('completed');
      }
    });

    if (progressText) {
      progressText.textContent = `${checkedCount} of ${checkboxes.length} Audited`;
    }
  }

  checkboxes.forEach(cb => cb.addEventListener('change', updateProgress));
  updateProgress();
}

/* ==========================================================================
   3. Quickstart Tabs
   ========================================================================== */

function initQuickstartTabs() {
  const tabBtns = document.querySelectorAll('.qs-tab-btn');
  const tabPanes = document.querySelectorAll('.qs-tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

/* ==========================================================================
   4. Copy-to-Clipboard Buttons
   ========================================================================== */

function initCopyButtons() {
  const copyBtns = document.querySelectorAll('.btn-copy');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pre = btn.parentElement.querySelector('pre');
      if (!pre) return;
      const text = pre.innerText;

      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.style.color = '#10b981';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.color = '';
        }, 2000);
      });
    });
  });
}

/* ==========================================================================
   5. Mobile Navigation
   ========================================================================== */

function initMobileNav() {
  const toggle = document.querySelector('.mobile-nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      if (navLinks.style.display === 'flex') {
        navLinks.style.display = 'none';
      } else {
        navLinks.style.display = 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '100%';
        navLinks.style.left = '0';
        navLinks.style.right = '0';
        navLinks.style.background = 'rgba(7, 11, 20, 0.98)';
        navLinks.style.padding = '1.5rem';
        navLinks.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
        navLinks.style.gap = '1.25rem';
      }
    });

    // Close when clicking any nav item
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          navLinks.style.display = 'none';
        }
      });
    });
  }
}

/* ==========================================================================
   6. Pleadings Interactive Info
   ========================================================================== */

function initPleadingCards() {
  const cards = document.querySelectorAll('.pleading-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const name = card.querySelector('.pleading-name').textContent;
      const purpose = card.querySelector('.pleading-purpose').textContent;
      console.log(`Pleading inspected: ${name} - ${purpose}`);
    });
  });
}
