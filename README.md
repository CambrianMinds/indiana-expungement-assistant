# Indiana Expungement Assistant

**Automated in-browser MyCase scraper and court-ready expungement packet generator for Indiana's Second Chance Law (Indiana Code § 35-38-9).**

[![Live Portal](https://img.shields.io/badge/Live_Portal-GitHub_Pages-blue?style=for-the-badge&logo=github)](https://cambrianminds.github.io/indiana-expungement-assistant/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Statute](https://img.shields.io/badge/Indiana_Code-IC_%C2%A7_35--38--9-emerald?style=for-the-badge)](https://iga.in.gov/laws/2023/ic/titles/35#35-38-9)
[![Developer](https://img.shields.io/badge/Developer-Justin_Bogner-indigo?style=for-the-badge)](https://github.com/CambrianMinds)

🌐 **Live Web Portal & Interactive Eligibility Calculator:** [https://cambrianminds.github.io/indiana-expungement-assistant/](https://cambrianminds.github.io/indiana-expungement-assistant/)

---

> ### 🛑 CRITICAL LEGAL WARNING: INDIANA'S LIFETIME ONE-SHOT RULE
>
> **INDIANA CODE § 35-38-9-9(i) STRICT STATUTORY LIMITATION:**
> Under Indiana law, **a person may petition for expungement of criminal conviction records ONLY ONCE IN THEIR ENTIRE LIFETIME.**
>
> - **Omission is Permanent and Irreversible:** If you omit or neglect to include any criminal conviction in your expungement petition, **YOU WILL PERMANENTLY LOSE THE RIGHT TO EVER EXPUNGE THAT CONVICTION FOR THE REST OF YOUR LIFE.**
> - **Multi-County 365-Day Window:** Under **IC § 35-38-9-9(d)**, if you have conviction records in more than one Indiana county, all petitions across all counties must be filed within a **365-day period**. Filing your first petition starts that lifetime countdown.
> - **Mandatory Pre-Filing Search:** You **MUST** search [mycase.in.gov](https://public.courts.in.gov/mycase/) for all legal names, maiden names, previous married names, and aliases across **ALL 92 Indiana counties** before submitting your petition.

---

> ### ⚖️ PUBLIC INTEREST MISSION & LEGAL SAFEGUARDS
>
> **The Public Accessibility Initiative:**
> Indiana's Second Chance Law (IC § 35-38-9) is one of the most transformative civil rights reforms in state history. It offers individuals who have paid their societal debt and maintained clean records an opportunity to remove old criminal records that hinder employment, housing, and civic participation.
>
> However, navigating complex local court rules and formatting formal legal pleadings is daunting. Private defense attorneys frequently charge **$1,500 to $3,500** for routine expungement petitions, placing second chances out of reach for working-class citizens.
>
> This open-source tool was designed and developed by **Justin Bogner** (an independent software developer, **Justin Bogner**) as a civic public service project to democratize access to standard Indiana court forms.
>
> **Strict Legal Disclaimers:**
>
> 1. **NOT AN ATTORNEY:** The developer is **NOT an attorney**, is not licensed to practice law in Indiana or any jurisdiction, and does not operate a law firm or legal referral service.
> 2. **NOT LEGAL ADVICE:** This software is an automated clerical data extraction and document formatting tool. It does **NOT** provide legal advice, case strategy, or legal representation.
> 3. **NO ATTORNEY-CLIENT RELATIONSHIP:** Using this software, website, extension, or documentation does **NOT** establish an attorney-client relationship.
> 4. **PRO SE RESPONSIBILITY:** You are filing **pro se** (representing yourself). You bear 100% of the responsibility to audit every case number, date, charge, and personal identifier before signing under penalty of perjury and filing with the Court Clerk.
> 5. **"AS IS" WARRANTY DISCLAIMER:** Provided **"AS IS" WITHOUT WARRANTY OF ANY KIND**. The developer disclaims all liability for errors, omissions, court rejections, prosecutorial objections, or omitted convictions.

---

## Privacy & Security: Zero Cloud Storage

Your personal information (Social Security Number, Date of Birth, Driver's License Number, and 10-year address history) is required by the court for the Confidential Information Sheet (ACR Form).

- **100% Local Execution**: The document engine runs entirely on your local machine (`http://127.0.0.1:8000`).
- **No Remote Telemetry**: Petitioner data is stored strictly in your browser's local `chrome.storage.local` and is never transmitted to external servers.
- **In-Browser Scraping**: All data collection occurs client-side within your active, authenticated Indiana MyCase browser session.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE CHROME BROWSER                           │
│                                                                        │
│   ┌────────────────────────┐      ┌────────────────────────────────┐   │
│   │  public.courts.in.gov  │◄────►│ Chrome Extension (Manifest V3) │   │
│   │  (User's Live Session) │      │ • Knockout.js Observable Reader│   │
│   │  • Search Results      │      │ • Client-Side CCS Fetcher      │   │
│   │  • Case Summaries      │      │ • IC § 35-38-9 Rules Engine    │   │
│   └────────────────────────┘      │ • Civic Sidepanel Interface    │   │
│                                   │ • Interactive Formatters & Acks│   │
│                                   └───────────────┬────────────────┘   │
└───────────────────────────────────────────────────┼────────────────────┘
                                                    │ Verified JSON Payload
                                                    ▼
                                    ┌────────────────────────────────┐
                                    │    Local Form Engine (Python)  │
                                    │    FastAPI + ReportLab Canvas  │
                                    │    http://127.0.0.1:8000       │
                                    └───────────────┬────────────────┘
                                                    │
                                                    ▼
                                    ┌────────────────────────────────┐
                                    │  Court-Ready Expungement ZIP   │
                                    │  (10 Official Court Pleadings  │
                                    │   + Instructions & Warnings)   │
                                    └────────────────────────────────┘
```

---

## Court Forms Generated (10 Official Pleadings)

Every packet generated by the tool contains standard Indiana Office of Court Services (IOCS) pro se pleadings formatted for immediate court filing:

| # | Document File Name | Formal Legal Description | Authority | Destination |
| --- | --- | --- | --- | --- |
| **00** | `00_CRITICAL_WARNING_AND_INSTRUCTIONS.pdf` | Step-by-Step Pro Se Filing Walkthrough & One-Shot Alert | IC § 35-38-9-9(i) | Petitioner Copy |
| **00** | `00_COMPLETE_EXPUNGEMENT_PETITION_PACKET.pdf` | Consolidated Master Court Packet (All Pleadings Combined) | Indiana Rules of Court | Court Filing |
| **01** | `01_Appearance_Form.pdf` | Appearance Form for Self-Represented Person | Ind. Trial Rule 3.1 | County Clerk |
| **02** | `02_Notice_of_Exclusion_Confidential_Info.pdf` | Notice of Exclusion of Confidential Information | ACR Rule 5 | Public Court File |
| **03** | `03_Confidential_Information_Sheet.pdf` | Confidential Information Sheet (SSN, DOB, DL#, Addresses) | ACR Rule 5 & IC § 35-38-9-8(b) | Sealed Envelope |
| **04** | `04_Verified_Petition_for_Expungement.pdf` | Verified Petition Itemizing All Causes & Affirmations | IC §§ 35-38-9-1–4 | Presiding Judge |
| **05** | `05_Notice_of_Filing_to_Prosecutor.pdf` | Formal 30-Day Notice of Filing to County Prosecutor | IC § 35-38-9-9(g) | Prosecutor |
| **06** | `06_Certificate_of_Service.pdf` | Proof of Service (Certified Mail / Hand Delivery) | Ind. Trial Rule 5 | Trial Court |
| **07** | `07_Proposed_Order_Granting_Expungement.pdf` | Proposed Judicial Order Directing Sealing (ISP, BMV, Court) | IC §§ 35-38-9-1–6 | Judge Signature |
| **08** | `08_Fee_Waiver_Request_and_Order.pdf` | Verified Request to Waive $157 Civil Filing Fee & Order | IC § 33-37-3-2 | Presiding Judge |

---

## Statutory Eligibility Matrix (IC § 35-38-9)

| Indiana Code | Offense Classification | Statutory Waiting Period | Legal Standard |
| --- | --- | --- | --- |
| **IC § 35-38-9-1** | Arrests, Dismissed Charges, Not Guilty Verdicts, Infractions | **≥ 1 year** from date of arrest or dismissal | **Mandatory Grant** (Court must grant if statutory prerequisites are met) |
| **IC § 35-38-9-2** | Misdemeanor Convictions (Class A, B, C) | **≥ 5 years** from date of conviction / sentencing | **Mandatory Grant** |
| **IC § 35-38-9-3** | Class D & Level 6 Felonies (Without Serious Bodily Injury) | **≥ 8 years** from date of conviction / sentencing | **Mandatory Grant** (Subject to statutory disqualifications) |
| **IC § 35-38-9-4** | Major Felonies (Classes A, B, C; Levels 1, 2, 3, 4, 5) | **≥ 8 years** from conviction OR **≥ 3 years** from sentence completion | **Discretionary Grant** (Court holds judicial discretion) |
| **IC § 35-38-9-5** | Felonies Involving Serious Bodily Injury | **≥ 10 years** from conviction OR **≥ 5 years** from sentence completion | **Discretionary** (Requires written Prosecutor consent) |

*Note: In computing waiting periods for convictions, statutory law counts from the **Date of Conviction / Sentencing**, whereas non-convictions (dismissals) count from the **Date of Arrest or Dismissal**.*

---

## Quickstart Installation

### Prerequisites

- Python 3.10 or higher
- Google Chrome browser (or Chromium-based browser such as Brave or Edge)

### 1. Launch the Local Form Engine

```bash
# Clone the repository
git clone https://github.com/CambrianMinds/indiana-expungement-assistant.git
cd indiana-expungement-assistant/backend

# Create and activate a virtual environment
python -m venv .venv

# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1

# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the microservice
python app.py
```

The engine runs locally at `http://127.0.0.1:8000`. You can inspect the health check at `http://127.0.0.1:8000/health` or the OpenAPI documentation at `http://127.0.0.1:8000/docs`.

### 2. Load the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the upper-right corner)
3. Click **Load unpacked**
4. Select the `extension/` directory from this repository
5. Click the **Indiana Expungement Assistant** extension icon in your Chrome toolbar to open the sidepanel

### 3. Generate Your Petition Packet

1. Open [mycase.in.gov](https://public.courts.in.gov/mycase/) and search for your records across all Indiana counties
2. Open the extension sidepanel and click **"Scan Page & Check Eligibility"**
3. Review the statutory breakdown and case list on the **Results** tab
4. Enter your contact details and address history on the **Profile** tab (all formatting for SSN, Driver's License, DOB, and Phone is enforced automatically)
5. Review and check each of the 4 **Mandatory Legal Acknowledgments** on the **Generate** tab
6. Confirm the final **Lifetime One-Shot Warning** modal
7. Click **"Generate Complete Petition Packet"** to download your court-ready ZIP

---

## Running Automated Tests

```bash
# Run API endpoint and legal guardrail tests
python tests/test_api_endpoints.py

# Run PDF packet generation smoke test
python tests/test_form_engine.py
```

---

## Project Structure

```
indiana-expungement-assistant/
├── backend/                       # Local Python PDF form generation engine
│   ├── app.py                     # FastAPI service with strict CORS & statutory guards
│   ├── form_engine.py             # ReportLab canvas engine generating all 10 court forms
│   └── requirements.txt           # Python dependencies (ReportLab, FastAPI, Uvicorn)
├── docs/                          # Public GitHub Pages civic portal
│   ├── index.html                 # Self-help guide & interactive eligibility calculator
│   ├── style.css                  # Dignified civic design system (slate, navy, gold)
│   ├── app.js                     # Calculator logic, tab navigation, cachebusting
│   └── assets/                    # Optimized public imagery & icons
├── extension/                     # Chrome Extension (Manifest V3)
│   ├── manifest.json              # MV3 configuration with required permissions
│   ├── background.js              # Service worker handling local API routing & downloads
│   ├── content.js                 # In-browser Knockout observable scraper
│   ├── eligibility.js             # IC § 35-38-9 statutory decision engine
│   ├── icons/                     # Standard extension icons (16, 48, 128px)
│   └── sidepanel/                 # Civic sidepanel user interface
│       ├── sidepanel.html         # Tabbed UI with alerts, modals & input guards
│       ├── sidepanel.css          # Styled matching the civic web portal
│       └── sidepanel.js           # Form formatters, health monitoring & packet generator
├── tests/                         # Automated test suite
│   ├── test_api_endpoints.py      # Validates disclaimer API & 400 rejection safeguards
│   └── test_form_engine.py        # Generates synthetic 10-form ZIP verification packet
├── .gitignore                     # Excludes local venvs, bytecode, and generated PDFs
└── README.md                      # Public project documentation & statutory guidance
```

---

## Developer Attribution & License

- **Developer:** Justin Bogner · [CambrianMinds](https://github.com/CambrianMinds)
- **License:** [MIT License](LICENSE)

*This project is an independent open-source initiative dedicated to promoting equal access to justice and a second chances under Indiana law.*
