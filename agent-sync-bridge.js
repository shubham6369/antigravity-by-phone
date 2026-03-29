const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, 'service-account.json');
const projectId = "antigravity-by-phone";

let adminApp;

try {
    if (fs.existsSync(serviceAccountPath)) {
        console.log("✅ Using Service Account Key: service-account.json");
        adminApp = initializeApp({
            credential: cert(serviceAccountPath),
            projectId: projectId
        });
    } else {
        console.log("⚠️ No service-account.json found. Trying Default Credentials...");
        adminApp = initializeApp({
            projectId: projectId
        });
    }

    const db = getFirestore(adminApp);

    console.log(`\n-----------------------------------------`);
    console.log(`🚀 ANTIGRAVITY AGENT SYNC ACTIVE`);
    console.log(`📡 MONITORING FOR MOBILE TASKS...`);
    console.log(`-----------------------------------------\n`);

    const commandsRef = db.collection('antigravity_commands');
    const query = commandsRef.where('status', '==', 'pending').orderBy('timestamp', 'asc');

    query.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const cmdDoc = change.doc;
                const cmd = cmdDoc.data();
                
                console.log(`\n[AGENT TASK RECEIVED]: ${cmd.text}`);
                console.log(`Status: PENDING EXECUTION\n`);

                await cmdDoc.ref.update({ status: 'received_by_agent' });

                // Log awareness back to mobile dashboard
                await db.collection('antigravity_logs').add({
                    text: `Antigravity received task: "${cmd.text}". Starting work...`,
                    type: 'agent',
                    timestamp: FieldValue.serverTimestamp()
                });
            }
        });
    });

} catch (e) {
    console.error("\n❌ Agent Sync failed to start!");
    console.log(`Error: ${e.message}`);
    console.log(`\nTo fix this:`);
    console.log(`1. Run 'firebase login' in your local terminal.`);
    console.log(`2. OR download a Service Account Key (JSON) from Firebase Console and name it 'service-account.json'.\n`);
}
