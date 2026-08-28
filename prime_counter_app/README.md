# Prime Counter

A client-side web application that counts unsigned integer prime numbers up to
a user-supplied positive number, reports how long the computation took, and
keeps a log of the last 100 results.

## What it does
- Accepts a non-negative integer `N` from the user
- Computes the count of primes in `[2, N]` using a Sieve of Eratosthenes
- Displays the prime count and the elapsed computation time
- Persists the last 100 results (input, count, elapsed time, timestamp) in
  the browser's `localStorage` and renders them in a table

## Files
- `index.html` - page structure and layout
- `styles.css` - styling
- `app.js` - sieve algorithm, timing, and result log logic

## Usage
Open `index.html` in a browser (no build step or server required):

```bash
open index.html
```

Enter a whole number and click **Compute**. Use **Clear Log** to reset the
stored history.

## Notes
- Inputs are capped at 20,000,000 to keep the sieve responsive in the browser.
- The result log is stored per-browser via `localStorage` and survives page
  reloads.
