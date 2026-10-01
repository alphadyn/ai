# Google News Capture

A local web app that opens Google News in headless Chromium, scrolls the feed to load additional stories, and extracts article titles, links, and related reads. Captures are shown in a responsive browser interface and can be downloaded as structured JSON. A copy is also saved beside the app as `google_news.json`.

## Requirements

- Python 3.10 or newer
- Flask
- Playwright and its Chromium browser

Install the dependency and browser once from this directory:

```sh
python3 -m pip install -r requirements.txt
python3 -m playwright install chromium
```

## Run

```sh
python3 app.py
```

Open <http://127.0.0.1:5000> in your browser and select **Capture today’s headlines**. The server scrolls the feed until it stops adding stories (up to 15 passes), then displays the extracted cards and related reads. Select **Download JSON** to save the capture. The app is local-only by default; it binds to `127.0.0.1`.

Each entry in the `news` array has `header_title`, `header_url`, and a `subtitles` array of `{ "title", "url" }` objects. Google News may change its page markup, and available headlines vary by region and time. An internet connection is required. Only save content you're permitted to download and retain, and follow Google's applicable terms.
