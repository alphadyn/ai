# Atlas & Co. Online Store

A branded static storefront with a front-facing shopping page, grouped product/service menu, searchable inventory, cart, checkout flow, advertising placements, encrypted browser cart storage, and payment-provider hooks for Apple Pay and credit cards.

## Features

- Branded storefront for Atlas & Co. with featured products and partner advertising placements
- Main-page branded product and service highlights with direct cart actions
- Dedicated shop screen for products and services grouped into responsive section tiles
- Storewide search across item names, sections, brands, descriptions, tags, services, and inventory
- Type, section, stock, and sort controls for products and services before adding them to the cart
- In-stock filtering and an exportable inventory table
- Cart drawer with quantity controls, subtotal, estimated tax, and checkout handoff
- Browser cart persistence encrypted with Web Crypto AES-256-GCM before storage in `localStorage`
- Payment integration points for Stripe Payment Request Button, Apple Pay-capable wallets, and credit-card processing

## Run it

Open [index.html](index.html) directly in a browser, or serve the folder locally:

```bash
cd online_store_app
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Payment setup

The app does not collect raw card numbers. For real payments, use a PCI-compliant processor such as Stripe:

1. Serve the site over HTTPS.
2. Create a backend endpoint that validates the cart, calculates trusted totals server-side, and creates a PaymentIntent.
3. Set `stripePublishableKey` and `paymentIntentEndpoint` in [app.js](app.js).
4. Configure Apple Pay in the payment provider dashboard, including domain verification.

When those values are blank, the checkout remains in local demo mode and prepares the order without charging a real payment method.

## Security model

- Cart data stored by this demo is encrypted at rest in the browser with AES-256-GCM using the Web Crypto API.
- The AES key is generated per browser profile and stored in IndexedDB as a non-extractable `CryptoKey`.
- Production data transmission must use HTTPS for the storefront, inventory APIs, checkout endpoint, and payment-provider scripts.
- Real orders should be finalized only by a trusted backend. Client totals and item availability are display hints and must be revalidated server-side.
- Apple Pay and credit cards should be processed by the payment provider's hosted or tokenized fields so sensitive payment data never touches this app's JavaScript.

## Main files

- [index.html](index.html) - storefront structure, separate shop screen, cart drawer, inventory, and checkout sections
- [styles.css](styles.css) - responsive visual design and storefront layout
- [app.js](app.js) - catalog data, search/filtering, encrypted cart persistence, cart totals, checkout, and payment hooks

## Test the project

Run the repository-wide test suite from the project root:

```bash
./run_tests.sh
```