# Handoff test assets

This package contains **118 synthetic development-seed requests** with expected structured responses and **21 adversarial invalid-plan cases**. These are test specifications, not model-produced results.

Run from the package root:
```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r reference/requirements-dev.txt
python scripts/validate_handoff.py
```
On Windows, activate the virtual environment with the shell-appropriate command or call its Python executable directly. Do not install these development dependencies inside a customer's device or require Python for the shipping app.

The script checks schema consistency, the reference semantic validator, example contexts, page math, batch collection types and intentionally invalid plans. It does not call an AI provider, process a PDF, build a native app or test the UI.

Keep a separate independently authored holdout before testing live models. When implementing production adapters, generate synthetic PDF fixtures and run all file integrity/network/visual tests described in `docs/08_TESTING_AND_RELEASE.md`. Do not interpret a passing pack check as production security assurance.
