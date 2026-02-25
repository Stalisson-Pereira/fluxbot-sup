import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

try {
    const { rows } = await pool.query('SELECT NOW()');
    console.log('✅ Conexão OK:', rows[0]);
} catch (err) {
    console.error('❌ Falha:', err.message);
} finally {
    await pool.end();
}