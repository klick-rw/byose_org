// Maintenance: the jobs that used to be terminal scripts on the backend, for an administrator. Every job PREVIEWS first and changes data only after a
// confirmation. The scripts (backend/scripts) do the same work from a terminal. A read-only account can look but the server refuses its changes.
import {useCallback, useEffect, useState} from 'react';
import {AlertCircle, CheckCircle2, Clock, Image as ImageIcon, KeyRound, RefreshCw, Wrench, Camera} from 'lucide-react';
import {fetchData, returnToken, sendData} from '../../utils/helper.js';
import {presence_server} from '../../config/server_api.js';

const API = `${presence_server}/api/admin`;
const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—');
const mb = (bytes) => `${((bytes || 0) / 1048576).toFixed(1)} MB`;

const Card = ({title, icon: Icon, intro, children}) => (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold text-slate-800"><Icon className="w-5 h-5 text-slate-500"/>{title}</div>
        {intro && <p className="text-xs text-slate-500">{intro}</p>}
        {children}
    </section>
);

const Banner = ({banner}) => !banner ? null : (
    <div className={`flex gap-2 rounded-lg px-3 py-2 text-xs ${banner.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
        {banner.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0"/> : <AlertCircle className="w-4 h-4 shrink-0"/>}
        <span>{banner.text}</span>
    </div>
);

const Stat = ({label, value}) => (
    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
);

const Btn = ({children, onClick, disabled, tone = 'primary'}) => (
    <button onClick={onClick} disabled={disabled}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${tone === 'primary' ? 'bg-[#195C51] text-white hover:opacity-90' : tone === 'danger' ? 'bg-red-600 text-white hover:opacity-90' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
        {children}
    </button>
);

/** A change that needs a second click: shows the question, then Confirm / Back. */
function Confirm({question, onConfirm, busy, onCancel}) {
    return (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
            <span>{question}</span>
            <button onClick={onConfirm} disabled={busy} className="rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">{busy ? 'Working…' : 'Confirm'}</button>
            <button onClick={onCancel} disabled={busy} className="font-semibold text-slate-500 hover:underline">Back</button>
        </div>
    );
}

/** POST helper that reports a server message in the card instead of the global popup. */
async function post(url, body, setBanner) {
    const res = await sendData(url, body, returnToken(), (msg) => setBanner({kind: 'error', text: msg}));
    return res.data === -1 ? null : res.data;
}

// ── 1. Merge close online windows ────────────────────────────────────────────────────────────────────────────────────────────────────────────
function MergeWindowsCard() {
    const [threshold, setThreshold] = useState(10);
    const [report, setReport] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [banner, setBanner] = useState(null);

    const run = async (apply) => {
        setBusy(true); setBanner(null);
        const r = await post(`${API}/maintenance/merge-windows`, {thresholdSeconds: Number(threshold), apply, confirm: apply}, setBanner);
        setBusy(false); setConfirming(false);
        if (!r) return;
        setReport(r);
        if (apply) setBanner({kind: 'ok', text: r.complete ? `Done: ${r.windowsEliminated} windows merged in ${r.affected} sessions.` : `Partly done: ${r.windowsEliminated} windows merged so far. Press Preview, then apply again to continue.`});
        else if (!r.complete) setBanner({kind: 'error', text: 'The preview stopped at the time limit and covers only part of the history. Applying and repeating will converge; for one complete count use the script.'});
    };

    return (
        <Card title="Merge close online windows" icon={Clock}
              intro="A server bug used to split one continuous connection into several online windows a few seconds apart, which inflates the offline-incident counts. This joins windows whose gap is at most the threshold and recomputes each camera's online time. The same job as backend/scripts/mergecloseWindows.js.">
            <label className="block text-xs text-slate-500">Largest gap to merge, in seconds (1 to 300)
                <input type="number" min={1} max={300} value={threshold} onChange={(e) => { setThreshold(e.target.value); setReport(null); setConfirming(false); }}
                       className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"/>
            </label>
            <div className="flex gap-3"><Btn onClick={() => run(false)} disabled={busy} tone="secondary"><RefreshCw className="w-4 h-4"/>Preview</Btn>
                {report && report.dryRun && report.affected > 0 && !confirming && <Btn onClick={() => setConfirming(true)} disabled={busy}>Apply…</Btn>}</div>
            {report && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Stat label="Sessions read" value={`${report.processed} / ${report.totalSessions}`}/>
                    <Stat label="Sessions to change" value={report.affected}/>
                    <Stat label="Windows before → after" value={`${report.windowsBefore} → ${report.windowsAfter}`}/>
                    <Stat label="Windows removed" value={report.windowsEliminated}/>
                </div>
            )}
            {confirming && <Confirm busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => run(true)}
                                    question={`Merge gaps of ${threshold} s or less in ${report ? report.affected : ''} sessions? This rewrites stored history and cannot be undone.`}/>}
            <Banner banner={banner}/>
        </Card>
    );
}

// ── 2. Orphan photo clean-up ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function OrphanImagesCard() {
    const [graceHours, setGraceHours] = useState(48);
    const [maxDelete, setMaxDelete] = useState(500);
    const [report, setReport] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [banner, setBanner] = useState(null);

    const run = async (apply) => {
        setBusy(true); setBanner(null);
        const r = await post(`${API}/maintenance/orphan-images`, {graceHours: Number(graceHours), maxDelete: Number(maxDelete), apply, confirm: apply}, setBanner);
        setBusy(false); setConfirming(false);
        if (!r) return;
        setReport(r);
        if (r.aborted) setBanner({kind: 'error', text: r.aborted});
        else if (apply) setBanner({kind: 'ok', text: `Deleted ${r.deleted} photos${r.failed ? `, ${r.failed} failed` : ''}${r.capped ? `, ${r.capped} more remain (run again)` : ''}.`});
    };

    return (
        <Card title="Clean up orphan photos" icon={ImageIcon}
              intro="Finds gate photos on Cloudinary that no event or notification refers to any more (they are personal pictures and cost storage). Only our own vehicle photos older than the grace period are ever candidates. The same job as backend/scripts/sweep-orphan-images.js.">
            <div className="grid grid-cols-2 gap-3 max-w-sm">
                <label className="text-xs text-slate-500">Grace period (hours)
                    <input type="number" min={1} value={graceHours} onChange={(e) => { setGraceHours(e.target.value); setReport(null); }}
                           className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"/></label>
                <label className="text-xs text-slate-500">Delete at most
                    <input type="number" min={1} max={2000} value={maxDelete} onChange={(e) => { setMaxDelete(e.target.value); setReport(null); }}
                           className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"/></label>
            </div>
            <div className="flex gap-3"><Btn onClick={() => run(false)} disabled={busy} tone="secondary"><RefreshCw className="w-4 h-4"/>Preview</Btn>
                {report && report.dryRun && !report.aborted && report.orphanCount > 0 && !confirming && <Btn onClick={() => setConfirming(true)} disabled={busy} tone="danger">Delete…</Btn>}</div>
            {report && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Stat label="Photos listed" value={report.scanned}/>
                        <Stat label="Ours / in use" value={`${report.ours} / ${report.referenced}`}/>
                        <Stat label="Too recent" value={report.tooYoung}/>
                        <Stat label="Orphans" value={`${report.orphanCount} (${mb(report.orphanBytes)})`}/>
                    </div>
                    {report.orphans.length > 0 && (
                        <details className="text-xs text-slate-500"><summary className="cursor-pointer font-semibold text-slate-600">Oldest {report.orphansShown} orphans</summary>
                            <ul className="mt-2 space-y-0.5 font-mono">{report.orphans.map((o) => <li key={o.publicId}>{fmt(o.createdAt)} · {o.publicId} · {mb(o.bytes)}</li>)}</ul></details>
                    )}
                </>
            )}
            {confirming && <Confirm busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => run(true)}
                                    question={`Permanently delete up to ${Math.min(maxDelete, report ? report.orphanCount : 0)} photos from Cloudinary? This cannot be undone.`}/>}
            <Banner banner={banner}/>
        </Card>
    );
}

// ── 3. Camera status keys (the rotating key cameras use to encrypt their MQTT status) ─────────────────────────────────────────────────────
function StatusKeysCard() {
    const [status, setStatus] = useState(null);
    const [banner, setBanner] = useState(null);
    const [busy, setBusy] = useState(false);
    const [action, setAction] = useState(null);          // 'rotate' | 'use-on' | 'use-off'
    const [revokePrevious, setRevokePrevious] = useState(false);

    const load = useCallback(async () => {
        const res = await fetchData(`${API}/mqtt-keys`, returnToken(), (msg) => setBanner({kind: 'error', text: msg}));
        if (res.data !== -1) setStatus(res.data);
    }, []);
    useEffect(() => { load(); }, [load]);

    const go = async () => {
        setBusy(true); setBanner(null);
        const r = action === 'rotate'
            ? await post(`${API}/mqtt-keys/rotate`, {confirm: true, revokePrevious}, setBanner)
            : await post(`${API}/mqtt-keys/devices-use-keys`, {enabled: action === 'use-on', confirm: true}, setBanner);
        setBusy(false); setAction(null);
        if (r) { setStatus(r.current !== undefined ? r : status); setBanner({kind: 'ok', text: 'Done.'}); load(); }
    };

    const lg = status && status.legacy;
    return (
        <Card title="Camera status keys" icon={KeyRound}
              intro="Cameras encrypt their status with a key that rotates every 90 days. Same as backend/scripts/rotate-mqtt-key.js and devices-use-keys.js.">
            {status && !status.enabled && <Banner banner={{kind: 'error', text: status.message}}/>}
            {status && status.enabled && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Stat label="Current key" value={status.current ? status.current.kid : '—'}/>
                        <Stat label="Rotates in" value={status.current ? `${status.current.daysUntilRotation} days` : '—'}/>
                        <Stat label="Cameras use keys" value={status.devicesUseKeys ? 'ON' : 'OFF'}/>
                        <Stat label="Cameras on the old key" value={lg ? `${lg.onLegacy} of ${lg.activeDevices}` : '—'}/>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={revokePrevious} onChange={(e) => setRevokePrevious(e.target.checked)}/>
                        When rotating, stop accepting the previous key at once (lost or stolen camera)</label>
                    <div className="flex flex-wrap gap-3">
                        <Btn tone="secondary" disabled={busy} onClick={() => setAction('rotate')}>Rotate the key now…</Btn>
                        <Btn tone="secondary" disabled={busy} onClick={() => setAction(status.devicesUseKeys ? 'use-off' : 'use-on')}>{status.devicesUseKeys ? 'Turn “cameras use keys” off…' : 'Turn “cameras use keys” on…'}</Btn>
                    </div>
                </>
            )}
            {action && <Confirm busy={busy} onCancel={() => setAction(null)} onConfirm={go}
                                question={action === 'rotate' ? 'Make a new current key now?' : action === 'use-on'
                                    ? 'Turn ON? Apps older than 3.5.0 will show keyed cameras as offline.' : 'Turn OFF? Cameras return to the old shared key within about 5 minutes.'}/>}
            <Banner banner={banner}/>
        </Card>
    );
}

// ── 4. Camera keys (one per camera: claim code, revoke) ──────────────────────────────────────────────────────────────────────────────────
function CameraKeysCard() {
    const [rows, setRows] = useState(null);
    const [banner, setBanner] = useState(null);
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState(null);        // {serial}
    const [code, setCode] = useState(null);

    const load = useCallback(async () => {
        const res = await fetchData(`${API}/device-credentials`, returnToken(), (msg) => setBanner({kind: 'error', text: msg}));
        if (res.data !== -1) setRows(res.data.devices || []);
    }, []);
    useEffect(() => { load(); }, [load]);

    const claim = async (serial) => {
        setBusy(true); setBanner(null); setCode(null);
        const r = await post(`${API}/device-credentials/${serial}/claim-code`, {}, setBanner);
        setBusy(false);
        if (r) { setCode(r); load(); }
    };
    const revoke = async () => {
        setBusy(true); setBanner(null);
        const r = await post(`${API}/device-credentials/${pending.serial}/revoke`, {confirm: true}, setBanner);
        setBusy(false); setPending(null);
        if (r) { setBanner({kind: 'ok', text: `The key of ${r.serial} was revoked; it stops working within a minute.`}); load(); }
    };

    return (
        <Card title="Camera keys" icon={Camera}
              intro="Each camera has its own key. Revoke a lost or stolen camera's key, or make a one-time claim code. Factory provisioning normally does this for new cameras. Same as backend/scripts/device-key.js.">
            {code && <Banner banner={{kind: 'ok', text: `Claim code for ${code.serial}: ${code.claimCode} (valid until ${fmt(code.expiresAt)}, works once, shown only now)`}}/>}
            {rows && (rows.length === 0 ? <p className="text-xs text-slate-500">No cameras have a key record yet.</p> : (
                <div className="overflow-x-auto"><table className="w-full text-xs text-left">
                    <thead className="text-slate-400"><tr><th className="py-1 pr-3">Camera</th><th className="pr-3">State</th><th className="pr-3">Last used</th><th/></tr></thead>
                    <tbody>{rows.map((d) => (
                        <tr key={d.serial} className="border-t border-slate-100">
                            <td className="py-1.5 pr-3 font-mono">{d.serial}{d.label ? <span className="ml-2 font-sans text-slate-400">{d.label}</span> : null}</td>
                            <td className="pr-3">{d.status}</td><td className="pr-3">{fmt(d.lastUsedAt)}</td>
                            <td className="text-right space-x-3 whitespace-nowrap">
                                <button disabled={busy} onClick={() => claim(d.serial)} className="font-semibold text-[#195C51] hover:underline">Claim code</button>
                                {d.status === 'claimed' && <button disabled={busy} onClick={() => setPending({serial: d.serial})} className="font-semibold text-red-600 hover:underline">Revoke</button>}
                            </td>
                        </tr>))}</tbody></table></div>
            ))}
            {pending && <Confirm busy={busy} onCancel={() => setPending(null)} onConfirm={revoke} question={`Revoke the key of ${pending.serial}? The camera stops working until it is claimed again.`}/>}
            <Banner banner={banner}/>
        </Card>
    );
}

export default function Maintenance() {
    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
            <div>
                <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800"><Wrench className="w-5 h-5"/>Maintenance</h1>
                <p className="text-xs text-slate-500 mt-1">Administrator tools. Each one previews first and asks before it changes anything. Every change is written to the audit log.</p>
            </div>
            <MergeWindowsCard/>
            <OrphanImagesCard/>
            <StatusKeysCard/>
            <CameraKeysCard/>
        </div>
    );
}
