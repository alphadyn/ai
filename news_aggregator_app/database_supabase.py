#!/usr/bin/env python3
"""
Supabase (hosted Postgres) storage backend for the Pulse news aggregator.

Used instead of the local SQLite backend (database.py) when SUPABASE_URL and
SUPABASE_SERVICE_KEY are configured (see README "Supabase setup"). Talks to
Supabase's PostgREST API over HTTPS using the Python standard library only
(urllib) — no third-party client library required.

IMPORTANT: this module uses the Supabase *service role* key, which bypasses
Row Level Security and must only ever be used from this trusted server
process — it is never sent to the browser. The schema in supabase-schema.sql
enables RLS with no public policies, so the anon/public key (if one were
used client-side) cannot read or write any table directly. All access must
go through this server's API, which enforces the same auth/ownership rules
as the SQLite backend.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from security import (
    generate_session_token,
    hash_password,
    hash_token,
    hot_score,
    new_id,
    now_iso,
    plain_excerpt,
    sanitize_rich_text,
    validate_avatar_data_url,
    verify_password,
    SEED_ADMIN_USERNAME,
    SEED_ADMIN_PASSWORD,
    SESSION_TTL_SECONDS,
)


class SupabaseError(RuntimeError):
    pass


class SupabaseDatabaseManager:
    def __init__(self, url: str, service_key: str):
        self.base_url = url.rstrip("/")
        self.service_key = service_key
        self._ensure_seed_admin()

    # ---- low-level REST helpers -------------------------------------------

    def _request(self, method: str, path: str, *, params: Optional[Dict[str, Any]] = None,
                  json_body: Any = None, extra_headers: Optional[Dict[str, str]] = None) -> tuple[Any, Dict[str, str]]:
        query = f"?{urllib.parse.urlencode(params, doseq=True)}" if params else ""
        url = f"{self.base_url}/rest/v1/{path}{query}"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            **(extra_headers or {}),
        }
        data = json.dumps(json_body).encode("utf-8") if json_body is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = resp.read()
                parsed = json.loads(body) if body else None
                return parsed, dict(resp.headers)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SupabaseError(f"Supabase {method} {path} failed ({exc.code}): {detail}") from exc
        except urllib.error.URLError as exc:
            raise SupabaseError(f"Could not reach Supabase at {self.base_url}: {exc.reason}") from exc

    def _count(self, path: str, params: Dict[str, Any]) -> int:
        _, headers = self._request(
            "GET", path,
            params={**params, "select": "id", "limit": 1},
            extra_headers={"Prefer": "count=exact"},
        )
        content_range = headers.get("Content-Range", "0/0")
        return int(content_range.split("/")[-1] or 0)

    def _ensure_seed_admin(self) -> None:
        existing, _ = self._request("GET", "users", params={"username": f"eq.{SEED_ADMIN_USERNAME}", "select": "id"})
        if existing:
            return
        password_hash, salt = hash_password(SEED_ADMIN_PASSWORD)
        self._request("POST", "users", json_body={
            "id": new_id(),
            "username": SEED_ADMIN_USERNAME,
            "password_hash": password_hash,
            "password_salt": salt,
            "role": "admin",
            "created_at": now_iso(),
        }, extra_headers={"Prefer": "return=minimal"})

    # ---- Users & auth -------------------------------------------------------

    def create_user(self, username: str, password: str) -> Dict[str, Any]:
        import re
        username = username.strip()
        if not re.match(r"^[A-Za-z0-9_.-]{3,32}$", username):
            raise ValueError("Username must be 3-32 characters (letters, numbers, _ . -).")
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters.")
        existing, _ = self._request("GET", "users", params={"username": f"eq.{username}", "select": "id"})
        if existing:
            raise ValueError("Username is already taken.")
        password_hash, salt = hash_password(password)
        user_id = new_id()
        self._request("POST", "users", json_body={
            "id": user_id,
            "username": username,
            "password_hash": password_hash,
            "password_salt": salt,
            "role": "user",
            "created_at": now_iso(),
        }, extra_headers={"Prefer": "return=minimal"})
        return {"id": user_id, "username": username, "role": "user", "avatar": None}

    def authenticate(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        rows, _ = self._request("GET", "users", params={"username": f"eq.{username.strip()}", "select": "*"})
        if not rows:
            return None
        row = rows[0]
        if not verify_password(password, row["password_hash"], row["password_salt"]):
            return None
        return {"id": row["id"], "username": row["username"], "role": row["role"], "avatar": row.get("avatar_data_url")}

    def create_session(self, user_id: str) -> str:
        token = generate_session_token()
        import time as _time
        from datetime import datetime, timezone
        expires_at = datetime.fromtimestamp(_time.time() + SESSION_TTL_SECONDS, tz=timezone.utc).isoformat()
        self._request("POST", "sessions", json_body={
            "token_hash": hash_token(token),
            "user_id": user_id,
            "created_at": now_iso(),
            "expires_at": expires_at,
        }, extra_headers={"Prefer": "return=minimal"})
        return token

    def get_user_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        if not token:
            return None
        from datetime import datetime, timezone
        rows, _ = self._request("GET", "sessions", params={"token_hash": f"eq.{hash_token(token)}", "select": "*"})
        if not rows:
            return None
        session = rows[0]
        if datetime.fromisoformat(session["expires_at"]) < datetime.now(timezone.utc):
            return None
        users, _ = self._request("GET", "users", params={"id": f"eq.{session['user_id']}", "select": "*"})
        if not users:
            return None
        u = users[0]
        return {"id": u["id"], "username": u["username"], "role": u["role"], "avatar": u.get("avatar_data_url")}

    def revoke_session(self, token: str) -> None:
        self._request("DELETE", "sessions", params={"token_hash": f"eq.{hash_token(token)}"})

    def set_avatar(self, user_id: str, avatar_data_url: Optional[str]) -> None:
        clean = validate_avatar_data_url(avatar_data_url) if avatar_data_url else None
        self._request("PATCH", "users", params={"id": f"eq.{user_id}"}, json_body={"avatar_data_url": clean},
                      extra_headers={"Prefer": "return=minimal"})

    def _avatar_map(self, author_ids: List[Optional[str]]) -> Dict[str, Optional[str]]:
        ids = [a for a in set(author_ids) if a]
        if not ids:
            return {}
        rows, _ = self._request("GET", "users", params={
            "id": f"in.({','.join(ids)})", "select": "id,avatar_data_url",
        })
        return {r["id"]: r.get("avatar_data_url") for r in rows or []}

    # ---- Posts ---------------------------------------------------------------

    def _post_to_dict(self, row: Dict[str, Any], comment_count: int = 0, my_vote: int = 0,
                       author_avatar: Optional[str] = None) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "authorId": row.get("author_id"),
            "authorName": row.get("author_name", "Anonymous"),
            "authorAvatar": author_avatar,
            "title": row["title"],
            "body": row.get("body", ""),
            "linkUrl": row.get("link_url"),
            "tags": row.get("tags") or [],
            "attachments": row.get("attachments") or [],
            "upvotes": row.get("upvotes", 0),
            "downvotes": row.get("downvotes", 0),
            "score": row.get("upvotes", 0) - row.get("downvotes", 0),
            "hotRank": hot_score(row.get("upvotes", 0), row.get("downvotes", 0), row["created_at"]),
            "commentCount": comment_count,
            "myVote": my_vote,
            "isDeleted": bool(row.get("is_deleted")),
            "createdAt": row["created_at"],
        }

    def create_post(self, title: str, body: str, link_url: Optional[str], tags: List[str],
                     attachments: List[Dict[str, Any]], author: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        title = (title or "").strip()
        if not title:
            raise ValueError("Title is required.")
        if len(title) > 300:
            raise ValueError("Title is too long.")
        clean_tags = sorted({t.strip().lower()[:32] for t in tags if t and t.strip()})[:12]
        post_id = new_id()
        rows, _ = self._request("POST", "posts", json_body={
            "id": post_id,
            "author_id": author["id"] if author else None,
            "author_name": author["username"] if author else "Anonymous",
            "title": title,
            "body": sanitize_rich_text(body),
            "link_url": (link_url or "").strip()[:2000] or None,
            "tags": clean_tags,
            "attachments": attachments or [],
            "created_at": now_iso(),
        }, extra_headers={"Prefer": "return=representation"})
        return self._post_to_dict(rows[0])

    def get_post(self, post_id: str, voter_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
        rows, _ = self._request("GET", "posts", params={"id": f"eq.{post_id}", "is_deleted": "eq.false", "select": "*"})
        if not rows:
            return None
        count = self._count("comments", {"post_id": f"eq.{post_id}", "is_deleted": "eq.false"})
        my_vote = 0
        if voter_key:
            votes, _ = self._request("GET", "post_votes", params={
                "post_id": f"eq.{post_id}", "voter_key": f"eq.{voter_key}", "select": "value",
            })
            my_vote = votes[0]["value"] if votes else 0
        avatar = self._avatar_map([rows[0].get("author_id")]).get(rows[0].get("author_id"))
        return self._post_to_dict(rows[0], count, my_vote, avatar)

    def list_posts(self, sort: str = "hot", tag: Optional[str] = None, query: Optional[str] = None,
                   limit: int = 50, offset: int = 0, voter_key: Optional[str] = None) -> List[Dict[str, Any]]:
        rows, _ = self._request("GET", "posts", params={"is_deleted": "eq.false", "select": "*"})
        comments, _ = self._request("GET", "comments", params={"is_deleted": "eq.false", "select": "post_id"})
        counts: Dict[str, int] = {}
        for c in comments or []:
            counts[c["post_id"]] = counts.get(c["post_id"], 0) + 1

        my_votes: Dict[str, int] = {}
        if voter_key:
            votes, _ = self._request("GET", "post_votes", params={"voter_key": f"eq.{voter_key}", "select": "post_id,value"})
            my_votes = {v["post_id"]: v["value"] for v in votes or []}

        avatars = self._avatar_map([r.get("author_id") for r in rows or []])
        items = [
            self._post_to_dict(r, counts.get(r["id"], 0), my_votes.get(r["id"], 0), avatars.get(r.get("author_id")))
            for r in rows or []
        ]

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

    def _apply_vote(self, table: str, key_field: str, key_value: str, count_table: str,
                     voter_key: str, value: int) -> None:
        value = 1 if value > 0 else (-1 if value < 0 else 0)
        existing, _ = self._request("GET", table, params={key_field: f"eq.{key_value}", "voter_key": f"eq.{voter_key}", "select": "value"})
        if existing:
            old = existing[0]["value"]
            column = "upvotes" if old == 1 else "downvotes"
            self._decrement(count_table, key_value, column)
            self._request("DELETE", table, params={key_field: f"eq.{key_value}", "voter_key": f"eq.{voter_key}"})
        if value != 0:
            self._request("POST", table, json_body={
                key_field: key_value, "voter_key": voter_key, "value": value,
            }, extra_headers={"Prefer": "return=minimal"})
            column = "upvotes" if value == 1 else "downvotes"
            self._increment(count_table, key_value, column)

    def _increment(self, table: str, row_id: str, column: str) -> None:
        rows, _ = self._request("GET", table, params={"id": f"eq.{row_id}", "select": column})
        current = rows[0][column] if rows else 0
        self._request("PATCH", table, params={"id": f"eq.{row_id}"}, json_body={column: current + 1},
                      extra_headers={"Prefer": "return=minimal"})

    def _decrement(self, table: str, row_id: str, column: str) -> None:
        rows, _ = self._request("GET", table, params={"id": f"eq.{row_id}", "select": column})
        current = rows[0][column] if rows else 0
        self._request("PATCH", table, params={"id": f"eq.{row_id}"}, json_body={column: max(current - 1, 0)},
                      extra_headers={"Prefer": "return=minimal"})

    def vote_post(self, post_id: str, voter_key: str, value: int) -> Optional[Dict[str, Any]]:
        self._apply_vote("post_votes", "post_id", post_id, "posts", voter_key, value)
        return self.get_post(post_id, voter_key)

    def delete_post(self, post_id: str, requester: Optional[Dict[str, Any]]) -> bool:
        rows, _ = self._request("GET", "posts", params={"id": f"eq.{post_id}", "select": "author_id"})
        if not rows:
            return False
        is_owner = requester and requester["id"] == rows[0]["author_id"]
        is_admin = requester and requester["role"] == "admin"
        if not (is_owner or is_admin):
            raise PermissionError("Not authorized to delete this post.")
        self._request("PATCH", "posts", params={"id": f"eq.{post_id}"}, json_body={"is_deleted": True},
                      extra_headers={"Prefer": "return=minimal"})
        return True

    def restore_post(self, post_id: str, requester: Optional[Dict[str, Any]]) -> bool:
        if not (requester and requester["role"] == "admin"):
            raise PermissionError("Admin access required to restore a post.")
        rows, _ = self._request("GET", "posts", params={"id": f"eq.{post_id}", "select": "id"})
        if not rows:
            return False
        self._request("PATCH", "posts", params={"id": f"eq.{post_id}"}, json_body={"is_deleted": False},
                      extra_headers={"Prefer": "return=minimal"})
        return True

    def list_tags(self) -> List[Dict[str, Any]]:
        rows, _ = self._request("GET", "posts", params={"is_deleted": "eq.false", "select": "tags"})
        counts: Dict[str, int] = {}
        for row in rows or []:
            for tag in row.get("tags") or []:
                counts[tag] = counts.get(tag, 0) + 1
        return sorted(({"tag": t, "count": c} for t, c in counts.items()), key=lambda x: -x["count"])

    # ---- Comments -------------------------------------------------------------

    def _comment_to_dict(self, row: Dict[str, Any], author_avatar: Optional[str] = None) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "postId": row["post_id"],
            "parentId": row.get("parent_id"),
            "authorId": row.get("author_id"),
            "authorName": row.get("author_name", "Anonymous"),
            "authorAvatar": author_avatar,
            "body": row.get("body", ""),
            "attachments": row.get("attachments") or [],
            "upvotes": row.get("upvotes", 0),
            "downvotes": row.get("downvotes", 0),
            "score": row.get("upvotes", 0) - row.get("downvotes", 0),
            "isDeleted": bool(row.get("is_deleted")),
            "createdAt": row["created_at"],
            "replies": [],
        }

    def create_comment(self, post_id: str, parent_id: Optional[str], body: str,
                        attachments: List[Dict[str, Any]], author: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        body = (body or "").strip()
        if not body and not attachments:
            raise ValueError("Comment body or an attachment is required.")
        posts, _ = self._request("GET", "posts", params={"id": f"eq.{post_id}", "is_deleted": "eq.false", "select": "id"})
        if not posts:
            raise ValueError("Post not found.")
        if parent_id:
            parents, _ = self._request("GET", "comments", params={"id": f"eq.{parent_id}", "post_id": f"eq.{post_id}", "select": "id"})
            if not parents:
                raise ValueError("Parent comment not found.")
        comment_id = new_id()
        rows, _ = self._request("POST", "comments", json_body={
            "id": comment_id,
            "post_id": post_id,
            "parent_id": parent_id,
            "author_id": author["id"] if author else None,
            "author_name": author["username"] if author else "Anonymous",
            "body": sanitize_rich_text(body),
            "attachments": attachments or [],
            "created_at": now_iso(),
        }, extra_headers={"Prefer": "return=representation"})
        return self._comment_to_dict(rows[0])

    def get_comment(self, comment_id: str) -> Optional[Dict[str, Any]]:
        rows, _ = self._request("GET", "comments", params={"id": f"eq.{comment_id}", "select": "*"})
        if not rows:
            return None
        avatar = self._avatar_map([rows[0].get("author_id")]).get(rows[0].get("author_id"))
        return self._comment_to_dict(rows[0], avatar)

    def get_comment_tree(self, post_id: str) -> List[Dict[str, Any]]:
        rows, _ = self._request("GET", "comments", params={"post_id": f"eq.{post_id}", "order": "created_at.asc", "select": "*"})
        avatars = self._avatar_map([r.get("author_id") for r in rows or []])
        by_id: Dict[str, Dict[str, Any]] = {}
        roots: List[Dict[str, Any]] = []
        for row in rows or []:
            item = self._comment_to_dict(row, avatars.get(row.get("author_id")))
            if item["isDeleted"]:
                item["body"] = ""
                item["authorName"] = "[deleted]"
                item["authorAvatar"] = None
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
        self._apply_vote("comment_votes", "comment_id", comment_id, "comments", voter_key, value)
        return self.get_comment(comment_id)

    def delete_comment(self, comment_id: str, requester: Optional[Dict[str, Any]]) -> bool:
        rows, _ = self._request("GET", "comments", params={"id": f"eq.{comment_id}", "select": "author_id"})
        if not rows:
            return False
        is_owner = requester and requester["id"] == rows[0]["author_id"]
        is_admin = requester and requester["role"] == "admin"
        if not (is_owner or is_admin):
            raise PermissionError("Not authorized to delete this comment.")
        self._request("PATCH", "comments", params={"id": f"eq.{comment_id}"}, json_body={"is_deleted": True},
                      extra_headers={"Prefer": "return=minimal"})
        return True

    # ---- Admin --------------------------------------------------------------

    def list_users(self) -> List[Dict[str, Any]]:
        rows, _ = self._request("GET", "users", params={
            "select": "id,username,role,avatar_data_url,created_at", "order": "created_at.asc",
        })
        return [{**r, "avatar": r.get("avatar_data_url")} for r in rows or []]

    def set_user_role(self, user_id: str, role: str) -> None:
        if role not in ("user", "admin"):
            raise ValueError("Invalid role.")
        self._request("PATCH", "users", params={"id": f"eq.{user_id}"}, json_body={"role": role},
                      extra_headers={"Prefer": "return=minimal"})

    def admin_stats(self) -> Dict[str, Any]:
        return {
            "users": self._count("users", {}),
            "posts": self._count("posts", {"is_deleted": "eq.false"}),
            "deletedPosts": self._count("posts", {"is_deleted": "eq.true"}),
            "comments": self._count("comments", {"is_deleted": "eq.false"}),
            "anonymousPosts": self._count("posts", {"is_deleted": "eq.false", "author_id": "is.null"}),
        }

    def admin_list_posts(self, limit: int = 200) -> List[Dict[str, Any]]:
        rows, _ = self._request("GET", "posts", params={"order": "created_at.desc", "limit": limit, "select": "*"})
        comments, _ = self._request("GET", "comments", params={"select": "post_id"})
        counts: Dict[str, int] = {}
        for c in comments or []:
            counts[c["post_id"]] = counts.get(c["post_id"], 0) + 1
        return [self._post_to_dict(r, counts.get(r["id"], 0)) for r in rows or []]
