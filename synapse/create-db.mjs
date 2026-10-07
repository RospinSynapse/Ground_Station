import 'dotenv/config';
import { createClient } from "@libsql/client";

const db = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN
});

await db.execute(`
    CREATE TABLE IF NOT EXISTS datapoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        Lat REAL NOT NULL,
        Long REAL NOT NULL,
        terrain INTEGER NOT NULL
    )
`);

await db.execute(`
    CREATE TABLE IF NOT EXISTS packets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        desc TEXT NOT NULL,
        time TEXT NOT NULL,
        details TEXT NOT NULL
    )
`);

console.log("Database created successfully");


await db.close();
