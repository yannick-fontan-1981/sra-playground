"""Persistent, inspectable symbolic memory. No game oracle or hidden policy."""
from __future__ import annotations
import hashlib
import json
import re
import sqlite3
import time
from pathlib import Path
from catalog import OPERATIONS, TREE, RECONCILIATION, parse_tree, sha


def pack(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


class Memory:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.path)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.executescript("""
          CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS nodes(k TEXT PRIMARY KEY,address TEXT,line INTEGER,body TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS edges(src TEXT,relation TEXT,dst TEXT,PRIMARY KEY(src,relation,dst));
          CREATE TABLE IF NOT EXISTS operations(k TEXT PRIMARY KEY,body TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS facts(episode TEXT,k TEXT,v TEXT NOT NULL,evidence TEXT,revision INTEGER,
            PRIMARY KEY(episode,k));
          CREATE TABLE IF NOT EXISTS traces(id INTEGER PRIMARY KEY,episode TEXT,kind TEXT,body TEXT,created REAL);
          CREATE TABLE IF NOT EXISTS archive(k TEXT PRIMARY KEY,body TEXT NOT NULL,tokens INTEGER);
        """)

    def close(self):
        self.db.close()

    def import_catalog(self):
        nodes = parse_tree()
        with self.db:
            for n in nodes:
                self.db.execute("INSERT OR REPLACE INTO nodes VALUES(?,?,?,?)",
                                (n["key"], n["address"], n["line"], n["text"]))
            for index, n in enumerate(nodes):
                for rel, j in [("previous_text", index - 1), ("next_text", index + 1)]:
                    if 0 <= j < len(nodes):
                        self.db.execute("INSERT OR IGNORE INTO edges VALUES(?,?,?)", (n["key"], rel, nodes[j]["key"]))
                for key in re.findall(r">>\s*\S+\s+\[([^\]]+)\]", n["text"]):
                    if any(key == other["key"] for other in nodes):
                        self.db.execute("INSERT OR IGNORE INTO edges VALUES(?,?,?)", (n["key"], "explicit_reference", key))
            for op in OPERATIONS.values():
                self.db.execute("INSERT OR REPLACE INTO operations VALUES(?,?)", (op["key"], pack(op)))
            self.db.execute("INSERT OR REPLACE INTO meta VALUES('tree_sha',?)", (sha(TREE),))
            self.db.execute("INSERT OR REPLACE INTO meta VALUES('reconciliation_sha',?)", (sha(RECONCILIATION),))
        return {"nodes": len(nodes), "operations": len(OPERATIONS), "tree_sha256": sha(TREE)}

    def window(self, key):
        row = self.db.execute("SELECT k,address,line,body FROM nodes WHERE k=?", (key,)).fetchone()
        if row is None:
            raise KeyError(key)
        def view(record):
            return {"key": record[0], "address": record[1], "line": record[2],
                    "navigation_excerpt": record[3][:180], "excerpt_only": len(record[3]) > 180}
        edges = self.db.execute("SELECT relation,dst FROM edges WHERE src=? ORDER BY relation,dst", (key,)).fetchall()
        # Documentary adjacency is visible context, never an execution permission.
        return {"current": view(row), "neighbors": [
            {"relation": rel, **view(self.db.execute("SELECT k,address,line,body FROM nodes WHERE k=?", (dst,)).fetchone())}
            for rel, dst in edges[:6]], "remaining_neighbors": max(0, len(edges) - 6),
            "adjacency_is_not_permission": True}

    def jump(self, episode, source_key, target_key, observation_revision):
        # A cognitive jump does not roll back a game state or erase memory.
        target = self.window(target_key)
        self.trace(episode, "cognitive_jump", {"from": source_key, "to": target_key,
                   "observation_revision": observation_revision, "game_undo": False})
        return target

    def put(self, episode, key, value, evidence="fixture", revision=1):
        with self.db:
            self.db.execute("INSERT OR REPLACE INTO facts VALUES(?,?,?,?,?)",
                            (episode, key, pack(value), evidence, revision))

    def get(self, episode, key):
        row = self.db.execute("SELECT v,evidence,revision FROM facts WHERE episode=? AND k=?", (episode, key)).fetchone()
        if row is None:
            raise KeyError((episode, key))
        return {"value": json.loads(row[0]), "evidence": row[1], "revision": row[2]}

    def trace(self, episode, kind, value):
        with self.db:
            self.db.execute("INSERT INTO traces(episode,kind,body,created) VALUES(?,?,?,?)",
                            (episode, kind, pack(value), time.time()))

    def seed_archive(self, tokenizer, minimum_tokens=100_000):
        count = 0
        with self.db:
            for i in range(10_000):
                text = (f"Archive synthétique {i}: observation conservée, mécanisme supposé, contrainte à vérifier. "
                        "Les faits confirmés, les exceptions et les dépendances ont une provenance explicite. "
                        "Ce document ne constitue pas une preuve de résolution d'un jeu.")
                tokens = len(tokenizer.encode(text, add_special_tokens=False))
                self.db.execute("INSERT OR REPLACE INTO archive VALUES(?,?,?)", (f"record-{i:05}", text, tokens))
                count += tokens
                if count >= minimum_tokens:
                    return {"records": i + 1, "tokens": count, "synthetic": True}
        raise RuntimeError("Archive construction bound exhausted")

    def stats(self):
        return {name: self.db.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
                for name in ["nodes", "edges", "operations", "facts", "traces", "archive"]}
