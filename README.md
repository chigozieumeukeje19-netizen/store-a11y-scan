# store-a11y-scan

Runs an automated WCAG 2.2 A/AA accessibility scan (axe-core in headless Chromium) on the public homepage of each site listed in `stores.txt`.

An automated scan catches only part of the accessibility problems on a page. Results are a starting point for a manual audit, not a statement of conformance.

Usage: edit `stores.txt` (one domain per line) and push, or run the "Scan stores" workflow by hand. Results are uploaded as a workflow artifact.
