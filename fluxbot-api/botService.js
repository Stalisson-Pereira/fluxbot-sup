// botService.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { pool } from './db.js';
import { registerBot, getBot, unregisterBot } from './botRegistry.js';

const SESSION_DIR = './.wwebjs_auth';

async function updateDeviceStatus(deviceId, status, lastError = null) {
    try {
        await pool.query(
            `UPDATE devices
             SET status = $1::device_status, -- <--- AQUI ESTÁ A CORREÇÃO: Cast explícito para o ENUM
                 last_error = $2,
                 updated_at = NOW(),
                 last_connected_at = CASE WHEN $1::device_status = 'connected' THEN NOW() ELSE last_connected_at END -- E AQUI TAMBÉM
             WHERE id = $3`,
            [status, lastError, deviceId]
        );
    } catch (err) {
        console.error(`Erro ao atualizar status do device ${deviceId}:`, err.message);
    }
}

// ... (o restante do seu botService.js permanece o mesmo) ...

// Função para salvar mensagens recebidas no banco de dados (se você não tiver ela, adicione)
async function saveIncomingMessage(deviceId, userId, msg) {
    try {
        const fromNumber = msg.from;
        const toNumber = msg.to;
        const body = msg.body;
        const externalId = msg.id.id;

        await pool.query(
            `INSERT INTO messages (device_id, user_id, direction, from_number, to_number, body, status, external_id)
             VALUES ($1, $2, 'inbound', $3, $4, $5, 'received', $6)`,
            [deviceId, userId, fromNumber, toNumber, body, 'received', externalId]
        );
        console.log(`Mensagem inbound de ${fromNumber} salva para device ${deviceId} e user ${userId}.`);
    } catch (err) {
        console.error(`Erro ao salvar mensagem inbound para device ${deviceId}:`, err.message);
    }
}

export async function startDevice(device) {
    const { id, platform, user_id: userId } = device; // Adicionado user_id

    if (getBot(id)) {
        console.log(`Device ${id} (${platform}) já registrado.`);
        return;
    }

    if (platform === 'whatsapp') {
        await startWhatsappDevice(device, userId); // Passa userId
    } else if (platform === 'whatsapp_cloud') {
        if (device.status !== 'connected') {
            await updateDeviceStatus(id, 'connected', null);
        }
        console.log(`Device ${id} (WhatsApp Cloud) não requer inicialização de cliente persistente.`);
    }
    else {
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
        } else if (bot.platform === 'whatsapp_cloud') {
            await updateDeviceStatus(deviceId, 'disconnected', null);
            unregisterBot(deviceId);
            console.log(`Device ${deviceId} (WhatsApp Cloud) marcado como desconectado.`);
        }
    } else {
        await updateDeviceStatus(deviceId, 'disconnected', null);
    }
}

async function startWhatsappDevice(device, userId) { // Recebe userId
    const { id } = device;
    console.log(`Iniciando WhatsApp device ${id}...`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: `device_${id}`,
            dataPath: SESSION_DIR,
        }),
        puppeteer: {
            headless: false, // Abrir aba do navegador
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

    client.on('change_state', (state) => {
        console.log(`Device ${id} - Estado: ${state}`);
    });

    client.on('qr', async (qr) => {
        console.log(`QR ignorado. Abrir aba do WhatsApp Web para device ${id}`);
        await updateDeviceStatus(id, 'pending_qr', 'QR ignorado - abrir WhatsApp Web');
    });

    client.on('ready', async () => {
        console.log(`WhatsApp device ${id} conectado!`);
        await updateDeviceStatus(id, 'connected', null);
    });

    client.on('disconnected', async (reason) => {
        console.log(`Device ${id} desconectado:`, reason);
        unregisterBot(id);
        await updateDeviceStatus(id, 'disconnected', reason || null);
    });

    client.on('error', async (err) => {
        console.error(`Erro no WhatsApp client ${id}:`, err.message);
        await updateDeviceStatus(id, 'error', err.message);
    });

    client.on('message', async (msg) => {
        console.log(`Mensagem recebida device ${id}:`, msg.from, msg.body);
        await saveIncomingMessage(id, userId, msg); // Salva a mensagem no DB
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
