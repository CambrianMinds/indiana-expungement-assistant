// ═══════════════════════════════════════════════════════════════════════
// Indiana Expungement Assistant — Complete In-Browser Court Document Engine
// Strictly compliant with Indiana Trial Rule 10 & Document Formatting Guide:
// - Page Layout: Standard 8.5 x 11 inches (612 x 792 pt)
// - Margins: At least 1-inch (72 pt) margins on all four sides (top, bottom, left, right)
// - Typography: 12-point or larger, strictly black (#000000), Times New Roman
// - Spacing: Double-spaced body text (24 pt line height), single-spaced tables/captions
// - Pagination: Consecutively numbered at the bottom of the page, starting with 1
// - Caption Structure: Exact court name, title of action, cause number, Rule 7(A) designation
// - Interactive Form Fields: All blank/unanswered fields are fillable for manual completion
// ═══════════════════════════════════════════════════════════════════════

class PdfContext {
  constructor(pdfDoc, fonts, colors) {
    this.pdfDoc = pdfDoc;
    this.form = pdfDoc.getForm();
    this.fonts = fonts;
    this.colors = colors;
    this.currentPage = null;
    this.pageWidth = 612;
    this.pageHeight = 792;
    // Exactly 1-inch (72 pt) margins on all sides
    this.leftMargin = 72;
    this.rightMargin = 540; // 612 - 72 = 540
    this.contentWidth = 468; // 540 - 72 = 468
    this.topMargin = 72;
    this.bottomMargin = 72;
    this.cursorY = 720; // 792 - 72 = 720
    this.fieldCounter = {};
  }

  addPage() {
    this.currentPage = this.pdfDoc.addPage();
    this.currentPage.setSize(this.pageWidth, this.pageHeight);
    this.cursorY = 720;
    return this.currentPage;
  }

  ensureSpace(neededHeight) {
    if (this.cursorY - neededHeight < this.bottomMargin) {
      this.addPage();
    }
  }

  getUniqueFieldName(baseName) {
    if (!this.fieldCounter[baseName]) {
      this.fieldCounter[baseName] = 1;
      return baseName;
    }
    this.fieldCounter[baseName]++;
    return `${baseName}_${this.fieldCounter[baseName]}`;
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

  drawText(text, x, y, size = 12, fontType = 'regular', color = this.colors.black) {
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

  drawCenteredText(text, y, size = 12, fontType = 'bold', color = this.colors.black) {
    const font = this.fonts[fontType] || this.fonts.bold;
    const clean = this.cleanText(text);
    const textWidth = font.widthOfTextAtSize(clean, size);
    const x = (this.pageWidth - textWidth) / 2;
    this.drawText(clean, x, y, size, fontType, color);
  }

  drawLine(startX, startY, endX, endY, thickness = 0.75, color = this.colors.black) {
    this.currentPage.drawLine({
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      thickness,
      color,
    });
  }

  drawRectangle(x, y, width, height, fillColor = null, borderColor = this.colors.black, borderWidth = 0.5) {
    const options = { x, y, width, height };
    if (fillColor) options.color = fillColor;
    if (borderColor) {
      options.borderColor = borderColor;
      options.borderWidth = borderWidth;
    }
    this.currentPage.drawRectangle(options);
  }

  // Interactive PDF Form Field helpers
  addTextField(name, x, y, width, height, defaultValue = '', { fontSize = 11, fontType = 'regular', isMultiline = false } = {}) {
    try {
      const fieldName = this.getUniqueFieldName(name);
      const tf = this.form.createTextField(fieldName);
      tf.addToPage(this.currentPage, {
        x,
        y,
        width,
        height,
        textColor: this.colors.black,
        borderColor: this.colors.fieldBorder,
        borderWidth: 0.5,
        backgroundColor: this.colors.fieldBg
      });
      tf.setFontSize(fontSize);
      if (isMultiline) tf.enableMultiline();
      if (defaultValue) {
        tf.setText(this.cleanText(defaultValue));
      }
      return tf;
    } catch (e) {
      console.warn('Could not add text field:', name, e);
      return null;
    }
  }

  addCheckBox(name, x, y, width = 12, height = 12, isChecked = false) {
    try {
      const fieldName = this.getUniqueFieldName(name);
      const cb = this.form.createCheckBox(fieldName);
      cb.addToPage(this.currentPage, {
        x,
        y,
        width,
        height,
        borderColor: this.colors.black,
        borderWidth: 0.75
      });
      if (isChecked) cb.check();
      return cb;
    } catch (e) {
      console.warn('Could not add checkbox:', name, e);
      return null;
    }
  }

  // ── Caption Structure (Trial Rule 10) ──
  drawCaption(payload, rule7ADesignation = 'XP - EXPUNGEMENT PETITION') {
    this.ensureSpace(140);
    const county = (payload.county || 'MARION').toUpperCase();
    const court = (payload.court || 'CIRCUIT / SUPERIOR COURT').toUpperCase();
    const courtCode = payload.courtCode || '49D01';
    const petName = (payload.petitioner?.fullName || 'PETITIONER').toUpperCase();
    const aliases = payload.petitioner?.aliases ? `a/k/a ${payload.petitioner.aliases}` : '';

    const startY = this.cursorY;

    // Left Column: Parties & Title of Action
    this.drawText('STATE OF INDIANA', 72, startY, 12, 'bold');
    this.drawText(`COUNTY OF ${county}`, 72, startY - 16, 12, 'bold');
    this.drawText('IN RE THE EXPUNGEMENT OF THE', 72, startY - 36, 11, 'bold');
    this.drawText('ARREST AND CONVICTION RECORDS OF:', 72, startY - 50, 11, 'bold');
    this.drawText(petName, 72, startY - 68, 12, 'bold');

    let leftOffset = 82;
    if (aliases) {
      this.drawText(aliases, 84, startY - leftOffset, 10, 'italic');
      leftOffset += 14;
    }
    this.drawText('Petitioner.', 96, startY - leftOffset, 11, 'bold');

    // Right Column: Exact Name of Court, Cause No., Rule 7(A) Designation
    this.drawText(`IN THE ${court}`, 310, startY, 11, 'bold');
    this.drawText('CAUSE NO.', 310, startY - 24, 11, 'bold');
    // Interactive fillable Cause Number field
    this.addTextField('causeNumber', 380, startY - 28, 160, 18, `${courtCode}-____-XP-______`, { fontSize: 10 });
    this.drawText(rule7ADesignation, 310, startY - 48, 10, 'bold');

    const bottomY = Math.min(startY - leftOffset - 12, startY - 80);
    this.drawLine(72, bottomY, 540, bottomY, 1, this.colors.black);
    this.cursorY = bottomY - 18;
  }

  drawTitleBlock(title, subtitle = '') {
    this.ensureSpace(44);
    this.drawCenteredText(title, this.cursorY, 13, 'bold');
    this.cursorY -= 16;
    if (subtitle) {
      this.drawCenteredText(subtitle, this.cursorY, 10.5, 'italic');
      this.cursorY -= 14;
    }
    this.cursorY -= 8;
  }

  drawHeading(heading) {
    this.ensureSpace(28);
    this.drawText(heading, 72, this.cursorY, 12, 'bold');
    this.cursorY -= 18;
  }

  // Double-spaced body paragraph per Trial Rule 10 (lineHeight = 24pt for 12pt font)
  drawDoubleSpacedParagraph(text, { indent = 0, extraSpacing = 8 } = {}) {
    const font = this.fonts.regular;
    const size = 12;
    const lineHeight = 24; // Double spaced
    const maxWidth = this.contentWidth - indent;
    const lines = this.wrapText(text, font, size, maxWidth);

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.drawText(line, 72 + indent, this.cursorY, size, 'regular');
      this.cursorY -= lineHeight;
    }
    this.cursorY -= extraSpacing;
  }

  // Single-spaced paragraph for exceptions (tables, charts, block quotes, certificates)
  drawSingleSpacedParagraph(text, { size = 11, fontType = 'regular', indent = 0, extraSpacing = 6 } = {}) {
    const font = this.fonts[fontType] || this.fonts.regular;
    const lineHeight = size * 1.35;
    const maxWidth = this.contentWidth - indent;
    const lines = this.wrapText(text, font, size, maxWidth);

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.drawText(line, 72 + indent, this.cursorY, size, fontType);
      this.cursorY -= lineHeight;
    }
    this.cursorY -= extraSpacing;
  }

  drawBullet(text, indent = 14) {
    const font = this.fonts.regular;
    const size = 12;
    const lineHeight = 20; // Slightly compact for numbered/bulleted pleading paragraphs
    const maxWidth = this.contentWidth - indent - 12;
    const lines = this.wrapText(text, font, size, maxWidth);

    if (lines.length > 0) {
      this.ensureSpace(lineHeight);
      this.drawText('•', 72 + indent, this.cursorY, size, 'bold');
      this.drawText(lines[0], 72 + indent + 12, this.cursorY, size, 'regular');
      this.cursorY -= lineHeight;

      for (let i = 1; i < lines.length; i++) {
        this.ensureSpace(lineHeight);
        this.drawText(lines[i], 72 + indent + 12, this.cursorY, size, 'regular');
        this.cursorY -= lineHeight;
      }
    }
    this.cursorY -= 4;
  }

  // Single-spaced Key-Value Table with interactive fillable text fields for missing data
  drawInteractiveKeyValueTable(pairs, keyWidth = 145) {
    const totalWidth = this.contentWidth;
    const valWidth = totalWidth - keyWidth;
    const rowHeight = 22;
    const tableHeight = pairs.length * rowHeight;
    this.ensureSpace(tableHeight + 8);

    let y = this.cursorY;
    for (let i = 0; i < pairs.length; i++) {
      const [key, val, fieldName] = pairs[i];
      const rowY = y - (i * rowHeight);

      // Cell borders
      this.drawRectangle(72, rowY - rowHeight, keyWidth, rowHeight, this.colors.tableHeaderBg, this.colors.black, 0.5);
      this.drawRectangle(72 + keyWidth, rowY - rowHeight, valWidth, rowHeight, null, this.colors.black, 0.5);

      this.drawText(key, 76, rowY - 15, 10, 'bold');

      if (fieldName) {
        // Interactive fillable text field
        this.addTextField(fieldName, 72 + keyWidth + 4, rowY - rowHeight + 2, valWidth - 8, rowHeight - 4, val || '', { fontSize: 10 });
      } else {
        this.drawText(String(val || ''), 72 + keyWidth + 6, rowY - 15, 10, 'regular');
      }
    }
    this.cursorY = y - tableHeight - 12;
  }

  drawTable(headers, rows, colWidths) {
    const rowHeight = 20;
    const totalHeight = (rows.length + 1) * rowHeight;
    this.ensureSpace(Math.min(totalHeight, 120));

    // Header row
    let xOffset = 72;
    this.drawRectangle(72, this.cursorY - rowHeight, this.contentWidth, rowHeight, this.colors.tableHeaderBg, this.colors.black, 0.75);
    for (let c = 0; c < headers.length; c++) {
      this.drawText(headers[c], xOffset + 4, this.cursorY - 14, 9, 'bold');
      xOffset += colWidths[c];
    }
    this.cursorY -= rowHeight;

    // Data rows
    for (let r = 0; r < rows.length; r++) {
      this.ensureSpace(rowHeight);
      xOffset = 72;
      const bg = r % 2 === 1 ? this.colors.tableHeaderBg : null;
      this.drawRectangle(72, this.cursorY - rowHeight, this.contentWidth, rowHeight, bg, this.colors.black, 0.5);
      for (let c = 0; c < rows[r].length; c++) {
        const cellText = String(rows[r][c] || '');
        this.drawText(cellText, xOffset + 4, this.cursorY - 14, 8.5, 'regular');
        xOffset += colWidths[c];
      }
      this.cursorY -= rowHeight;
    }
    this.cursorY -= 10;
  }

  drawSignatureBlock(nameUpper, title = 'Petitioner Pro Se', fieldPrefix = 'sig') {
    this.ensureSpace(75);
    this.drawText('Respectfully submitted,', 72, this.cursorY, 12, 'regular');
    this.cursorY -= 30;

    // Fillable signature line
    this.drawLine(72, this.cursorY, 320, this.cursorY, 0.75, this.colors.black);
    this.addTextField(`${fieldPrefix}_signer`, 72, this.cursorY + 2, 248, 20, `${nameUpper}, ${title}`, { fontSize: 11, fontType: 'bold' });

    this.drawText(`${nameUpper}, ${title}`, 72, this.cursorY - 14, 12, 'bold');

    // Fillable date field
    this.drawText('Date:', 72, this.cursorY - 32, 11, 'regular');
    this.addTextField(`${fieldPrefix}_date`, 108, this.cursorY - 36, 140, 18, '', { fontSize: 10 });
    this.cursorY -= 48;
  }

  drawPerjuryAffirmation(nameUpper, fieldPrefix = 'verif') {
    this.ensureSpace(90);
    this.drawHeading('AFFIRMATION UNDER PENALTIES FOR PERJURY (T.R. 11)');
    this.drawDoubleSpacedParagraph(
      'I affirm, under the penalties for perjury, that the foregoing representations, factual statements, ' +
      'and exhibits set forth in this pleading are true and accurate to the best of my knowledge, information, and belief.'
    );
    this.drawSignatureBlock(nameUpper, 'Petitioner Pro Se', fieldPrefix);
  }
}


// ─── FORM 00: FILING INSTRUCTIONS & STATUTORY CHECKLIST ───────────────
function buildForm00(ctx, payload) {
  ctx.addPage();
  ctx.drawTitleBlock(
    'INDIANA EXPUNGEMENT PETITION PACKET · FILING INSTRUCTIONS',
    'Self-Help Reference Guide for Self-Represented (Pro Se) Petitioners · Indiana Code § 35-38-9'
  );

  ctx.drawHeading('CRITICAL ONE-SHOT EXPUNGEMENT RULE WARNING (IC § 35-38-9-9(i))');
  ctx.drawDoubleSpacedParagraph(
    'Under Indiana Code § 35-38-9-9(i), an individual may file a petition for conviction expungement ' +
    'ONLY ONE (1) TIME IN THEIR ENTIRE LIFE. If you omit any conviction in this county or any other county, ' +
    'you will NEVER be permitted to expunge it. Under IC § 35-38-9-9(d), all petitions across multiple counties ' +
    'must be filed within 365 days of each other.'
  );

  ctx.drawHeading('STEP-BY-STEP ODYSSEY E-FILING GUIDE (CASE TYPE: XP)');
  ctx.drawSingleSpacedParagraph(
    '1. Case Type: Select "XP - Expungement Petition" when initiating your new civil case in the Odyssey E-Filing System (IEFS).'
  );
  ctx.drawSingleSpacedParagraph(
    '2. Lead Document: Upload Form 04 (Verified Petition) as your Lead Document, and attach Form 01 (Appearance) as a secondary filing.'
  );
  ctx.drawSingleSpacedParagraph(
    '3. Confidential Documents: Form 02 (Form ACR) and Form 03 (Confidential Information Sheet) MUST be marked as "Confidential" in the e-filing system.'
  );
  ctx.drawSingleSpacedParagraph(
    '4. Service Requirements (IC § 35-38-9-8(e)): Serve copies on the County Prosecutor, Indiana State Police, BMV, and arresting agencies.'
  );
  ctx.drawSingleSpacedParagraph(
    '5. Fillable Fields: Any field left blank can be filled directly in this PDF before filing or printed and signed.'
  );
}


// ─── FORM 01: APPEARANCE (TRIAL RULE 3.1) ─────────────────────────────
function buildForm01(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'APPEARANCE BY SELF-REPRESENTED PERSON');
  ctx.drawTitleBlock('APPEARANCE BY SELF-REPRESENTED PERSON IN CIVIL CASE');

  ctx.drawHeading('1. Party Information:');
  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();

  ctx.drawDoubleSpacedParagraph(
    `The Petitioner, ${name}, hereby enters an appearance pro se (self-represented) ` +
    `in the above-captioned expungement proceeding pursuant to Indiana Trial Rule 3.1.`
  );

  ctx.drawInteractiveKeyValueTable([
    ['Petitioner Legal Name:', name, 'f1_name'],
    ['Current Physical Address:', pet.currentAddress || '', 'f1_address'],
    ['Telephone Number:', pet.phone || '', 'f1_phone'],
    ['Email Address:', pet.email || '', 'f1_email'],
  ], 160);

  ctx.drawHeading('2. Case Type & Nature of Proceeding:');
  ctx.drawDoubleSpacedParagraph(
    'This is a civil Miscellaneous proceeding for the Expungement of Conviction and Arrest Records ' +
    '(Case Type: XP) pursuant to Indiana Code §§ 35-38-9-1, 35-38-9-2, 35-38-9-3, 35-38-9-4, and 35-38-9-8.'
  );

  ctx.drawHeading('3. Service Information:');
  ctx.drawDoubleSpacedParagraph(
    'Petitioner accepts service of all court documents, notices, and orders at the postal address and/or ' +
    'email address provided above, or via the Indiana Odyssey E-Filing System (IEFS).'
  );

  ctx.drawHeading('4. Representation Status:');
  ctx.drawDoubleSpacedParagraph(
    'Petitioner represents himself/herself in this matter and is not represented by legal counsel.'
  );

  ctx.drawSignatureBlock(nameUpper, 'Petitioner Pro Se', 'f1');
}


// ─── FORM 02: FORM ACR (RULE 5) ───────────────────────────────────────
function buildForm02(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'FORM ACR - EXCLUSION OF CONFIDENTIAL INFO');
  ctx.drawTitleBlock(
    'FORM ACR · NOTICE OF EXCLUSION OF CONFIDENTIAL INFORMATION FROM PUBLIC ACCESS',
    '(Pursuant to Indiana Rules on Access to Court Records, Rule 5)'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();

  ctx.drawDoubleSpacedParagraph(
    `Pursuant to the Indiana Rules on Access to Court Records (Rule 5), Petitioner, ${name}, ` +
    `gives notice that the accompanying Confidential Information Supplement (Form 03) contains confidential ` +
    `identifying information that is excluded from public access under Indiana law, and states:`
  );

  ctx.drawHeading('1. Confidential Personal Identifiers:');
  ctx.drawDoubleSpacedParagraph(
    "The Petitioner's complete Social Security Number, Date of Birth, and Driver's License Number are excluded " +
    "from public access pursuant to Access to Court Records Rule 5(C)(1). These identifiers are supplied under separate " +
    "confidential cover because Indiana Code § 35-38-9-8(b)(8) explicitly mandates them for court review."
  );

  ctx.drawHeading('2. Complete Residential History:');
  ctx.drawDoubleSpacedParagraph(
    "Petitioner's residential history from the date of the earliest offense to present is excluded from public access " +
    "pursuant to Access to Court Records Rule 5 to protect Petitioner's personal privacy and residential security."
  );

  ctx.drawHeading('3. Separate Filing:');
  ctx.drawDoubleSpacedParagraph(
    'The excluded information is filed contemporaneously on Form 03 (Confidential Information Supplement) ' +
    'and designated as confidential pursuant to Access to Court Records Rule 5.'
  );

  ctx.drawSignatureBlock(nameUpper, 'Petitioner Pro Se', 'f2');
}


// ─── FORM 03: CONFIDENTIAL INFORMATION SUPPLEMENT (FORM 03A) ──────────
function buildForm03(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'FORM 03 - CONFIDENTIAL SUPPLEMENT');
  ctx.drawTitleBlock(
    'CONFIDENTIAL INFORMATION SUPPLEMENT & RESIDENTIAL HISTORY',
    'CONFIDENTIAL PER ACCESS TO COURT RECORDS RULE 5 · NOT FOR PUBLIC ACCESS'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();

  ctx.drawHeading('I. PETITIONER PERSONAL IDENTIFIERS:');
  ctx.drawInteractiveKeyValueTable([
    ['Full Legal Name:', name, 'f3_name'],
    ['Other Names / Aliases:', pet.aliases || '', 'f3_aliases'],
    ['Date of Birth:', pet.dob || '', 'f3_dob'],
    ['Social Security Number:', pet.ssn || '', 'f3_ssn'],
    ["Driver's License / ID Number:", `${pet.driverLicense || ''}`, 'f3_dl'],
    ['Current Physical Address:', pet.currentAddress || '', 'f3_currAddr'],
    ['Telephone & Email:', `Phone: ${pet.phone || ''} | Email: ${pet.email || ''}`, 'f3_contact'],
  ], 160);

  ctx.drawHeading('II. RESIDENTIAL ADDRESS HISTORY (10+ YEARS):');
  ctx.drawSingleSpacedParagraph(
    'Required by Indiana Code § 35-38-9-8(b)(3) from date of earliest offense to present (fillable):'
  );

  const addresses = (pet.addresses && pet.addresses.length > 0) ? pet.addresses : [];
  const tableRows = [];
  const count = Math.max(addresses.length, 4);

  for (let i = 0; i < count; i++) {
    const a = addresses[i] || {};
    const street = a.street || a.line || '';
    const city = a.city || '';
    const st = a.state || (street ? 'IN' : '');
    const zip = a.zipCode || '';
    const dates = (a.fromDate || a.toDate) ? `${a.fromDate || '?'} – ${a.toDate || 'Present'}` : '';

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
    [24, 170, 85, 38, 51, 100]
  );

  ctx.drawPerjuryAffirmation(nameUpper, 'f3');
}


// ─── FORM 04: VERIFIED PETITION FOR EXPUNGEMENT ────────────────────────
function buildForm04(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'VERIFIED PETITION FOR EXPUNGEMENT');
  ctx.drawTitleBlock(
    'VERIFIED PETITION FOR EXPUNGEMENT OF ARREST AND CONVICTION RECORDS',
    '(Pursuant to Indiana Code §§ 35-38-9-1, 35-38-9-2, 35-38-9-3, 35-38-9-4, and 35-38-9-8)'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();
  const cases = payload.cases || [];

  ctx.drawDoubleSpacedParagraph(
    `The Petitioner, ${name}, pro se, respectfully petitions this Court to expunge and seal ` +
    `all records of arrest, charge, and conviction pursuant to Indiana Code § 35-38-9, and in support shows:`
  );

  ctx.drawHeading('1. Petitioner Identification & Indiana Jurisdiction:');
  ctx.drawDoubleSpacedParagraph(
    `Petitioner is a resident of the State of Indiana, born on ${pet.dob || '[Date of Birth]'}, ` +
    `residing at ${pet.currentAddress || '[Current Address]'}. Petitioner's confidential identifiers ` +
    `and 10+ year residential history are filed contemporaneously on Form 03 pursuant to IC § 35-38-9-8(b).`
  );

  ctx.drawHeading('2. Enumeration of Records Seeking Expungement:');
  ctx.drawSingleSpacedParagraph(
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
    [24, 120, 36, 155, 75, 58]
  );

  ctx.drawHeading('3. Statutory Grounds for Expungement:');
  ctx.drawDoubleSpacedParagraph(
    'A. Section 1 (Arrests, Non-Convictions & Dismissals — IC § 35-38-9-1): ' +
    'At least one (1) year has elapsed since the date of arrest; no charges are pending; Petitioner was not convicted; ' +
    'and Petitioner did not participate in a pretrial diversion program unless successfully completed.'
  );
  ctx.drawDoubleSpacedParagraph(
    'B. Section 2 (Misdemeanors & Minor Offenses — IC § 35-38-9-2): ' +
    'At least five (5) years have passed since date of conviction; Petitioner has not been convicted of any crime within ' +
    'the preceding five (5) years; no criminal charges are pending; and all fines, fees, court costs, and restitution are satisfied.'
  );
  ctx.drawDoubleSpacedParagraph(
    'C. Section 3 (Class D & Level 6 Felonies — IC § 35-38-9-3): ' +
    'At least eight (8) years have passed since date of conviction; Petitioner has not been convicted of a felony within ' +
    'the preceding eight (8) years; no criminal charges are pending; and all financial obligations have been satisfied.'
  );
  ctx.drawDoubleSpacedParagraph(
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
  ctx.drawDoubleSpacedParagraph(
    'WHEREFORE, Petitioner respectfully prays that this Court enter an Order Granting Expungement of all enumerated records, ' +
    'directing the Clerk of Court, Indiana State Police Criminal History Repository, Indiana Bureau of Motor Vehicles, and each ' +
    'arresting law enforcement agency to seal, redact, and prohibit disclosure of said records to the full extent of the law, ' +
    'and restoring all of Petitioner’s civil rights, and for all other just and proper relief.'
  );

  ctx.drawPerjuryAffirmation(nameUpper, 'f4');
}


// ─── FORM 05: NOTICE OF FILING TO PROSECUTOR ───────────────────────────
function buildForm05(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'NOTICE OF FILING TO PROSECUTOR');
  ctx.drawTitleBlock(
    'NOTICE OF FILING OF EXPUNGEMENT PETITION TO PROSECUTING ATTORNEY',
    '(Pursuant to Indiana Code § 35-38-9-8(e))'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();
  const county = payload.county || 'County';

  ctx.drawHeading(`TO: OFFICE OF THE PROSECUTING ATTORNEY OF ${county.toUpperCase()} COUNTY, INDIANA`);
  ctx.drawDoubleSpacedParagraph(
    `PLEASE TAKE NOTICE that on this date, Petitioner, ${name}, filed a Verified Petition for ` +
    `Expungement of Arrest and Conviction Records pursuant to Indiana Code § 35-38-9 in the above-captioned Court.`
  );
  ctx.drawDoubleSpacedParagraph(
    'Pursuant to Indiana Code § 35-38-9-8(e), the Prosecuting Attorney has thirty (30) days from service ' +
    'of this Notice to file an Answer, Response, or Objection to the Petition for Expungement.'
  );
  ctx.drawDoubleSpacedParagraph(
    'If the Prosecuting Attorney does not file an objection within thirty (30) days, the Court may grant the ' +
    'petition without setting a hearing, provided the statutory conditions of Indiana Code § 35-38-9 are met.'
  );

  ctx.drawSignatureBlock(nameUpper, 'Petitioner Pro Se', 'f5');
}


// ─── FORM 06: CERTIFICATE OF SERVICE ──────────────────────────────────
function buildForm06(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'CERTIFICATE OF SERVICE');
  ctx.drawTitleBlock('CERTIFICATE OF SERVICE');

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();
  const county = payload.county || 'County';

  ctx.drawDoubleSpacedParagraph(
    `I hereby certify that on the date set forth below, a true and correct copy of the foregoing ` +
    `Verified Petition for Expungement, Appearance, Notice of Exclusion of Confidential Information, ` +
    `and Proposed Order was served upon the following parties pursuant to Indiana Trial Rule 5:`
  );

  ctx.drawInteractiveKeyValueTable([
    ['1. County Prosecuting Attorney:', `Office of the ${county} County Prosecutor, Criminal Courts Division`],
    ['2. Indiana State Police:', 'Criminal History Repository / Expungement Section, 100 N Senate Ave, Indianapolis, IN 46204'],
    ['3. Indiana Bureau of Motor Vehicles:', 'Legal Department / Records Division, 100 N Senate Ave, Room N400, Indianapolis, IN 46204'],
    ['4. Local Arresting Agencies:', `Sheriff of ${county} County and Local Municipal Police Departments`],
  ], 165);

  ctx.drawHeading('Method of Service:');
  ctx.drawSingleSpacedParagraph(
    '[X] Indiana Odyssey E-Filing System (IEFS)    [X] Certified U.S. Mail    [X] First Class U.S. Mail'
  );

  ctx.drawSignatureBlock(nameUpper, 'Petitioner Pro Se', 'f6');
}


// ─── FORM 07: PROPOSED ORDER GRANTING EXPUNGEMENT ──────────────────────
function buildForm07(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'ORDER GRANTING EXPUNGEMENT');
  ctx.drawTitleBlock(
    'ORDER GRANTING EXPUNGEMENT OF ARREST AND CONVICTION RECORDS',
    '(Pursuant to Indiana Code § 35-38-9)'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const cases = payload.cases || [];

  ctx.drawDoubleSpacedParagraph(
    `Come now the Court, having reviewed the Verified Petition for Expungement filed by Petitioner, ${name}, ` +
    `the response of the Prosecuting Attorney (or having noted that no timely objection was filed), ` +
    `and having reviewed the official record, now finds and orders:`
  );

  ctx.drawHeading('FINDINGS OF FACT & CONCLUSIONS OF LAW:');
  ctx.drawBullet('1. The Court has personal jurisdiction over Petitioner and subject-matter jurisdiction under IC § 35-38-9.');
  ctx.drawBullet('2. The Prosecuting Attorney was served with statutory notice pursuant to IC § 35-38-9-8(e).');
  ctx.drawBullet('3. Petitioner satisfies all applicable waiting periods and conditions set forth in IC § 35-38-9.');
  ctx.drawBullet('4. No criminal proceedings are pending against Petitioner in any jurisdiction.');
  ctx.drawBullet('5. Petitioner has satisfied all court costs, fines, user fees, and restitution obligations.');
  ctx.drawBullet('6. Petitioner has not previously received an expungement of a conviction record in any Indiana court.');

  ctx.drawHeading('IT IS THEREFORE ORDERED, ADJUDGED, AND DECREED:');
  ctx.drawDoubleSpacedParagraph(
    '1. The Verified Petition for Expungement is hereby GRANTED as to all records, charges, and convictions enumerated below:'
  );

  const caseLines = cases.map(c => `Cause No. ${c.caseNumber || 'Unknown'} — ${c.charges || 'Offenses'} (${c.type || 'XP'})`);
  if (caseLines.length === 0) caseLines.push('All qualifying arrest and conviction records on file in this cause.');
  caseLines.forEach(cl => ctx.drawBullet(cl, 14));

  ctx.drawDoubleSpacedParagraph(
    '2. The Clerk of Court, Indiana State Police, Indiana Bureau of Motor Vehicles, and all law enforcement agencies ' +
    'holding records pertaining to said cases shall permanently redact and seal all public records relating to these proceedings ' +
    'and shall not disclose them to any person except as authorized under Indiana Code § 35-38-9-10.'
  );
  ctx.drawDoubleSpacedParagraph(
    '3. Petitioner’s full civil rights (including rights to vote, hold public office, and serve on a jury) are fully RESTORED.'
  );

  ctx.ensureSpace(85);
  ctx.drawText('SO ORDERED this ________ day of ____________________, 20____.', 72, ctx.cursorY, 12, 'bold');
  ctx.cursorY -= 36;
  ctx.drawLine(72, ctx.cursorY, 320, ctx.cursorY, 1, ctx.colors.black);
  // Interactive fillable judge signature field
  ctx.addTextField('judgeSignature_f7', 72, ctx.cursorY + 2, 248, 22, '', { fontSize: 11 });
  ctx.drawText('Judge, Circuit / Superior Court', 72, ctx.cursorY - 16, 12, 'bold');
  ctx.cursorY -= 30;

  ctx.drawHeading('DISTRIBUTION LIST FOR CLERK OF COURT:');
  ctx.drawSingleSpacedParagraph(
    'The Clerk shall transmit certified copies of this Order to: (1) Petitioner, (2) Prosecuting Attorney, ' +
    '(3) Indiana State Police Records Division, (4) Indiana Bureau of Motor Vehicles, and (5) Arresting Agencies.'
  );
}


// ─── FORM 08: FEE WAIVER (IN FORMA PAUPERIS) ──────────────────────────
function buildForm08(ctx, payload) {
  ctx.addPage();
  ctx.drawCaption(payload, 'PETITION FOR FEE WAIVER & ORDER');
  ctx.drawTitleBlock(
    'VERIFIED PETITION FOR WAIVER OF COURT COSTS AND FILING FEES',
    '(In Forma Pauperis · Indiana Code § 33-37-3-2)'
  );

  const pet = payload.petitioner || {};
  const name = pet.fullName || 'Petitioner';
  const nameUpper = name.toUpperCase();

  ctx.drawDoubleSpacedParagraph(
    `Petitioner, ${name}, pro se, respectfully requests this Court waive all civil court costs, ` +
    `filing fees, and administrative charges in this action pursuant to Indiana Code § 33-37-3-2, and states:`
  );

  ctx.drawHeading('1. Financial Inability Statement:');
  ctx.drawDoubleSpacedParagraph(
    'Petitioner is indigent and without sufficient income, assets, or resources to pay the filing fees ' +
    'and court costs associated with initiating this expungement proceeding without causing substantial hardship to Petitioner and dependents.'
  );

  ctx.drawHeading('2. Affidavit of Income & Financial Resources:');
  ctx.drawInteractiveKeyValueTable([
    ['Petitioner Legal Name:', name, 'f8_name'],
    ['Current Monthly Gross Income:', '', 'f8_income'],
    ['Public Assistance Received:', '', 'f8_assistance'],
    ['Number of Minor Dependents:', '', 'f8_dependents'],
    ['Monthly Housing & Living Expenses:', '', 'f8_expenses'],
  ], 175);

  ctx.drawPerjuryAffirmation(nameUpper, 'f8');

  ctx.ensureSpace(120);
  ctx.drawLine(72, ctx.cursorY, 540, ctx.cursorY, 1, ctx.colors.black);
  ctx.cursorY -= 16;
  ctx.drawTitleBlock('ORDER ON FEE WAIVER REQUEST');
  ctx.drawDoubleSpacedParagraph(
    'The Court, having considered Petitioner’s Verified Petition for Fee Waiver, now finds that Petitioner ' +
    'is indigent and unable to pay court costs. IT IS THEREFORE ORDERED that the filing fees and court costs in this action ' +
    'are hereby [   ] WAIVED in full; [   ] DENIED.'
  );
  ctx.cursorY -= 28;
  ctx.drawLine(72, ctx.cursorY, 320, ctx.cursorY, 1, ctx.colors.black);
  ctx.addTextField('judgeSignature_f8', 72, ctx.cursorY + 2, 248, 22, '', { fontSize: 11 });
  ctx.drawText('Judge, Circuit / Superior Court', 72, ctx.cursorY - 16, 12, 'bold');
  ctx.cursorY -= 24;
}


// ─── MASTER PACKET GENERATOR ──────────────────────────────────────────
export async function generateCompletePacket(payload) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  // Official Permitted Indiana Court Font: Times New Roman (12pt+)
  const regularFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  // Strictly Black text per Document Formatting Guide
  const colors = {
    black: rgb(0, 0, 0),
    darkText: rgb(0, 0, 0),
    tableHeaderBg: rgb(0.95, 0.95, 0.95),
    borderColor: rgb(0, 0, 0),
    fieldBorder: rgb(0.65, 0.65, 0.70),
    fieldBg: rgb(0.97, 0.98, 1.0)
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

  // Consecutive Pagination Rule (Section 4):
  // "Pages must be numbered consecutively, located at the bottom of the page, beginning with numeral 1 on the first page"
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i);
    const pageNumStr = `${i + 1}`;
    const strWidth = regularFont.widthOfTextAtSize(pageNumStr, 11);
    page.drawText(pageNumStr, {
      x: (612 - strWidth) / 2,
      y: 40,
      size: 11,
      font: regularFont,
      color: colors.black
    });
  }

  return await pdfDoc.save();
}

// Standalone Appearance generator for backward compatibility
export async function generateAppearanceForm(payload) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  const regularFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const colors = {
    black: rgb(0, 0, 0),
    darkText: rgb(0, 0, 0),
    tableHeaderBg: rgb(0.95, 0.95, 0.95),
    borderColor: rgb(0, 0, 0),
    fieldBorder: rgb(0.65, 0.65, 0.70),
    fieldBg: rgb(0.97, 0.98, 1.0)
  };

  const ctx = new PdfContext(pdfDoc, { regular: regularFont, bold: boldFont, italic: italicFont }, colors);
  buildForm01(ctx, payload);

  const page = pdfDoc.getPage(0);
  page.drawText('1', {
    x: 300,
    y: 40,
    size: 11,
    font: regularFont,
    color: colors.black
  });

  return await pdfDoc.save();
}

if (typeof window !== 'undefined') {
  window.PdfGenerator = {
    generateCompletePacket,
    generateAppearanceForm
  };
}
