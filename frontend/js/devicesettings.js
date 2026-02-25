const API_BASE_URL = 'https://fluxbot-sup.onrender.com';

function getToken() {
    const token = localStorage.getItem('fluxbot_token');
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }
    return token;
}

function showMessage(elementId, text, type = 'info') {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = `message-area message-${type}`;
    el.style.display = 'block';
    // Faz a mensagem desaparecer após 5 segundos
    setTimeout(() => {
        el.style.display = 'none';
    }, 5000);
}

async function loadDevice() {
    const token = getToken();
    if (!token) return;

    const params = new URLSearchParams(window.location.search);
    const deviceId = params.get('id');
    if (!deviceId) {
        showMessage('device-message', 'ID do aparelho não informado.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            showMessage('device-message', data.error || 'Erro ao buscar aparelho.', 'error');
            return;
        }

        const dev = data.device;

        document.getElementById('device-name-title').textContent = dev.name;
        document.getElementById('device-platform').textContent = dev.platform;
        document.getElementById('device-created-at').textContent =
            new Date(dev.created_at).toLocaleString('pt-BR');

        document.getElementById('device-last-connected').textContent =
            dev.last_connected_at
                ? new Date(dev.last_connected_at).toLocaleString('pt-BR')
                : '—';

        document.getElementById('device-last-error').textContent =
            dev.last_error || '—';

        const statusBadge = document.getElementById('device-status-badge');
        statusBadge.textContent = dev.status.toUpperCase();
        statusBadge.className = `badge-status ${dev.status}`;

        // Preencher campos de configuração se houver dados no 'config' do device
        // ATENÇÃO: O backend (app.js) precisa retornar a coluna 'config' na rota /devices/:id
        // Por enquanto, os campos de mensagem e webhook ficarão vazios por padrão
        // até que o backend seja atualizado para enviar esses dados.
        if (dev.config) {
            document.getElementById('welcome-message').value = dev.config.welcomeMessage || '';
            document.getElementById('out-of-hours-message').value = dev.config.outOfHoursMessage || '';
            document.getElementById('webhook-url').value = dev.config.webhookUrl || '';
            document.getElementById('secret-key').value = dev.config.secretKey || '';
        }

    } catch (err) {
        console.error(err);
        showMessage('device-message', 'Não foi possível conectar ao servidor.', 'error');
    }
}

// Função para salvar as configurações do aparelho (messages, webhooks, etc.)
async function saveDeviceConfig(configUpdates) {
    const token = getToken();
    if (!token) return;

    const params = new URLSearchParams(window.location.search);
    const deviceId = params.get('id');
    if (!deviceId) {
        showMessage('device-message', 'ID do aparelho não informado para salvar.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ config: configUpdates }) // Envia o objeto config para o backend
        });
        const data = await res.json();

        if (!res.ok) {
            showMessage('device-message', data.error || 'Erro ao salvar configurações.', 'error');
            return;
        }

        showMessage('device-message', 'Configurações salvas com sucesso!', 'success');
        loadDevice(); // Recarrega os dados para garantir que a interface esteja atualizada

    } catch (err) {
        console.error(err);
        showMessage('device-message', 'Falha ao conectar ao servidor para salvar configurações.', 'error');
    }
}

async function saveMessages() {
    const welcomeMessage = document.getElementById('welcome-message').value;
    const outOfHoursMessage = document.getElementById('out-of-hours-message').value;

    await saveDeviceConfig({ welcomeMessage, outOfHoursMessage });
}

async function saveServerConfig() {
    const webhookUrl = document.getElementById('webhook-url').value;
    const secretKey = document.getElementById('secret-key').value;

    await saveDeviceConfig({ webhookUrl, secretKey });
}

function handleCreateFlow() {
    alert('Criar fluxo ainda não está disponível. Em breve esta opção levará você para a tela de fluxos.');
}

function setupButtons() {
    const saveMsgBtn = document.getElementById('save-messages-button');
    const saveSrvBtn = document.getElementById('save-servers-button');
    const createFlowBtn = document.getElementById('create-flow-button');

    if (saveMsgBtn) {
        saveMsgBtn.addEventListener('click', e => {
            e.preventDefault();
            saveMessages();
        });
    }

    if (saveSrvBtn) {
        saveSrvBtn.addEventListener('click', e => {
            e.preventDefault();
            saveServerConfig();
        });
    }

    if (createFlowBtn) {
        createFlowBtn.addEventListener('click', e => {
            e.preventDefault();
            handleCreateFlow();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDevice();
    setupButtons();
});
