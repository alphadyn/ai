# iPhone 17 Pro Simulator

A self-contained, interactive iPhone 17 Pro-style web simulator built with plain HTML, CSS, and JavaScript.

## What is included

- Lock screen with live time and swipe-to-unlock interaction
- Responsive iPhone device frame for desktop and mobile screens
- Home screen with calendar and Bellevue, WA weather widgets
- Dynamic Island and Control Center interactions
- Simulated Messages, Camera, Photos, Music, Safari, Settings, Notes, Wallet, Phone, Mail, and Calculator apps
- Functional Safari simulation with address/search input, local pages, history, reload, share, and tab feedback

## How to view it

Open [index.html](index.html) directly in a browser. No build step, package installation, or web server is required.

You can also serve the folder locally from the repository root:

```bash
python3 -m http.server 8000 --directory iphone_17_simulator
```

Then open <http://localhost:8000>.

## Notes

The weather and Safari experiences are intentionally simulated for an offline demo. They do not call live weather or web services.
