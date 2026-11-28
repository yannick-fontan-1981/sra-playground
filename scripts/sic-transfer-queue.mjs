import { DatabaseSync } from 'node:sqlite';

export function openQueue(path, configuration) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS metadata (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS comparisons (
      id INTEGER PRIMARY KEY, stage TEXT NOT NULL, signature TEXT NOT NULL UNIQUE, spec TEXT NOT NULL,
      owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, decision TEXT
    );
    CREATE INDEX IF NOT EXISTS available ON comparisons (stage, decision IS NULL, lease_until, id);
  `);
  const get = db.prepare('SELECT value FROM metadata WHERE name = ?');
  const insert = db.prepare('INSERT OR IGNORE INTO metadata (name, value) VALUES (?, ?)');
  const put = (key, value) => insert.run(key, JSON.stringify(value));
  const read = key => JSON.parse(get.get(key)?.value ?? 'null');
  put('configuration', configuration);
  if (JSON.stringify(read('configuration')) !== JSON.stringify(configuration)) {
    db.close();
    throw new Error('This queue belongs to a different campaign. Use its original count, seed and source or select a new state directory.');
  }

  function transaction(run) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = run();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return {
    read,
    close: () => db.close(),
    seed(stage, generate, plan) {
      return transaction(() => {
        if (read(stage)) return read(stage);
        const used = new Set(db.prepare('SELECT signature FROM comparisons').all().map(row => row.signature));
        const add = db.prepare('INSERT INTO comparisons (stage, signature, spec) VALUES (?, ?, ?)');
        for (const { key, spec } of generate(used)) add.run(stage, key, JSON.stringify(spec));
        put(stage, plan);
        return plan;
      });
    },
    claim(stage, owner, amount, leaseMs) {
      const now = Date.now();
      return db.prepare(`
        UPDATE comparisons SET owner = ?, lease_until = ?, attempts = attempts + 1
        WHERE id IN (SELECT id FROM comparisons
          WHERE stage = ? AND decision IS NULL AND lease_until <= ? ORDER BY id LIMIT ?)
        RETURNING id, spec
      `).all(owner, now + leaseMs, stage, now, amount).map(({ id, spec }) => ({ id, spec: JSON.parse(spec) }));
    },
    checkpoint(owner, decisions) {
      return transaction(() => {
        const update = db.prepare(`
          UPDATE comparisons SET decision = ?, owner = NULL, lease_until = 0
          WHERE id = ? AND owner = ? AND decision IS NULL
        `);
        for (const { id, ...decision } of decisions) {
          if (update.run(JSON.stringify(decision), id, owner).changes !== 1) throw new Error('Lost lease for comparison ' + id);
        }
      });
    },
    release(owner) {
      db.prepare('UPDATE comparisons SET owner = NULL, lease_until = 0 WHERE owner = ? AND decision IS NULL').run(owner);
    },
    pending(stage) {
      return db.prepare('SELECT count(*) AS n FROM comparisons WHERE stage = ? AND decision IS NULL').get(stage).n;
    },
    results(stage) {
      return db.prepare('SELECT id, spec, decision FROM comparisons WHERE stage = ? AND decision IS NOT NULL ORDER BY id').all(stage)
        .map(({ id, spec, decision }) => ({ id, spec: JSON.parse(spec), ...JSON.parse(decision) }));
    },
  };
}
