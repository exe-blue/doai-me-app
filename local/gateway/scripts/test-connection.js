/**
 * DoAi.Me E2E Connection Test
 * Tests: Device (LAIXI) -> Node (Gateway) -> Network -> Server (Cloud)
 * Usage: node scripts/test-connection.js
 */

const http = require('http');
const WebSocket = require('ws');

const TESTS = {
    laixi: { url: 'ws://127.0.0.1:22221/', name: 'LAIXI (Device->Node)', type: 'ws', optional: true },
    localGW: { url: 'http://localhost:3100/health', name: 'Local Gateway', type: 'http' },
    cloudGW: { url: 'http://158.247.210.152:3100/health', name: 'Cloud Gateway', type: 'http' },
    nodes: { url: 'http://158.247.210.152:3100/api/nodes', name: 'Node Registration', type: 'json' }
};

const TIMEOUT = 5000;

function testHttp(url) {
    return new Promise(resolve => {
        const timeout = setTimeout(() => resolve({ ok: false, error: 'Timeout' }), TIMEOUT);
        http.get(url, res => {
            clearTimeout(timeout);
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ ok: res.statusCode === 200, data }));
        }).on('error', err => { clearTimeout(timeout); resolve({ ok: false, error: err.message }); });
    });
}

function testWs(url) {
    return new Promise(resolve => {
        const timeout = setTimeout(() => { ws.close(); resolve({ ok: false, error: 'Timeout' }); }, TIMEOUT);
        const ws = new WebSocket(url);
        ws.on('open', () => { clearTimeout(timeout); ws.close(); resolve({ ok: true }); });
        ws.on('error', err => { clearTimeout(timeout); resolve({ ok: false, error: err.message }); });
    });
}

async function main() {
    console.log('\n=== DoAi.Me Connection Test ===\n');
    let critical = 0;

    for (const [k, t] of Object.entries(TESTS)) {
        process.stdout.write('  ' + t.name + '... ');
        const r = t.type === 'ws' ? await testWs(t.url) : await testHttp(t.url);

        if (r.ok) {
            console.log('\x1b[32mOK\x1b[0m');
        } else if (t.optional) {
            console.log('\x1b[33m(optional)\x1b[0m');
        } else {
            console.log('\x1b[31mFAILED\x1b[0m');
            critical++;
        }
    }

    console.log('\n' + (critical === 0 ? 'All OK' : critical + ' failed') + '\n');
    process.exit(critical === 0 ? 0 : 1);
}

main();
