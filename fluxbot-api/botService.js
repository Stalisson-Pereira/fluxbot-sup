import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { pool } from './db.js';
import { registerBot, getBot, unregisterBot } from './botRegistry.js';

const SESSION_DIR = './.wwebjs_auth';

async function updateDeviceStatus(deviceId, status, lastError = null) {
    try {
        await pool.query(
            `UPDATE devices
             SET status = $1,
                 last_error = $2,
                 updated_at = NOW(),
                 last_connected_at = CASE WHEN $1 = 'connected' THEN NOW() ELSE last_connected_at END
             WHERE id = $3`,
            [status, lastError, deviceId]
        );
    } catch (err) {
        console.error(`Erro ao atualizar status do device ${deviceId}:`, err.message);
    }
}

export async function startDevice(device) {
    const { id, platform } = device;

    if (getBot(id)) {
        console.log(`Device ${id} (${platform}) já registrado.`);
        return;
    }

    if (platform === 'whatsapp') {
        await startWhatsappDevice(device);
    } else {
        await updateDeviceStatus(id, 'error', `Plataforma '${platform}' não suportada.`);
        throw new Error(`Plataforma não suportada: ${platform}`);
    }
}

export async function stopDevice(deviceId) {
    const bot = getBot(deviceId);
    if (bot) {
        if (bot.platform === 'whatsapp') {
            try {
                await bot.client.destroy();
                unregisterBot(deviceId);
                await updateDeviceStatus(deviceId, 'disconnected', null);
            } catch (err) {
                console.error(`Erro ao parar WhatsApp client ${deviceId}:`, err.message);
                await updateDeviceStatus(deviceId, 'error', `Erro ao parar: ${err.message}`);
            }
        }
    } else {
        await updateDeviceStatus(deviceId, 'disconnected', null);
    }
}

async function startWhatsappDevice(device) {
    const { id } = device;
    console.log(`Iniciando WhatsApp device ${id}...`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: `device_${id}`,
            dataPath: SESSION_DIR,
        }),
        puppeteer: {
            headless: false, // <<< Abrir aba do navegador
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--window-size=1280,720',
            ],
        },
    });

    // Estado do client
    client.on('change_state', (state) => {
        console.log(`Device ${id} - Estado: ${state}`);
    });

    // QR Code não usado mais
    client.on('qr', async (qr) => {
        console.log(`QR ignorado. Abrir aba do WhatsApp Web para device ${id}`);
        await updateDeviceStatus(id, 'pending_qr', 'QR ignorado - abrir WhatsApp Web');
    });

    // Client pronto → status conectado
    client.on('ready', async () => {
        console.log(`WhatsApp device ${id} conectado!`);
        await updateDeviceStatus(id, 'connected', null);
    });

    // Desconectado
    client.on('disconnected', async (reason) => {
        console.log(`Device ${id} desconectado:`, reason);
        unregisterBot(id);
        await updateDeviceStatus(id, 'disconnected', reason || null);
    });

    // Erro genérico
    client.on('error', async (err) => {
        console.error(`Erro no WhatsApp client ${id}:`, err.message);
        await updateDeviceStatus(id, 'error', err.message);
    });

    // Mensagens recebidas
    client.on('message', async (msg) => {
        console.log(`Mensagem recebida device ${id}:`, msg.from, msg.body);
    });

    registerBot(id, { platform: 'whatsapp', client });

    try {
        await client.initialize();
    } catch (err) {
        console.error(`Erro ao inicializar client ${id}:`, err.message);
        unregisterBot(id);
        await updateDeviceStatus(id, 'error', `Erro inicializando: ${err.message}`);
        throw err;
    }
}