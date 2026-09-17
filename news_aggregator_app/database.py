#!/usr/bin/env python3
"""
SQLite storage backend for the Pulse news aggregator.

This is the default, zero-configuration backend used when Supabase
credentials (SUPABASE_URL / SUPABASE_SERVICE_KEY) are not set. It handles
schema creation and all CRUD/search/ranking operations for posts, comments,
votes, tags, and users, persisting everything to a local `pulse.db` file.
See database_supabase.py for the Postgres/Supabase-backed equivalent.
"""

from __future__ import annotations

import json
import re
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from security import (
    SEED_ADMIN_USERNAME,
    SEED_ADMIN_PASSWORD,
    SESSION_TTL_SECONDS,
    generate_session_token,
    hash_password,
    hash_token,
    hot_score,
    new_id,
    now_iso,
    plain_excerpt,
    sanitize_rich_text,
    verify_password,
)

DB_FILE = Path(__file__).resolve().parent / "pulse.db"


# --------------------------------------------------------------------------
# Connection & schema
# --------------------------------------------------------------------------

def get_db_connection(db_path: Optional[str | Path] = None) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path or DB_FILE))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn



def init_db(db_path: Optional[str | Path] = None) -> None:
    conn = get_db_connection(db_path)
    with conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                author_name TEXT NOT NULL DEFAULT 'Anonymous',
                title TEXT NOT NULL,
                body TEXT DEFAULT '',
                link_url TEXT,
                tags TEXT DEFAULT '[]',
                attachments TEXT DEFAULT '[]',
                upvotes INTEGER DEFAULT 0,
                downvotes INTEGER DEFAULT 0,
                is_deleted INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS post_votes (
                post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                voter_key TEXT NOT NULL,
                value INTEGER NOT NULL,
                PRIMARY KEY (post_id, voter_key)
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
                author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                author_name TEXT NOT NULL DEFAULT 'Anonymous',
                body TEXT DEFAULT '',
                attachments TEXT DEFAULT '[]',
                upvotes INTEGER DEFAULT 0,
                downvotes INTEGER DEFAULT 0,
                is_deleted INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS comment_votes (
                comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
                voter_key TEXT NOT NULL,
                value INTEGER NOT NULL,
                PRIMARY KEY (comment_id, voter_key)
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);")

        admin = conn.execute("SELECT id FROM users WHERE username = ?", (SEED_ADMIN_USERNAME,)).fetchone()
        if not admin:
            password_hash, salt = hash_password(SEED_ADMIN_PASSWORD)
            conn.execute(
                "INSERT INTO users (id, username, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)",
                (new_id(), SEED_ADMIN_USERNAME, password_hash, salt, now_iso()),
            )
    conn.close()


class DatabaseManager:
    def __init__(self, db_path: Optional[str | Path] = None):
        self.db_path = db_path or DB_FILE
        init_db(self.db_path)

    def _conn(self) -> sqlite3.Connection:
        return get_db_connection(self.db_path)

    # ---- Users & auth ----------------------------------------------------

    def create_user(self, username: str, password: str) -> Dict[str, Any]:
        username = username.strip()
        if not re.match(r"^[A-Za-z0-9_.-]{3,32}$", username):
            raise ValueError("Username must be 3-32 characters (letters, numbers, _ . -).")
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters.")
        conn = self._conn()
        try:
            with conn:
                existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
                if existing:
                    raise ValueError("Username is already taken.")
                password_hash, salt = hash_password(password)
                user_id = new_id()
                conn.execute(
                    "INSERT INTO users (id, username, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, 'user', ?)",
                    (user_id, username, password_hash, salt, now_iso()),
                )
                return {"id": user_id, "username": username, "role": "user"}
        finally:
            conn.close()

    def authenticate(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        conn = self._conn()
        try:
            row = conn.execute("SELECT * FROM users WHERE username = ?", (username.strip(),)).fetchone()
            if not row or not verify_password(password, row["password_hash"], row["password_salt"]):
                return None
            return {"id": row["id"], "username": row["username"], "role": row["role"]}
        finally:
            conn.close()

    def create_session(self, user_id: str) -> str:
        token = generate_session_token()
        conn = self._conn()
        try:
            with conn:
                conn.execute(
                    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                    (hash_token(token), user_id, now_iso(),
                     datetime.fromtimestamp(time.time() + SESSION_TTL_SECONDS, tz=timezone.utc).isoformat()),
                )
            return token
        finally:
            conn.close()

    def get_user_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        if not token:
            return None
        conn = self._conn()
        try:
            row = conn.execute(
                """
                SELECT u.id, u.username, u.role, s.expires_at FROM sessions s
                JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?
                """,
                (hash_token(token),),
            ).fetchone()
            if not row:
                return None
            if datetime.fromisoformat(row["expires_at"]) < datetime.now(timezone.utc):
                return None
            return {"id": row["id"], "username": row["username"], "role": row["role"]}
        finally:
            conn.close()

    def revoke_session(self, token: str) -> None:
        conn = self._conn()
        try:
            with conn:
                conn.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(token),))
        finally:
            conn.close()

    # ---- Posts -------------------------------------------------------------

    def create_post(self, title: str, body: str, link_url: Optional[str], tags: List[str],
                     attachments: List[Dict[str, Any]], author: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        title = (title or "").strip()
        if not title:
            raise ValueError("Title is required.")
        if len(title) > 300:
            raise ValueError("Title is too long.")
        clean_tags = sorted({t.strip().lower()[:32] for t in tags if t and t.strip()})[:12]
        post_id = new_id()
        conn = self._conn()
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO posts (id, author_id, author_name, title, body, link_url, tags, attachments, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        post_id,
                        author["id"] if author else None,
                        author["username"] if author else "Anonymous",
                        title,
                        sanitize_rich_text(body),
                        (link_url or "").strip()[:2000] or None,
                        json.dumps(clean_tags),
                        json.dumps(attachments or []),
                        now_iso(),
                    ),
                )
            return self.get_post(post_id)
        finally:
            conn.close()

    def _post_row_to_dict(self, row: sqlite3.Row, comment_count: int = 0, my_vote: int = 0) -> Dict[str, Any]:
        data = dict(row)
        data["tags"] = json.loads(data.pop("tags") or "[]")
        data["attachments"] = json.loads(data.pop("attachments") or "[]")
        data["score"] = data["upvotes"] - data["downvotes"]
        data["hotRank"] = hot_score(data["upvotes"], data["downvotes"], data["created_at"])
        data["commentCount"] = comment_count
        data["myVote"] = my_vote
        data["isDeleted"] = bool(data.pop("is_deleted"))
        data["authorId"] = data.pop("author_id")
        data["authorName"] = data.pop("author_name")
        data["linkUrl"] = data.pop("link_url")
        data["createdAt"] = data.pop("created_at")
        return data

    def get_post(self, post_id: str, voter_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
        conn = self._conn()
        try:
            row = conn.execute("SELECT * FROM posts WHERE id = ? AND is_deleted = 0", (post_id,)).fetchone()
            if not row:
                return None
            count = conn.execute(
                "SELECT COUNT(*) c FROM comments WHERE post_id = ? AND is_deleted = 0", (post_id,)
            ).fetchone()["c"]
            my_vote = 0
            if voter_key:
                vote_row = conn.execute(
                    "SELECT value FROM post_votes WHERE post_id = ? AND voter_key = ?", (post_id, voter_key)
                ).fetchone()
                my_vote = vote_row["value"] if vote_row else 0
            return self._post_row_to_dict(row, count, my_vote)
        finally:
            conn.close()

    def list_posts(self, sort: str = "hot", tag: Optional[str] = None, query: Optional[str] = None,
                   limit: int = 50, offset: int = 0, voter_key: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = self._conn()
        try:
            rows = conn.execute("SELECT * FROM posts WHERE is_deleted = 0").fetchall()
            counts = {r["post_id"]: r["c"] for r in conn.execute(
                "SELECT post_id, COUNT(*) c FROM comments WHERE is_deleted = 0 GROUP BY post_id"
            ).fetchall()}
            my_votes = {}
            if voter_key:
                my_votes = {r["post_id"]: r["value"] for r in conn.execute(
                    "SELECT post_id, value FROM post_votes WHERE voter_key = ?", (voter_key,)
                ).fetchall()}
        finally:
            conn.close()

        items = [self._post_row_to_dict(r, counts.get(r["id"], 0), my_votes.get(r["id"], 0)) for r in rows]

        if tag:
            tag = tag.strip().lower()
            items = [p for p in items if tag in p["tags"]]
        if query:
            q = query.strip().lower()
            items = [
                p for p in items
                if q in p["title"].lower()
                or q in plain_excerpt(p["body"], 5000).lower()
                or any(q in t for t in p["tags"])
            ]

        if sort == "new":
            items.sort(key=lambda p: p["createdAt"], reverse=True)
        elif sort == "top":
            items.sort(key=lambda p: (p["score"], p["createdAt"]), reverse=True)
        else:
            items.sort(key=lambda p: p["hotRank"], reverse=True)

        return items[offset: offset + limit]

    def vote_post(self, post_id: str, voter_key: str, value: int) -> Optional[Dict[str, Any]]:
        value = 1 if value > 0 else (-1 if value < 0 else 0)
        conn = self._conn()
        try:
            with conn:
                existing = conn.execute(
                    "SELECT value FROM post_votes WHERE post_id = ? AND voter_key = ?", (post_id, voter_key)
                ).fetchone()
                if existing:
                    old = existing["value"]
                    if old == 1:
                        conn.execute("UPDATE posts SET upvotes = upvotes - 1 WHERE id = ?", (post_id,))
                    elif old == -1:
                        conn.execute("UPDATE posts SET downvotes = downvotes - 1 WHERE id = ?", (post_id,))
                    conn.execute("DELETE FROM post_votes WHERE post_id = ? AND voter_key = ?", (post_id, voter_key))
                if value != 0:
                    conn.execute(
                        "INSERT INTO post_votes (post_id, voter_key, value) VALUES (?, ?, ?)",
                        (post_id, voter_key, value),
                    )
                    if value == 1:
                        conn.execute("UPDATE posts SET upvotes = upvotes + 1 WHERE id = ?", (post_id,))
                    else:
                        conn.execute("UPDATE posts SET downvotes = downvotes + 1 WHERE id = ?", (post_id,))
        finally:
            conn.close()
        return self.get_post(post_id, voter_key)

    def delete_post(self, post_id: str, requester: Optional[Dict[str, Any]]) -> bool:
        conn = self._conn()
        try:
            row = conn.execute("SELECT author_id FROM posts WHERE id = ?", (post_id,)).fetchone()
            if not row:
                return False
            is_owner = requester and requester["id"] == row["author_id"]
            is_admin = requester and requester["role"] == "admin"
            if not (is_owner or is_admin):
                raise PermissionError("Not authorized to delete this post.")
            with conn:
                conn.execute("UPDATE posts SET is_deleted = 1 WHERE id = ?", (post_id,))
            return True
        finally:
            conn.close()

    def restore_post(self, post_id: str, requester: Optional[Dict[str, Any]]) -> bool:
        if not (requester and requester["role"] == "admin"):
            raise PermissionError("Admin access required to restore a post.")
        conn = self._conn()
        try:
            row = conn.execute("SELECT id FROM posts WHERE id = ?", (post_id,)).fetchone()
            if not row:
                return False
            with conn:
                conn.execute("UPDATE posts SET is_deleted = 0 WHERE id = ?", (post_id,))
            return True
        finally:
            conn.close()

    def list_tags(self) -> List[Dict[str, Any]]:
        conn = self._conn()
        try:
            rows = conn.execute("SELECT tags FROM posts WHERE is_deleted = 0").fetchall()
        finally:
            conn.close()
        counts: Dict[str, int] = {}
        for row in rows:
            for tag in json.loads(row["tags"] or "[]"):
                counts[tag] = counts.get(tag, 0) + 1
        return sorted(({"tag": t, "count": c} for t, c in counts.items()), key=lambda x: -x["count"])

    # ---- Comments -----------------------------------------------------------

    def create_comment(self, post_id: str, parent_id: Optional[str], body: str,
                        attachments: List[Dict[str, Any]], author: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        body = (body or "").strip()
        if not body and not attachments:
            raise ValueError("Comment body or an attachment is required.")
        conn = self._conn()
        try:
            post = conn.execute("SELECT id FROM posts WHERE id = ? AND is_deleted = 0", (post_id,)).fetchone()
            if not post:
                raise ValueError("Post not found.")
            if parent_id:
                parent = conn.execute(
                    "SELECT id FROM comments WHERE id = ? AND post_id = ?", (parent_id, post_id)
                ).fetchone()
                if not parent:
                    raise ValueError("Parent comment not found.")
            comment_id = new_id()
            with conn:
                conn.execute(
                    """
                    INSERT INTO comments (id, post_id, parent_id, author_id, author_name, body, attachments, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        comment_id, post_id, parent_id,
                        author["id"] if author else None,
                        author["username"] if author else "Anonymous",
                        sanitize_rich_text(body),
                        json.dumps(attachments or []),
                        now_iso(),
                    ),
                )
        finally:
            conn.close()
        return self.get_comment(comment_id)

    def _comment_row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        data = dict(row)
        data["attachments"] = json.loads(data.pop("attachments") or "[]")
        data["score"] = data["upvotes"] - data["downvotes"]
        data["isDeleted"] = bool(data.pop("is_deleted"))
        data["authorId"] = data.pop("author_id")
        data["authorName"] = data.pop("author_name")
        data["parentId"] = data.pop("parent_id")
        data["postId"] = data.pop("post_id")
        data["createdAt"] = data.pop("created_at")
        data["replies"] = []
        return data

    def get_comment(self, comment_id: str) -> Optional[Dict[str, Any]]:
        conn = self._conn()
        try:
            row = conn.execute("SELECT * FROM comments WHERE id = ?", (comment_id,)).fetchone()
            return self._comment_row_to_dict(row) if row else None
        finally:
            conn.close()

    def get_comment_tree(self, post_id: str) -> List[Dict[str, Any]]:
        conn = self._conn()
        try:
            rows = conn.execute(
                "SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC", (post_id,)
            ).fetchall()
        finally:
            conn.close()
        by_id: Dict[str, Dict[str, Any]] = {}
        roots: List[Dict[str, Any]] = []
        for row in rows:
            item = self._comment_row_to_dict(row)
            if item["isDeleted"]:
                item["body"] = ""
                item["authorName"] = "[deleted]"
                item["attachments"] = []
            by_id[item["id"]] = item
        for item in by_id.values():
            parent = item["parentId"]
            if parent and parent in by_id:
                by_id[parent]["replies"].append(item)
            else:
                roots.append(item)
        return roots

    def vote_comment(self, comment_id: str, voter_key: str, value: int) -> Optional[Dict[str, Any]]:
        value = 1 if value > 0 else (-1 if value < 0 else 0)
        conn = self._conn()
        try:
            with conn:
                existing = conn.execute(
                    "SELECT value FROM comment_votes WHERE comment_id = ? AND voter_key = ?",
                    (comment_id, voter_key),
                ).fetchone()
                if existing:
                    old = existing["value"]
                    if old == 1:
                        conn.execute("UPDATE comments SET upvotes = upvotes - 1 WHERE id = ?", (comment_id,))
                    elif old == -1:
                        conn.execute("UPDATE comments SET downvotes = downvotes - 1 WHERE id = ?", (comment_id,))
                    conn.execute(
                        "DELETE FROM comment_votes WHERE comment_id = ? AND voter_key = ?", (comment_id, voter_key)
                    )
                if value != 0:
                    conn.execute(
                        "INSERT INTO comment_votes (comment_id, voter_key, value) VALUES (?, ?, ?)",
                        (comment_id, voter_key, value),
                    )
                    column = "upvotes" if value == 1 else "downvotes"
                    conn.execute(f"UPDATE comments SET {column} = {column} + 1 WHERE id = ?", (comment_id,))
        finally:
            conn.close()
        return self.get_comment(comment_id)

    def delete_comment(self, comment_id: str, requester: Optional[Dict[str, Any]]) -> bool:
        conn = self._conn()
        try:
            row = conn.execute("SELECT author_id FROM comments WHERE id = ?", (comment_id,)).fetchone()
            if not row:
                return False
            is_owner = requester and requester["id"] == row["author_id"]
            is_admin = requester and requester["role"] == "admin"
            if not (is_owner or is_admin):
                raise PermissionError("Not authorized to delete this comment.")
            with conn:
                conn.execute("UPDATE comments SET is_deleted = 1 WHERE id = ?", (comment_id,))
            return True
        finally:
            conn.close()

    # ---- Admin --------------------------------------------------------------

    def list_users(self) -> List[Dict[str, Any]]:
        conn = self._conn()
        try:
            rows = conn.execute("SELECT id, username, role, created_at FROM users ORDER BY created_at ASC").fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def set_user_role(self, user_id: str, role: str) -> None:
        if role not in ("user", "admin"):
            raise ValueError("Invalid role.")
        conn = self._conn()
        try:
            with conn:
                conn.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
        finally:
            conn.close()

    def admin_stats(self) -> Dict[str, Any]:
        conn = self._conn()
        try:
            users = conn.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
            posts = conn.execute("SELECT COUNT(*) c FROM posts WHERE is_deleted = 0").fetchone()["c"]
            deleted_posts = conn.execute("SELECT COUNT(*) c FROM posts WHERE is_deleted = 1").fetchone()["c"]
            comments = conn.execute("SELECT COUNT(*) c FROM comments WHERE is_deleted = 0").fetchone()["c"]
            anonymous_posts = conn.execute(
                "SELECT COUNT(*) c FROM posts WHERE author_id IS NULL AND is_deleted = 0"
            ).fetchone()["c"]
            return {
                "users": users,
                "posts": posts,
                "deletedPosts": deleted_posts,
                "comments": comments,
                "anonymousPosts": anonymous_posts,
            }
        finally:
            conn.close()

    def admin_list_posts(self, limit: int = 200) -> List[Dict[str, Any]]:
        conn = self._conn()
        try:
            rows = conn.execute(
                "SELECT * FROM posts ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
            counts = {r["post_id"]: r["c"] for r in conn.execute(
                "SELECT post_id, COUNT(*) c FROM comments GROUP BY post_id"
            ).fetchall()}
        finally:
            conn.close()
        return [self._post_row_to_dict(r, counts.get(r["id"], 0)) for r in rows]

