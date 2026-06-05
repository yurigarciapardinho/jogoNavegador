const fs = require('fs');
const dbPath = './prisma/dev.db';
const buf = fs.readFileSync(dbPath);
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all("SELECT * FROM Movement WHERE type='RETURN'", (err, rows) => {
    console.log("RETURN Movements:");
    console.log(rows);
  });
  db.all("SELECT * FROM Movement WHERE type='ATTACK'", (err, rows) => {
    console.log("ATTACK Movements:");
    console.log(rows);
  });
});

db.close();
