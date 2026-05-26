import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import dns from 'node:dns'

dns.setDefaultResultOrder('ipv4first')
dotenv.config()

async function wipe() {
    const url = "postgresql://postgres:6kDilfNydUbFyOVd@db.xxtkfldycbdvvelqxggu.supabase.co:5432/postgres?pgbouncer=true"
    const pool = new Pool({ connectionString: url })
    
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema='public' AND table_type='BASE TABLE'
        `)
        for (let row of res.rows) {
            if (row.table_name !== '_prisma_migrations') {
                console.log('Truncating', row.table_name)
                await pool.query(`TRUNCATE TABLE "${row.table_name}" CASCADE`)
            }
        }
        console.log('Wipe remote success')
    } catch(e) {
        console.error('Wipe remote error:', e)
    } finally {
        await pool.end()
    }
}
wipe()
