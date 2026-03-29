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

const consoleLogs = document.getElementById('console');
const commandForm = document.getElementById('command-form');
const commandInput = document.getElementById('command-input');
const clearLogsBtn = document.getElementById('clear-logs');
const agentStatePanel = document.getElementById('agent-state-panel');
const agentStateText = document.getElementById('agent-state-text');
const currentGoalText = document.getElementById('current-goal');

// Update Agent State UI
function setAgentState(state, text) {
    if (agentStatePanel) agentStatePanel.className = `agent-state ${state}`;
    if (agentStateText) agentStateText.innerText = text.toUpperCase();
    if (state !== 'idle' && currentGoalText) {
        currentGoalText.innerText = text;
    }
}

// Helper to append logs to UI
function appendLog(text, type = 'system') {
    if (!consoleLogs) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    entry.innerHTML = `<span style="opacity: 0.5">[${timestamp}]</span> ${text}`;
    
    consoleLogs.appendChild(entry);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// Send Task to Antigravity
async function sendTask(taskText) {
    if (!taskText || !taskText.trim()) return;
    
    appendLog(taskText, 'user');
    setAgentState('thinking', 'Analyzing Task...');

    try {
        await addDoc(collection(db, "antigravity_commands"), {
            text: taskText,
            status: "pending",
            type: "agent_task",
            timestamp: serverTimestamp()
        });
        
        setTimeout(() => {
            setAgentState('working', `Working on: ${taskText}`);
        }, 1000);

    } catch (e) {
        appendLog(`Error sending task: ${e.message}`, 'error');
        setAgentState('idle', 'AGENT READY');
    }
}

// Attach sendTask to global window for onclick handlers
window.sendTask = sendTask;

// Handle Form Submit
commandForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const task = commandInput.value;
    sendTask(task);
    commandInput.value = '';
});

// Clear Logs
clearLogsBtn.addEventListener('click', () => {
    consoleLogs.innerHTML = '';
    appendLog("Logs cleared.", "system");
});

// Real-time Logs Listener
const q = query(collection(db, "antigravity_logs"), orderBy("timestamp", "desc"), limit(20));
onSnapshot(q, (snapshot) => {
    snapshot.docChanges().reverse().forEach((change) => {
        if (change.type === "added") {
            const data = change.doc.data();
            appendLog(data.text, data.type);
            
            // If task completes, return to idle
            if (data.text.includes("Task Completed") || data.text.includes("COMPLETED")) {
                setAgentState('idle', 'AGENT READY');
                currentGoalText.innerText = "Task finished. Standing by.";
            }
        }
    });
});

console.log("Antigravity Module Fully Initialized.");
