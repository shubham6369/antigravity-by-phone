const https = require('https');

const PROJECT_ID = "antigravity-by-phone";
const DATABASE_ID = "(default)";
const COMMANDS_COLLECTION = "antigravity_commands";
const LOGS_COLLECTION = "antigravity_logs";

// Helper to post a log to Firestore REST API
function postLog(text, type = "system") {
    const postData = JSON.stringify({
        fields: {
            text: { stringValue: text },
            type: { stringValue: type },
            timestamp: { timestampValue: new Date().toISOString() }
        }
    });

    const options = {
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${LOGS_COLLECTION}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {});
    req.on('error', (e) => console.error(`Error logging to Firestore: ${e.message}`));
    req.write(postData);
    req.end();
}

function getPendingCommands() {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${COMMANDS_COLLECTION}`;

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
                            postLog(`Working on: ${task}`, "agent");
                            
                            // Here we would PATCH the document to 'received', 
                            // but for simplicity, the console output confirms it.
                        }
                    });
                }
            } catch (e) {}
        });
    });
}

console.log(`\n-----------------------------------------`);
console.log(`🚀 ANTIGRAVITY AGENT SYNC ACTIVE`);
console.log(`📡 MONITORING FOR MOBILE TASKS...`);
console.log(`-----------------------------------------\n`);

// Initialize mobile sync
postLog("TERMINAL: ONLINE. Ready for mobile tasks.", "system");

setInterval(getPendingCommands, 5000);
getPendingCommands();
