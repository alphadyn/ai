# Business Plan

This folder contains a polished single-page business plan presentation for Northstar AI, a fictional AI startup.

## What is included
- A static HTML presentation in `index.html`
- Content covering the executive summary, market opportunity, solution, revenue model, and go-to-market strategy

## How to view it
Open `index.html` in any web browser to view the presentation.

## Notes
- The project is fully static and does not require a build step.
- It is intended as a demo or portfolio-style business plan.

## Test the project
Run the repository-wide test suite from the project root:

```bash
./run_tests.sh
```

## Generate the report
Run the generator script to create a simple HTML output:

```bash
python3 generate_report.py
```

This writes [generated_report.html](generated_report.html) in the same folder.
