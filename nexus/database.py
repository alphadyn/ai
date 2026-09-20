#!/usr/bin/env python3
"""
SQLite Database Layer for Nexus Content Management System (CMS).
Provides schema initialization, seed data management, and CRUD operations.
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_FILE = Path(__file__).resolve().parent / "cms_database.db"


def get_db_connection(db_path: Optional[str | Path] = None) -> sqlite3.Connection:
    """Create and configure a SQLite connection."""
    target_path = str(db_path or DB_FILE)
    conn = sqlite3.connect(target_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: Optional[str | Path] = None) -> None:
    """Initialize database schema and tables."""
    conn = get_db_connection(db_path)
    with conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS media_items (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                filename TEXT NOT NULL,
                type TEXT NOT NULL,
                mime_type TEXT,
                size INTEGER DEFAULT 0,
                date TEXT,
                category TEXT DEFAULT 'General',
                author TEXT DEFAULT 'Anonymous',
                status TEXT DEFAULT 'published',
                rating INTEGER DEFAULT 0,
                starred INTEGER DEFAULT 0,
                tags TEXT DEFAULT '[]',
                description TEXT DEFAULT '',
                custom_props TEXT DEFAULT '[]',
                data_url TEXT,
                text_content TEXT,
                created_at TEXT,
                updated_at TEXT
            );
            """
        )
        # Create indexes for fast filtering and search
        conn.execute("CREATE INDEX IF NOT EXISTS idx_type ON media_items(type);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_category ON media_items(category);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_status ON media_items(status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_date ON media_items(date);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_starred ON media_items(starred);")
    conn.close()


def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Convert a database row into a frontend JSON-compatible dictionary."""
    data = dict(row)
    # Parse JSON columns
    try:
        data["tags"] = json.loads(data.get("tags") or "[]")
    except Exception:
        data["tags"] = []

    try:
        data["customProps"] = json.loads(data.get("custom_props") or "[]")
    except Exception:
        data["customProps"] = []

    data.pop("custom_props", None)
    data["mimeType"] = data.pop("mime_type", "application/octet-stream")
    data["starred"] = bool(data.get("starred", 0))
    data["createdAt"] = data.pop("created_at", None)
    data["updatedAt"] = data.pop("updated_at", None)
    data["textContent"] = data.pop("text_content", None)
    data["dataUrl"] = data.pop("data_url", None)
    return data


def dict_to_row_tuple(item: Dict[str, Any]) -> tuple:
    """Convert an incoming item dictionary into a database tuple."""
    now_iso = datetime.now(timezone.utc).isoformat()
    tags_json = json.dumps(item.get("tags", []))
    custom_props_json = json.dumps(item.get("customProps") or item.get("custom_props") or [])
    starred_int = 1 if item.get("starred") else 0

    return (
        item.get("id"),
        item.get("title", "Untitled"),
        item.get("filename", "file.bin"),
        item.get("type", "other"),
        item.get("mimeType") or item.get("mime_type") or "application/octet-stream",
        int(item.get("size", 0)),
        item.get("date") or now_iso,
        item.get("category", "General"),
        item.get("author", "Anonymous"),
        item.get("status", "published"),
        int(item.get("rating", 0)),
        starred_int,
        tags_json,
        item.get("description", ""),
        custom_props_json,
        item.get("dataUrl") or item.get("data_url"),
        item.get("textContent") or item.get("text_content"),
        item.get("createdAt") or item.get("created_at") or now_iso,
        item.get("updatedAt") or item.get("updated_at") or now_iso,
    )


class DatabaseManager:
    """High-level database management interface."""

    def __init__(self, db_path: Optional[str | Path] = None):
        self.db_path = db_path or DB_FILE
        init_db(self.db_path)

    def get_all(self) -> List[Dict[str, Any]]:
        conn = get_db_connection(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM media_items ORDER BY datetime(date) DESC;")
        rows = cursor.fetchall()
        conn.close()
        return [row_to_dict(r) for r in rows]

    def get_by_id(self, item_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM media_items WHERE id = ?;", (item_id,))
        row = cursor.fetchone()
        conn.close()
        return row_to_dict(row) if row else None

    def upsert(self, item: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection(self.db_path)
        row_values = dict_to_row_tuple(item)
        with conn:
            conn.execute(
                """
                INSERT INTO media_items (
                    id, title, filename, type, mime_type, size, date, category,
                    author, status, rating, starred, tags, description,
                    custom_props, data_url, text_content, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    filename = excluded.filename,
                    type = excluded.type,
                    mime_type = excluded.mime_type,
                    size = excluded.size,
                    date = excluded.date,
                    category = excluded.category,
                    author = excluded.author,
                    status = excluded.status,
                    rating = excluded.rating,
                    starred = excluded.starred,
                    tags = excluded.tags,
                    description = excluded.description,
                    custom_props = excluded.custom_props,
                    data_url = excluded.data_url,
                    text_content = excluded.text_content,
                    updated_at = excluded.updated_at;
                """,
                row_values,
            )
        conn.close()
        return self.get_by_id(item["id"]) or item

    def upsert_many(self, items: List[Dict[str, Any]]) -> int:
        conn = get_db_connection(self.db_path)
        count = 0
        with conn:
            for item in items:
                row_values = dict_to_row_tuple(item)
                conn.execute(
                    """
                    INSERT INTO media_items (
                        id, title, filename, type, mime_type, size, date, category,
                        author, status, rating, starred, tags, description,
                        custom_props, data_url, text_content, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        title = excluded.title,
                        filename = excluded.filename,
                        type = excluded.type,
                        mime_type = excluded.mime_type,
                        size = excluded.size,
                        date = excluded.date,
                        category = excluded.category,
                        author = excluded.author,
                        status = excluded.status,
                        rating = excluded.rating,
                        starred = excluded.starred,
                        tags = excluded.tags,
                        description = excluded.description,
                        custom_props = excluded.custom_props,
                        data_url = excluded.data_url,
                        text_content = excluded.text_content,
                        updated_at = excluded.updated_at;
                    """,
                    row_values,
                )
                count += 1
        conn.close()
        return count

    def delete(self, item_id: str) -> bool:
        conn = get_db_connection(self.db_path)
        with conn:
            cursor = conn.execute("DELETE FROM media_items WHERE id = ?;", (item_id,))
            deleted = cursor.rowcount > 0
        conn.close()
        return deleted

    def delete_many(self, item_ids: List[str]) -> int:
        if not item_ids:
            return 0
        conn = get_db_connection(self.db_path)
        placeholders = ",".join("?" for _ in item_ids)
        with conn:
            cursor = conn.execute(
                f"DELETE FROM media_items WHERE id IN ({placeholders});",
                tuple(item_ids),
            )
            count = cursor.rowcount
        conn.close()
        return count

    def clear_all(self) -> int:
        conn = get_db_connection(self.db_path)
        with conn:
            cursor = conn.execute("DELETE FROM media_items;")
            count = cursor.rowcount
        conn.close()
        return count

    def count(self) -> int:
        conn = get_db_connection(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM media_items;")
        total = cursor.fetchone()[0]
        conn.close()
        return total
