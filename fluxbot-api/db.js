import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necessário para alguns ambientes de desenvolvimento com Supabase
    }
});

pool.on('error', (err, client) => {
    console.error('Erro inesperado no pool do DB:', err.message, err.stack);
    process.exit(-1);
});
