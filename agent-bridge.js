const { initializeApp } = require('firebase/app');
const { 
    getFirestore, 
    doc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    where, 
    orderBy, 
    serverTimestamp 
} = require('firebase/firestore');
const { exec } = require('child_process');
const screenshot = require('screenshot-desktop');
const { Jimp } = require('jimp');
const path = require('path');
const os = require('os');

// FIREBASE CONFIG (Sync with app.js)
const firebaseConfig = {
    apiKey: "AIzaSyAN8gmDvohf52wvXMyIC9wh8ZtRRj6_EKc",
    authDomain: "antigravity-by-phone.firebaseapp.com",
    projectId: "antigravity-by-phone",
    storageBucket: "antigravity-by-phone.firebasestorage.app",
    messagingSenderId: "176099404006",
    appId: "1:176099404006:web:205becd24f4567f2b83327",
    measurementId: "G-K0BPQX88GS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentCwd = process.cwd();

// References
const statusRef = doc(db, 'antigravity_mirror', 'status');
const mirrorRef = doc(db, 'antigravity_mirror', 'screen');
const logsColl = collection(db, 'antigravity_logs');
const commandsColl = collection(db, 'antigravity_commands');
const inputsColl = collection(db, 'antigravity_remote_inputs');

console.log(`\n-----------------------------------------`);
console.log(`🚀 ANTIGRAVITY AGENT BRIDGE v2.2 (Web SDK)`);
console.log(`📁 CWD: ${currentCwd}`);
console.log(`🖥️  OS: ${os.type()} ${os.release()}`);
console.log(`📡 Project: ${firebaseConfig.projectId}`);
console.log(`-----------------------------------------\n`);

// Helper to update status
async function updateStatus(data) {
    try {
        await setDoc(statusRef, {
            ...data,
            lastUpdate: serverTimestamp(),
            active: true,
            cwd: currentCwd
        }, { merge: true });
    } catch (e) {
        console.error("Status Update Error:", e.message);
    }
}

// --- SCREEN SYNC (MIRRORING) ---
let isMirroring = true;
async function syncScreen() {
    if (!isMirroring) return;
    try {
        const imgBuffer = await screenshot({ format: 'jpg' });
        const image = await Jimp.read(imgBuffer);
        
        const origWidth = image.bitmap.width;
        const origHeight = image.bitmap.height;

        // Heartbeat with resolution data
        await updateStatus({
            screenWidth: origWidth,
            screenHeight: origHeight
        });

        // Resize for mobile performance & Firebase limits
        image.resize({ w: 854 }); 
        const base64 = await image.getBase64("image/jpeg", { quality: 40 });

        await setDoc(mirrorRef, {
            data: base64,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        console.warn("Screen Sync Warning:", err.message);
    }
    setTimeout(syncScreen, 2000); // 2s interval
}

// --- REMOTE INPUT RELAY (POWERSHELL) ---
function startInputListener() {
    const q = query(inputsColl, where('status', '==', 'pending'));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const inputDoc = change.doc;
                const { type, x, y, key } = inputDoc.data();
                
                try {
                    await updateDoc(inputDoc.ref, { status: 'processed' });
                    console.log(`[REMOTE]: ${type} at ${x},${y} ${key || ''}`);

                    let psCommand = "";
                    if (type === 'click' || type === 'move') {
                        psCommand = `[Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y});`;
                        if (type === 'click') {
                            psCommand += ` $sign = '[DllImport(\"user32.dll\")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);'; ` +
                                        `Add-Type -MemberDefinition $sign -Name 'Win32MouseEvent' -Namespace Win32; ` +
                                        `[Win32.Win32MouseEvent]::mouse_event(0x0002, 0, 0, 0, 0); ` +
                                        `[Win32.Win32MouseEvent]::mouse_event(0x0004, 0, 0, 0, 0);`;
                        }
                    } else if (type === 'key') {
                        const safeKey = key.replace(/'/g, "''");
                        psCommand = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${safeKey}')`;
                    }

                    if (psCommand) {
                        exec(`powershell -ExecutionPolicy Bypass -Command "${psCommand}"`, (err) => {
                            if (err) console.error("Input Error:", err.message);
                        });
                    }
                } catch (e) {
                    console.error("Input Processing Error:", e.message);
                }
            }
        });
    }, err => console.error("Snapshot Error (Input):", err.message));
}

// --- COMMAND LISTENER ---
function startCommandListener() {
    const q = query(commandsColl, where('status', '==', 'pending'));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const cmdDoc = change.doc;
                const { text: cmdText } = cmdDoc.data();
                
                console.log(`\n[MOBILE TASK]: ${cmdText}`);
                
                try {
                    await updateDoc(cmdDoc.ref, { status: 'executing' });
                    await updateStatus({ 
                        currentTask: `Executing: ${cmdText}`,
                        tool: "Shell"
                    });

                    const proc = exec(cmdText, { cwd: currentCwd, shell: 'powershell.exe' });
                    let output = "";

                    proc.stdout.on('data', data => { output += data; process.stdout.write(data); });
                    proc.stderr.on('data', data => { output += `\nERROR: ${data}`; process.stderr.write(data); });

                    proc.on('close', async code => {
                        console.log(`\n✅ [DONE]: ${cmdText}`);

                        if (cmdText.trim().startsWith('cd ')) {
                            const newDir = cmdText.trim().substring(3).replace(/["']/g, '');
                            currentCwd = path.resolve(currentCwd, newDir);
                        }

                        await addDoc(logsColl, {
                            text: output || "[SUCCESS]",
                            type: code === 0 ? 'agent' : 'error',
                            timestamp: serverTimestamp()
                        });

                        await updateDoc(cmdDoc.ref, { status: 'completed' });
                        await updateStatus({ currentTask: "Idle", tool: "Idle" });
                    });
                } catch (e) {
                    console.error("Command Processing Error:", e.message);
                }
            }
        });
    }, err => console.error("Snapshot Error (Command):", err.message));
}

// Cleanup
process.on('SIGINT', async () => {
    console.log("\n🛑 Stopping Bridge...");
    isMirroring = false;
    try {
        await updateDoc(statusRef, { active: false, tool: "Offline" });
    } catch (e) {}
    process.exit();
});

// START
(async () => {
    await updateStatus({ currentTask: "Online", tool: "Idle" });
    syncScreen();
    startInputListener();
    startCommandListener();
})();
