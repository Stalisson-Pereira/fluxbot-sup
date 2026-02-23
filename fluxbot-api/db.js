import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: Number(process.env.PGPORT) || 5432,
});

// Opcional: Testar conexão ao iniciar
pool.connect()
    .then(client => {
        console.log('✅ Conectado ao PostgreSQL!');
        client.release();
    })
    .catch(err => {
        console.error('❌ Erro ao conectar ao PostgreSQL:', err.message);
        process.exit(-1);
    });