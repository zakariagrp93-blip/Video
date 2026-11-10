import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs, { type Database as SqlDatabase, type SqlValue } from 'sql.js';
import { writeFileAtomic } from '../util/fsx';
import { createLogger } from '../util/logger';

const log = createLogger('db');
const require_ = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url);

/**
 * Local SQLite database (sql.js / WebAssembly — no native module to rebuild
 * for Electron). Writes are persisted atomically to disk, debounced.
 */
const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS projects (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     topic TEXT NOT NULL,
     status TEXT NOT NULL,
     language TEXT NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     duration_sec REAL,
     file_size INTEGER,
     project_dir TEXT NOT NULL,
     failed_stage TEXT,
     error TEXT,
     cost_usd REAL NOT NULL DEFAULT 0,
     cost_known INTEGER NOT NULL DEFAULT 1
   );
   CREATE TABLE IF NOT EXISTS generation_events (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     project_id TEXT NOT NULL,
     kind TEXT NOT NULL,
     stage TEXT,
     message TEXT,
     at TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_events_project ON generation_events(project_id);
   CREATE TABLE IF NOT EXISTS api_requests (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     project_id TEXT,
     provider TEXT NOT NULL,
     kind TEXT NOT NULL,
     model TEXT,
     units REAL NOT NULL DEFAULT 0,
     unit_type TEXT NOT NULL,
     input_tokens INTEGER,
     output_tokens INTEGER,
     cost_usd REAL,
     cached INTEGER NOT NULL DEFAULT 0,
     ok INTEGER NOT NULL DEFAULT 1,
     at TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_requests_project ON api_requests(project_id);
   CREATE TABLE IF NOT EXISTS asset_cache (
     key TEXT PRIMARY KEY,
     kind TEXT NOT NULL,
     path TEXT NOT NULL,
     provider TEXT NOT NULL,
     bytes INTEGER NOT NULL,
     hits INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     last_used_at TEXT NOT NULL
   );`,
];

export class AppDatabase {
  private saveTimer: NodeJS.Timeout | undefined;
  private dirty = false;

  private constructor(
    private readonly db: SqlDatabase,
    private readonly file: string | null,
  ) {}

  static async open(file: string | null): Promise<AppDatabase> {
    const SQL = await initSqlJs({
      locateFile: (f: string) => path.join(path.dirname(require_.resolve('sql.js')), f),
    });
    let db: SqlDatabase;
    if (file && fs.existsSync(file)) {
      try {
        db = new SQL.Database(fs.readFileSync(file));
      } catch (err) {
        const backup = `${file}.corrupt-${Date.now()}`;
        log.error('Database unreadable, moving aside to', backup, err);
        fs.renameSync(file, backup);
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
    }
    const instance = new AppDatabase(db, file);
    instance.migrate();
    return instance;
  }

  private migrate(): void {
    this.db.run('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
    const row = this.get<{ version: number }>('SELECT version FROM schema_version LIMIT 1');
    let version = row?.version ?? 0;
    if (!row) this.db.run('INSERT INTO schema_version (version) VALUES (0)');
    while (version < MIGRATIONS.length) {
      this.db.exec(MIGRATIONS[version]!);
      version += 1;
      this.db.run('UPDATE schema_version SET version = ?', [version]);
    }
    this.markDirty();
  }

  run(sql: string, params: SqlValue[] = []): void {
    this.db.run(sql, params);
    this.markDirty();
  }

  all<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  get<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T | undefined {
    return this.all<T>(sql, params)[0];
  }

  private markDirty(): void {
    if (!this.file) return;
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      void this.flush();
    }, 250);
  }

  async flush(): Promise<void> {
    if (!this.file || !this.dirty) return;
    this.dirty = false;
    await writeFileAtomic(this.file, this.db.export());
  }

  async close(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    await this.flush();
    this.db.close();
  }
}
