
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'analytics.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error("Could not connect to database at " + dbPath);
        console.error(err.message);
        process.exit(1);
    }
});

console.log(`Reading database from: ${dbPath}`);

db.serialize(() => {
    db.all("SELECT * FROM sessions ORDER BY id DESC LIMIT 5", (err, rows) => {
        if (err) console.error(err);
        console.log("\n--- Latest 5 Sessions ---");
        console.table(rows);
    });

    db.all("SELECT * FROM events ORDER BY id DESC LIMIT 10", (err, rows) => {
        if (err) console.error(err);
        console.log("\n--- Latest 10 Events ---");
        console.table(rows);
    });
});
