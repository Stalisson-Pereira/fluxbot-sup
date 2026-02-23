document.addEventListener('DOMContentLoaded', () => {
    // Ano no footer
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Header dinâmico
    const token = localStorage.getItem('fluxbot_token');
    const dashboardBtn = document.getElementById('dashboard-btn-header');
    const loginLink = document.getElementById('login-link-header');
    const registerBtn = document.getElementById('register-btn-header');

    if (dashboardBtn && loginLink && registerBtn) {
        if (token) {
            dashboardBtn.style.display = 'inline-flex';
            loginLink.style.display = 'none';
            registerBtn.style.display = 'none';
        } else {
            dashboardBtn.style.display = 'none';
            loginLink.style.display = 'inline-flex';
            registerBtn.style.display = 'inline-flex';
        }
    }

    // Menu mobile (se quiser usar)
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navEl = document.querySelector('header nav');
    if (mobileMenuBtn && navEl) {
        mobileMenuBtn.addEventListener('click', () => {
            navEl.classList.toggle('open');
        });
    }

    // Botão de sair (logout)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('fluxbot_token');
            localStorage.removeItem('fluxbot_user');
            window.location.href = 'login.html';
        });
    }
});

// Função para exibir mensagens (erro/sucesso/info)
function showMessage(elementId, message, type = 'info') {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    el.className = `message-area message-${type}`;
    el.style.display = 'block';
}
