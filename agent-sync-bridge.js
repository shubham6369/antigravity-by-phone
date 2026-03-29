const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const firebaseConfig = {
    projectId: "antigravity-by-phone"
};

try {
    const adminApp = initializeApp(firebaseConfig);
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
                
                // Print task in terminal for the agent to see
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
    console.error("Agent Sync failed to start. Ensure you are logged into Firebase: `firebase login`", e.message);
}
