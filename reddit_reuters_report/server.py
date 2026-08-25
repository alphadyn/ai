#!/usr/bin/env python3
"""Local dev server: serves this folder's static files and proxies the Reddit
front-page JSON server-side so the browser never makes a cross-origin request."""

import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Reddit's public www.reddit.com/.json endpoint is aggressively blocked for
# non-browser traffic on many networks (including most cloud/hosting IP ranges).
# Setting REDDIT_CLIENT_ID (and optionally REDDIT_CLIENT_SECRET) uses Reddit's
# official OAuth API instead, which is far less likely to be blocked.
# Create a free app at https://www.reddit.com/prefs/apps (type "script" or "installed app").
REDDIT_CLIENT_ID = os.environ.get("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.environ.get("REDDIT_CLIENT_SECRET", "")

# Fallback: try a couple of Reddit hosts directly, since one may be blocked while another isn't.
FEED_HOSTS = ["https://www.reddit.com", "https://old.reddit.com"]
FEED_PATH = "/.json?limit=100&raw_json=1"
OAUTH_FEED_URL = "https://oauth.reddit.com/.json?limit=100&raw_json=1"
TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
# Mimic a real Firefox browser request as closely as possible — full header set,
# not just the User-Agent — since anti-bot filters key off the whole fingerprint.
USER_AGENT = "reuters-style-reddit-app/1.0 (by /u/anonymous; local dev server)"
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

_token_cache = {"token": None, "expires_at": 0}


def get_oauth_token():
    if _token_cache["token"] and time.time() < _token_cache["expires_at"]:
        return _token_cache["token"]

    credentials = f"{REDDIT_CLIENT_ID}:{REDDIT_CLIENT_SECRET}".encode("utf-8")
    body = urllib.parse.urlencode(
        {
            "grant_type": "https://oauth.reddit.com/grants/installed_client",
            "device_id": "DO_NOT_TRACK_THIS_DEVICE",
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        TOKEN_URL,
        data=body,
        headers={
            "Authorization": "Basic " + base64.b64encode(credentials).decode("ascii"),
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = json.loads(response.read())

    _token_cache["token"] = payload["access_token"]
    _token_cache["expires_at"] = time.time() + payload.get("expires_in", 3600) - 60
    return _token_cache["token"]


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/reddit-front-page"):
            self.proxy_reddit()
        else:
            super().do_GET()

    def proxy_reddit(self):
        errors = []

        if REDDIT_CLIENT_ID:
            try:
                token = get_oauth_token()
                request = urllib.request.Request(
                    OAUTH_FEED_URL,
                    headers={"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT},
                )
                with urllib.request.urlopen(request, timeout=10) as response:
                    return self.send_json(200, response.read())
            except urllib.error.HTTPError as error:
                errors.append(f"oauth.reddit.com: HTTP {error.code} {error.reason}")
            except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as error:
                errors.append(f"oauth.reddit.com: {error}")

        for host in FEED_HOSTS:
            request = urllib.request.Request(host + FEED_PATH, headers=BROWSER_HEADERS)
            try:
                with urllib.request.urlopen(request, timeout=10) as response:
                    return self.send_json(200, response.read())
            except urllib.error.HTTPError as error:
                errors.append(f"{host}: HTTP {error.code} {error.reason}")
            except (urllib.error.URLError, TimeoutError) as error:
                errors.append(f"{host}: {error}")

        hint = (
            "Reddit often blocks anonymous requests from cloud/hosting IP ranges. Set "
            "REDDIT_CLIENT_ID (and REDDIT_CLIENT_SECRET) env vars from a free app at "
            "https://www.reddit.com/prefs/apps to use Reddit's OAuth API instead, which is "
            "rarely blocked."
            if not REDDIT_CLIENT_ID
            else "The OAuth request was also rejected — check your REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET."
        )
        message = "Reddit rejected the request from every source tried (" + "; ".join(errors) + f"). {hint}"
        self.send_json(502, json.dumps({"error": message}).encode("utf-8"))

    def send_json(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


def main():
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
