"""Serve the dashboard and proxy Nasdaq requests through the same origin."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import json


NASDAQ_API = "https://api.nasdaq.com/api"
ROOT = Path(__file__).resolve().parent


class DashboardServer(ThreadingHTTPServer):
    # Browser tabs reload/abort mid-scan constantly with 500+ in-flight requests; these are expected client
    # disconnects, not server bugs, so silence the default noisy traceback logging for them.
    def handle_error(self, request, client_address):
        import sys
        exc_type = sys.exc_info()[0]
        if exc_type in (BrokenPipeError, ConnectionResetError):
            return
        super().handle_error(request, client_address)


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.proxy_nasdaq()
            return
        super().do_GET()

    def proxy_nasdaq(self):
        request = Request(
            f"{NASDAQ_API}{self.path[4:]}",
            headers={
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Market Lens local proxy)",
                "Referer": "https://www.nasdaq.com/",
            },
        )
        try:
            with urlopen(request, timeout=15) as response:
                payload = response.read()
                status = response.status
        except (HTTPError, URLError, TimeoutError) as error:
            payload = json.dumps({"error": f"Nasdaq request failed: {error}"}).encode()
            status = 502

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    server = DashboardServer(("127.0.0.1", 8000), DashboardHandler)
    print("Market Lens running at http://localhost:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()