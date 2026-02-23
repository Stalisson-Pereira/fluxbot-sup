function protectRoute() {
    const token = localStorage.getItem('fluxbot_token');
    if (!token) window.location.href = 'login.html';
    return token;
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function loadDevice() {
    const token = protectRoute();
    if (!token) return;

    const id = getQueryParam('id');
    if (!id) {
        showMessage('device-message', 'ID do aparelho não informado na URL.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/devices/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            showMessage('device-message', data.error || 'Erro ao carregar aparelho.', 'error');
            return;
        }

        const device = data.device || data; // se sua API devolver só o device
        document.getElementById('device-name-title').textContent = device.name;
        document.getElementById('device-platform').textContent = device.platform;
        document.getElementById('device-last-connected').textContent =
            device.last_connected_at ? formatDate(device.last_connected_at) : '-';
        document.getElementById('device-created-at').textContent =
            device.created_at ? formatDate(device.created_at) : '-';

        const statusBadge = document.getElementById('device-status-badge');
        statusBadge.textContent =
            device.status === 'connected' ? 'Conectado' :
                device.status === 'pending_qr' ? 'Aguardando QR' :
                    'Offline';

        statusBadge.classList.remove('online', 'offline');
        statusBadge.classList.add(device.status === 'connected' ? 'online' : 'offline');
    } catch (err) {
        console.error(err);
        showMessage('device-message', 'Falha ao conectar ao servidor.', 'error');
    }
}

function setupTabs() {
    const buttons = document.querySelectorAll('.tab-button');
    const panels = document.querySelectorAll('.tab-panel');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;

            buttons.forEach(b => b.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(target).classList.add('active');
        });
    });
}

function setupForms() {
    const saveMessagesBtn = document.getElementById('save-messages-button');
    const saveServersBtn = document.getElementById('save-servers-button');

    if (saveMessagesBtn) {
        saveMessagesBtn.addEventListener('click', () => {
            // aqui no futuro você vai mandar para a API
            showMessage('device-message', 'Mensagens salvas (mock). Em breve conectamos com a API.', 'success');
        });
    }

    if (saveServersBtn) {
        saveServersBtn.addEventListener('click', () => {
            // aqui no futuro você vai mandar para a API
            showMessage('device-message', 'Configurações de servidor salvas (mock).', 'success');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    protectRoute();
    setupTabs();
    setupForms();
    loadDevice();
});
