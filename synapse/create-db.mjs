import { createClient } from "@libsql/client";

const db = createClient({
    url: "file:local.db"
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
