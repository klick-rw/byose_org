// Change an account's role from the user detail. Raising a role (user < special < factory < admin) sends the account's owner an emailed invitation with
// what the role allows and your notes; nothing changes until they accept. Anything else applies at once and they are told by email. The server decides
// which is which and enforces every rule (admin only, no self change, last admin, ...); this panel only shows the choices and the consequences.
import {useCallback, useEffect, useState} from 'react';
import {Send, ShieldCheck, Clock, X, AlertCircle, CheckCircle2} from 'lucide-react';
import {deleteData, fetchData, returnToken, sendData} from '../../utils/helper.js';
import {presence_server} from '../../config/server_api.js';

const ROLES = `${presence_server}/api/admin/roles`;
const NOTES_MAX = 1000;

const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—');
const STATUS_TEXT = {
    pending: 'waiting for an answer', accepted: 'accepted', rejected: 'declined', cancelled: 'cancelled', expired: 'expired',
    superseded: 'replaced', applied: 'applied at once',
};

export default function RoleChangePanel({userId, currentRole, onChanged}) {
    const [catalogue, setCatalogue] = useState([]);
    const [overview, setOverview] = useState({pending: null, history: []});
    const [role, setRole] = useState('');
    const [notes, setNotes] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [banner, setBanner] = useState(null);       // {kind: 'ok' | 'error', text}

    const refresh = useCallback(async () => {
        const res = await fetchData(`${ROLES}/users/${userId}`, returnToken());
        if (res.data !== -1) setOverview(res.data);
    }, [userId]);

    useEffect(() => {
        let alive = true;
        (async () => {
            const res = await fetchData(`${ROLES}/catalogue`, returnToken());
            if (alive && res.data !== -1) setCatalogue(res.data.roles || []);
        })();
        return () => { alive = false; };
    }, []);
    useEffect(() => { setRole(''); setNotes(''); setConfirming(false); setBanner(null); refresh(); }, [userId, refresh]);

    const info = (r) => catalogue.find((c) => c.role === r);
    const current = info(currentRole || 'user');
    const chosen = role ? info(role) : null;
    const raising = !!(chosen && current && chosen.rank > current.rank);

    const submit = async () => {
        setBusy(true);
        setBanner(null);
        const res = await sendData(`${ROLES}/users/${userId}`, {role, notes}, returnToken(), (msg) => setBanner({kind: 'error', text: msg}));
        setBusy(false);
        setConfirming(false);
        if (res.data === -1) return;
        if (res.data.mode === 'invited') setBanner({kind: 'ok', text: `Invitation sent. The role stays ${currentRole} until the account owner accepts it from the email (valid for 7 days).`});
        else setBanner({kind: 'ok', text: `The role is now ${res.data.toRole}.${res.data.notified ? ' The account owner was told by email.' : ' The email to the account owner could not be sent.'}`});
        setRole('');
        setNotes('');
        await refresh();
        if (res.data.mode === 'applied' && onChanged) onChanged();
    };

    const cancelInvite = async (id) => {
        setBusy(true);
        const res = await deleteData(`${ROLES}/invites/${id}`, returnToken(), (msg) => setBanner({kind: 'error', text: msg}));
        setBusy(false);
        if (res.data !== -1) { setBanner({kind: 'ok', text: 'Invitation cancelled.'}); await refresh(); }
    };

    const pending = overview.pending;
    return (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ShieldCheck className="w-4 h-4 text-slate-500"/> Change role
            </div>

            {pending && (
                <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                    <div className="flex gap-2">
                        <Clock className="w-4 h-4 shrink-0 mt-0.5"/>
                        <span>Invitation to become <b>{pending.toRole}</b> sent {fmt(pending.createdAt)} by {pending.requestedByEmail || 'an administrator'}, expires {fmt(pending.expiresAt)}.</span>
                    </div>
                    <button disabled={busy} onClick={() => cancelInvite(pending._id)} className="shrink-0 inline-flex items-center gap-1 font-semibold hover:underline">
                        <X className="w-3 h-3"/> Cancel
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-slate-500">New role
                    <select value={role} onChange={(e) => { setRole(e.target.value); setConfirming(false); setBanner(null); }}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
                        <option value="">Choose a role…</option>
                        {catalogue.filter((c) => c.role !== (currentRole || 'user')).map((c) => (
                            <option key={c.role} value={c.role}>{c.role} — {c.title}</option>
                        ))}
                    </select>
                </label>
                <div className="text-xs text-slate-500 self-end">
                    {chosen ? (raising
                        ? <span className="text-amber-700 font-medium">This raises their access, so they get an invitation and must accept. Nothing changes until then.</span>
                        : <span className="text-slate-700 font-medium">This lowers or keeps their access: it applies at once and they are told by email.</span>)
                        : 'Raising a role sends an invitation; lowering applies at once.'}
                </div>
            </div>

            {chosen && (
                <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-600 space-y-1">
                    <div className="font-semibold text-slate-700">What “{chosen.role}” gives ({chosen.title})</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                        {[...chosen.can, ...chosen.cannot].map((line) => <li key={line}>{line}</li>)}
                    </ul>
                </div>
            )}

            {chosen && (
                <label className="block text-xs text-slate-500">Notes for the account owner (shown in the email, optional)
                    <textarea value={notes} maxLength={NOTES_MAX} rows={3} onChange={(e) => setNotes(e.target.value)}
                              placeholder="Why this change, and what to expect"
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"/>
                    <span className="float-right text-[10px] text-slate-400">{notes.length}/{NOTES_MAX}</span>
                </label>
            )}

            {banner && (
                <div className={`flex gap-2 rounded-lg px-3 py-2 text-xs ${banner.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {banner.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0"/> : <AlertCircle className="w-4 h-4 shrink-0"/>}
                    <span>{banner.text}</span>
                </div>
            )}

            {chosen && !confirming && (
                <button onClick={() => setConfirming(true)} disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#195C51] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    <Send className="w-4 h-4"/> {raising ? 'Send invitation…' : 'Apply change…'}
                </button>
            )}
            {chosen && confirming && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
                    <span>{raising ? <>Email an invitation to become <b>{chosen.role}</b>?</> : <>Change the role to <b>{chosen.role}</b> now?</>}</span>
                    <button onClick={submit} disabled={busy} className="rounded-md bg-[#195C51] px-3 py-1.5 font-semibold text-white disabled:opacity-50">{busy ? 'Working…' : 'Confirm'}</button>
                    <button onClick={() => setConfirming(false)} disabled={busy} className="font-semibold text-slate-500 hover:underline">Back</button>
                </div>
            )}

            {overview.history.length > 0 && (
                <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer font-semibold text-slate-600">Role history ({overview.history.length})</summary>
                    <ul className="mt-2 space-y-1">
                        {overview.history.map((h) => (
                            <li key={h._id}>{fmt(h.createdAt)}: {h.fromRole} → <b>{h.toRole}</b>, {STATUS_TEXT[h.status] || h.status}{h.requestedByEmail ? ` (by ${h.requestedByEmail})` : ''}</li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}
