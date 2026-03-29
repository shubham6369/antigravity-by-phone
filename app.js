// Antigravity Mobile Command Center - Firebase Integration with Full Control
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, deleteDoc, doc, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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

// Global Delete Function for Logs
async function deleteLog(docId) {
    try {
        await deleteDoc(doc(db, "antigravity_logs", docId));
        console.log("Log deleted:", docId);
    } catch (e) {
        console.error("Delete failed:", e);
    }
}

// Global Clear All Function
async function clearAllLogs() {
    if (!confirm("Are you sure you want to WIPE all logs?")) return;
    
    try {
        const q = query(collection(db, "antigravity_logs"));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        consoleLogs.innerHTML = '';
        appendLog("All logs cleared from database.", "system");
    } catch (e) {
        console.error("Clear failed:", e);
    }
}

// Expose functions to global scope for HTML onclick
window.deleteLog = deleteLog;
window.clearAllLogs = clearAllLogs;

// Helper to append logs to UI with individual delete control
function appendLog(text, type = 'system', docId = null) {
    if (!consoleLogs) return;
    
    // Check if log already exists in UI (to prevent doubles on sync)
    if (docId && document.getElementById(`log-${docId}`)) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    if (docId) entry.id = `log-${docId}`;
    
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    
    let deleteBtnHtml = docId ? `<button class="delete-btn" onclick="deleteLog('${docId}')">✕</button>` : '';
    
    entry.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%;">
            <span><span style="opacity: 0.5; font-size: 0.7rem;">[${timestamp}]</span> ${text}</span>
            ${deleteBtnHtml}
        </div>
    `;
    
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
        appendLog(`Error: ${e.message}`, 'error');
        setAgentState('idle', 'AGENT READY');
    }
}

window.sendTask = sendTask;

// Handle Form Submit
commandForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const task = commandInput.value;
    sendTask(task);
    commandInput.value = '';
});

// Real-time Logs Listener
const q = query(collection(db, "antigravity_logs"), orderBy("timestamp", "asc"));
onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
            const data = change.doc.data();
            appendLog(data.text, data.type, change.doc.id);
            
            if (data.text.includes("Task Completed") || data.text.includes("COMPLETED")) {
                setAgentState('idle', 'AGENT READY');
            }
        }
        if (change.type === "removed") {
            const el = document.getElementById(`log-${change.doc.id}`);
            if (el) el.remove();
        }
    });
});

console.log("Antigravity Control Dashboard Fully Initialized.");
