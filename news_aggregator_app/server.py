#!/usr/bin/env python3
"""
Pulse — a social news aggregator REST API & static file server.

Runs on the Python standard library only (http.server + sqlite3, or
optionally Supabase/Postgres — see README "Supabase setup"). Supports plain
HTTP for local development and optional TLS (HTTPS) for production — see
generate_cert.sh and the README for enabling encrypted transport.
"""

from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Any, Optional

APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR))


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader (no external deps) so secrets don't need shell exports."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(APP_DIR / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    from database_supabase import SupabaseDatabaseManager
    db = SupabaseDatabaseManager(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print(f"Storage backend: Supabase ({SUPABASE_URL})")
else:
    from database import DatabaseManager
    db = DatabaseManager()
    print("Storage backend: local SQLite (pulse.db) — set SUPABASE_URL/SUPABASE_SERVICE_KEY to use Supabase instead.")

MAX_BODY_BYTES = 25 * 1024 * 1024  # 25MB request cap (posts/comments may embed file attachments)


class PulseRequestHandler(BaseHTTPRequestHandler):
    server_version = "PulseNews/1.0"

    # ---- helpers ------------------------------------------------------

    def _send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Anon-Id")
        # Defense-in-depth headers for the API responses.
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, message: str) -> None:
        self._send_json(status, {"error": message})

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0:
            return {}
        if length > MAX_BODY_BYTES:
            raise ValueError("Request body too large.")
        raw = self.rfile.read(length)
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON body.")

    def _current_user(self) -> Optional[dict]:
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return db.get_user_by_token(auth[len("Bearer "):].strip())
        return None

    def _voter_key(self, user: Optional[dict]) -> str:
        if user:
            return f"user:{user['id']}"
        anon_id = self.headers.get("X-Anon-Id", "").strip()
        return f"anon:{anon_id}" if anon_id else f"anon:{self.client_address[0]}"

    def _require_admin(self, user: Optional[dict]) -> bool:
        return bool(user and user["role"] == "admin")

    # ---- CORS preflight -------------------------------------------------

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Anon-Id")
        self.end_headers()

    # ---- routing ----------------------------------------------------------

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        try:
            if path == "/api/health":
                return self._send_json(200, {"status": "ok", "storage": "sqlite"})

            if path == "/api/me":
                user = self._current_user()
                return self._send_json(200, {"user": user})

            if path == "/api/posts":
                sort = qs.get("sort", ["hot"])[0]
                tag = qs.get("tag", [None])[0]
                query = qs.get("q", [None])[0]
                limit = min(int(qs.get("limit", ["30"])[0]), 100)
                offset = int(qs.get("offset", ["0"])[0])
                voter_key = self._voter_key(self._current_user())
                items = db.list_posts(sort=sort, tag=tag, query=query, limit=limit, offset=offset, voter_key=voter_key)
                return self._send_json(200, {"posts": items})

            if path.startswith("/api/posts/"):
                post_id = path[len("/api/posts/"):].strip("/")
                voter_key = self._voter_key(self._current_user())
                post = db.get_post(post_id, voter_key)
                if not post:
                    return self._error(404, "Post not found.")
                post["comments"] = db.get_comment_tree(post_id)
                return self._send_json(200, {"post": post})

            if path == "/api/tags":
                return self._send_json(200, {"tags": db.list_tags()})

            if path == "/api/admin/users":
                user = self._current_user()
                if not self._require_admin(user):
                    return self._error(403, "Admin access required.")
                return self._send_json(200, {"users": db.list_users()})

            if path == "/api/admin/stats":
                user = self._current_user()
                if not self._require_admin(user):
                    return self._error(403, "Admin access required.")
                return self._send_json(200, {"stats": db.admin_stats()})

            if path == "/api/admin/posts":
                user = self._current_user()
                if not self._require_admin(user):
                    return self._error(403, "Admin access required.")
                return self._send_json(200, {"posts": db.admin_list_posts()})

            return self._serve_static(path)
        except Exception as exc:  # noqa: BLE001
            self._error(500, str(exc))

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        try:
            body = self._read_json_body()
        except ValueError as exc:
            return self._error(400, str(exc))

        try:
            if path == "/api/register":
                user = db.create_user(body.get("username", ""), body.get("password", ""))
                token = db.create_session(user["id"])
                return self._send_json(201, {"user": user, "token": token})

            if path == "/api/login":
                user = db.authenticate(body.get("username", ""), body.get("password", ""))
                if not user:
                    return self._error(401, "Invalid username or password.")
                token = db.create_session(user["id"])
                return self._send_json(200, {"user": user, "token": token})

            if path == "/api/logout":
                auth = self.headers.get("Authorization", "")
                if auth.startswith("Bearer "):
                    db.revoke_session(auth[len("Bearer "):].strip())
                return self._send_json(200, {"ok": True})

            if path == "/api/posts":
                user = self._current_user()
                post = db.create_post(
                    title=body.get("title", ""),
                    body=body.get("body", ""),
                    link_url=body.get("linkUrl"),
                    tags=body.get("tags", []),
                    attachments=body.get("attachments", []),
                    author=user,
                )
                return self._send_json(201, {"post": post})

            if path.startswith("/api/posts/") and path.endswith("/vote"):
                post_id = path[len("/api/posts/"):-len("/vote")].strip("/")
                user = self._current_user()
                post = db.vote_post(post_id, self._voter_key(user), int(body.get("value", 0)))
                if not post:
                    return self._error(404, "Post not found.")
                return self._send_json(200, {"post": post})

            if path.startswith("/api/posts/") and path.endswith("/comments"):
                post_id = path[len("/api/posts/"):-len("/comments")].strip("/")
                user = self._current_user()
                comment = db.create_comment(
                    post_id=post_id,
                    parent_id=body.get("parentId"),
                    body=body.get("body", ""),
                    attachments=body.get("attachments", []),
                    author=user,
                )
                return self._send_json(201, {"comment": comment})

            if path.startswith("/api/comments/") and path.endswith("/vote"):
                comment_id = path[len("/api/comments/"):-len("/vote")].strip("/")
                user = self._current_user()
                comment = db.vote_comment(comment_id, self._voter_key(user), int(body.get("value", 0)))
                if not comment:
                    return self._error(404, "Comment not found.")
                return self._send_json(200, {"comment": comment})

            if path.startswith("/api/admin/users/") and path.endswith("/role"):
                user = self._current_user()
                if not self._require_admin(user):
                    return self._error(403, "Admin access required.")
                user_id = path[len("/api/admin/users/"):-len("/role")].strip("/")
                db.set_user_role(user_id, body.get("role", "user"))
                return self._send_json(200, {"ok": True})

            if path.startswith("/api/posts/") and path.endswith("/restore"):
                post_id = path[len("/api/posts/"):-len("/restore")].strip("/")
                user = self._current_user()
                ok = db.restore_post(post_id, user)
                return self._send_json(200, {"ok": ok}) if ok else self._error(404, "Post not found.")

            return self._error(404, "Not found.")
        except PermissionError as exc:
            self._error(403, str(exc))
        except ValueError as exc:
            self._error(400, str(exc))
        except Exception as exc:  # noqa: BLE001
            self._error(500, str(exc))

    def do_DELETE(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        user = self._current_user()
        try:
            if path.startswith("/api/posts/"):
                post_id = path[len("/api/posts/"):].strip("/")
                ok = db.delete_post(post_id, user)
                return self._send_json(200, {"ok": ok}) if ok else self._error(404, "Post not found.")

            if path.startswith("/api/comments/"):
                comment_id = path[len("/api/comments/"):].strip("/")
                ok = db.delete_comment(comment_id, user)
                return self._send_json(200, {"ok": ok}) if ok else self._error(404, "Comment not found.")

            self._error(404, "Not found.")
        except PermissionError as exc:
            self._error(403, str(exc))
        except Exception as exc:  # noqa: BLE001
            self._error(500, str(exc))

    # ---- static file serving --------------------------------------------

    def _serve_static(self, path: str) -> None:
        if path == "/":
            path = "/index.html"
        # Prevent path traversal outside the app directory.
        safe_path = os.path.normpath(path).lstrip("/\\")
        file_path = (APP_DIR / safe_path).resolve()
        if APP_DIR not in file_path.parents and file_path != APP_DIR:
            return self._error(403, "Forbidden.")
        if not file_path.is_file():
            return self._error(404, "Not found.")

        content_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
        }
        content_type = content_types.get(file_path.suffix, "application/octet-stream")
        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        sys.stderr.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), format % args))


def build_server(host: str, port: int) -> HTTPServer:
    httpd = HTTPServer((host, port), PulseRequestHandler)
    cert_file = APP_DIR / "server.pem"
    key_file = APP_DIR / "server.key"
    if cert_file.exists() and key_file.exists():
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(certfile=str(cert_file), keyfile=str(key_file))
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
        print(f"TLS enabled using {cert_file.name} — serving HTTPS on https://{host}:{port}")
    else:
        print(f"No server.pem/server.key found — serving plain HTTP on http://{host}:{port}")
        print("Run ./generate_cert.sh to create a local self-signed certificate for HTTPS.")
    return httpd


def main() -> None:
    host = os.environ.get("PULSE_HOST", "127.0.0.1")
    port = int(os.environ.get("PULSE_PORT", "8000"))
    httpd = build_server(host, port)
    scheme = "https" if isinstance(httpd.socket, ssl.SSLSocket) else "http"
    print(f"Pulse news aggregator running at {scheme}://{host}:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        httpd.server_close()


if __name__ == "__main__":
    main()
