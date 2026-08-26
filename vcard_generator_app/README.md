# Contact Card Generator

A simple browser app for turning a contact form into a standard vCard (.vcf) file and a scannable QR code containing the same contact details.

## Features

- Enter first, middle, and last name, organization, job title, phone numbers (mobile and work), email, website, address, birthday, and notes
- Upload a profile picture, which is resized and embedded directly in the vCard as a `PHOTO` property
- Generates a valid vCard 3.0 file with proper text escaping and RFC 2426 line folding
- Preview the raw vCard content before downloading
- Download the contact as a `.vcf` file that can be imported into any contacts app
- Displays a QR code encoding the vCard so it can be scanned directly by a phone camera or QR reader
- Download the QR code as a PNG image

## Run locally

From the project root, go to the app folder and start a simple local server:

```bash
cd vcard_generator_app
python3 -m http.server 8000
```

Then open this in a browser:

```text
http://localhost:8000/
```

## How to use

1. Fill in as many contact fields as you'd like (at least one is required).
2. Click "Generate contact card".
3. Review the generated vCard text and the QR code preview.
4. Click "Download .vcf file" to save the contact card, or "Download QR code" to save a scannable image of it.

## Notes

- QR codes generated with the [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) library (loaded from a CDN), so scanning them saves the full contact directly without needing the .vcf file.
- The birthday field uses the standard `BDAY` vCard property in `YYYYMMDD` format.
- If a profile picture makes the vCard too large to fit in a QR code, the QR code is generated without the photo while the downloaded `.vcf` file still includes it.
