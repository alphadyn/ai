#!/usr/bin/env python3
"""Local dev server: serves this folder's static files and proxies the Reddit
front-page JSON server-side so the browser never makes a cross-origin request."""

import json
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REDDIT_FEED_URL = "https://www.reddit.com/.json?limit=100&raw_json=1"
# Reddit requires a descriptive, unique User-Agent or it will throttle/reject requests.
USER_AGENT = "reddit-reuters-report/1.0 (local dev server)"


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/reddit-front-page"):
            self.proxy_reddit()
        else:
            super().do_GET()

    def proxy_reddit(self):
        request = urllib.request.Request(REDDIT_FEED_URL, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                body = response.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as error:
            payload = json.dumps({"error": str(error)}).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)

    def log_message(self, format, *args):
        pass


def main():
    import os

    os.chdir(Path(__file__).parent)
    port = 8000
    server = ThreadingHTTPServer(("localhost", port), Handler)
    print(f"Serving on http://localhost:{port} (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
