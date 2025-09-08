// /lib/proxy.js
import proxyAgent from 'https-proxy-agent';
const { HttpsProxyAgent } = proxyAgent;

export async function testProxyUrl(url) {
    const started = Date.now();
    try {
        const agent = new HttpsProxyAgent(url);
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch('https://api.ipify.org?format=json', { agent, signal: ctrl.signal });
        clearTimeout(to);
        const json = await r.json().catch(() => ({}));
        const latencyMs = Date.now() - started;
        return { ok: r.ok, ip: json?.ip || null, latencyMs };
    } catch (e) {
        return { ok: false, error: e?.message || String(e), latencyMs: Date.now() - started };
    }
}
