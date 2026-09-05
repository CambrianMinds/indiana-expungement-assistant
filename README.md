# Indiana Expungement Assistant

**Automated in-browser MyCase scraping + court-ready IC § 35-38-9 petition generator**

> ### 🛑 CRITICAL LEGAL NOTICE & ONE-SHOT RULE WARNING
> **INDIANA CODE § 35-38-9-9(i) LIFETIME ONE-SHOT LIMITATION:**
> Under Indiana law, **you are permitted to petition for expungement of criminal conviction records ONLY ONCE IN YOUR ENTIRE LIFETIME.**
> 
> - **Omission is Fatal & Permanent:** If you omit or neglect to include any criminal conviction in your expungement petition, **YOU WILL PERMANENTLY LOSE THE RIGHT TO EVER EXPUNGE THAT CONVICTION FOR THE REST OF YOUR LIFE.**
> - **Multiple Counties (365-Day Rule):** Under **IC § 35-38-9-9(d)**, if you have conviction records in more than one Indiana county, all petitions across all counties must be filed within a **365-day period** or consolidated. Filing in one county triggers this lifetime window.
> - **Mandatory Pre-Filing Search:** You MUST search [mycase.in.gov](https://public.courts.in.gov/mycase/) for all past legal names, maiden names, prior married names, and aliases across **ALL 92 Indiana counties** before submitting a petition.

> ### ⚖️ CREATOR MISSION & STRICT LEGAL DISCLAIMER ("COVER MY ASS")
> **Independent Public Accessibility Initiative:**
> This tool was conceived, designed, and built by an **independent individual** who believes that clearing eligible criminal records under Indiana's Second Chance Law should be an **accessible, transparent process for everyday working people**—not an expensive privilege restricted to those who can afford thousands of dollars in private attorney fees. The justice system is complex and intimidating; this project exists to democratize access to standard court forms.
>
> **Strict Legal Disclaimers:**
> 1. **NOT AN ATTORNEY:** The creator and operator of this software is **NOT an attorney**, is not licensed to practice law in Indiana or any jurisdiction, and is not a law firm or legal referral service.
> 2. **NOT LEGAL ADVICE:** This software is an automated clerical data extraction and document formatting tool. It does **NOT** provide legal advice, legal strategy, case assessment, or legal representation.
> 3. **NO ATTORNEY-CLIENT RELATIONSHIP:** Using this software, website, extension, or documentation does **NOT** form an attorney-client relationship under any circumstance.
> 4. **PRO SE RESPONSIBILITY:** You are acting strictly **pro se** (representing yourself). You bear 100% of the legal responsibility to audit every case number, date, charge, and personal identifier before signing under penalty of perjury and filing with the Court Clerk.
> 5. **"AS IS" & LIMITATION OF LIABILITY:** This software is provided **"AS IS" WITHOUT WARRANTY OF ANY KIND**, express or implied. The author disclaims all liability for any damages, errors, omissions, court rejections, prosecutorial objections, or omitted convictions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CHROME BROWSER ENVIRONMENT                       │
│                                                                     │
│   ┌──────────────────────┐     ┌────────────────────────────────┐   │
│   │ public.courts.in.gov │◄───►│  Chrome Extension (Manifest V3)│   │
│   │ (User's Live Session)│     │  • In-Browser DOM/KO Scraper   │   │
│   │ • Search Results     │     │  • CCS Deep-Fetcher            │   │
│   │ • Case Summaries     │     │  • IC § 35-38-9 Rules Engine   │   │
│   └──────────────────────┘     │  • One-Shot Warning Safeguards │   │
│                                │  • Pro Se Sidepanel UI         │   │
│                                └────────────────┬───────────────┘   │
└─────────────────────────────────────────────────┼───────────────────┘
                                                  │ Verified JSON Payload
                                                  ▼
                                     ┌──────────────────────────┐
                                     │  Backend Form Bot (Local) │
                                     │  FastAPI + ReportLab      │
                                     │  http://127.0.0.1:8000    │
                                     └────────────┬─────────────┘
                                                  │
                                                  ▼
                                     ┌──────────────────────────┐
                                     │ Complete Expungement ZIP  │
                                     │ (Warning Guide + Forms,  │
                                     │  Court-Ready PDFs)        │
                                     └──────────────────────────┘
```

## Quick Start

### 1. Start the Backend Form Engine

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The API will run locally at `http://127.0.0.1:8000` (docs at `/docs`, health check at `/health`, disclaimer at `/api/disclaimer`).

### 2. Install the Chrome Extension

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (toggle in upper right)
3. Click **Load unpacked**
4. Select the `extension/` directory

### 3. Use It

1. Navigate to [mycase.in.gov](https://public.courts.in.gov/mycase/)
2. Search for your legal name, previous names, maiden names, and aliases across all Indiana counties
3. Open the **Sidepanel** via the extension icon
4. Click **"Scan Page & Check Eligibility"**
5. Review statutory categories and eligibility in the **Results** tab
6. Complete your contact and residential history on the **Profile** tab
7. Read and check each **Mandatory Legal Acknowledgment** on the **Generate** tab
8. Confirm the **Lifetime One-Shot Warning** modal
9. Download your court-ready ZIP packet containing all verified forms and filing instructions

## Project Structure

```
indiana-expunge/
├── extension/                      # Chrome Extension (Manifest V3)
│   ├── manifest.json               # Extension manifest
│   ├── background.js               # Service worker (messaging & local backend API)
│   ├── content.js                  # In-browser MyCase Knockout/DOM scraper
│   ├── eligibility.js              # IC § 35-38-9 statutory rules engine
│   ├── icons/                      # Extension icons
│   └── sidepanel/                  # Sidepanel user interface
│       ├── sidepanel.html          # UI with one-shot alerts, disclaimers & modals
│       ├── sidepanel.css           # Design tokens, dark mode, alert styling
│       └── sidepanel.js            # Controller, state, verification gates
├── backend/                        # Local Python Form Generation Microservice
│   ├── app.py                      # FastAPI app with CORS & acknowledgment checks
│   ├── form_engine.py              # ReportLab legal document generator
│   └── requirements.txt            # Dependencies
├── tests/                          # Automated verification tests
│   └── test_form_engine.py         # End-to-end PDF packet smoke test
└── README.md                       # Comprehensive guide & statutory warnings
```

## How Scraping Works (Zero Bot Footprint)

**All scraping runs 100% inside the user's browser** — within their legitimate, authenticated MyCase session.

- **Strategy 1 (Knockout Observables)**: MyCase runs Tyler Technologies' Odyssey SPA with Knockout.js bindings. The content script accesses `ko.dataFor()` to read structured JavaScript view models directly — avoiding bot detection patterns and brittle HTML scraping.
- **Strategy 2 (DOM Fallback)**: If Knockout context is unexposed, the script reads rendered `.result-row` containers and their data bindings.
- **CCS Deep-Scraping**: Fetches detailed Chronological Case Summary (CCS) pages using `fetch()` with `credentials: 'same-origin'`, maintaining the user's active session.

## Statutory Coverage

| Indiana Code Section | Coverage | Waiting Period | Grant Type |
|---|---|---|---|
| IC § 35-38-9-1 | Arrests, non-convictions, infractions | ≥ 1 year | Mandatory |
| IC § 35-38-9-2 | Misdemeanor convictions | ≥ 5 years | Mandatory |
| IC § 35-38-9-3 | Class D / Level 6 felonies | ≥ 8 years | Mandatory* |
| IC § 35-38-9-4 | Higher felonies (A/B/C, L1-5) | ≥ 10 years | Discretionary |

*Mandatory unless bodily injury or statutory exclusion.

## Generated Court Forms

| File Name | Form Description | Statutory / Rule Authority |
|---|---|---|
| `00_CRITICAL_WARNING_AND_INSTRUCTIONS.pdf` | Lifetime One-Shot Warning & Pro Se Filing Walkthrough | IC § 35-38-9-9(i) |
| `00_COMPLETE_EXPUNGEMENT_PETITION_PACKET.pdf` | Master Combined Court Packet (All Pleadings) | Consolidated filing |
| `01_Appearance_Form.pdf` | Appearance by Self-Represented Person | Ind. Trial Rule 3.1 |
| `02_Notice_of_Exclusion_Confidential_Info.pdf` | Notice of Exclusion of Confidential Information | Access to Court Records Rule 5 |
| `03_Confidential_Information_Sheet.pdf` | Confidential Information Sheet (SSN, DOB, DL#, Addresses) | ACR Rule 5 & IC § 35-38-9-8(b) |
| `04_Verified_Petition_for_Expungement.pdf` | Verified Petition (With statutory one-shot affirmations) | IC §§ 35-38-9-1, 2, 3, & 8 |
| `05_Notice_of_Filing_to_Prosecutor.pdf` | Formal Notice of Filing to County Prosecutor | IC § 35-38-9-9(g) |
| `06_Certificate_of_Service.pdf` | Certificate of Service on Prosecuting Attorney | Ind. Trial Rule 5 |
| `07_Proposed_Order_Granting_Expungement.pdf` | Proposed Judicial Order Granting Expungement | IC §§ 35-38-9-1, 2, 3, & 6 |
| `08_Fee_Waiver_Request_and_Order.pdf` | Verified Request to Waive Filing Fees & Order | IC § 33-37-3-2 |

## Disclaimers & Non-Attorney Notice

This software is an educational and clerical automation tool created by an independent individual advocating for legal accessibility. **It is NOT legal advice.** No attorney-client relationship is created. Users proceed *pro se* and are solely responsible for ensuring the accuracy and completeness of all court filings. Always verify with official court clerks or a licensed Indiana attorney.
