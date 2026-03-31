import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    limit, 
    serverTimestamp, 
    doc, 
    getDocs, 
    writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAN8gmDvohf52wvXMyIC9wh8ZtRRj6_EKc",
  authDomain: "antigravity-by-phone.firebaseapp.com",
  projectId: "antigravity-by-phone",
  storageBucket: "antigravity-by-phone.firebasestorage.app",
  messagingSenderId: "176099404006",
  appId: "1:176099404006:web:205becd24f4567f2b83327",
  measurementId: "G-K0BPQX88GS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const statusDot = document.getElementById('status-indicator');
const statusText = document.getElementById('agent-status-text');
const thoughtDisplay = document.getElementById('thought-display');
const toolDisplay = document.getElementById('tool-display');
const mirrorContainer = document.getElementById('mirror-container');
const consoleBody = document.getElementById('console-body');
const commandInput = document.getElementById('command-input');
const clearLogsBtn = document.getElementById('clear-logs');
const remoteScreen = document.getElementById('remote-screen');
const remoteContainer = document.getElementById('remote-container');
const commandForm = document.getElementById('command-form');

// State tracking
let remoteResolution = { width: 1920, height: 1080 };

/**
 * Updates the agent's visual state in the status bar
 * @param {'idle' | 'thinking' | 'working'} state 
 */
function updateAgentUI(state) {
    statusDot.className = 'status-dot';
    
    switch(state) {
        case 'thinking':
            statusDot.classList.add('pulsing');
            statusText.textContent = 'Agent Thinking...';
            mirrorContainer.classList.add('active');
            break;
        case 'working':
            statusDot.classList.add('active');
            statusText.textContent = 'Agent Working';
            mirrorContainer.classList.add('active');
            break;
        default:
            statusDot.classList.add('active');
            if (!task) statusText.textContent = 'Agent Online';
            mirrorContainer.classList.remove('active');
    }
}

/**
 * Appends a log entry to the virtual console
 */
function appendLog(text, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.innerHTML = `<span style="opacity:0.4; font-size: 0.7rem; margin-right: 8px;">[${time}]</span> ${text}`;
    
    consoleBody.appendChild(entry);
    consoleBody.scrollTop = consoleBody.scrollHeight;
    
    // Auto-prune old UI elements
    if (consoleBody.children.length > 100) {
        consoleBody.removeChild(consoleBody.firstChild);
    }
}

// 1. Listen for Agent Mirror State (Digital Twin)
onSnapshot(doc(db, "antigravity_mirror", "status"), (snapshot) => {
    if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Show EVERYTHING happening
        thoughtDisplay.textContent = data.thought || "Awaiting task...";
        toolDisplay.textContent = data.tool ? `Tool: ${data.tool}` : "Idle";
        
        if (data.active) {
            const uiState = data.tool !== 'Idle' ? 'working' : 'idle';
            updateAgentUI(uiState, data.currentTask);
            
            // Sync resolution for input mapping
            if (data.screenWidth && data.screenHeight) {
                remoteResolution.width = data.screenWidth;
                remoteResolution.height = data.screenHeight;
            }
        } else {
            updateAgentUI('offline');
        }
    } else {
        updateAgentUI('offline');
    }
});

// 2. Listen for Real-time Logs
const qLogs = query(collection(db, "antigravity_logs"), orderBy("timestamp", "desc"), limit(50));
onSnapshot(qLogs, (snapshot) => {
    // Current approach: clear and re-render for simplicity on small log sets
    // In production, we'd handle docChanges() for performance
    consoleBody.innerHTML = '';
    const logs = [];
    snapshot.forEach(doc => logs.push(doc.data()));
    
    // Reverse because we queried desc for limit, but want to display chronological
    logs.reverse();
    
    logs.forEach(log => {
        const entry = document.createElement('div');
        entry.className = `log-entry ${log.type || 'agent'}`;
        
        const time = log.timestamp ? log.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '...';
        
        // Handle multi-line output nicely
        const formattedText = log.text.replace(/\n/g, '<br>');
        entry.innerHTML = `<span style="opacity:0.3; font-size: 0.7rem; margin-right: 8px;">[${time}]</span> ${formattedText}`;
        
        consoleBody.appendChild(entry);
    });
    
    consoleBody.scrollTop = consoleBody.scrollHeight;
});

// 3. Command Sending Logic
async function sendCommand(text) {
    if (!text.trim()) return;
    
    appendLog(text, 'user');
    updateAgentUI('thinking');
    
    try {
        await addDoc(collection(db, "antigravity_commands"), {
            text: text,
            status: "pending",
            timestamp: serverTimestamp()
        });
        commandInput.value = '';
    } catch (err) {
        appendLog(`Failed to send: ${err.message}`, 'error');
        updateAgentUI('idle');
    }
}

commandForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendCommand(commandInput.value);
});

// 4. Clear Logs (Admin Function)
clearLogsBtn.addEventListener('click', async () => {
    if (!confirm("Clear overall logs?")) return;
    
    try {
        const snapshot = await getDocs(collection(db, "antigravity_logs"));
        const batch = writeBatch(db);
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        appendLog("Remote history purged.", "system");
    } catch (err) {
        appendLog("Purge failed: " + err.message, "error");
    }
});

// 5. Listen for Screen Mirror
onSnapshot(doc(db, "antigravity_mirror", "screen"), (snapshot) => {
    if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.data) {
            remoteScreen.src = data.data;
        }
    }
});

// 6. Handle Remote Input (Clicks)
remoteScreen.addEventListener('click', async (e) => {
    const rect = remoteScreen.getBoundingClientRect();
    
    // Calculate relative position (0.0 to 1.0)
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    // Convert to target desktop resolution
    const desktopX = Math.round(relX * remoteResolution.width);
    const desktopY = Math.round(relY * remoteResolution.height);

    appendLog(`Sending Click: ${desktopX}, ${desktopY}`, 'system');

    try {
        await addDoc(collection(db, "antigravity_remote_inputs"), {
            type: 'click',
            x: desktopX,
            y: desktopY,
            status: 'pending',
            timestamp: serverTimestamp()
        });
    } catch (err) {
        appendLog(`Input Failed: ${err.message}`, 'error');
    }
});

// Initial boot
appendLog("Antigravity Neural Link Established.", "system");
updateAgentUI('idle');
