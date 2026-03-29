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

    const req = https.request(options, (res) => {
        if (res.statusCode >= 400) {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                console.error(`❌ Firestore Sync Error (${res.statusCode}): ${body}`);
            });
        } else {
            // Success
        }
    });
    
    req.on('error', (e) => console.error(`❌ Network error: ${e.message}`));
    req.write(postData);
    req.end();
}

function getPendingCommands() {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${COMMANDS_COLLECTION}?mask.fieldPaths=status&mask.fieldPaths=text`;

    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.documents) {
                    json.documents.forEach(doc => {
                        const fields = doc.fields;
                        if (fields && fields.status && fields.status.stringValue === "pending") {
                            const task = fields.text ? fields.text.stringValue : "Untitled Task";
                            console.log(`\n✨ [MOBILE TASK RECEIVED]: ${task}`);
                            postLog(`Working on: ${task}`, "agent");
                            
                            // Log the receipt back to the dashboard immediately
                            postLog(`✅ Antigravity is processing: "${task}"`, "agent");
                        }
                    });
                }
            } catch (e) {
                // Silently skip if response is malformed or empty
            }
        });
    }).on('error', (e) => {
        console.error(`❌ Connection lost. Retrying...`);
    });
}

console.log(`\n=========================================`);
console.log(`🚀 ANTIGRAVITY AGENT SYNC ACTIVE`);
console.log(`📡 MONITORING FOR MOBILE TASKS...`);
console.log(`=========================================\n`);

// Initialize mobile sync with a visible startup log
postLog("Agent Sync Bridge: CONNECTED. Ready for tasks.", "system");

// Polling every 3 seconds for faster response
setInterval(getPendingCommands, 3000);
getPendingCommands();
