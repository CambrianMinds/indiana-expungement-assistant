// PDF Generator using pdf-lib

async function generateAppearanceForm(payload) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  
  // Create a new PDFDocument
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size 8.5x11 inches (72 points per inch)

  // Embed the standard fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { petitioner, county, court, courtCode } = payload;
  const name = petitioner.fullName || 'PETITIONER NAME';
  const nameUpper = name.toUpperCase();
  const countyName = county || 'Unknown';
  const courtName = court || 'Unknown Court';
  const causeStr = `CAUSE NO. ${courtCode || 'XXXXX'}-____-XP-______`;
  
  const drawText = (text, x, y, size = 10, useBold = false) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: useBold ? boldFont : font,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  // Caption Block
  drawText('STATE OF INDIANA', 50, 720, 10, true);
  drawText(`COUNTY OF ${countyName.toUpperCase()}`, 50, 705, 10, true);
  
  drawText('IN RE THE EXPUNGEMENT OF THE', 50, 680, 10, true);
  drawText('ARREST AND CONVICTION RECORDS OF:', 50, 665, 10, true);
  
  drawText(nameUpper, 50, 640, 10, true);
  if (petitioner.aliases) {
    drawText(`a/k/a ${petitioner.aliases}`, 60, 625, 10, false);
    drawText('Petitioner.', 80, 610, 10, false);
  } else {
    drawText('Petitioner.', 80, 625, 10, false);
  }

  drawText(`IN THE ${courtName.toUpperCase()}`, 300, 720, 10, true);
  drawText(causeStr, 300, 690, 10, true);
  drawText('XP - EXPUNGEMENT PETITION', 300, 660, 10, true);

  // Divider Line
  page.drawLine({
    start: { x: 50, y: 590 },
    end: { x: 560, y: 590 },
    thickness: 1,
    color: rgb(0, 0, 0)
  });

  // Title
  drawText('APPEARANCE BY SELF-REPRESENTED PERSON IN CIVIL CASE', 120, 560, 12, true);

  // Body Sections
  drawText('1. Party Information:', 50, 530, 10, true);
  drawText(`The Petitioner, ${name}, hereby enters his/her appearance pro se (self-represented)`, 50, 515, 10, false);
  drawText('in the above-captioned expungement proceeding pursuant to Indiana Trial Rule 3.1.', 50, 500, 10, false);

  drawText('Name:', 70, 470, 10, true);
  drawText(name, 200, 470, 10, false);

  drawText('Current Physical Address:', 70, 450, 10, true);
  drawText(petitioner.currentAddress || '_________________________________________________', 200, 450, 10, false);

  drawText('Telephone Number:', 70, 430, 10, true);
  drawText(petitioner.phone || '______________________', 200, 430, 10, false);

  drawText('Email Address:', 70, 410, 10, true);
  drawText(petitioner.email || '______________________', 200, 410, 10, false);

  drawText('2. Case Type & Nature of Proceeding:', 50, 380, 10, true);
  drawText('This is a civil Miscellaneous proceeding for the Expungement of Conviction and Arrest Records', 50, 365, 10, false);
  drawText('(Case Type: XP) pursuant to Indiana Code §§ 35-38-9-1, 35-38-9-2, 35-38-9-3, and 35-38-9-8.', 50, 350, 10, false);

  drawText('3. Service Information:', 50, 320, 10, true);
  drawText('Petitioner accepts service of all court documents and notices at the postal address and/or', 50, 305, 10, false);
  drawText('email address provided above, or via the Indiana Odyssey E-Filing System (IEFS).', 50, 290, 10, false);

  drawText('4. Representation Status:', 50, 260, 10, true);
  drawText('Petitioner is representing himself/herself in this matter and is not represented by legal counsel.', 50, 245, 10, false);

  drawText('Respectfully submitted,', 50, 200, 10, false);

  drawText('_________________________________________________', 50, 160, 10, false);
  drawText(`${nameUpper}, Petitioner Pro Se`, 50, 145, 10, true);
  drawText('Date: ________________________', 50, 130, 10, false);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

if (typeof window !== 'undefined') {
  window.PdfGenerator = {
    generateAppearanceForm
  };
}

export { generateAppearanceForm };

