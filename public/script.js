let selectedImageBase64 = null;
let recognition = null;
let isRecording = false;
let currentUtterance = null;
let isAudioPaused = false;

// DOM Elements
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const micIcon = document.getElementById('micIcon');
const imageInput = document.getElementById('imageInput');
const imagePreviewBar = document.getElementById('imagePreviewBar');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');
const chatContainer = document.getElementById('chatContainer');
const welcomeCard = document.getElementById('welcomeCard');
const audioControlBar = document.getElementById('audioControlBar');
const pauseAudioBtn = document.getElementById('pauseAudioBtn');
const stopAudioBtn = document.getElementById('stopAudioBtn');
const audioStatus = document.getElementById('audioStatus');

// Setup Speech Recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'hi-IN'; // Default Hindi support

    recognition.onstart = () => {
        isRecording = true;
        micBtn.classList.add('recording');
        micIcon.className = 'fa-solid fa-microphone-slash';
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value += (userInput.value ? ' ' : '') + transcript;
    };

    recognition.onerror = (event) => {
        console.error("Speech Error:", event.error);
        stopRecording();
    };

    recognition.onend = () => {
        stopRecording();
    };
} else {
    micBtn.style.display = 'none';
    console.warn("Speech Recognition not supported in this browser.");
}

function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    micIcon.className = 'fa-solid fa-microphone';
    if (recognition) recognition.stop();
}

micBtn.addEventListener('click', () => {
    if (!recognition) return alert("आपका ब्राउज़र वॉइस रिकॉर्डिंग सपोर्ट नहीं करता है।");
    if (isRecording) {
        stopRecording();
    } else {
        recognition.start();
    }
});

// Image Upload Handler
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            selectedImageBase64 = event.target.result;
            imagePreview.src = selectedImageBase64;
            imagePreviewBar.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

removeImageBtn.addEventListener('click', () => {
    selectedImageBase64 = null;
    imageInput.value = '';
    imagePreviewBar.classList.add('hidden');
});

// Send Message Handler
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !selectedImageBase64) return;

    if (welcomeCard) welcomeCard.style.display = 'none';

    // Append User Message
    appendMessage('user', text, selectedImageBase64);

    const payload = {
        prompt: text,
        image: selectedImageBase64
    };

    // Reset Input
    userInput.value = '';
    const tempImage = selectedImageBase64;
    removeImageBtn.click();

    // Show AI Loading Placeholder
    const aiMessageDiv = appendMessage('ai', 'सोच रहा हूँ...');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            updateAiMessage(aiMessageDiv, data.text, data.generatedImage);
            speakText(data.text);
        } else {
            updateAiMessage(aiMessageDiv, `त्रुटि: ${data.error || 'सर्वर से जवाब नहीं मिला।'}`);
        }
    } catch (err) {
        updateAiMessage(aiMessageDiv, 'त्रुटि: सर्वर से कनेक्ट करने में विफल।');
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function appendMessage(sender, text, imageSrc) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');

    if (imageSrc) {
        const img = document.createElement('img');
        img.src = imageSrc;
        img.classList.add('msg-image');
        msgDiv.appendChild(img);
    }

    const textSpan = document.createElement('span');
    textSpan.classList.add('msg-text');
    textSpan.innerText = text;
    msgDiv.appendChild(textSpan);

    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return msgDiv;
}

function updateAiMessage(msgDiv, text, generatedImageSrc) {
    const textSpan = msgDiv.querySelector('.msg-text');
    textSpan.innerText = text;

    if (generatedImageSrc) {
        const img = document.createElement('img');
        img.src = generatedImageSrc;
        img.classList.add('msg-image');
        msgDiv.insertBefore(img, textSpan);
    }

    // Add action buttons (Speaker & Download)
    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('msg-actions');

    const speakBtn = document.createElement('button');
    speakBtn.classList.add('action-btn');
    speakBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> सुनें';
    speakBtn.onclick = () => speakText(text);
    actionsDiv.appendChild(speakBtn);

    if (generatedImageSrc) {
        const downloadBtn = document.createElement('a');
        downloadBtn.classList.add('action-btn');
        downloadBtn.href = generatedImageSrc;
        downloadBtn.download = 'valmiki-edited-image.png';
        downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> फोटो डाउनलोड करें';
        actionsDiv.appendChild(downloadBtn);
    }

    msgDiv.appendChild(actionsDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Text to Speech (TTS) Controls
function speakText(text) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Stop any active speech

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'hi-IN';

    currentUtterance.onstart = () => {
        audioControlBar.classList.remove('hidden');
        audioStatus.innerText = 'AI जवाब बोल रहा है...';
        pauseAudioBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        isAudioPaused = false;
    };

    currentUtterance.onend = () => {
        audioControlBar.classList.add('hidden');
    };

    currentUtterance.onerror = () => {
        audioControlBar.classList.add('hidden');
    };

    window.speechSynthesis.speak(currentUtterance);
}

pauseAudioBtn.addEventListener('click', () => {
    if (!window.speechSynthesis) return;

    if (window.speechSynthesis.speaking) {
        if (isAudioPaused) {
            window.speechSynthesis.resume();
            isAudioPaused = false;
            pauseAudioBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            audioStatus.innerText = 'AI जवाब बोल रहा है...';
        } else {
            window.speechSynthesis.pause();
            isAudioPaused = true;
            pauseAudioBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            audioStatus.innerText = 'आवाज़ रोकी गई है (Paused)';
        }
    }
});

stopAudioBtn.addEventListener('click', () => {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        audioControlBar.classList.add('hidden');
    }
});
