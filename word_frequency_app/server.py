from __future__ import annotations

import argparse
import json
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from analyzer import MAX_URLS, analyze_urls, find_random_urls


APP_DIR = Path(__file__).resolve().parent
MAX_REQUEST_BYTES = 32_000


def parse_analysis_request(payload: object) -> tuple[list[str], int, set[str]]:
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")
    urls = payload.get("urls")
    if not isinstance(urls, list) or not all(isinstance(url, str) for url in urls):
        raise ValueError("URLs must be supplied as a list.")
    urls = [url.strip() for url in urls if url.strip()]
    if not 1 <= len(urls) <= MAX_URLS:
        raise ValueError(f"Choose between 1 and {MAX_URLS} URLs.")

    top_count = payload.get("top_count", 20)
    if isinstance(top_count, bool) or not isinstance(top_count, int):
        raise ValueError("Top word count must be a whole number.")

    raw_excluded = payload.get("excluded_words", [])
    if not isinstance(raw_excluded, list) or not all(isinstance(word, str) for word in raw_excluded):
        raise ValueError("Excluded words must be supplied as a list.")
    excluded = {word.strip().lower() for word in raw_excluded if word.strip()}
    return urls, top_count, excluded


class WordFrequencyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def do_GET(self) -> None:
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == "/api/random-urls":
            try:
                query = urllib.parse.parse_qs(parsed_path.query)
                count = int(query.get("count", ["3"])[0])
                self.send_json(200, {"urls": find_random_urls(count)})
            except (ValueError, TypeError) as error:
                self.send_json(400, {"error": str(error)})
            except Exception:
                self.send_json(502, {"error": "The random URL service is temporarily unavailable."})
            return
        if parsed_path.path in {"", "/"}:
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self) -> None:
        if urllib.parse.urlparse(self.path).path != "/api/analyze":
            self.send_json(404, {"error": "Not found."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if not 0 < content_length <= MAX_REQUEST_BYTES:
                raise ValueError("Request body is empty or too large.")
            payload = json.loads(self.rfile.read(content_length))
            urls, top_count, excluded = parse_analysis_request(payload)
            self.send_json(200, analyze_urls(urls, top_count, excluded))
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            self.send_json(500, {"error": "The server could not complete the analysis."})

    def send_json(self, status: int, data: dict) -> None:
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def run_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = HTTPServer((host, port), WordFrequencyHandler)
    print(f"WordScope running at http://{host}:{port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the WordScope web application")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    arguments = parser.parse_args()
    run_server(arguments.host, arguments.port)