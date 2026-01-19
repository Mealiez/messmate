// public/assets/ai-assistant.js
import { supabase } from '../supabaseConfig.js';

// 1. Inject Styles
const style = document.createElement('style');
style.textContent = `
    #mealiez-ai-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        font-family: 'Inter', sans-serif;
    }
    #ai-toggle-btn {
        background: #2563EB;
        color: white;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border: none;
        cursor: pointer;
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
    }
    #ai-toggle-btn:hover { transform: scale(1.05); }
    
    #ai-chat-window {
        position: absolute;
        bottom: 80px;
        right: 0;
        width: 350px;
        height: 500px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: opacity 0.3s;
    }
    
    /* FIX: Renamed from .hidden to .ai-hidden to avoid conflicting with Tailwind */
    .ai-hidden { display: none !important; opacity: 0; }
    
    #ai-header {
        background: #2563EB;
        color: white;
        padding: 15px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    #ai-messages {
        flex: 1;
        padding: 15px;
        overflow-y: auto;
        background: #F3F4F6;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .message {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 14px;
        line-height: 1.4;
    }
    .user-msg {
        background: #2563EB;
        color: white;
        align-self: flex-end;
        border-bottom-right-radius: 2px;
    }
    .ai-msg {
        background: white;
        color: #1F2937;
        align-self: flex-start;
        border-bottom-left-radius: 2px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    #ai-input-area {
        padding: 15px;
        border-top: 1px solid #E5E7EB;
        display: flex;
        gap: 10px;
        background: white;
    }
    #ai-input {
        flex: 1;
        border: 1px solid #D1D5DB;
        border-radius: 20px;
        padding: 8px 15px;
        outline: none;
    }
    #ai-send {
        background: #2563EB;
        color: white;
        border: none;
        border-radius: 50%;
        width: 35px;
        height: 35px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }
`;
document.head.appendChild(style);

// 2. Inject HTML Structure
const widgetContainer = document.createElement('div');
widgetContainer.id = 'mealiez-ai-widget';
// FIX: Applied 'ai-hidden' class here
widgetContainer.innerHTML = `
    <div id="ai-chat-window" class="ai-hidden">
        <div id="ai-header">
            <span>Mealiez Assistant 🤖</span>
            <button id="ai-close-btn" style="background:none;border:none;color:white;cursor:pointer;font-size:18px;">&times;</button>
        </div>
        <div id="ai-messages">
            <div class="message ai-msg">Hello! I can help you find the best mess or check today's menu. What are you looking for?</div>
        </div>
        <form id="ai-input-area">
            <input type="text" id="ai-input" placeholder="Type a message..." autocomplete="off">
            <button type="submit" id="ai-send">➤</button>
        </form>
    </div>
    <button id="ai-toggle-btn">💬</button>
`;
document.body.appendChild(widgetContainer);

// 3. Logic & Event Listeners
const toggleBtn = document.getElementById('ai-toggle-btn');
const closeBtn = document.getElementById('ai-close-btn');
const chatWindow = document.getElementById('ai-chat-window');
const form = document.getElementById('ai-input-area');
const input = document.getElementById('ai-input');
const messagesContainer = document.getElementById('ai-messages');

function toggleChat() {
    // FIX: Toggling the new specific class
    chatWindow.classList.toggle('ai-hidden');
    if (!chatWindow.classList.contains('ai-hidden')) input.focus();
}

toggleBtn.addEventListener('click', toggleChat);
closeBtn.addEventListener('click', toggleChat);

function addMessage(text, isUser) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-msg' : 'ai-msg'}`;
    msgDiv.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    addMessage(query, true);
    input.value = '';

    const loadingId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai-msg';
    loadingDiv.id = loadingId;
    loadingDiv.textContent = 'Thinking...';
    messagesContainer.appendChild(loadingDiv);

    try {
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
            body: { query: query }
        });

        document.getElementById(loadingId).remove();

        if (error) throw error;
        addMessage(data.answer || "Sorry, I couldn't understand that.", false);

    } catch (err) {
        document.getElementById(loadingId)?.remove();
        addMessage(`Error: ${err.message}.`, false);
        console.error(err);
    }
});