# Archived Legacy Components

This directory contains archived components from the initial Indiana Expungement Assistant architecture before its evolution into a fully client-side, zero-backend Chrome extension.

## Contents

### 1. `legacy_backend/`
- **`app.py`**: Former FastAPI web server providing local REST endpoints (`GET /health`, `POST /generate`, `POST /preview`).
- **`form_engine.py`**: 70KB Python document generator using `python-docx` and COM/LibreOffice to generate court filings and convert to PDF.
- **`requirements.txt`**: Python dependencies required by the former FastAPI backend (`fastapi`, `uvicorn`, `python-docx`, `pydantic`).

### 2. `legacy_python_tests/`
- **`test_api_endpoints.py`**: Pytest test suite for the FastAPI endpoints.
- **`test_form_engine.py`**: Pytest test suite validating the Python form engine.
- **`test_output.zip`**: Sample court petition zip generated during integration tests.

### 3. `legacy_extension_monolith/`
- **`sidepanel.js`**: Original 1,627-line monolithic script before it was refactored into modern, decoupled ES6 modules (`main.js`, `state.js`, `scanner.js`, `profile.js`, `generator.js`, `ui.js`, `utils.js`).

## Why Were These Archived?
1. **Client-Side Architecture**: PDF generation was transitioned to in-browser client-side generation using `pdf-lib` (`pdf-lib.min.js`). This eliminated the requirement for users to install Python, run a local server, and deal with local port/firewall issues.
2. **ES6 Modularization**: The sidepanel UI logic was decomposed into focused ES modules with clear responsibilities, improving testability and maintainability.
3. **Streamlined Repository**: Removing the 80MB Python virtual environment and dead code makes the extension faster to clone, build, and distribute.

## Restoring or Referencing
If needed, these files can be referenced for historical context, legal wording templates, or revived by installing dependencies listed in `legacy_backend/requirements.txt`.
