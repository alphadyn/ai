# Largest Companies Report

This folder contains a polished HTML report of 100 of the largest public companies by market capitalization.

## What is included
- Company names and official website links
- Country of origin for each company
- Approximate current market-cap values
- A clean, presentation-ready static layout

## How to view it
Open the file [index.html](index.html) in any modern web browser.

## Notes
- The figures are approximate and intended for informational use.
- The report is fully self-contained and does not require any build step.

## Test the project
Run the repository-wide test suite from the project root:

```bash
./run_tests.sh
```

## Generate the report
Run the generator script to create a simple HTML artifact for this project:

```bash
python3 generate_report.py
```

This writes [generated_report.html](generated_report.html) in the same folder.
