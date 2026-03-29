// Antigravity Mobile Command Center - Firebase Integration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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

const consoleLogs = document.getElementById('console-logs');
const commandForm = document.getElementById('command-form');
const commandInput = document.getElementById('command-input');
const clearLogsBtn = document.getElementById('clear-logs');
const statusText = document.getElementById('agent-status');

// Helper to append logs to UI
function appendLog(text, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.textContent = `[${time}] ${text}`;
    consoleLogs.appendChild(entry);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// Listen for logs from Firestore
const logsQuery = query(collection(db, "antigravity_logs"), orderBy("timestamp", "desc"), limit(50));
onSnapshot(logsQuery, (snapshot) => {
    snapshot.docChanges().reverse().forEach((change) => {
        if (change.type === "added") {
            const data = change.doc.data();
            appendLog(data.text, data.type || 'agent');
        }
    });
});

// Send command to Firestore
async function sendCommand(text) {
    if (!text.trim()) return;
    
    appendLog(text, 'user');
    try {
        await addDoc(collection(db, "antigravity_commands"), {
            text: text,
            status: "pending",
            timestamp: serverTimestamp()
        });
        commandInput.value = '';
    } catch (e) {
        appendLog("Failed to send command: " + e.message, 'error');
    }
}

commandForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendCommand(commandInput.value);
});

// Quick Action Buttons
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        sendCommand(cmd);
        
        // Custom logic for specific buttons
        if (cmd === 'Run Chartink Scan') {
            appendLog("Scanning large cap stocks...", "agent");
            setTimeout(() => {
                window.location.href = 'screener.html';
            }, 1500);
        }
    });
});

clearLogsBtn.addEventListener('click', () => {
    consoleLogs.innerHTML = '';
    appendLog("Logs cleared locally.", "system");
});

// Simulate Metrics update
setInterval(() => {
    const cpuBar = document.querySelector('.metric-card:nth-child(2) .bar-fill');
    const randomCpu = Math.floor(Math.random() * 20) + 5;
    cpuBar.style.width = randomCpu + '%';
}, 3000);
