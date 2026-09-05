/**
 * Indiana Expungement Assistant - Public Legal Aid & Second Chance Portal
 * Client-Side Interactive Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initEligibilityCalculator();
  initAuditChecklist();
  initGuideTabs();
  initCopyButtons();
  initMobileNav();
});

/* ==========================================================================
   1. Statutory Eligibility Assessment (IC § 35-38-9)
   ========================================================================== */

const STATUTORY_TIERS = {
  tier1: {
    statute: 'IC § 35-38-9-1',
    name: 'Non-Convictions, Dismissals & Arrests',
    waitingYears: 1,
    grantType: 'Mandatory (Court Shall Grant)',
    isConviction: false,
    courtAction: 'The court SHALL grant expungement if no charges are pending.',
    details: 'Covers dropped charges, acquittals, or arrests where no charges were filed within 1 year or charges were dismissed. Completely mandatory grant with no filing fees in most circumstances.'
  },
  tier2: {
    statute: 'IC § 35-38-9-2',
    name: 'Misdemeanors & Reduced Felonies',
    waitingYears: 5,
    grantType: 'Mandatory (Court Shall Grant)',
    isConviction: true,
    courtAction: 'The court SHALL grant expungement if statutory criteria are met.',
    details: 'Covers Class A, B, C misdemeanors and Class D/Level 6 felonies reduced to misdemeanors. Requires 5 years from date of conviction, all fines/restitution paid, and no new convictions.'
  },
  tier3: {
    statute: 'IC § 35-38-9-3',
    name: 'Class D / Level 6 Felonies',
    waitingYears: 8,
    grantType: 'Mandatory (Court Shall Grant)',
    isConviction: true,
    courtAction: 'The court SHALL grant expungement if statutory criteria are met.',
    details: 'Covers Level 6 and Class D felonies that did not result in bodily injury. Requires 8 years from date of conviction (or 3 years from completion of sentence). Mandatory grant upon statutory proof.'
  },
  tier4: {
    statute: 'IC § 35-38-9-4',
    name: 'Major Felonies (Non-Violent Levels 1-5)',
    waitingYears: 8,
    grantType: 'Discretionary (Judicial Review)',
    isConviction: true,
    courtAction: 'The court MAY grant expungement in its judicial discretion.',
    details: 'Covers higher-level felonies (Class A, B, C or Levels 1-5) that did not result in serious bodily injury. Requires 8 years from conviction (or 3 years from sentence completion). Judge has discretion to grant or deny; court hearing is typically held.'
  },
  tier5: {
    statute: 'IC § 35-38-9-5',
    name: 'Serious Violent Felonies',
    waitingYears: 10,
    grantType: 'Prosecutor Written Consent Required',
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
  const checkSentence = document.getElementById('calcCheckSentence');
  const checkSentenceRow = document.getElementById('checkSentenceRow');
  const checkSentenceText = document.getElementById('checkSentenceText');

  const dateStepLabel = document.getElementById('dateStepLabel');
  const calcDateLabel = document.getElementById('calcDateLabel');
  const calcDateHint = document.getElementById('calcDateHint');

  // Set default date to 6 years ago for immediate illustration
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
    document.querySelectorAll('.tier-item').forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Update Date prompt & explanation based on conviction vs arrest
    if (tierKey === 'tier1') {
      if (dateStepLabel) dateStepLabel.textContent = 'Date of Dismissal or Arrest';
      if (calcDateLabel) calcDateLabel.textContent = 'Enter date charges were dismissed (or arrest date if no charges filed):';
      if (calcDateHint) {
        calcDateHint.innerHTML = '<strong>Arrest / Dismissal Date:</strong> For non-convictions (dismissals, dropped charges, or acquittals), the 1-year statutory waiting clock runs from the date charges were dismissed or the date of arrest if no charges were filed (whichever is later).';
      }
      if (checkSentenceRow) checkSentenceRow.style.display = 'none';
    } else {
      if (dateStepLabel) dateStepLabel.textContent = 'Date of Conviction / Sentencing';
      if (calcDateLabel) calcDateLabel.textContent = 'Enter date judgment of conviction / sentence was entered (NOT arrest date):';
      
      const isFelony = tierKey === 'tier3' || tierKey === 'tier4' || tierKey === 'tier5';
      if (calcDateHint) {
        if (isFelony) {
          calcDateHint.innerHTML = '<strong>Sentencing Date, NOT Arrest Date:</strong> Under Indiana Code § 35-38-9, the statutory waiting clock for felony convictions begins on the date of <em>conviction and sentencing</em> by the court, NOT when you were arrested. If a case was pending or someone was on warrant for years before sentencing, that pre-sentence time does not count. In addition, at least 3 years must have passed since you fully completed your sentence (probation, parole, or DOC release).';
        } else {
          calcDateHint.innerHTML = '<strong>Sentencing Date, NOT Arrest Date:</strong> Under Indiana Code § 35-38-9, the statutory waiting clock for criminal convictions begins on the date of <em>conviction and sentencing</em> by the court, NOT when you were arrested. If a case took years to go to trial or someone was on warrant before sentencing, that pre-sentence time does not count toward the waiting period.';
        }
      }

      if (checkSentenceRow) {
        if (isFelony) {
          checkSentenceRow.style.display = 'flex';
          const sentYears = tierKey === 'tier5' ? 5 : 3;
          if (checkSentenceText) {
            checkSentenceText.textContent = `At least ${sentYears} years have passed since completing all terms of sentence (probation, parole, or DOC discharge)`;
          }
        } else {
          checkSentenceRow.style.display = 'none';
        }
      }
    }

    const dateVal = dateInput.value;
    const finesPaid = checkFines ? checkFines.checked : true;
    const noPending = checkPending ? checkPending.checked : true;
    const noNewConvictions = checkConvictions ? checkConvictions.checked : true;
    const sentenceComplete = (checkSentenceRow && checkSentenceRow.style.display !== 'none' && checkSentence) ? checkSentence.checked : true;

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
    elapsedVal.textContent = dateVal ? `${yearsElapsed.toFixed(1)} Years elapsed` : 'Enter date';
    courtStandardVal.textContent = tier.grantType;

    if (!isTimeMet) {
      statusBadge.className = 'status-badge status-badge-warning';
      statusBadge.innerHTML = '⏳ Waiting Period In Progress';
      headline.textContent = `Eligible in Approximately ${daysRemaining} Days`;
      const dateTypeStr = tierKey === 'tier1' ? 'dismissal or arrest' : 'sentencing / conviction';
      explanation.innerHTML = `Under <b>${tier.statute}</b>, you must wait at least <b>${tier.waitingYears} years</b> from the date of ${dateTypeStr}. Based on the date provided, you have completed <b>${yearsElapsed.toFixed(1)}</b> of the required <b>${tier.waitingYears}</b> years. (Note: The County Prosecutor may give written consent to file early under IC § 35-38-9-9(b)).`;
    } else if (!finesPaid || !noPending || !noNewConvictions || !sentenceComplete) {
      statusBadge.className = 'status-badge status-badge-danger';
      statusBadge.innerHTML = '⚠️ Statutory Prerequisite Required';
      headline.textContent = 'Pre-Filing Requirements Incomplete';
      let missing = [];
      if (!finesPaid) missing.push('All court costs, fines, and restitution must be paid in full');
      if (!noPending) missing.push('No pending criminal charges in any jurisdiction');
      if (!noNewConvictions) missing.push(`No criminal convictions within the ${tier.waitingYears}-year statutory waiting window`);
      if (!sentenceComplete) missing.push('Required statutory time must have elapsed since completing all probation, parole, or DOC sentence terms');
      explanation.innerHTML = `Although the waiting period has elapsed from your ${tierKey === 'tier1' ? 'arrest/dismissal' : 'sentencing'}, Indiana law requires that all statutory conditions be satisfied prior to filing:<br>• ${missing.join('<br>• ')}`;
    } else {
      // Fully Eligible
      if (tier.grantType.includes('Mandatory')) {
        statusBadge.className = 'status-badge status-badge-success';
        statusBadge.innerHTML = '✓ Statutorily Eligible (Mandatory Grant)';
        headline.textContent = 'Court Required By Law To Grant';
        explanation.innerHTML = `Under <b>${tier.statute}</b>, if you satisfy all statutory prerequisites, the Indiana court <b>SHALL</b> grant the expungement. By law, the court does not have discretion to deny a compliant petition.`;
      } else if (tier.grantType.includes('Discretionary')) {
        statusBadge.className = 'status-badge status-badge-warning';
        statusBadge.innerHTML = '⚖️ Statutorily Eligible (Judicial Review)';
        headline.textContent = 'Court Exercises Judicial Discretion';
        explanation.innerHTML = `Under <b>${tier.statute}</b>, you meet the statutory eligibility threshold to petition the court. The judge <b>MAY</b> grant expungement after evaluating evidence of rehabilitation, character, and prosecutor input.`;
      } else {
        statusBadge.className = 'status-badge status-badge-warning';
        statusBadge.innerHTML = '📜 Prosecutor Written Consent Required';
        headline.textContent = 'Prosecutor Approval Required Before Filing';
        explanation.innerHTML = `Under <b>${tier.statute}</b>, serious violent felony expungements strictly require the written consent of the Prosecuting Attorney before the court can grant relief.`;
      }
    }
  }

  tierRadios.forEach(r => r.addEventListener('change', update));
  if (dateInput) dateInput.addEventListener('input', update);
  if (checkFines) checkFines.addEventListener('change', update);
  if (checkPending) checkPending.addEventListener('change', update);
  if (checkConvictions) checkConvictions.addEventListener('change', update);
  if (checkSentence) checkSentence.addEventListener('change', update);

  update();
}

/* ==========================================================================
   2. Record Audit Checklist
   ========================================================================== */

function initAuditChecklist() {
  const checkboxes = document.querySelectorAll('.audit-item input[type="checkbox"]');
  const progressText = document.getElementById('prepProgressText');

  function updateProgress() {
    let checkedCount = 0;
    checkboxes.forEach(cb => {
      const parent = cb.closest('.audit-item');
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
   3. User Guide Tabs
   ========================================================================== */

function initGuideTabs() {
  const tabBtns = document.querySelectorAll('.guide-tab-btn');
  const tabPanes = document.querySelectorAll('.guide-pane');

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
   4. Copy Buttons
   ========================================================================== */

function initCopyButtons() {
  const copyBtns = document.querySelectorAll('.btn-snippet-copy');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pre = btn.parentElement.querySelector('pre');
      if (!pre) return;
      const text = pre.innerText;

      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.style.backgroundColor = 'rgba(5, 150, 105, 0.5)';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.backgroundColor = '';
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
        navLinks.style.backgroundColor = '#ffffff';
        navLinks.style.padding = '1.5rem';
        navLinks.style.borderBottom = '1px solid #e2e8f0';
        navLinks.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.08)';
        navLinks.style.gap = '1.25rem';
      }
    });

    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          navLinks.style.display = 'none';
        }
      });
    });
  }
}
