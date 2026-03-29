const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { exec } = require('child_process');
const path = require('path');

const firebaseConfig = {
    projectId: "antigravity-by-phone"
};

let currentCwd = process.cwd();

try {
    const adminApp = initializeApp(firebaseConfig);
    const db = getFirestore(adminApp);

    console.log(`\n-----------------------------------------`);
    console.log(`🚀 ANTIGRAVITY REMOTE TERMINAL ACTIVE`);
    console.log(`📁 CWD: ${currentCwd}`);
    console.log(`-----------------------------------------\n`);

    const commandsRef = db.collection('antigravity_commands');
    const query = commandsRef.where('status', '==', 'pending').orderBy('timestamp', 'asc');

    query.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const cmdDoc = change.doc;
                const cmd = cmdDoc.data();
                
                console.log(`\n[INCOMING]: ${cmd.text}`);
                await cmdDoc.ref.update({ status: 'executing' });

                // Execute command in the local shell
                exec(cmd.text, { cwd: currentCwd, shell: 'powershell.exe' }, async (error, stdout, stderr) => {
                    let fullOutput = "";
                    
                    if (stdout) {
                        console.log(stdout);
                        fullOutput += stdout;
                    }
                    if (stderr) {
                        console.error(stderr);
                        fullOutput += `\nERROR: ${stderr}`;
                    }
                    if (error && !stderr) {
                        fullOutput += `\nEXEC ERROR: ${error.message}`;
                    }

                    // Handle 'cd' commands to update the persistent directory state
                    if (cmd.text.trim().startsWith('cd ')) {
                        const newDir = cmd.text.trim().substring(3).replace(/["']/g, '');
                        currentCwd = path.resolve(currentCwd, newDir);
                        fullOutput += `\n[DIRECTORY CHANGED]: ${currentCwd}`;
                    }

                    // Log output back to Firestore
                    await db.collection('antigravity_logs').add({
                        text: fullOutput || "[COMMAND EXECUTED - NO OUTPUT]",
                        type: stderr || error ? 'error' : 'agent',
                        timestamp: FieldValue.serverTimestamp()
                    });

                    await cmdDoc.ref.update({ status: 'completed' });
                    console.log(`[COMPLETED]: ${cmd.text}`);
                });
            }
        });
    });

} catch (e) {
    console.error("Bridge failed to start. Ensure you are logged into Firebase: `firebase login`", e.message);
}
