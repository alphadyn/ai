#!/usr/bin/env python3
"""
Lightweight REST API Backend & HTTP Server for Nexus Content Management System (CMS).
Persists all media records, tags, and files to an SQLite Database.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any

APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR))

from database import DatabaseManager

db_manager = DatabaseManager()


class CMSHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def _send_json_response(self, status_code: int, data: Any) -> None:
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == "/api/health":
            self._send_json_response(
                200,
                {
                    "status": "ok",
                    "storage": "sqlite",
                    "database": "cms_database.db",
                    "count": db_manager.count(),
                },
            )
            return

        if path == "/api/items":
            items = db_manager.get_all()
            self._send_json_response(200, items)
            return

        # Direct view redirect: /view/:id -> /index.html?item=:id
        if path.startswith("/view/"):
            item_id = path[len("/view/") :].strip("/")
            self.send_response(302)
            self.send_header("Location", f"/index.html?item={urllib.parse.quote(item_id)}")
            self.end_headers()
            return

        # Raw media stream / download endpoint: /media/:id or /api/media/:id
        if path.startswith("/media/") or path.startswith("/api/media/"):
            prefix = "/media/" if path.startswith("/media/") else "/api/media/"
            item_id = path[len(prefix) :].strip("/")
            item = db_manager.get_by_id(item_id)
            if not item:
                self._send_json_response(404, {"error": "Item not found"})
                return

            import base64

            data_url = item.get("dataUrl") or item.get("data_url")
            text_content = item.get("textContent") or item.get("text_content")
            mime_type = item.get("mimeType") or item.get("mime_type") or "application/octet-stream"
            filename = item.get("filename") or f"{item_id}.bin"

            content_bytes = b""
            if data_url and "," in data_url:
                header, encoded = data_url.split(",", 1)
                if ";base64" in header:
                    content_bytes = base64.b64decode(encoded)
                else:
                    content_bytes = urllib.parse.unquote(encoded).encode("utf-8")
                if "data:" in header and ";" in header:
                    mime_type = header.split("data:", 1)[1].split(";", 1)[0]
            elif text_content:
                content_bytes = text_content.encode("utf-8")
                mime_type = mime_type or "text/plain; charset=utf-8"
            else:
                content_bytes = b"Empty binary file"

            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content_bytes)))
            self.send_header("Content-Disposition", f'inline; filename="{filename}"')
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content_bytes)
            return

        if path.startswith("/api/items/"):
            item_id = path[len("/api/items/") :].strip("/")
            item = db_manager.get_by_id(item_id)
            if item:
                self._send_json_response(200, item)
            else:
                self._send_json_response(404, {"error": "Item not found"})
            return

        if path == "/" or path == "":
            self.path = "/index.html"

        super().do_GET()

    def do_POST(self) -> None:
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"

        try:
            payload = json.loads(body) if body else {}
        except Exception as e:
            self._send_json_response(400, {"error": f"Invalid JSON payload: {e}"})
            return

        if path == "/api/items":
            if not isinstance(payload, dict) or not payload.get("id"):
                self._send_json_response(400, {"error": "Missing item ID or invalid payload"})
                return
            saved = db_manager.upsert(payload)
            self._send_json_response(201, saved)
            return

        if path == "/api/items/batch":
            if isinstance(payload, list):
                count = db_manager.upsert_many(payload)
                self._send_json_response(200, {"saved": count})
            elif isinstance(payload, dict) and "items" in payload:
                count = db_manager.upsert_many(payload["items"])
                self._send_json_response(200, {"saved": count})
            else:
                self._send_json_response(400, {"error": "Expected a list of items"})
            return

        if path == "/api/items/batch-delete":
            ids = payload.get("ids", [])
            deleted = db_manager.delete_many(ids)
            self._send_json_response(200, {"deleted": deleted})
            return

        if path == "/api/items/clear":
            count = db_manager.clear_all()
            self._send_json_response(200, {"cleared": count})
            return

        self._send_json_response(404, {"error": "Endpoint not found"})

    def do_PUT(self) -> None:
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"

        try:
            payload = json.loads(body) if body else {}
        except Exception as e:
            self._send_json_response(400, {"error": f"Invalid JSON: {e}"})
            return

        if path.startswith("/api/items/"):
            item_id = path[len("/api/items/") :].strip("/")
            payload["id"] = item_id
            saved = db_manager.upsert(payload)
            self._send_json_response(200, saved)
            return

        self._send_json_response(404, {"error": "Endpoint not found"})

    def do_DELETE(self) -> None:
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == "/api/items":
            count = db_manager.clear_all()
            self._send_json_response(200, {"cleared": count})
            return

        if path.startswith("/api/items/"):
            item_id = path[len("/api/items/") :].strip("/")
            deleted = db_manager.delete(item_id)
            if deleted:
                self._send_json_response(200, {"deleted": True, "id": item_id})
            else:
                self._send_json_response(404, {"error": "Item not found"})
            return

        self._send_json_response(404, {"error": "Endpoint not found"})


def run_server(port: int = 8000, host: str = "0.0.0.0") -> None:
    server_address = (host, port)
    httpd = HTTPServer(server_address, CMSHTTPRequestHandler)
    print(f"🚀 Nexus CMS SQLite Database Server running at http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down gracefully.")
        httpd.server_close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Nexus CMS Backend Server")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default 8000)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host interface")
    args = parser.parse_args()

    run_server(port=args.port, host=args.host)
