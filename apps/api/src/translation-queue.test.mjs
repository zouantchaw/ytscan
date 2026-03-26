import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

function createDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE generation_jobs (
      id TEXT PRIMARY KEY
    );

    CREATE TABLE uploaded_media_translations (
      id TEXT PRIMARY KEY,
      latest_generation_job_id TEXT,
      FOREIGN KEY (latest_generation_job_id) REFERENCES generation_jobs(id) ON DELETE SET NULL
    );
  `);
  return db;
}

test("translation queue must create generation_jobs before referencing latest_generation_job_id", () => {
  const db = createDatabase();

  assert.throws(() => {
    db.prepare(
      `
        INSERT INTO uploaded_media_translations (id, latest_generation_job_id)
        VALUES (?, ?)
      `
    ).run("translation-old-order", "job-missing");
  }, /FOREIGN KEY constraint failed/u);

  db.prepare(`INSERT INTO generation_jobs (id) VALUES (?)`).run("job-correct-order");
  db.prepare(
    `
      INSERT INTO uploaded_media_translations (id, latest_generation_job_id)
      VALUES (?, ?)
    `
  ).run("translation-correct-order", "job-correct-order");

  const row = db
    .prepare(
      `
        SELECT latest_generation_job_id
        FROM uploaded_media_translations
        WHERE id = ?
      `
    )
    .get("translation-correct-order");

  assert.equal(row.latest_generation_job_id, "job-correct-order");
});
