#!/usr/bin/env python3
"""Small SQLite-backed server for Postboard."""

import json
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).parent
DATABASE_PATH = ROOT / "postboard.db"


def connect_database():
    database = sqlite3.connect(DATABASE_PATH)
    database.row_factory = sqlite3.Row
    database.execute(
        """
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            person_name TEXT NOT NULL,
            user_name TEXT NOT NULL,
            message TEXT NOT NULL,
            post_date TEXT NOT NULL,
            post_time TEXT NOT NULL,
            location TEXT NOT NULL DEFAULT '',
            attachment_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT
        )
        """
    )
    database.commit()
    return database


def post_from_row(row):
    post = {
        "id": row["id"],
        "personName": row["person_name"],
        "userName": row["user_name"],
        "message": row["message"],
        "date": row["post_date"],
        "time": row["post_time"],
        "location": row["location"],
        "createdAt": row["created_at"],
    }
    if row["updated_at"]:
        post["updatedAt"] = row["updated_at"]
    if row["attachment_json"]:
        post["attachment"] = json.loads(row["attachment_json"])
    return post


class PostboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        if urlparse(self.path).path == "/api/posts":
            with connect_database() as database:
                rows = database.execute("SELECT * FROM posts ORDER BY created_at DESC").fetchall()
            self.send_json([post_from_row(row) for row in rows])
            return
        super().do_GET()

    def do_PUT(self):
        if urlparse(self.path).path != "/api/posts":
            self.send_error(404)
            return
        try:
            posts = self.read_json()
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "Request body must be valid JSON."}, 400)
            return
        if not isinstance(posts, list):
            self.send_json({"error": "Posts must be a JSON array."}, 400)
            return
        required_fields = {"id", "personName", "userName", "message", "date", "time"}
        if any(not isinstance(post, dict) or not required_fields.issubset(post) for post in posts):
            self.send_json({"error": "Each post must include id, personName, userName, message, date, and time."}, 400)
            return
        with connect_database() as database:
            database.execute("DELETE FROM posts")
            for post in posts:
                database.execute(
                    """
                    INSERT INTO posts (id, person_name, user_name, message, post_date,
                      post_time, location, attachment_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        post["id"], post["personName"], post["userName"], post["message"],
                        post["date"], post["time"], post.get("location", ""),
                        json.dumps(post["attachment"]) if post.get("attachment") else None,
                        post.get("createdAt", ""), post.get("updatedAt"),
                    ),
                )
        self.send_json({"saved": len(posts)})


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 8000), PostboardHandler)
    print("Postboard running at http://127.0.0.1:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()