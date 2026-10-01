#!/usr/bin/env python3
"""
Lightweight HTTP Server & API Backend for Multi-Search Engine Web App.
Serves static UI files and handles /api/search requests.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

# Add directory to sys.path to import search_engine
APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR))

from search_engine import (
    AVAILABLE_ENGINES,
    DEFAULT_ENGINES,
    MultiSearchAggregator,
)


class MultiSearchHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def do_GET(self) -> None:
        parsed_path = urllib.parse.urlparse(self.path)

        # API Endpoints
        if parsed_path.path == "/api/search":
            self.handle_api_search(parsed_path.query)
            return
        elif parsed_path.path == "/api/engines":
            self.handle_api_engines()
            return
        elif parsed_path.path == "/" or parsed_path.path == "":
            self.path = "/index.html"

        # Serve static files (HTML, JS, CSS)
        return super().do_GET()

    def handle_api_engines(self) -> None:
        """Return available and default search engine metadata."""
        data = {
            "available_engines": AVAILABLE_ENGINES,
            "default_engines": DEFAULT_ENGINES,
            "max_engine_limit": 5,
            "max_results_per_engine": 10,
        }
        self.send_json_response(200, data)

    def handle_api_search(self, query_string: str) -> None:
        """Handle multi-engine search API requests."""
        qs = urllib.parse.parse_qs(query_string)
        query = qs.get("q", [""])[0].strip()

        # Parse engines param (comma-separated or multiple params)
        raw_engines = qs.get("engines", [])
        engines: list[str] = []
        for item in raw_engines:
            for part in item.split(","):
                part_clean = part.strip().lower()
                if part_clean and part_clean in AVAILABLE_ENGINES:
                    if part_clean not in engines:
                        engines.append(part_clean)

        if not engines:
            engines = DEFAULT_ENGINES

        # Ensure up to 5 engines
        engines = engines[:5]

        # Parse max_results
        try:
            max_results = int(qs.get("max_results", ["10"])[0])
            max_results = max(0, min(10, max_results))
        except ValueError:
            max_results = 10

        aggregator = MultiSearchAggregator(engines=engines, max_results_per_engine=max_results)
        result = aggregator.search(query)

        self.send_json_response(200, result)

    def send_json_response(self, status_code: int, data: dict) -> None:
        """Helper to send JSON response with CORS headers."""
        payload = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:
        """Handle CORS pre-flight requests."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


def run_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    server_address = (host, port)
    httpd = HTTPServer(server_address, MultiSearchHTTPRequestHandler)
    print(f"==================================================")
    print(f" Multi-Search Engine Web App running at:")
    print(f" http://{host}:{port}/")
    print(f"==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start Multi-Search Engine Web App HTTP Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    args = parser.parse_args()
    run_server(host=args.host, port=args.port)
