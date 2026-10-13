const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'textile.db');

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Failed to connect to SQLite database:', err.message);
    } else {
        console.log(` Connected to SQLite database at: ${DB_PATH}`);
    }
});

// Configure WAL mode for high concurrency and enable foreign key enforcement
db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON;');
    db.run('PRAGMA journal_mode = WAL;');
    db.run('PRAGMA synchronous = NORMAL;');
});

// Promisified helper methods
const dbAsync = {
    /**
     * Run a query that returns multiple rows
     */
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    },

    /**
     * Run a query that returns a single row
     */
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    },

    /**
     * Run an INSERT / UPDATE / DELETE statement
     * Returns { lastID, changes }
     */
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    },

    /**
     * Execute raw multi-statement SQL script (DDL/DML)
     */
    exec: (sql) => {
        return new Promise((resolve, reject) => {
            db.exec(sql, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    },

    /**
     * Execute operations inside an atomic transaction (ACID compliant)
     */
    transaction: async (callback) => {
        await dbAsync.run('BEGIN TRANSACTION;');
        try {
            const result = await callback(dbAsync);
            await dbAsync.run('COMMIT;');
            return result;
        } catch (error) {
            await dbAsync.run('ROLLBACK;');
            throw error;
        }
    },

    raw: db
};

module.exports = dbAsync;
