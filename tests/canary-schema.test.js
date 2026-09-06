const { validateMyCasePayload } = require('../scripts/canary/schema.js');

describe('Canary Zod Schema Validation', () => {
  const sampleValidPayload = {
    source: 'Indiana Expungement Assistant Bookmarklet',
    version: '1.0',
    exportedAt: '2026-09-06T00:00:00.000Z',
    searchContext: 'State of Indiana',
    totalCases: 2,
    hasCCS: true,
    cases: [
      {
        index: 1,
        case_number: '49D01-1805-CM-012345',
        title: 'State of Indiana v. John Doe',
        court: 'Marion Superior Court, Criminal Division 1',
        case_type: 'CM - Criminal Misdemeanor',
        filed: '05/12/2018',
        status: '09/14/2018, Disposed - Conviction',
        dispositionDate: '09/14/2018',
        charges: 'Operating While Intoxicated',
        caseToken: 'abc123token',
        ccs: {
          charges: [
            { count: '01', offense: 'Operating While Intoxicated', statute: '9-30-5-2', level: 'CM', disposition: 'Conviction', dispositionDate: '09/14/2018' }
          ],
          docketEntries: [
            { date: '05/12/2018', description: 'Information Filed' }
          ]
        }
      },
      {
        index: 2,
        case_number: '49D02-1901-F6-000456',
        title: 'State of Indiana v. Jane Smith',
        court: 'Marion Superior Court, Criminal Division 2',
        case_type: 'F6 - Level 6 Felony',
        filed: '01/10/2019',
        status: '06/20/2019, Dismissed',
        dispositionDate: '06/20/2019',
        charges: 'Theft',
        caseToken: 'def456token'
      }
    ]
  };

  it('passes on a valid MyCase export payload', () => {
    const result = validateMyCasePayload(sampleValidPayload);
    expect(result.success).toBe(true);
    expect(result.data.totalCases).toBe(2);
  });

  it('fails when cases array is empty (cases.length === 0)', () => {
    const invalidPayload = {
      ...sampleValidPayload,
      totalCases: 0,
      cases: []
    };
    const result = validateMyCasePayload(invalidPayload);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.message.includes('greater than 0') || e.message.includes('at least 1'))).toBe(true);
  });

  it('fails when dispositionDate is missing from a case', () => {
    const invalidPayload = {
      ...sampleValidPayload,
      cases: [
        {
          ...sampleValidPayload.cases[0],
          dispositionDate: '' // empty dispositionDate
        },
        sampleValidPayload.cases[1]
      ]
    };
    const result = validateMyCasePayload(invalidPayload);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.path === 'cases.0.dispositionDate' && e.message.includes('dispositionDate'))).toBe(true);
  });

  it('fails when caseToken is missing', () => {
    const invalidPayload = {
      ...sampleValidPayload,
      cases: [
        {
          ...sampleValidPayload.cases[0],
          caseToken: ''
        },
        sampleValidPayload.cases[1]
      ]
    };
    const result = validateMyCasePayload(invalidPayload);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.path === 'cases.0.caseToken')).toBe(true);
  });
});
