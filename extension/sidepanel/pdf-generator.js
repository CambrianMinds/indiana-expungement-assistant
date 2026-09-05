// ═══════════════════════════════════════════════════════════════════════
// Indiana Expungement Assistant — Complete In-Browser Court Document Engine
// Generates official court forms pursuant to Indiana Code § 35-38-9:
// - Form 00: Filing Instructions & Statutory Checklist (Cover Sheet)
// - Form 01: Appearance by Self-Represented Person in Civil Case (T.R. 3.1)
// - Form 02: Notice of Exclusion of Confidential Info (Form ACR, Rule 5)
// - Form 03: Confidential Info Supplement & Address History (Form 03A, IC § 35-38-9-8(b)(3))
// - Form 04: Verified Petition for Expungement (IC §§ 35-38-9-1, 2, 3, 4, 8)
// - Form 05: Notice of Filing of Expungement Petition to Prosecuting Attorney (IC § 35-38-9-8(e))
// - Form 06: Certificate of Service
// - Form 07: Proposed Order Granting Expungement of Records
// - Form 08: Verified Petition for Fee Waiver & Order (In Forma Pauperis, IC § 33-37-3-2)
// ═══════════════════════════════════════════════════════════════════════

class PdfContext {
  constructor(pdfDoc, fonts, colors) {
    this.pdfDoc = pdfDoc;
    this.fonts = fonts;
    this.colors = colors;
    this.currentPage = null;
    this.cursorY = 742;
    this.pageWidth = 612;
    this.pageHeight = 792;
    this.leftMargin = 50;
    this.rightMargin = 562;
    this.contentWidth = 512;
    this.bottomThreshold = 50;
    this.pageNumber = 0;
  }

  addPage() {
    this.currentPage = this.pdfDoc.addPage();
    this.currentPage.setSize(this.pageWidth, this.pageHeight);
    this.cursorY = 742;
    this.pageNumber++;
    return this.currentPage;
  }

  ensureSpace(neededHeight) {
    if (this.cursorY - neededHeight < this.bottomThreshold) {
      this.addPage();
    }
  }

  cleanText(text) {
    if (text == null) return '';
    return String(text).replace(/[^\x00-\x7F\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u00A7]/g, ' ');
  }

  wrapText(text, font, size, maxWidth) {
    const clean = this.cleanText(text);
    if (!clean) return [];
    const paragraphs = clean.split('\n');
    const allLines = [];

    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        allLines.push('');
        continue;
      }
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, size);
        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) allLines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) allLines.push(currentLine);
    }
    return allLines;
  }

  drawText(text, x, y, size = 8.5, fontType = 'regular', color = this.colors.darkText) {
    const font = this.fonts[fontType] || this.fonts.regular;
    const clean = this.cleanText(text);
    this.currentPage.drawText(clean, {
      x,
      y,
      size,
      font,
      color,
    });
  }

  drawCenteredText(text, y, size = 11, fontType = 'bold', color = this.colors.navyHeader) {
    const font = this.fonts[fontType] || this.fonts.bold;
    const textWidth = font.widthOfTextAtSize(text, size);
    const x = (this.pageWidth - textWidth) / 2;
    this.drawText(text, x, y, size, fontType, color);
  }

  drawLine(startX, startY, endX, endY, thickness = 0.5, color = this.colors.borderColor) {
    this.currentPage.drawLine({
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      thickness,
      color,
    });
  }

  drawRectangle(x, y, width, height, fillColor = null, borderColor = null, borderWidth = 0.5) {
    const options = { x, y, width, height };
    if (fillColor) options.color = fillColor;
    if (borderColor) {
      options.borderColor = borderColor;
      options.borderWidth = borderWidth;
    }
    this.currentPage.drawRectangle(options);
  }

  drawCaption(payload, formNumberStr = '') {
    this.ensureSpace(120);
    const county = (payload.county || 'MARION').toUpperCase();
    const court = (payload.court || 'CIRCUIT / SUPERIOR COURT').toUpperCase();
    const courtCode = payload.courtCode || 'XXXXX';
    const petName = (payload.petitioner?.fullName || 'PETITIONER').toUpperCase();
    const aliases = payload.petitioner?.aliases ? `a/k/a ${payload.petitioner.aliases}` : '';

    const startY = this.cursorY;

    // Left Column
    this.drawText('STATE OF INDIANA', 50, startY, 9, 'bold', this.colors.navyHeader);
    this.drawText(`COUNTY OF ${county}`, 50, startY - 12, 9, 'bold', this.colors.navyHeader);
    this.drawText('IN RE THE EXPUNGEMENT OF THE', 50, startY - 28, 8, 'bold');
    this.drawText('ARREST AND CONVICTION RECORDS OF:', 50, startY - 39, 8, 'bold');
    this.drawText(petName, 50, startY - 54, 9.5, 'bold', this.colors.navyHeader);

    let leftOffset = 66;
    if (aliases) {
      this.drawText(aliases, 60, startY - leftOffset, 7.5, 'italic');
      leftOffset += 11;
    }
    this.drawText('Petitioner.', 75, startY - leftOffset, 8.5, 'bold');

    // Right Column
    this.drawText(`IN THE ${court}`, 300, startY, 9, 'bold', this.colors.navyHeader);
    this.drawText(`CAUSE NO. ${courtCode}-____-XP-______`, 300, startY - 20, 8.5, 'bold');
    this.drawText('XP - EXPUNGEMENT PETITION', 300, startY - 36, 8, 'bold', this.colors.mutedText);
    if (formNumberStr) {
      this.drawText(formNumberStr, 300, startY - 50, 7.5, 'italic', this.colors.mutedText);
    }

    const bottomY = Math.min(startY - leftOffset - 10, startY - 72);
    this.drawLine(50, bottomY, 562, bottomY, 0.75, this.colors.darkText);
    this.cursorY = bottomY - 14;
  }

  drawTitleBlock(title, subtitle = '') {
    this.ensureSpace(38);
    this.drawCenteredText(title, this.cursorY, 10.5, 'bold', this.colors.navyHeader);
    this.cursorY -= 13;
    if (subtitle) {
      this.drawCenteredText(subtitle, this.cursorY, 8, 'italic', this.colors.mutedText);
      this.cursorY -= 12;
    }
    this.cursorY -= 4;
  }

  drawHeading(heading) {
    this.ensureSpace(22);
    this.drawText(heading, 50, this.cursorY, 9, 'bold', this.colors.navyHeader);
    this.cursorY -= 13;
  }

  drawParagraph(text, { size = 8.5, fontType = 'regular', color = this.colors.darkText, indent = 0, extraSpacing = 5 } = {}) {
    const font = this.fonts[fontType] || this.fonts.regular;
    const lineHeight = size * 1.35;
    const maxWidth = this.contentWidth - indent;
    const lines = this.wrapText(text, font, size, maxWidth);

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.drawText(line, 50 + indent, this.cursorY, size, fontType, color);
      this.cursorY -= lineHeight;
    }
    this.cursorY -= extraSpacing;
  }

  drawBullet(text, indent = 10) {
    const font = this.fonts.regular;
    const size = 8.5;
    const lineHeight = size * 1.35;
    const maxWidth = this.contentWidth - indent - 10;
    const lines = this.wrapText(text, font, size, maxWidth);

    if (lines.length > 0) {
      this.ensureSpace(lineHeight);
      this.drawText('•', 50 + indent, this.cursorY, size, 'bold', this.colors.navyHeader);
      this.drawText(lines[0], 50 + indent + 10, this.cursorY, size, 'regular', this.colors.darkText);
      this.cursorY -= lineHeight;

      for (let i = 1; i < lines.length; i++) {
        this.ensureSpace(lineHeight);
        this.drawText(lines[i], 50 + indent + 10, this.cursorY, size, 'regular', this.colors.darkText);
        this.cursorY -= lineHeight;
      }
    }
    this.cursorY -= 3;
  }

  drawKeyValueTable(pairs, keyWidth = 140) {
    const totalWidth = this.contentWidth;
    const valWidth = totalWidth - keyWidth;
    const rowHeight = 18;
    const tableHeight = pairs.length * rowHeight;
    this.ensureSpace(tableHeight + 6);

    let y = this.cursorY;
    for (let i = 0; i < pairs.length; i++) {
      const [key, val] = pairs[i];
      const rowY = y - (i * rowHeight);

      this.drawRectangle(50, rowY - rowHeight, keyWidth, rowHeight, this.colors.tableHeaderBg, this.colors.borderColor, 0.5);
      this.drawRectangle(50 + keyWidth, rowY - rowHeight, valWidth, rowHeight, null, this.colors.borderColor, 0.5);

      this.drawText(key, 55, rowY - 13, 8, 'bold', this.colors.darkText);
      this.drawText(String(val || ''), 50 + keyWidth + 6, rowY - 13, 8, 'regular', this.colors.darkText);
    }
    this.cursorY = y - tableHeight - 10;
  }

  drawTable(headers, rows, colWidths) {
    const rowHeight = 16;
    const totalHeight = (rows.length + 1) * rowHeight;
    this.ensureSpace(Math.min(totalHeight, 100));

    // Header row
    let xOffset = 50;
    this.drawRectangle(50, this.cursorY - rowHeight, this.contentWidth, rowHeight, this.colors.tableHeaderBg, this.colors.borderColor, 0.5);
    for (let c = 0; c < headers.length; c++) {
      this.drawText(headers[c], xOffset + 4, this.cursorY - 12, 7.5, 'bold', this.colors.navyHeader);
      xOffset += colWidths[c];
    }
    this.cursorY -= rowHeight;

    // Data rows
    for (let r = 0; r < rows.length; r++) {
      this.ensureSpace(rowHeight);
      xOffset = 50;
      const bg = r % 2 === 1 ? this.colors.tableHeaderBg : null;
      this.drawRectangle(50, this.cursorY - rowHeight, this.contentWidth, rowHeight, bg, this.colors.borderColor, 0.5);
      for (let c = 0; c < rows[r].length; c++) {
        const cellText = String(rows[r][c] || '');
        this.drawText(cellText, xOffset + 4, this.cursorY - 11.5, 7.5, 'regular', this.colors.darkText);
        xOffset += colWidths[c];
      }
      this.cursorY -= rowHeight;
    }
    this.cursorY -= 8;
  }

  drawAlertBox(title, bullets) {
    const boxWidth = this.contentWidth;
    let textHeight = 18;

    const allLines = [];
    for (const b of bullets) {
      const lines = this.wrapText(b, this.fonts.regular, 8, boxWidth - 30);
      allLines.push(lines);
      textHeight += lines.length * 11 + 3;
    }

    this.ensureSpace(textHeight + 10);
    const finalStartY = this.cursorY;
    this.drawRectangle(50, finalStartY - textHeight, boxWidth, textHeight, this.colors.alertBg, this.colors.alertBorder, 1);

    this.drawText(`[CRITICAL WARNING]  ${title}`, 60, finalStartY - 14, 8.5, 'bold', this.colors.alertText);
    let curY = finalStartY - 27;
    for (const lines of allLines) {
      if (lines.length > 0) {
        this.drawText('•', 65, curY, 8, 'bold', this.colors.alertText);
        for (let i = 0; i < lines.length; i++) {
          this.drawText(lines[i], 75, curY, 8, 'regular', this.colors.darkText);
          curY -= 11;
        }
        curY -= 2;
      }
    }
    this.cursorY = finalStartY - textHeight - 12;
  }

  drawSignatureBlock(nameUpper, title = 'Petitioner Pro Se') {
    this.ensureSpace(55);
    this.drawText('Respectfully submitted,', 50, this.cursorY, 8.5, 'regular');
    this.cursorY -= 24;
    this.drawLine(50, this.cursorY, 260, this.cursorY, 0.75, this.colors.darkText);
    this.drawText(`${nameUpper}, ${title}`, 50, this.cursorY - 11, 8.5, 'bold');
    this.drawText('Date: ________________________', 50, this.cursorY - 22, 8, 'regular');
    this.cursorY -= 32;
  }

  drawPerjuryAffirmation(nameUpper) {
    this.ensureSpace(65);
    this.drawHeading('AFFIRMATION UNDER PENALTIES FOR PERJURY (T.R. 11)');
    this.drawParagraph(
      'I affirm, under the penalties for perjury, that the foregoing representations, factual statements, ' +
      'and exhibits set forth in this pleading are true and accurate to the best of my knowledge, information, and belief.'
    );
    this.drawSignatureBlock(nameUpper, 'Petitioner Pro Se');
  }
}


// ─── FORM 00: FILING INSTRUCTIONS & STATUTORY CHECKLIST ───────────────
function buildForm00(ctx, payload) {
  ctx.addPage();
  ctx.drawTitleBlock(
    'INDIANA EXPUNGEMENT PETITION PACKET · FILING INSTRUCTIONS',
    'Self-Help Reference Guide for Self-Represented (Pro Se) Petitioners · Indiana Code § 35-38-9'
  );

  ctx.drawAlertBox('CRITICAL ONE-SHOT EXPUNGEMENT RULE WARNING (IC § 35-38-9-9(i))', [
    'Under Indiana Code § 35-38-9-9(i), a person may file a petition for conviction expungement ONLY ONE (1) TIME in their entire lifetime.',
    'FAILURE TO INCLUDE ANY CONVICTION IS PERMANENT: If you omit any conviction in this county or another county, you will NEVER be permitted to expunge it.',
    '365-DAY MULTI-COUNTY WINDOW (IC § 35-38-9-9(d)): If you have convictions in multiple Indiana counties, all petitions must be filed within 365 days of each other.'
  ]);

  ctx.drawHeading('OVERVIEW OF REQUIRED COURT DOCUMENTS IN THIS PACKET');
  ctx.drawParagraph(
    'This verified filing packet contains all necessary pleadings and notices mandated by the Indiana Trial Rules and Indiana Code § 35-38-9:'
  );
  ctx.drawBullet('Form 01 — Appearance by Self-Represented Person in Civil Case (Trial Rule 3.1)');
  ctx.drawBullet('Form 02 — Notice of Exclusion of Confidential Information from Public Access (Form ACR / Rule 5)');
  ctx.drawBullet('Form 03 — Confidential Information Supplement & 10+ Year Address History (IC § 35-38-9-8(b)(3))');
  ctx.drawBullet('Form 04 — Verified Petition for Expungement of Arrest and Conviction Records');
  ctx.drawBullet('Form 05 — Statutory Notice of Filing to Prosecuting Attorney (IC § 35-38-9-8(e))');
  ctx.drawBullet('Form 06 — Certificate of Service (Prosecutor, Indiana State Police, BMV, Arresting Agencies)');
  ctx.drawBullet('Form 07 — Proposed Order Granting Expungement of Records (for Judicial Signature)');
  if (payload.includeFeeWaiver) {
    ctx.drawBullet('Form 08 — Verified Petition for Fee Waiver (In Forma Pauperis) & Proposed Order (IC § 33-37-3-2)');
  }

  ctx.drawHeading('STEP-BY-STEP E-FILING GUIDE (INDIANA ODYSSEY IEFS)');
  ctx.drawParagraph(
    '1. Case Type: Select "XP - Expungement Petition" when initiating your new civil case in the Odyssey E-Filing System (IEFS).'
  );
  ctx.drawParagraph(
    '2. Lead Document: Upload Form 04 (Verified Petition) as your Lead Document, and attach Form 01 (Appearance) as a secondary filing.'
  );
  ctx.drawParagraph(
    '3. Confidential Documents: Form 02 (Form ACR) and Form 03 (Confidential Information Sheet) MUST be marked as "Confidential" in the e-filing system so personal identifiers (SSN, DOB) are shielded from the public.'
  );
  ctx.drawParagraph(
    '4. Service Requirements (IC § 35-38-9-8(e)): Serve certified copies on the County Prosecuting Attorney, Indiana State Police (Criminal History Section), Indiana BMV, and each arresting law enforcement agency.'
  );
  ctx.drawParagraph(
    '5. Prosecutor 30-Day Window: The Prosecuting Attorney has thirty (30) days from service to file an Answer or Objection. If no objection is filed, the court may grant expungement without a hearing.'
  );
}


// ─── FORM 01: APPEARANCE (TRIAL RULE 3.1) ─────────────────────────────
function buildForm01(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'FORM 01 — APPEARANCE');
  ctx.drawTitleBlock('APPEARANCE BY SELF-REPRESENTED PERSON IN CIVIL CASE');

  ctx.drawHeading('1. Party Information:');
  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();

  ctx.drawParagraph(
    `The Petitioner, ${name}, hereby enters an appearance pro se (self-represented) ` +
    `in the above-captioned expungement proceeding pursuant to Indiana Trial Rule 3.1.`
  );

  ctx.drawKeyValueTable([
    ['Petitioner Legal Name:', name],
    ['Current Physical Address:', pet.currentAddress || 'On file with court'],
    ['Telephone Number:', pet.phone || 'None provided'],
    ['Email Address:', pet.email || 'None provided'],
  ], 145);

  ctx.drawHeading('2. Case Type & Nature of Proceeding:');
  ctx.drawParagraph(
    'This is a civil Miscellaneous proceeding for the Expungement of Conviction and Arrest Records ' +
    '(Case Type: XP) pursuant to Indiana Code §§ 35-38-9-1, 35-38-9-2, 35-38-9-3, 35-38-9-4, and 35-38-9-8.'
  );

  ctx.drawHeading('3. Service Information:');
  ctx.drawParagraph(
    'Petitioner accepts service of all court documents, notices, and orders at the postal address and/or ' +
    'email address provided above, or via the Indiana Odyssey E-Filing System (IEFS).'
  );

  ctx.drawHeading('4. Representation Status:');
  ctx.drawParagraph(
    'Petitioner represents himself/herself in this matter and is not represented by legal counsel.'
  );

  ctx.drawSignatureBlock(nameUpper, 'Petitioner Pro Se');
}


// ─── FORM 02: FORM ACR (RULE 5) ───────────────────────────────────────
function buildForm02(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'FORM 02 — FORM ACR');
  ctx.drawTitleBlock(
    'FORM ACR · NOTICE OF EXCLUSION OF CONFIDENTIAL INFORMATION FROM PUBLIC ACCESS',
    '(Pursuant to Indiana Rules on Access to Court Records, Rule 5)'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();

  ctx.drawParagraph(
    `Pursuant to the Indiana Rules on Access to Court Records (Rule 5), Petitioner, ${name}, ` +
    `gives notice that the accompanying Confidential Information Supplement (Form 03) contains confidential ` +
    `identifying information that is excluded from public access under Indiana law, and states:`
  );

  ctx.drawHeading('1. Confidential Personal Identifiers:');
  ctx.drawParagraph(
    "The Petitioner's complete Social Security Number, Date of Birth, and Driver's License Number are excluded " +
    "from public access pursuant to Access to Court Records Rule 5(C)(1). These identifiers are supplied under separate " +
    "confidential cover because Indiana Code § 35-38-9-8(b)(8) explicitly mandates them for court review."
  );

  ctx.drawHeading('2. Complete Residential History:');
  ctx.drawParagraph(
    "Petitioner's residential history from the date of the earliest offense to present is excluded from public access " +
    "pursuant to Access to Court Records Rule 5 to protect Petitioner's personal privacy and residential security."
  );

  ctx.drawHeading('3. Separate Filing:');
  ctx.drawParagraph(
    'The excluded information is filed contemporaneously on Form 03 (Confidential Information Supplement) ' +
    'and designated as confidential pursuant to Access to Court Records Rule 5.'
  );

  ctx.drawSignatureBlock(nameUpper, 'Petitioner Pro Se');
}


// ─── FORM 03: CONFIDENTIAL INFORMATION SUPPLEMENT (FORM 03A) ──────────
function buildForm03(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'FORM 03 — CONFIDENTIAL SUPPLEMENT');
  ctx.drawTitleBlock(
    'CONFIDENTIAL INFORMATION SUPPLEMENT & RESIDENTIAL HISTORY',
    'CONFIDENTIAL PER ACCESS TO COURT RECORDS RULE 5 · NOT FOR PUBLIC ACCESS'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();

  ctx.drawHeading('I. PETITIONER PERSONAL IDENTIFIERS:');
  ctx.drawKeyValueTable([
    ['Full Legal Name:', name],
    ['Other Names / Aliases:', pet.aliases || 'None'],
    ['Date of Birth:', pet.dob || 'On file'],
    ['Social Security Number:', pet.ssn || 'XXX-XX-XXXX'],
    ["Driver's License / ID:", `${pet.driverLicense || 'None'} (State: IN)`],
    ['Current Physical Address:', pet.currentAddress || 'On file'],
    ['Contact Telephone & Email:', `Phone: ${pet.phone || 'N/A'} | Email: ${pet.email || 'N/A'}`],
  ], 145);

  ctx.drawHeading('II. RESIDENTIAL ADDRESS HISTORY (10+ YEARS):');
  ctx.drawParagraph(
    'Required by Indiana Code § 35-38-9-8(b)(3) from date of earliest offense to present:'
  );

  const addresses = (pet.addresses && pet.addresses.length > 0) ? pet.addresses : [];
  const tableRows = [];
  const count = Math.max(addresses.length, 3);

  for (let i = 0; i < count; i++) {
    const a = addresses[i] || {};
    const street = a.street || a.line || '___________________________';
    const city = a.city || '_________________';
    const st = a.state || 'IN';
    const zip = a.zipCode || '________';
    const dates = (a.fromDate || a.toDate) ? `${a.fromDate || '?'} – ${a.toDate || 'Present'}` : '____________________';

    tableRows.push([
      String(i + 1),
      street,
      city,
      st,
      zip,
      dates
    ]);
  }

  ctx.drawTable(
    ['#', 'Street Address', 'City', 'State', 'ZIP', 'Approx. Residence Dates'],
    tableRows,
    [24, 185, 95, 38, 55, 115]
  );

  ctx.drawPerjuryAffirmation(nameUpper);
}


// ─── FORM 04: VERIFIED PETITION FOR EXPUNGEMENT ────────────────────────
function buildForm04(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'FORM 04 — VERIFIED PETITION');
  ctx.drawTitleBlock(
    'VERIFIED PETITION FOR EXPUNGEMENT OF ARREST AND CONVICTION RECORDS',
    '(Pursuant to Indiana Code §§ 35-38-9-1, 35-38-9-2, 35-38-9-3, 35-38-9-4, and 35-38-9-8)'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();
  const cases = payload.cases || [];

  ctx.drawParagraph(
    `The Petitioner, ${name}, pro se, respectfully petitions this Court to expunge and seal ` +
    `all records of arrest, charge, and conviction pursuant to Indiana Code § 35-38-9, and in support shows:`,
    { fontType: 'bold' }
  );

  ctx.drawHeading('1. Petitioner Identification & Indiana Jurisdiction:');
  ctx.drawParagraph(
    `Petitioner is a resident of the State of Indiana, born on ${pet.dob || '[Date of Birth]'}, ` +
    `residing at ${pet.currentAddress || '[Current Address]'}. Petitioner's confidential identifiers ` +
    `and 10+ year residential history are filed contemporaneously on Form 03 pursuant to IC § 35-38-9-8(b).`
  );

  ctx.drawHeading('2. Enumeration of Records Seeking Expungement:');
  ctx.drawParagraph(
    'Petitioner petitions for expungement of the following criminal cases and arrest records in this jurisdiction:'
  );

  const caseRows = [];
  cases.forEach((c, idx) => {
    const disp = c.dispositionDate || c.filed || 'N/A';
    caseRows.push([
      String(idx + 1),
      c.caseNumber || 'Unknown',
      c.type || 'XP',
      c.charges || 'Criminal Proceeding',
      c.statute || 'IC § 35-38-9',
      disp
    ]);
  });

  if (caseRows.length === 0) {
    caseRows.push(['1', 'XXXXX-XXXX-XP-XXXXXX', 'XP', 'Eligible Criminal Records', 'IC § 35-38-9', 'See MyCase']);
  }

  ctx.drawTable(
    ['#', 'Cause / Case Number', 'Type', 'Charges / Offenses', 'Statutory Basis', 'Disp. Date'],
    caseRows,
    [24, 130, 38, 175, 80, 65]
  );

  ctx.drawHeading('3. Statutory Grounds for Expungement:');
  ctx.drawParagraph(
    'A. Section 1 (Arrests, Non-Convictions & Dismissals — IC § 35-38-9-1): ' +
    'At least one (1) year has elapsed since the date of arrest; no charges are pending; Petitioner was not convicted; ' +
    'and Petitioner did not participate in a pretrial diversion program unless successfully completed.'
  );
  ctx.drawParagraph(
    'B. Section 2 (Misdemeanors & Minor Offenses — IC § 35-38-9-2): ' +
    'At least five (5) years have passed since date of conviction; Petitioner has not been convicted of any crime within ' +
    'the preceding five (5) years; no criminal charges are pending; and all fines, fees, court costs, and restitution are satisfied.'
  );
  ctx.drawParagraph(
    'C. Section 3 (Class D & Level 6 Felonies — IC § 35-38-9-3): ' +
    'At least eight (8) years have passed since date of conviction; Petitioner has not been convicted of a felony within ' +
    'the preceding eight (8) years; no criminal charges are pending; and all financial obligations have been satisfied.'
  );
  ctx.drawParagraph(
    'D. Section 4 & 5 (Major Felonies — IC §§ 35-38-9-4 & 35-38-9-5): ' +
    'Petitioner satisfies all applicable statutory waiting periods, sentencing terms, and has obtained prosecutor consent if required by law.'
  );

  ctx.drawHeading('4. Mandatory Statutory Allegations:');
  ctx.drawBullet('No criminal charges are currently pending against Petitioner in any state or federal court.');
  ctx.drawBullet('Petitioner has paid all court costs, fines, administrative fees, probation fees, and restitution ordered by the Court.');
  ctx.drawBullet('Petitioner has successfully completed all terms of probation, incarceration, and community supervision.');
  ctx.drawBullet('Petitioner has never previously filed a petition for conviction expungement in Indiana (One-Shot Rule compliance).');
  ctx.drawBullet('All other petitions in other Indiana counties (if any) have been or will be filed within 365 days (IC § 35-38-9-9(d)).');

  ctx.drawHeading('5. Prayer for Relief:');
  ctx.drawParagraph(
    'WHEREFORE, Petitioner respectfully prays that this Court enter an Order Granting Expungement of all enumerated records, ' +
    'directing the Clerk of Court, Indiana State Police Criminal History Repository, Indiana Bureau of Motor Vehicles, and each ' +
    'arresting law enforcement agency to seal, redact, and prohibit disclosure of said records to the full extent of the law, ' +
    'and restoring all of Petitioner’s civil rights, and for all other just and proper relief.'
  );

  ctx.drawPerjuryAffirmation(nameUpper);
}


// ─── FORM 05: NOTICE OF FILING TO PROSECUTOR ───────────────────────────
function buildForm05(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'FORM 05 — NOTICE TO PROSECUTOR');
  ctx.drawTitleBlock(
    'NOTICE OF FILING OF EXPUNGEMENT PETITION TO PROSECUTING ATTORNEY',
    '(Pursuant to Indiana Code § 35-38-9-8(e))'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();
  const county = payload.county || 'County';

  ctx.drawHeading(`TO: OFFICE OF THE PROSECUTING ATTORNEY OF ${county.toUpperCase()} COUNTY, INDIANA`);
  ctx.drawParagraph(
    `PLEASE TAKE NOTICE that on this date, Petitioner, ${name}, filed a Verified Petition for ` +
    `Expungement of Arrest and Conviction Records pursuant to Indiana Code § 35-38-9 in the above-captioned Court.`
  );
  ctx.drawParagraph(
    'Pursuant to Indiana Code § 35-38-9-8(e), the Prosecuting Attorney has thirty (30) days from service ' +
    'of this Notice to file an Answer, Response, or Objection to the Petition for Expungement.'
  );
  ctx.drawParagraph(
    'If the Prosecuting Attorney does not file an objection within thirty (30) days, the Court may grant the ' +
    'petition without setting a hearing, provided the statutory conditions of Indiana Code § 35-38-9 are met.'
  );

  ctx.drawSignatureBlock(nameUpper, 'Petitioner Pro Se');
}


// ─── FORM 06: CERTIFICATE OF SERVICE ──────────────────────────────────
function buildForm06(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'FORM 06 — CERTIFICATE OF SERVICE');
  ctx.drawTitleBlock('CERTIFICATE OF SERVICE');

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();
  const county = payload.county || 'County';

  ctx.drawParagraph(
    `I hereby certify that on the date set forth below, a true and correct copy of the foregoing ` +
    `Verified Petition for Expungement, Appearance, Notice of Exclusion of Confidential Information, ` +
    `and Proposed Order was served upon the following parties pursuant to Indiana Trial Rule 5:`,
    { fontType: 'bold' }
  );

  ctx.drawKeyValueTable([
    ['1. County Prosecuting Attorney:', `Office of the ${county} County Prosecutor, Criminal Courts Division (via IEFS / Hand Delivery)`],
    ['2. Indiana State Police:', 'Criminal History Repository / Expungement Section, 100 N Senate Ave, Indianapolis, IN 46204'],
    ['3. Indiana Bureau of Motor Vehicles:', 'Legal Department / Records Division, 100 N Senate Ave, Room N400, Indianapolis, IN 46204'],
    ['4. Local Arresting Agencies:', `Sheriff of ${county} County and City Police Departments involved in underlying arrests`],
  ], 160);

  ctx.drawParagraph(
    'Service was completed by [X] Indiana Odyssey E-Filing System (IEFS), [X] Certified U.S. Mail, or [X] First Class Mail.'
  );

  ctx.drawSignatureBlock(nameUpper, 'Petitioner Pro Se');
}


// ─── FORM 07: PROPOSED ORDER GRANTING EXPUNGEMENT ──────────────────────
function buildForm07(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'FORM 07 — PROPOSED ORDER');
  ctx.drawTitleBlock(
    'ORDER GRANTING EXPUNGEMENT OF ARREST AND CONVICTION RECORDS',
    '(Pursuant to Indiana Code § 35-38-9)'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const cases = payload.cases || [];

  ctx.drawParagraph(
    `Come now the Court, having reviewed the Verified Petition for Expungement filed by Petitioner, ${name}, ` +
    `the response of the Prosecuting Attorney (or having noted that no timely objection was filed), ` +
    `and having reviewed the record, now finds:`,
    { fontType: 'italic' }
  );

  ctx.drawHeading('FINDINGS OF FACT & CONCLUSIONS OF LAW:');
  ctx.drawBullet('1. The Court has personal jurisdiction over Petitioner and subject-matter jurisdiction under IC § 35-38-9.');
  ctx.drawBullet('2. The Prosecuting Attorney was served with statutory notice pursuant to IC § 35-38-9-8(e).');
  ctx.drawBullet('3. Petitioner satisfies all applicable waiting periods and conditions set forth in IC § 35-38-9.');
  ctx.drawBullet('4. No criminal proceedings are pending against Petitioner in any jurisdiction.');
  ctx.drawBullet('5. Petitioner has satisfied all court costs, fines, user fees, and restitution obligations.');
  ctx.drawBullet('6. Petitioner has not previously received an expungement of a conviction record in any Indiana court.');

  ctx.drawHeading('IT IS THEREFORE ORDERED, ADJUDGED, AND DECREED:');
  ctx.drawParagraph(
    '1. The Verified Petition for Expungement is hereby GRANTED as to all records, charges, and convictions enumerated below:'
  );

  const caseLines = cases.map(c => `• Cause No. ${c.caseNumber || 'Unknown'} — ${c.charges || 'Offenses'} (${c.type || 'XP'})`);
  if (caseLines.length === 0) caseLines.push('• All qualifying arrest and conviction records on file in this cause.');
  caseLines.forEach(cl => ctx.drawBullet(cl, 14));

  ctx.drawParagraph(
    '2. The Clerk of Court, Indiana State Police, Indiana Bureau of Motor Vehicles, and all law enforcement agencies ' +
    'holding records pertaining to said cases shall permanently redact and seal all public records relating to these proceedings ' +
    'and shall not disclose them to any person except as authorized under Indiana Code § 35-38-9-10.'
  );
  ctx.drawParagraph(
    '3. Petitioner’s full civil rights (including rights to vote, hold public office, and serve on a jury) are fully RESTORED.'
  );

  ctx.ensureSpace(65);
  ctx.drawText('SO ORDERED this ________ day of ____________________, 20____.', 50, ctx.cursorY, 8.5, 'bold');
  ctx.cursorY -= 30;
  ctx.drawLine(50, ctx.cursorY, 260, ctx.cursorY, 0.75, ctx.colors.darkText);
  ctx.drawText('Judge, Circuit / Superior Court', 50, ctx.cursorY - 12, 8.5, 'bold');
  ctx.cursorY -= 24;

  ctx.drawHeading('DISTRIBUTION LIST FOR CLERK OF COURT:');
  ctx.drawParagraph(
    'The Clerk shall transmit certified copies of this Order to: (1) Petitioner, (2) Prosecuting Attorney, ' +
    '(3) Indiana State Police Records Division, (4) Indiana Bureau of Motor Vehicles, and (5) Arresting Agencies.'
  );
}


// ─── FORM 08: FEE WAIVER (IN FORMA PAUPERIS) ──────────────────────────
function buildForm08(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'FORM 08 — FEE WAIVER & ORDER');
  ctx.drawTitleBlock(
    'VERIFIED PETITION FOR WAIVER OF COURT COSTS AND FILING FEES',
    '(In Forma Pauperis · Indiana Code § 33-37-3-2)'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();

  ctx.drawParagraph(
    `Petitioner, ${name}, pro se, respectfully requests this Court waive all civil court costs, ` +
    `filing fees, and administrative charges in this action pursuant to Indiana Code § 33-37-3-2, and states:`,
    { fontType: 'bold' }
  );

  ctx.drawHeading('1. Financial Inability Statement:');
  ctx.drawParagraph(
    'Petitioner is indigent and without sufficient income, assets, or resources to pay the filing fees ' +
    'and court costs associated with initiating this expungement proceeding without causing substantial hardship to Petitioner and dependents.'
  );

  ctx.drawHeading('2. Affidavit of Income & Financial Resources:');
  ctx.drawKeyValueTable([
    ['Petitioner Legal Name:', name],
    ['Current Monthly Gross Income:', '$________________ (Employed / Self-Employed / Benefits)'],
    ['Public Assistance Received:', '[  ] SNAP / Food Stamps    [  ] Medicaid / HIP    [  ] TANF / SSI'],
    ['Number of Minor Dependents:', '______ dependent(s) living in household'],
    ['Monthly Housing & Living Expenses:', 'Rent/Mortgage: $________ | Utilities: $________ | Food: $________'],
  ], 160);

  ctx.drawPerjuryAffirmation(nameUpper);

  ctx.ensureSpace(80);
  ctx.drawLine(50, ctx.cursorY, 562, ctx.cursorY, 0.75, ctx.colors.darkText);
  ctx.cursorY -= 14;
  ctx.drawTitleBlock('ORDER ON FEE WAIVER REQUEST');
  ctx.drawParagraph(
    'The Court, having considered Petitioner’s Verified Petition for Fee Waiver, now finds that Petitioner ' +
    'is indigent and unable to pay court costs. IT IS THEREFORE ORDERED that the filing fees and court costs in this action ' +
    'are hereby [  ] WAIVED in full; [  ] DENIED.'
  );
  ctx.cursorY -= 20;
  ctx.drawLine(50, ctx.cursorY, 260, ctx.cursorY, 0.75, ctx.colors.darkText);
  ctx.drawText('Judge, Circuit / Superior Court', 50, ctx.cursorY - 12, 8.5, 'bold');
  ctx.cursorY -= 20;
}


// ─── MASTER PACKET GENERATOR ──────────────────────────────────────────
export async function generateCompletePacket(payload) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const colors = {
    darkText: rgb(0.08, 0.12, 0.18),
    mutedText: rgb(0.35, 0.42, 0.50),
    navyHeader: rgb(0.04, 0.07, 0.16),
    borderColor: rgb(0.78, 0.83, 0.88),
    tableHeaderBg: rgb(0.93, 0.95, 0.98),
    alertBg: rgb(0.99, 0.95, 0.95),
    alertBorder: rgb(0.85, 0.20, 0.20),
    alertText: rgb(0.60, 0.10, 0.10)
  };

  const ctx = new PdfContext(pdfDoc, { regular: regularFont, bold: boldFont, italic: italicFont }, colors);

  // 1. Instructions & Warnings Cover Sheet
  buildForm00(ctx, payload);

  // 2. Appearance Form (Trial Rule 3.1)
  buildForm01(ctx, payload);

  // 3. Form ACR (Exclusion of Confidential Info)
  buildForm02(ctx, payload);

  // 4. Form 03: Confidential Information Supplement & Residential History
  if (payload.includeAddressSupplement !== false) {
    buildForm03(ctx, payload);
  }

  // 5. Form 04: Verified Petition for Expungement
  buildForm04(ctx, payload);

  // 6. Form 05: Notice of Filing to Prosecuting Attorney
  buildForm05(ctx, payload);

  // 7. Form 06: Certificate of Service
  buildForm06(ctx, payload);

  // 8. Form 07: Proposed Order Granting Expungement
  buildForm07(ctx, payload);

  // 9. Form 08: Fee Waiver Request & Order
  if (payload.includeFeeWaiver) {
    buildForm08(ctx, payload);
  }

  return await pdfDoc.save();
}

// Standalone Appearance generator for backward compatibility
export async function generateAppearanceForm(payload) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const colors = {
    darkText: rgb(0.08, 0.12, 0.18),
    mutedText: rgb(0.35, 0.42, 0.50),
    navyHeader: rgb(0.04, 0.07, 0.16),
    borderColor: rgb(0.78, 0.83, 0.88),
    tableHeaderBg: rgb(0.93, 0.95, 0.98),
    alertBg: rgb(0.99, 0.95, 0.95),
    alertBorder: rgb(0.85, 0.20, 0.20),
    alertText: rgb(0.60, 0.10, 0.10)
  };

  const ctx = new PdfContext(pdfDoc, { regular: regularFont, bold: boldFont, italic: italicFont }, colors);
  buildForm01(ctx, payload);
  return await pdfDoc.save();
}

if (typeof window !== 'undefined') {
  window.PdfGenerator = {
    generateCompletePacket,
    generateAppearanceForm
  };
}
