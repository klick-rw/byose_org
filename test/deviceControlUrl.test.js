// Run with: npm test   (node --test test/*.test.js)
import {test} from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import {pickControlServer, deviceLogsUrl} from '../src/utils/deviceControlUrl.js';

const VERCEL = 'https://api.presence-eye.byose.info';
const APP_ENGINE = 'https://presence-eye.byose.info';

test('without the control variable, device control keeps using the normal server (nothing changes)', () => {
    assert.strictEqual(pickControlServer({VITE_PRESENCE_EYE_SERVER_URL: VERCEL}), VERCEL);
    assert.strictEqual(pickControlServer({VITE_PRESENCE_EYE_SERVER_URL: VERCEL, VITE_PRESENCE_EYE_CONTROL_SERVER_URL: ''}), VERCEL);
    assert.strictEqual(pickControlServer({VITE_PRESENCE_EYE_SERVER_URL: VERCEL, VITE_PRESENCE_EYE_CONTROL_SERVER_URL: undefined}), VERCEL);
});

test('with the control variable, device control goes to it and the normal server is untouched', () => {
    const env = {VITE_PRESENCE_EYE_SERVER_URL: VERCEL, VITE_PRESENCE_EYE_CONTROL_SERVER_URL: APP_ENGINE};
    assert.strictEqual(pickControlServer(env), APP_ENGINE);
    assert.strictEqual(env.VITE_PRESENCE_EYE_SERVER_URL, VERCEL);
});

test('the lock/unlock logs URL is exactly the one the backend route serves', () => {
    assert.strictEqual(
        deviceLogsUrl(APP_ENGINE, 'REMOTE-1767109990004'),
        'https://presence-eye.byose.info/api/admin/remotes/REMOTE-1767109990004/logs',
    );
    // identical to what the portal built before this change when the base is the normal server
    assert.strictEqual(
        deviceLogsUrl(VERCEL, 'REMOTE-1'),
        `${VERCEL}/api/admin/remotes/REMOTE-1/logs`,
    );
});

test('only the logs toggle moved: the modal builds that URL from the control server, everything else still uses the normal one', () => {
    const modal = readFileSync(new URL('../src/components/RemoteDetailsModal.jsx', import.meta.url), 'utf8');
    assert.match(modal, /deviceLogsUrl\(presence_control_server, remote\.serialNumber\)/);
    assert.ok(!/\$\{presence_server\}\/api\/admin\/remotes\/\$\{remote\.serialNumber\}\/logs/.test(modal));
    assert.match(modal, /presence_server \+ "\/api\/admin\/get-qrCode"/);       // the QR call is unchanged
});

test('server_api exports the control server, defaulting through the same rule', () => {
    const config = readFileSync(new URL('../src/config/server_api.js', import.meta.url), 'utf8');
    assert.match(config, /export const presence_control_server = pickControlServer\(import\.meta\.env\);/);
});
