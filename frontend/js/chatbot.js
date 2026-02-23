document.addEventListener('DOMContentLoaded', () => {
    const chatbotLauncher = document.getElementById('chatbot-launcher');
    const chatbotWidget = document.getElementById('chatbot-widget');
    const chatbotCloseBtn = document.getElementById('chatbot-close-btn');
    const chatbotBody = document.getElementById('chatbot-body');
    const chatbotInput = document.getElementById('chatbot-input');
    const chatbotSendBtn = document.getElementById('chatbot-send-btn');
    const chatbotOptions = document.getElementById('chatbot-options');

    if (!chatbotLauncher || !chatbotWidget || !chatbotCloseBtn || !chatbotBody || !chatbotInput || !chatbotSendBtn || !chatbotOptions) {
        console.warn("Elementos do chatbot não encontrados. O chatbot de demonstração não será inicializado.");
        return;
    }

    chatbotLauncher.addEventListener('click', () => {
        chatbotWidget.classList.toggle('chatbot-open');
    });

    chatbotCloseBtn.addEventListener('click', () => {
        chatbotWidget.classList.remove('chatbot-open');
    });

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chatbot-message', sender);
        messageDiv.textContent = text;
        chatbotBody.appendChild(messageDiv);
        chatbotBody.scrollTop = chatbotBody.scrollHeight; // Scroll para o final
    }

    function handleBotResponse(userMessage) {
        let botResponse = "Desculpe, não entendi. Você pode tentar 'planos', 'funcionalidades' ou 'suporte'?";

        if (userMessage.includes('planos')) {
            botResponse = "Temos planos a partir de R$19,90/mês para 1 aparelho, com mensagens ilimitadas. Visite a seção 'Planos' para mais detalhes!";
            setTimeout(() => addMessage(botResponse, 'bot'), 500);

        } else if (userMessage.includes('funcionalidades')) {
            botResponse = "O FluxBot oferece chatbot 24/7, disparo em massa, agendamento, distribuição de atendimentos, transcrição de áudio e relatórios detalhados.";
            setTimeout(() => addMessage(botResponse, 'bot'), 500);

        } else if (userMessage.includes('suporte')) {
            botResponse = "Você será direcionado para o nosso suporte no WhatsApp. Aguarde um instante...";

            setTimeout(() => addMessage(botResponse, 'bot'), 500);

            // Redireciona após 2 segundos
            setTimeout(() => {
                window.open("https://wa.me/351937854517", "_blank");
            }, 2000);
        }
    }

    chatbotSendBtn.addEventListener('click', () => {
        const userMessage = chatbotInput.value.trim();
        if (userMessage) {
            addMessage(userMessage, 'user');
            chatbotInput.value = '';
            handleBotResponse(userMessage.toLowerCase());
        }
    });

    chatbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            chatbotSendBtn.click();
        }
    });

    chatbotOptions.addEventListener('click', (e) => {
        if (e.target.classList.contains('chatbot-option-btn')) {
            const optionValue = e.target.dataset.value;
            addMessage(e.target.textContent, 'user');
            handleBotResponse(optionValue);
        }
    });
});
