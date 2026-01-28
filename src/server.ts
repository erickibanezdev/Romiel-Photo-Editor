
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database Setup
const dbPath = path.resolve(__dirname, '../analytics.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT,
        startTime INTEGER,
        endTime INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT,
        category TEXT,
        action TEXT,
        label TEXT,
        timestamp INTEGER
    )`);
}

// Routes

// Start Session
app.post('/api/analytics/session/start', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
    }
    
    const startTime = Date.now();
    const query = `INSERT INTO sessions (sessionId, startTime) VALUES (?, ?)`;
    
    db.run(query, [sessionId, startTime], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Session started', id: this.lastID });
    });
});

// End Session / Heartbeat
app.post('/api/analytics/session/end', (req, res) => {
    const { sessionId } = req.body;
    const endTime = Date.now();
    
    const query = `UPDATE sessions SET endTime = ? WHERE sessionId = ?`;
    
    db.run(query, [endTime, sessionId], function(err) {
         if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Session updated' });
    });
});

// Track Event
app.post('/api/analytics/event', (req, res) => {
    const { sessionId, category, action, label } = req.body;
    const timestamp = Date.now();
    
    const query = `INSERT INTO events (sessionId, category, action, label, timestamp) VALUES (?, ?, ?, ?, ?)`;
    
    db.run(query, [sessionId, category, action, label, timestamp], function(err) {
         if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Event logged', id: this.lastID });
    });
});

const rootDir = path.resolve(__dirname, '../');
console.log('Serving static files from:', rootDir);
app.use(express.static(rootDir));

app.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
