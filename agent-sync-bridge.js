const https = require('https');

const PROJECT_ID = "antigravity-by-phone";
const DATABASE_ID = "(default)";
const COLLECTION = "antigravity_commands";

function getPendingCommands() {
    // Firestore REST API for a simple list (limited to public rules or open rules)
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${COLLECTION}`;

    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.documents) {
                    json.documents.forEach(doc => {
                        const fields = doc.fields;
                        if (fields.status && fields.status.stringValue === "pending") {
                            const task = fields.text ? fields.text.stringValue : "Untitled Task";
                            console.log(`\n[AGENT TASK RECEIVED]: ${task}`);
                            console.log(`📡 Status: LOGGED ON TERMINAL\n`);

                            // We'd normally update the status here via PATCH, 
                            // but for a simple "Ready for Work" bridge, 
                            // just printing it to the terminal is enough for me to see!
                        }
                    });
                }
            } catch (e) {
                // Silently wait for the next poll
            }
        });
    }).on('error', (err) => {
        console.error("❌ Network error. Retrying in 5s...");
    });
}

console.log(`\n-----------------------------------------`);
console.log(`🚀 ANTIGRAVITY AGENT SYNC ACTIVE (REST)`);
console.log(`📡 MONITORING FOR MOBILE TASKS...`);
console.log(`-----------------------------------------\n`);

// Polling every 5 seconds
setInterval(getPendingCommands, 5000);
getPendingCommands();
