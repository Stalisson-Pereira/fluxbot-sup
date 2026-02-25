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
    const listContainer = document.getElementById('devices-list-container');
    listContainer.innerHTML = ''; // limpa todo o conteúdo, incluindo a mensagem de "Carregando..."

    let total = 0,
        connected = 0,
        offline = 0;

    if (devices.length === 0) {
        listContainer.innerHTML = `
            <div class="dashboard-card">
                <div class="dashboard-card-header">
                    <div class="dashboard-card-title">Nenhum aparelho cadastrado</div>
                </div>
                <div class="dashboard-card-subtitle">
                    Comece adicionando um novo aparelho para gerenciar suas conversas.
                </div>
                <div class="dashboard-actions" style="margin-top:8px;">
                    <button class="btn btn-primary btn-sm" onclick="window.location.href='devices.html'">Adicionar Novo Aparelho</button>
                </div>
            </div>
        `;
    } else {
        devices.forEach((dev) => {
            total++;
            if (dev.status === 'connected') connected++;
            else offline++;

            const deviceCard = document.createElement('div');
            deviceCard.className = 'dashboard-card';
            deviceCard.innerHTML = `
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
                    <a href="devicesettings.html?id=${dev.id}" class="btn btn-outline btn-sm" style="margin-left: 5px;">Configurar</a>
                </div>
            `;
            listContainer.appendChild(deviceCard);
        });
    }

    // Atualiza métricas
    document.getElementById('total-devices').textContent = total;
    document.getElementById('connected-devices').textContent = connected;
    document.getElementById('offline-devices').textContent = offline;
}

// Carrega aparelhos da API
async function loadDevices() {
    const token = protectRoute(); // garante que tem token
    if (!token) return; // Se não tem token, já foi redirecionado

    const listContainer = document.getElementById('devices-list-container');
    const devicesListMessage = document.getElementById('devices-list-message'); // Mensagem específica da lista

    // Exibe a mensagem de carregamento inicial
    listContainer.innerHTML = `
        <div class="dashboard-card">
            <div class="dashboard-card-header">
                <div class="dashboard-card-title">Carregando Aparelhos...</div>
            </div>
            <div class="dashboard-card-subtitle">
                Aguarde enquanto buscamos seus dispositivos.
            </div>
        </div>
    `;
    if (devicesListMessage) devicesListMessage.style.display = 'none'; // Esconde mensagens anteriores

    try {
        const res = await fetch(`${API_BASE_URL}/devices`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            showMessage('dashboard-global-message', data.error || 'Erro ao buscar aparelhos.', 'error');
            listContainer.innerHTML = ''; // Limpa o carregamento se houver erro
            return;
        }

        renderDevices(data.devices);
    } catch (err) {
        console.error(err);
        showMessage('dashboard-global-message', 'Não foi possível conectar ao servidor para buscar aparelhos.', 'error');
        listContainer.innerHTML = ''; // Limpa o carregamento se houver erro
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
            showMessage('dashboard-global-message', data.error || `Erro ao ${action} aparelho.`, 'error');
            return;
        }

        showMessage('dashboard-global-message', `Aparelho ${action === 'connect' ? 'conectado' : 'desconectado'} com sucesso!`, 'success');
        // Recarrega a lista para refletir o novo status
        loadDevices();
    } catch (err) {
        console.error(err);
        showMessage('dashboard-global-message', `Falha ao ${action} aparelho.`, 'error');
    } finally {
        // Os botões serão reabilitados após o `loadDevices` renderizar tudo novamente
    }
}

// Delegação de eventos nos botões de conectar/desconectar
function setupDeviceActions() {
    const listContainer = document.getElementById('devices-list-container');
    if (!listContainer) return;

    listContainer.addEventListener('click', (e) => {
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

async function loadSubscription() {
    const token = protectRoute();
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE_URL}/subscription/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();

        if (!res.ok) {
            console.error(data.error);
            return;
        }

        const sub = data.subscription;

        document.getElementById('user-plan').textContent =
            sub.plan_name || 'Trial';

        document.getElementById('user-expiration').textContent =
            sub.trial_end_at
                ? new Date(sub.trial_end_at).toLocaleDateString('pt-BR')
                : '—';

        const statusEl = document.getElementById('user-sub-status');
        if (statusEl) statusEl.textContent = sub.status.toUpperCase();

    } catch (err) {
        console.error(err);
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    protectRoute(); // redireciona se não houver token
    loadDevices();
    setupDeviceActions();
    loadUserInfo(); // Carrega info do usuário
    loadSubscription(); 
});
