const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    await client.connect();
    const res = await client.query("SELECT id FROM \"User\" WHERE username = 'tester'");
    if (res.rows.length > 0) {
        const userId = res.rows[0].id;
        console.log("Detaching villages for user", userId);
        await client.query("UPDATE \"Village\" SET \"userId\" = NULL WHERE \"userId\" = $1", [userId]);
    }
    await client.end();
    console.log("Done");
}
run();
