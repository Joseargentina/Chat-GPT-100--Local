import { CreateWebWorkerMLCEngine } from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.46/+esm";

const $ = el => document.querySelector(el);

const $form = $('form');
const $input = $('form input');
const $template = $('#message-template');
const $messages = $('ul');
const $container = $('main');
const $button = $('button');
const $info = $('small');
const $loading = $('.loading');

let messages = [];
let end = false;

const SELECTED_MODEL = 'Llama-3-8B-Instruct-q4f32_1-MLC-1k';

const engine = await CreateWebWorkerMLCEngine(
    new Worker('./worker.js', { type: 'module' }),SELECTED_MODEL, {
        initProgressCallback: (info) => {
            $info.textContent = `${info.text}%`;
            if(info.progress === 1 && !end) {
                end = true;
                $loading?.parentNode?.removeChild($loading);
                $button.disabled = false;
                addMessage("¡Hola! Soy un ChatGPT que se ejecuta completamente en tu navegador. ¿En qué puedo ayudarte hoy?", 'bot');
                $input.focus();
            }
        }
    }
);

console.log('Engine initialized:', engine);

const MAX_CONTEXT_SIZE = 1024; // Tamaño de la ventana de contexto

$form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = $input.value.trim();

    if (messageText != '') {
        $input.value = '';
    }

    addMessage(messageText, 'user');
    $button.setAttribute('disabled', '');

    const userMessage = {
        role: 'user',
        content: messageText
    };

    messages.push(userMessage);

    // Recortar mensajes para que quepan en el contexto
    const contextMessages = trimMessagesToFitContext(messages, MAX_CONTEXT_SIZE);

    try {
        const chunks = await engine.chat.completions.create({
            messages: contextMessages,
            stream: true
        });

        let reply = "";
        const $botMessage = addMessage('', 'bot');

        for await (const chunk of chunks) {
            const [choice] = chunk.choices;
            const content = choice?.delta?.content ?? '';

            reply += content;
            $botMessage.textContent = reply;
            // console.log(chunk.choices);
        }

        messages.push({
            role: 'assistant',
            content: reply
        });

    } catch (error) {
        console.error('Error processing the message:', error);
        // Si hay un error, reduce el número de mensajes
        if (error.message.includes('Prompt tokens exceed context window size')) {
            // No ajustar automáticamente aquí para evitar un ciclo de errores.
        }
    } finally {
        $button.removeAttribute('disabled');
        $container.scrollTop = $container.scrollHeight;
    }
});

function addMessage(text, sender) {
    const clonedTemplate = $template.content.cloneNode(true);
    const $newMessage = clonedTemplate.querySelector('.message');

    const $who = $newMessage.querySelector('span');
    const $text = $newMessage.querySelector('p');

    $text.textContent = text;
    $who.textContent = sender === 'bot' ? 'GPT' : 'Tú';
    $newMessage.classList.add(sender);

    $messages.appendChild($newMessage);

    $container.scrollTop = $container.scrollHeight;

    return $text;
}

function trimMessagesToFitContext(messages, maxTokens) {
    let tokenCount = 0;
    const trimmedMessages = [];

    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        const messageTokens = countTokens(message.content); // Usa una función más precisa para contar tokens

        if (tokenCount + messageTokens <= maxTokens) {
            trimmedMessages.unshift(message);
            tokenCount += messageTokens;
        } else {
            break;
        }
    }

    return trimmedMessages;
}

function countTokens(text) {
    // Una aproximación simple para contar tokens
    // Puede ajustar esta función según sea necesario
    return text.split(' ').length;
}
