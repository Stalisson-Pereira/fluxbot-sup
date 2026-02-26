import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import { pool } from './db.js';
import { startDevice, stopDevice } from './botService.js';

dotenv.config();

const app = express();

app.use(cors({
    origin: 'https://fluxbotv1.netlify.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

function generateToken(userId) {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) {
        return res.status(401).json({ error: 'Token ausente.' });
    }

    const [, token] = header.split(' ');
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = payload.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
}

app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as now');
        res.json({ status: 'ok', dbTime: result.rows[0].now });
    } catch (err) {
        console.error('Erro no /health:', err.message);
        res.status(500).json({ status: 'error', error: 'Falha na conexão com banco.' });
    }
});

app.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            error: 'Nome, e-mail e senha são obrigatórios.'
        });
    }

    try {
        const hash = await bcrypt.hash(password, 10);

        const { rows } = await pool.query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, name, email`,
            [name, email, hash]
        );

        const user = rows[0];
        const token = generateToken(user.id);

        await pool.query(
          `INSERT INTO subscriptions (user_id, plan_id, status, trial_end_at, current_period_start)
         VALUES ($1, 1, 'trial', NOW() + INTERVAL '7 days', NOW())`,
        [user.id]
    );

        res.status(201).json({ token, user });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
        }
        console.error('Erro no /auth/register:', err.message);
        res.status(500).json({ error: 'Erro ao criar conta.' });
    }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: 'E-mail e senha são obrigatórios.'
        });
    }

    try {
        const { rows } = await pool.query(
            `SELECT id, name, email, password_hash
             FROM users
             WHERE email = $1`,
            [email]
        );

        const user = rows[0];
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const token = generateToken(user.id);
        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email },
        });
    } catch (err) {
        console.error('Erro no /auth/login:', err.message);
        res.status(500).json({ error: 'Erro ao autenticar.' });
    }
});

app.get('/dashboard/overview', auth, async (req, res) => {
    const userId = req.userId;

    try {
        const messagesTodayResult = await pool.query(
            `SELECT COUNT(*) FROM messages
             WHERE user_id = $1
               AND created_at::date = CURRENT_DATE`,
            [userId]
        );
        const messagesToday = messagesTodayResult.rows[0].count;

        const totalContactsResult = await pool.query(
            `SELECT COUNT(*) FROM contacts
             WHERE user_id = $1`,
            [userId]
        );
        const totalContacts = totalContactsResult.rows[0].count;

        const devicesConnectedResult = await pool.query(
            `SELECT COUNT(*) FROM devices
             WHERE user_id = $1
               AND status = 'connected'`,
            [userId]
        );
        const devicesConnected = devicesConnectedResult.rows[0].count;

        res.json({
            messagesToday: parseInt(messagesToday),
            totalContacts: parseInt(totalContacts),
            devicesConnected: parseInt(devicesConnected),
        });
    } catch (err) {
        console.error('Erro no /dashboard/overview:', err.message);
        res.status(500).json({ error: 'Erro ao carregar dados do dashboard.' });
    }
});

app.get('/devices', auth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, name, platform, status, last_error, last_connected_at, created_at
             FROM devices
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.userId]
        );
        res.json({ devices: rows });
    } catch (err) {
        console.error('Erro ao listar devices:', err.message);
        res.status(500).json({ error: 'Erro ao listar aparelhos.' });
    }
});

app.post('/devices', auth, async (req, res) => {
    try {
        const { name, platform, config } = req.body;

        if (!name || !platform) {
            return res.status(400).json({ error: 'Informe nome e plataforma.' });
        }

        const allowedPlatforms = ['whatsapp', 'telegram', 'whatsapp_cloud'];
        if (!allowedPlatforms.includes(platform)) {
            return res.status(400).json({ error: 'Plataforma inválida.' });
        }

        const configJson = config && typeof config === 'object' ? config : {};
        const initialStatus = 'disconnected';

        const { rows } = await pool.query(
            `INSERT INTO devices (user_id, name, platform, config, status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, platform, status, created_at`,
            [req.userId, name, platform, configJson, initialStatus]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Erro ao criar device:', err.message);
        let userMessage = 'Erro ao criar aparelho.';
        if (err.code === '23502') {
            userMessage = `Erro: Campo '${err.column}' é obrigatório.`;
        } else if (err.code === '42P01') {
            userMessage = 'Erro interno: Tabela de aparelhos não encontrada.';
        }
        res.status(500).json({ error: userMessage });
    }
});

app.put('/devices/:id', auth, async (req, res) => {
    try {
        const deviceId = Number(req.params.id);
        if (!deviceId || Number.isNaN(deviceId)) {
            return res.status(400).json({ error: 'ID inválido.' });
        }

        const { name, config } = req.body;

        const fields = [];
        const values = [];
        let idx = 1;

        if (name) {
            fields.push(`name = $${idx++}`);
            values.push(name);
        }

        if (config && typeof config === 'object') {
            fields.push(`config = $${idx++}`);
            values.push(config);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'Nada para atualizar.' });
        }

        values.push(req.userId);
        values.push(deviceId);

        const { rows } = await pool.query(
            `
            UPDATE devices
               SET ${fields.join(', ')},
                   updated_at = NOW()
             WHERE user_id = $${idx++}
               AND id = $${idx}
             RETURNING
               id,
               name,
               platform,
               status,
               last_error,
               last_connected_at,
               created_at
            `,
            values
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Aparelho não encontrado.' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Erro ao atualizar device:', err.message);
        res.status(500).json({ error: 'Erro ao atualizar aparelho.' });
    }
});

app.get('/devices/:id', auth, async (req, res) => {
    const userId = req.userId;
    const deviceId = req.params.id;

    try {
        const { rows } = await pool.query(
            `SELECT id, user_id, name, platform, status, created_at, last_connected_at, last_error
       FROM devices
       WHERE id = $1 AND user_id = $2`,
            [deviceId, userId]
        );

        const device = rows[0];
        if (!device) {
            return res.status(404).json({ error: 'Aparelho não encontrado.' });
        }

        res.json({ device });
    } catch (err) {
        console.error('Erro no GET /devices/:id:', err.message);
        res.status(500).json({ error: 'Erro ao buscar aparelho.' });
    }
});

app.delete('/devices/:id', auth, async (req, res) => {
    try {
        const deviceId = Number(req.params.id);

        if (!deviceId || Number.isNaN(deviceId)) {
            return res.status(400).json({ error: 'ID inválido.' });
        }

        await stopDevice(deviceId);

        const { rowCount } = await pool.query(
            `DELETE FROM devices
              WHERE user_id = $1
                AND id = $2`,
            [req.userId, deviceId]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Aparelho não encontrado.' });
        }

        res.status(204).send();

    } catch (err) {
        console.error('Erro ao remover device:', err.message);
        res.status(500).json({ error: 'Erro ao remover aparelho.' });
    }
});

app.post('/devices/:id/connect', auth, async (req, res) => {
    try {
        const deviceId = Number(req.params.id);

        if (!deviceId || Number.isNaN(deviceId)) {
            return res.status(400).json({ error: 'ID inválido.' });
        }

        const { rows } = await pool.query(
            `SELECT id, user_id, name, platform, status, config
             FROM devices
             WHERE id = $1 AND user_id = $2`,
            [deviceId, req.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Aparelho não encontrado.' });
        }

        const device = rows[0];

        if (device.platform === 'whatsapp_cloud') {
            await pool.query(
                `UPDATE devices SET status = 'connected', last_connected_at = NOW() WHERE id = $1`,
                [deviceId]
            );
        } else {
            await startDevice(device);
        }

        const { rows: updatedDeviceRows } = await pool.query(
            `SELECT id, name, platform, status, last_error, last_connected_at, created_at
             FROM devices
             WHERE id = $1`,
            [deviceId]
        );

        res.json(updatedDeviceRows[0]);

    } catch (err) {
        console.error('Erro ao conectar device na API:', err.message);
        res.status(500).json({ error: 'Erro ao conectar aparelho.' });
    }
});

app.post('/devices/:id/disconnect', auth, async (req, res) => {
    try {
        const deviceId = Number(req.params.id);

        if (!deviceId || Number.isNaN(deviceId)) {
            return res.status(400).json({ error: 'ID inválido.' });
        }

        const { rowCount, rows: deviceRows } = await pool.query(
            `SELECT id, platform FROM devices WHERE id = $1 AND user_id = $2`,
            [deviceId, req.userId]
        );
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Aparelho não encontrado.' });
        }

        const device = deviceRows[0];

        if (device.platform === 'whatsapp_cloud') {
            await pool.query(
                `UPDATE devices SET status = 'disconnected', last_error = NULL WHERE id = $1`,
                [deviceId]
            );
        } else {
            await stopDevice(deviceId);
        }

        const { rows: updatedDeviceRows } = await pool.query(
            `SELECT id, name, platform, status, last_error, last_connected_at, created_at
             FROM devices
             WHERE id = $1`,
            [deviceId]
        );

        res.json(updatedDeviceRows[0]);

    } catch (err) {
        console.error('Erro ao desconectar device na API:', err.message);
        res.status(500).json({ error: 'Erro ao desconectar aparelho.' });
    }
});

app.get('/subscription/me', auth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT 
                s.id,
                s.status,
                s.trial_end_at,
                s.current_period_start,
                p.name as plan_name
             FROM subscriptions s
             LEFT JOIN plans p ON p.id = s.plan_id
             WHERE s.user_id = $1
             ORDER BY s.created_at DESC
             LIMIT 1`,
            [req.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Assinatura não encontrada.' });
        }

        const sub = rows[0];

        // 🔥 lógica automática trial expirado
        if (sub.status === 'trial' && new Date(sub.trial_end_at) < new Date()) {
            await pool.query(
                `UPDATE subscriptions SET status = 'expired' WHERE id = $1`,
                [sub.id]
            );
            sub.status = 'expired';
        }

        res.json({ subscription: sub });

    } catch (err) {
        console.error('Erro no /subscription/me:', err.message);
        res.status(500).json({ error: 'Erro ao buscar assinatura.' });
    }
});

// Rota para enviar mensagem via WhatsApp Cloud API
app.post('/whatsapp-cloud/send', auth, async (req, res) => {
    const { deviceId, to, text } = req.body;

    if (!deviceId || !to || !text) {
        return res.status(400).json({ error: 'deviceId, to e text são obrigatórios.' });
    }

    try {
        const { rows } = await pool.query(
            `SELECT id, user_id, platform, config
             FROM devices
             WHERE id = $1 AND user_id = $2 AND platform = 'whatsapp_cloud'`,
            [deviceId, req.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Aparelho WhatsApp Cloud não encontrado ou não pertence ao usuário.' });
        }

        const device = rows[0];
        const phoneNumberId = device.config.phoneNumberId || process.env.META_WA_PHONE_NUMBER_ID;
        const accessToken = device.config.accessToken || process.env.META_WA_TOKEN;

        if (!phoneNumberId || !accessToken) {
            return res.status(400).json({ error: 'Configurações da WhatsApp Cloud API (phoneNumberId ou accessToken) ausentes no aparelho ou variáveis de ambiente.' });
        }

        const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };
        const body = JSON.stringify({
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
                body: text,
            },
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body,
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Erro ao enviar mensagem via WhatsApp Cloud API:', data);
            return res.status(response.status).json({ error: data.error?.message || 'Erro ao enviar mensagem via WhatsApp Cloud API.' });
        }

        await pool.query(
            `INSERT INTO messages (device_id, user_id, direction, from_number, to_number, body, status, external_id)
             VALUES ($1, $2, 'outbound', $3, $4, $5, 'sent', $6)`,
            [deviceId, req.userId, phoneNumberId, to, text, data.messages[0].id]
        );

        res.json({ success: true, messageId: data.messages[0].id });

    } catch (err) {
        console.error('Erro no /whatsapp-cloud/send:', err.message);
        res.status(500).json({ error: 'Erro interno ao enviar mensagem.' });
    }
});

// Rota de Webhook para verificação da Meta
app.get('/whatsapp-cloud/webhook', (req, res) => {
    const verifyToken = process.env.META_WA_WEBHOOK_VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('Webhook WhatsApp Cloud verificado com sucesso!');
        return res.status(200).send(challenge);
    }

    res.sendStatus(403);
});

// Rota de Webhook para recebimento de mensagens da Meta
app.post('/whatsapp-cloud/webhook', async (req, res) => {
    try {
        const body = req.body;
        console.log('Webhook WhatsApp Cloud recebido:', JSON.stringify(body, null, 2));

        if (body.object === 'whatsapp_business_account' && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from;
            const text = message.text?.body;
            const whatsappBusinessAccountId = body.entry[0].changes[0].value.metadata.phone_number_id;

            console.log(`Mensagem recebida de ${from} no aparelho ${whatsappBusinessAccountId}: ${text}`);

            const { rows: deviceRows } = await pool.query(
                `SELECT id, user_id FROM devices WHERE platform = 'whatsapp_cloud' AND config->>'phoneNumberId' = $1`,
                [whatsappBusinessAccountId]
            );

            if (deviceRows.length > 0) {
                const device = deviceRows[0];
                const deviceId = device.id;
                const userId = device.user_id;

                await pool.query(
                    `INSERT INTO messages (device_id, user_id, direction, from_number, to_number, body, status, external_id)
                     VALUES ($1, $2, 'inbound', $3, $4, $5, 'received', $6)`,
                    [deviceId, userId, from, whatsappBusinessAccountId, text, message.id]
                );
            } else {
                console.warn(`Webhook: Device WhatsApp Cloud com phoneNumberId ${whatsappBusinessAccountId} não encontrado no DB.`);
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Erro no webhook WhatsApp Cloud:', err.message);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ 🚀 FluxBot API rodando em http://localhost:${PORT}`);
});
