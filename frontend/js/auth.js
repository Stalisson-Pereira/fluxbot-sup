// LOGIN
function setupLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('login-button');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            showMessage('message-area', 'Preencha e-mail e senha.', 'error');
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = 'Entrando...';

        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                showMessage('message-area', data.error || 'Credenciais inválidas.', 'error');
                return;
            }

            localStorage.setItem('fluxbot_token', data.token);
            localStorage.setItem('fluxbot_user', JSON.stringify(data.user));

            showMessage('message-area', 'Login realizado com sucesso. Redirecionando...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
        } catch (err) {
            console.error(err);
            showMessage('message-area', 'Erro ao conectar ao servidor.', 'error');
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Entrar';
        }
    });
}

// REGISTER
function setupRegisterForm() {
    const form = document.getElementById('register-form');
    if (!form) return;

    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const registerButton = document.getElementById('register-button');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!name || !email || !password) {
            showMessage('message-area', 'Preencha todos os campos.', 'error');
            return;
        }

        registerButton.disabled = true;
        registerButton.textContent = 'Criando conta...';

        try {
            const res = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                showMessage('message-area', data.error || 'Erro ao criar conta.', 'error');
                return;
            }

            localStorage.setItem('fluxbot_token', data.token);
            localStorage.setItem('fluxbot_user', JSON.stringify(data.user));

            showMessage('message-area', 'Conta criada com sucesso. Redirecionando...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
        } catch (err) {
            console.error(err);
            showMessage('message-area', 'Erro ao conectar ao servidor.', 'error');
        } finally {
            registerButton.disabled = false;
            registerButton.textContent = 'Criar conta e acessar painel';
        }
    });
}
