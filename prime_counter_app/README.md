# Prime Counter

A client-side web application that counts unsigned integer prime numbers up to
a user-supplied positive number, reports how long the computation took, and
keeps a log of the last 100 results.

## What it does
- Accepts a non-negative integer `N` up to 10E20 (1×10²¹), including scientific
  notation like `1e18`
- For values small enough to sieve within a 5 second time budget, computes an
  **exact** prime count using a Sieve of Eratosthenes
- For values too large to sieve in time, falls back to a fast **estimate**
  using the asymptotic prime-counting formula `x/ln(x) * Σ k!/ln(x)^k`, and
  labels the result as estimated
- Displays the prime count, whether it's exact or estimated, and the elapsed
  computation time
- Persists the last 100 results (input, count, method, elapsed time,
  timestamp) in the browser's `localStorage` and renders them in a table

## Files
- `index.html` - page structure and layout
- `styles.css` - styling
- `app.js` - sieve/estimate algorithms, timing, and result log logic

## Usage
Open `index.html` in a browser (no build step or server required):

```bash
open index.html
```

Enter a whole number and click **Compute**. Use **Clear Log** to reset the
stored history.

## Notes
- Inputs are capped at 10E20 (1×10²¹).
- Exact computation is attempted for values up to 150,000,000 and is aborted
  in favor of the estimate if it exceeds the 5 second time budget.
- The result log is stored per-browser via `localStorage` and survives page
  reloads.
