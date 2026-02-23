// Função para proteger a rota – redireciona se não houver token
function protectRoute() {
    const token = localStorage.getItem('fluxbot_token');
    if (!token) {
        // Se não estiver logado, volta para login
        window.location.href = 'login.html';
    }
    return token;
}

// Formata data (ex.: 22/02/2026 14:30)
function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Renderiza a lista de aparelhos
function renderDevices(devices) {
    const list = document.getElementById('devices-list');
    list.innerHTML = ''; // limpa

    let total = 0,
        connected = 0,
        offline = 0;

    devices.forEach((dev) => {
        total++;
        if (dev.status === 'connected') connected++;
        else offline++;

        const li = document.createElement('div');
        li.className = 'dashboard-card';
        li.innerHTML = `
            <div class="dashboard-card-header">
                <div class="dashboard-card-title">${dev.name}</div>
                <span class="badge-status ${dev.status === 'connected' ? 'online' : 'offline'}">
                    ${dev.status === 'connected' ? 'Conectado' : 'Offline'}
                </span>
            </div>
            <div class="dashboard-card-subtitle">
                Plataforma: ${dev.platform}
            </div>
            <div class="dashboard-card-subtitle">
                Última conexão: ${dev.last_connected_at ? formatDate(dev.last_connected_at) : '—'}
            </div>
            <div class="dashboard-card-subtitle">
                Criado em: ${formatDate(dev.created_at)}
            </div>
            <div class="dashboard-actions" style="margin-top:8px;">
                ${dev.status === 'connected'
            ? `<button class="btn btn-outline btn-sm" data-id="${dev.id}" data-action="disconnect">Desconectar</button>`
            : `<button class="btn btn-primary btn-sm" data-id="${dev.id}" data-action="connect">Conectar</button>`}
            </div>
        `;
        list.appendChild(li);
    });

    // Atualiza métricas
    document.getElementById('total-devices').textContent = total;
    document.getElementById('connected-devices').textContent = connected;
    document.getElementById('offline-devices').textContent = offline;
}

// Carrega aparelhos da API
async function loadDevices() {
    const token = protectRoute(); // garante que tem token
    if (!token) return; // Se não tem token, já foi redirecionado

    try {
        const res = await fetch(`${API_BASE_URL}/devices`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            showMessage('dashboard-message', data.error || 'Erro ao buscar aparelhos.', 'error');
            return;
        }

        renderDevices(data.devices);
    } catch (err) {
        console.error(err);
        showMessage('dashboard-message', 'Não foi possível conectar ao servidor.', 'error');
    }
}

// Conectar / Desconectar aparelho
async function toggleDevice(deviceId, action) {
    const token = protectRoute();
    if (!token) return;

    const endpoint = action === 'connect' ? 'connect' : 'disconnect';

    try {
        // Desabilita todos os botões de ação para evitar cliques múltiplos
        document.querySelectorAll('[data-action]').forEach(btn => btn.disabled = true);

        const res = await fetch(`${API_BASE_URL}/devices/${deviceId}/${endpoint}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            showMessage('dashboard-message', data.error || `Erro ao ${action} aparelho.`, 'error');
            return;
        }

        showMessage('dashboard-message', `Aparelho ${action === 'connect' ? 'conectado' : 'desconectado'} com sucesso!`, 'success');
        // Recarrega a lista para refletir o novo status
        loadDevices();
    } catch (err) {
        console.error(err);
        showMessage('dashboard-message', `Falha ao ${action} aparelho.`, 'error');
    } finally {
        // Reabilita os botões após a operação (ou após o recarregamento dos devices)
        document.querySelectorAll('[data-action]').forEach(btn => btn.disabled = false);
    }
}

// Delegação de eventos nos botões de conectar/desconectar
function setupDeviceActions() {
    const list = document.getElementById('devices-list');
    if (!list) return;

    list.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const deviceId = btn.dataset.id;
        const action = btn.dataset.action; // 'connect' ou 'disconnect'
        toggleDevice(deviceId, action);
    });
}

// Carrega informações do usuário logado
function loadUserInfo() {
    const user = JSON.parse(localStorage.getItem('fluxbot_user'));
    if (user) {
        document.getElementById('user-name').textContent = user.name || 'N/A';
        document.getElementById('user-email').textContent = user.email || 'N/A';
        // Aqui você pode adicionar lógica para carregar plano e expiração da API, se disponível
        // Por enquanto, são valores estáticos do HTML
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    protectRoute(); // redireciona se não houver token
    loadDevices();
    setupDeviceActions();
    loadUserInfo(); // Carrega info do usuário
});
