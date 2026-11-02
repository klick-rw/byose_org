// src/pages/dashboard/UserInspectModal.jsx
import {useState, useEffect, useCallback} from 'react';
import {
    X, User, Wifi, Activity, Share2, Settings, Smartphone,
    ChevronDown, ChevronUp, Zap, Calendar, RefreshCw,
    Star, BadgeCheck, ExternalLink, AlertCircle, CreditCard,
    Plus, Clock, ShieldCheck, ShieldOff, UserX, Ban
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import {deleteData, fetchData, patchData, returnToken, sendData} from '../../utils/helper.js';
import {presence_server} from '../../config/server_api.js';
import RoleChangePanel from './RoleChangePanel.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : '—';

const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : '—';

const timeAgo = (d) => {
    if (!d) return '—';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
};

const StatusDot = ({online}) => (
    <span
        className={`inline-block w-2 h-2 rounded-full shrink-0 ${online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}/>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

const Section = ({title, icon: Icon, children, defaultOpen = true, badge}) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="w-4 h-4 text-[#195C51]"/>}
                    <span className="text-xs font-black uppercase tracking-widest text-slate-600">{title}</span>
                    {badge != null && (
                        <span
                            className="ml-1 bg-[#195C51] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
                    )}
                </div>
                {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400"/> :
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400"/>}
            </button>
            {open && <div className="p-4 bg-white space-y-3">{children}</div>}
        </div>
    );
};

const KV = ({label, value, mono = false, accent = false}) => (
    <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">{label}</span>
        <span
            className={`text-xs font-semibold text-right ${mono ? 'font-mono' : ''} ${accent ? 'text-[#195C51]' : 'text-slate-800'}`}>
      {value ?? '—'}
    </span>
    </div>
);

const MiniCard = ({label, value, sub, accent = 'slate'}) => {
    const colors = {
        slate: 'bg-slate-50 border-slate-200 text-slate-800',
        green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        red: 'bg-red-50 border-red-200 text-red-700',
        amber: 'bg-amber-50 border-amber-200 text-amber-800',
        blue: 'bg-blue-50 border-blue-200 text-blue-800',
        teal: 'bg-teal-50 border-[#195C51]/30 text-[#195C51]',
    };
    return (
        <div className={`border rounded-lg p-3 flex flex-col gap-0.5 ${colors[accent]}`}>
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</p>
            <p className="text-lg font-bold leading-none">{value ?? '—'}</p>
            {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
        </div>
    );
};

// ─── DailyUptimeChart ─────────────────────────────────────────────────────────

// FIX: accept nameMap as a prop with a default empty object so it's always defined
const CustomTooltip = ({active, payload, label, nameMap = {}}) => {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="bg-white border border-slate-200 rounded-md p-2 text-xs shadow">
            <p className="font-bold mb-1">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex justify-between gap-2">
                    <span className="text-slate-600">
                        {nameMap[p.dataKey] || p.dataKey}
                    </span>
                    <span className="font-bold text-[#195C51]">
                        {p.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

const DailyUptimeChart = ({data}) => {
    if (!data?.length) return <p className="text-xs text-slate-400 italic">No uptime data.</p>;
    const chartData = data.map(d => ({
        date: d.date,
        online: Math.round(d.uptimeSeconds / 3600),
        offline: Math.round(d.offlineSeconds / 3600),
        pct: d.uptimePct,
    }));

    // FIX: define a nameMap for the uptime chart labels and pass it to CustomTooltip
    const uptimeNameMap = {online: 'Online (hrs)', offline: 'Offline (hrs)'};

    return (
        <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{top: 4, right: 4, left: -24, bottom: 0}} barSize={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#94A3B8'}}
                       interval="preserveStartEnd"/>
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#94A3B8'}}/>
                {/* FIX: pass nameMap prop into CustomTooltip via the content render prop */}
                <RechartsTooltip content={(props) => <CustomTooltip {...props} nameMap={uptimeNameMap}/>}/>
                <Bar dataKey="online" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]}/>
                <Bar dataKey="offline" stackId="a" fill="#FCA5A5" radius={[2, 2, 0, 0]}/>
            </BarChart>
        </ResponsiveContainer>
    );
};

// ─── DailyEventsChart ─────────────────────────────────────────────────────────

const DailyEventsChart = ({dailyEventsByUser, userInteractions}) => {
    if (!dailyEventsByUser || Object.keys(dailyEventsByUser).length === 0)
        return <p className="text-xs text-slate-400 italic">No event data.</p>;

    // Build name map
    const nameMap = {};
    (userInteractions || []).forEach(u => {
        nameMap[u.userId] = u.displayName;
    });

    // Extract all userIds
    const allUserIds = [
        ...new Set(
            Object.values(dailyEventsByUser).flatMap(day =>
                day.map(u => u.id)
            )
        )
    ];

    // Transform data properly
    const chartData = Object.entries(dailyEventsByUser)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, users]) => {
            const row = {date};
            users.forEach(u => {
                row[u.id] = u.count;
            });
            return row;
        });

    const COLORS = ['#195C51', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];

    return (
        <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{top: 4, right: 4, left: -24, bottom: 0}} barSize={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#94A3B8'}}
                       interval="preserveStartEnd"/>
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#94A3B8'}}/>
                {/* FIX: pass nameMap as a prop via render prop pattern instead of relying on closure */}
                <RechartsTooltip content={(props) => <CustomTooltip {...props} nameMap={nameMap}/>}/>
                {allUserIds.map((uid, i) => (
                    <Bar key={uid} dataKey={uid} stackId="a" fill={COLORS[i % COLORS.length]}
                         radius={i === allUserIds.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}/>
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
};

// ─── ConnectivityTimeline ─────────────────────────────────────────────────────

const ConnectivityTimeline = ({windows, from, to}) => {
    if (!windows?.length) return <p className="text-xs text-slate-400 italic">No connectivity windows.</p>;
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    const span = end - start || 1;

    return (
        <div className="relative h-6 bg-red-100 rounded overflow-hidden">
            {windows.map((w, i) => {
                const wStart = Math.max(new Date(w.onlineAt).getTime(), start);
                const wEnd = w.offlineAt ? Math.min(new Date(w.offlineAt).getTime(), end) : end;
                const left = ((wStart - start) / span) * 100;
                const width = ((wEnd - wStart) / span) * 100;
                return (
                    <div key={i}
                         className="absolute top-0 h-full bg-emerald-500 opacity-80 hover:opacity-100 transition-opacity cursor-pointer group"
                         style={{left: `${left}%`, width: `${Math.max(width, 0.3)}%`}}
                         title={`Online: ${fmtDateTime(w.onlineAt)} → ${w.offlineAt ? fmtDateTime(w.offlineAt) : 'now'}`}
                    />
                );
            })}
            <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
                <span className="text-[8px] font-bold text-red-700">{fmtDate(from)}</span>
                <span className="text-[8px] font-bold text-slate-500">{fmtDate(to)}</span>
            </div>
        </div>
    );
};

// ─── RemoteCard ───────────────────────────────────────────────────────────────

// eslint-disable-next-line react/prop-types
const RemoteCard = ({remoteData, timeScope}) => {
    const [open, setOpen] = useState(false);
    const {remote, connectivity, usage, configuration, sharing} = remoteData;
    const isOnline = connectivity?.isOnline;

    return (
        <div
            className={`border rounded-xl overflow-hidden transition-all ${isOnline ? 'border-emerald-200' : 'border-red-200'}`}>
            {/* Header */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-3 p-4 bg-white hover:bg-slate-50 transition-colors text-left"
            >
                <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isOnline ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    <StatusDot online={isOnline}/>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 text-sm">{remote?.labelName || 'Unnamed Remote'}</p>
                        <span
                            className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
              {remote?.modelType}
            </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono">{remote?.serialNumber}</p>
                </div>
                <div className="text-right shrink-0 pl-2">
                    <p className="text-xs font-bold text-slate-700">{connectivity?.rangeUptime || '—'}</p>
                    <p className="text-[9px] text-slate-400">range uptime</p>
                </div>
                {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0"/> :
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0"/>}
            </button>

            {open && (
                <div className="border-t border-slate-100 p-4 space-y-4 bg-white">

                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-2">
                        <MiniCard label="Total Uptime" value={connectivity?.totalUptime} accent="teal"/>
                        <MiniCard label="Range Uptime" value={`${connectivity?.rangeUptimePct || '—'}`}
                                  accent={parseFloat(connectivity?.rangeUptimePct) > 80 ? 'green' : 'amber'}/>
                        <MiniCard label="Offline Incidents" value={connectivity?.offlineIncidents?.count ?? 0}
                                  accent={connectivity?.offlineIncidents?.count > 5 ? 'red' : 'slate'}/>
                    </div>

                    {/* Connectivity timeline */}
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Connectivity
                            Timeline</p>
                        <ConnectivityTimeline windows={connectivity?.windows} from={timeScope?.from}
                                              to={timeScope?.to}/>
                        <p className="text-[9px] text-slate-400 mt-1">Green = online · Red = offline</p>
                    </div>

                    {/* Daily uptime chart */}
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Daily
                            Uptime (hours)</p>
                        <DailyUptimeChart data={connectivity?.dailyUptime}/>
                    </div>

                    {/* Events */}
                    {usage?.totalEventsInRange > 0 && (
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                                Daily Events — {usage.totalEventsInRange} total
                            </p>
                            <DailyEventsChart
                                dailyEventsByUser={usage.dailyEventsByUser}
                                userInteractions={usage.userInteractions}
                            />
                        </div>
                    )}

                    {/* Button breakdown */}
                    {usage?.buttonBreakdown?.length > 0 && (
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Top
                                Buttons</p>
                            <div className="space-y-1.5">
                                {usage.buttonBreakdown.slice(0, 5).map((btn) => (
                                    <div key={btn.buttonId} className="flex items-center gap-2">
                                        <span
                                            className="text-xs text-slate-700 flex-1 truncate">{btn.labelName || btn.buttonId}</span>
                                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="h-full bg-[#195C51] rounded-full"
                                                style={{width: `${Math.min(100, (btn.eventCount / (usage.buttonBreakdown[0]?.eventCount || 1)) * 100)}%`}}
                                            />
                                        </div>
                                        <span
                                            className="text-[10px] font-bold text-slate-500 w-6 text-right">{btn.eventCount}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Last event */}
                    {usage?.lastEvent && (
                        <div
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-3">
                            <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700">
                                    Last: <span className="text-[#195C51]">{usage.lastEvent.buttonLabel}</span>
                                    {' '}· <span className="capitalize">{usage.lastEvent.pressType}</span> press
                                </p>
                                <p className="text-[10px] text-slate-400">{timeAgo(usage.lastEvent.at)}</p>
                            </div>
                        </div>
                    )}

                    {/* Offline incidents list */}
                    {connectivity?.offlineIncidents?.incidents?.length > 0 && (
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                                Offline Incidents ({connectivity.offlineIncidents.count}) ·
                                avg {connectivity.offlineIncidents.avgDuration}
                            </p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {connectivity.offlineIncidents.incidents.map((inc, i) => (
                                    <div key={i}
                                         className={`flex items-center justify-between text-[10px] px-2.5 py-1.5 rounded-md ${inc.currentlyOffline ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-100'}`}>
                                        <div className="flex items-center gap-1.5">
                                            {inc.currentlyOffline
                                                ? <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
                                                : <span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>}
                                            <span className="font-mono text-slate-700">{fmtDateTime(inc.from)}</span>
                                        </div>
                                        <span
                                            className={`font-bold ${inc.currentlyOffline ? 'text-red-600' : 'text-slate-600'}`}>
                      {inc.duration}{inc.currentlyOffline ? ' (ongoing)' : ''}
                    </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sharing */}
                    {sharing?.totalShares > 0 && (
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                                Sharing ({sharing.activeShares} active / {sharing.revokedShares} revoked)
                            </p>
                            <div className="space-y-1.5">
                                {sharing.details?.map((s) => (
                                    <div key={s.shareId}
                                         className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                                        <div>
                                            <p className="text-xs font-semibold text-slate-800">
                                                {s.sharedWith?.name || '—'}
                                                {s.nickname &&
                                                    <span className="text-slate-400 font-normal"> · {s.nickname}</span>}
                                            </p>
                                            <p className="text-[9px] text-slate-400 font-mono">{s.sharedWith?.email}</p>
                                        </div>
                                        <span
                                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {s.status}
                    </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Config summary */}
                    {configuration && (
                        <div
                            className="flex items-center gap-3 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                            <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
                            <span><strong className="text-slate-800">{configuration.totalChanges}</strong> total config changes · <strong
                                className="text-slate-800">{configuration.changesInRange}</strong> in range</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Modal Component
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * UserInspectModal
 *
 * Props:
 *   userId   {string}  — MongoDB ObjectId to inspect
 *   onClose  {fn}      — called when the modal should close
 *
 * Optionally pass `timeRange = { from: ISOstring, to: ISOstring }` to scope the
 * inspection; defaults to the API's own 30-day window.
 */
export default function UserInspectModal({userId, onClose, timeRange}) {

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [tab, setTab] = useState('overview'); // 'overview' | 'devices' | 'sessions' | 'subscriptions' | 'sharing'

    // Subscription management state
    const [showGrantModal, setShowGrantModal] = useState(false);
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState(null);
    const [grantForm, setGrantForm] = useState({planId: '', durationMonths: 2, country: 'RW', reason: ''});
    const [extendForm, setExtendForm] = useState({extendDays: 30, reason: ''});
    const [subscriptionActionLoading, setSubscriptionActionLoading] = useState(false);
    const [subscriptionActionError, setSubscriptionActionError] = useState(null);
    const [plans, setPlans] = useState([]);
    const [accountActionLoading, setAccountActionLoading] = useState(false);
    const [accountActionError, setAccountActionError] = useState(null);
    const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

    const load = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            let url = `${presence_server}/api/admin/inspect?userId=${userId}`;
            if (timeRange?.from) url += `&from=${timeRange.from}`;
            if (timeRange?.to) url += `&to=${timeRange.to}`;
            const res = await fetchData(url);
            if (res.data?.success && res.data?.data) {
                setData(res.data.data);
            } else {
                setError(res.data?.message || 'Failed to load inspection data.');
            }
        } catch (err) {
            setError('Failed to connect to inspection endpoint.');
        }
        setLoading(false);
    }, [userId, timeRange]);

    // Load available plans for grant modal
    const loadPlans = useCallback(async () => {
        try {
            const res = await fetchData(`${presence_server}/api/admin/subscriptions/plans?isActive=true`);
            if (res.data?.plans) {
                setPlans(res.data.plans);
            }
        } catch (err) {
            console.error('Failed to load plans', err);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (showGrantModal) {
            loadPlans();
        }
    }, [showGrantModal, loadPlans]);

    // Handle grant subscription
    const handleGrantSubscription = async () => {
        if (!grantForm.planId || !grantForm.durationMonths) {
            setSubscriptionActionError('Plan and duration are required');
            return;
        }

        setSubscriptionActionLoading(true);
        setSubscriptionActionError(null);

        try {
            const res = await sendData(
                `${presence_server}/api/admin/subscriptions/grant`,
                {
                    userId: userId,
                    planId: grantForm.planId,
                    durationMonths: parseInt(grantForm.durationMonths),
                    country: grantForm.country,
                    reason: grantForm.reason,
                }
            );

            if (res.data?.code === 'SUBSCRIPTION_GRANTED') {
                setShowGrantModal(false);
                setGrantForm({planId: '', durationMonths: 12, country: 'RW', reason: ''});
                load(); // Reload user data
            } else {
                setSubscriptionActionError(res.data?.message || 'Failed to grant subscription');
            }
        } catch (err) {
            setSubscriptionActionError(err.message || 'Failed to grant subscription');
        }

        setSubscriptionActionLoading(false);
    };


    const handleUpdateStatus = async (newStatus) => {
        if (!acc?.id) return;
        setAccountActionLoading(true);
        setAccountActionError(null);

        const res = await patchData(
            `${presence_server}/api/admin/users/p/${acc.id}/status`,
            {status: newStatus},
            token
        );

        if (res.error) {
            setAccountActionError(res.error);
        } else if (res.data?.success) {
            load();
        } else {
            setAccountActionError(res.message || 'Failed to update status');
        }

        setAccountActionLoading(false);
    };

    const handleUpdateTrust = async (nextTrusted) => {
        if (!acc?.id) return;
        setAccountActionLoading(true);
        setAccountActionError(null);

        const res = await patchData(
            `${presence_server}/api/admin/users/p/${acc.id}/trust-status`,
            {isTrusted: nextTrusted}
        );

        if (res.error) {
            setAccountActionError(res.error);
        } else if (res.data?.success) {
            load();
        } else {
            setAccountActionError(res.message || 'Failed to update trust status');
        }

        setAccountActionLoading(false);
    };

    const handleDeactivateUser = async () => {
        if (!acc?.id) return;
        setAccountActionLoading(true);
        setAccountActionError(null);

        const res = await deleteData(
            `${presence_server}/api/admin/users/p/${userId}`
        );

        if (res.error) {
            setAccountActionError(res.error);
        } else {
            setShowDeactivateConfirm(false);
            load();
        }

        setAccountActionLoading(false);
    };

    // Handle extend subscription
    const handleExtendSubscription = async () => {
        if (!selectedSubscription || !extendForm.extendDays) {
            setSubscriptionActionError('Subscription and extension days are required');
            return;
        }

        setSubscriptionActionLoading(true);
        setSubscriptionActionError(null);

        try {
            const res = await sendData(
                `${presence_server}/api/admin/subscriptions/extend`,
                {
                    subscriptionId: selectedSubscription,
                    extendDays: parseInt(extendForm.extendDays),
                    reason: extendForm.reason,
                }
            );

            if (res.data?.code === 'SUBSCRIPTION_EXTENDED') {
                setShowExtendModal(false);
                setExtendForm({extendDays: 30, reason: ''});
                setSelectedSubscription(null);
                load(); // Reload user data
            } else {
                setSubscriptionActionError(res.data?.message || 'Failed to extend subscription');
            }
        } catch (err) {
            setSubscriptionActionError(err.message || 'Failed to extend subscription');
        }

        setSubscriptionActionLoading(false);
    };

    // Close on Escape
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const acc = data?.account;
    const ds = data?.deviceSummary;
    const subs = data?.subscriptions;

    const TABS = [
        {id: 'overview', label: 'Overview', icon: Activity},
        {id: 'devices', label: 'Devices', icon: Wifi, badge: data?.remotes?.length},
        {id: 'sessions', label: 'Sessions', icon: Smartphone, badge: data?.loginSessions?.active},
        {id: 'subscriptions', label: 'Subscriptions', icon: CreditCard, badge: subs?.active || 0},
        {id: 'account', label: 'Account', icon: User, badge: subs?.active || 0},
        {
            id: 'sharing',
            label: 'Sharing',
            icon: Share2,
            badge: (data?.sharesGiven?.active || 0) + (data?.sharedRemoteInteractions?.length || 0)
        },
    ];

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6 overflow-hidden flex flex-col">

                {/* ── Header ────────────────────────────────────────────────────── */}
                <div className="bg-[#195C51] px-6 py-5 flex items-start justify-between">
                    <div>
                        {loading ? (
                            <div className="flex items-center gap-2 text-white/80">
                                <div
                                    className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"/>
                                <span className="text-sm font-medium">Loading inspection…</span>
                            </div>
                        ) : error ? (
                            <p className="text-white/80 text-sm">{error}</p>
                        ) : acc ? (
                            <>
                                <div className="flex items-center gap-3 mb-1">
                                    <div
                                        className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg shrink-0">
                                        {acc.displayName?.[0] || '?'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-white font-display font-bold text-xl leading-none">{acc.displayName}</h2>
                                            {acc.role === 'special' && <Star className="w-4 h-4 text-amber-300"/>}
                                            {acc.isVerified && <BadgeCheck className="w-4 h-4 text-emerald-300"/>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                      <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${acc.status === 'active' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-red-500/30 text-red-200'}`}>
                        {acc.status}
                      </span>
                                            <span className="text-[10px] text-white/60">{acc.role}</span>
                                            <span className="text-[10px] text-white/60">·</span>
                                            <span className="text-[10px] text-white/60">{acc.country}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-white/60">
                                    <span className="font-mono">{acc.email}</span>
                                    {acc.phone && <span className="font-mono">{acc.phone}</span>}
                                    <span>Member since {fmtDate(acc.memberSince)}</span>
                                </div>
                            </>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                        <button onClick={load}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                title="Refresh">
                            <RefreshCw className="w-4 h-4 text-white"/>
                        </button>
                        <button onClick={onClose}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                            <X className="w-4 h-4 text-white"/>
                        </button>
                    </div>
                </div>

                {/* ── Time scope strip ──────────────────────────────────────────── */}
                {data?.timeScope && (
                    <div className="bg-slate-50 border-b border-slate-200 px-6 py-1.5 flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-slate-400"/>
                        <span className="text-[10px] text-slate-500 font-medium">
              Scoped: {fmtDate(data.timeScope.from)} — {fmtDate(data.timeScope.to)}
            </span>
                    </div>
                )}

                {/* ── Tabs ──────────────────────────────────────────────────────── */}
                {!loading && !error && data && (
                    <div className="border-b border-slate-200 flex overflow-x-auto bg-white">
                        {TABS.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all relative
                  ${tab === t.id
                                    ? 'border-[#195C51] text-[#195C51] bg-[#195C51]/5'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                            >
                                <t.icon className="w-3.5 h-3.5"/>
                                {t.label}
                                {t.badge != null && t.badge > 0 && (
                                    <span
                                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-[#195C51] text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {t.badge}
                  </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Content ───────────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[65vh]">

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div
                                className="w-8 h-8 border-3 border-[#195C51] border-t-transparent rounded-full animate-spin"/>
                            <p className="text-sm text-slate-500 font-medium">Fetching diagnostic data…</p>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                            <AlertCircle className="w-10 h-10 text-red-400"/>
                            <p className="text-sm font-semibold text-slate-700">{error}</p>
                            <button onClick={load}
                                    className="text-xs text-[#195C51] hover:underline font-semibold">Retry
                            </button>
                        </div>
                    )}

                    {!loading && !error && data && (
                        <>
                            {/* ── Overview Tab ──────────────────────────────────────── */}
                            {tab === 'overview' && (
                                <div className="space-y-4">

                                    {/* Account details */}
                                    <Section title="Account" icon={User} defaultOpen>
                                        <div className="grid grid-cols-2 gap-x-6">
                                            <KV label="Full name" value={acc?.displayName}/>
                                            <KV label="Email" value={acc?.email} mono/>
                                            <KV label="Phone" value={acc?.phone} mono/>
                                            <KV label="Role" value={acc?.role}/>
                                            <KV label="Status" value={acc?.status} accent/>
                                            <KV label="Country" value={acc?.country}/>
                                            <KV label="Verified" value={acc?.isVerified ? 'Yes' : 'No'}/>
                                            <KV label="Trusted" value={acc?.isTrusted ? 'Yes' : 'No'}/>
                                            <KV label="Trusted devices" value={acc?.trustedDeviceCount}/>
                                            <KV label="Member since" value={fmtDate(acc?.memberSince)}/>
                                        </div>
                                        <RoleChangePanel userId={userId} currentRole={acc?.role} onChanged={load}/>
                                    </Section>

                                    {/* Device summary */}
                                    {ds && (
                                        <Section title="Device Summary" icon={Wifi} defaultOpen>
                                            <div className="grid grid-cols-3 gap-2 mb-3">
                                                <MiniCard label="Remotes" value={ds.totalRemotes} accent="teal"/>
                                                <MiniCard label="Online Now" value={ds.currentlyOnline} accent="green"/>
                                                <MiniCard label="Offline Now" value={ds.currentlyOffline}
                                                          accent={ds.currentlyOffline > 0 ? 'red' : 'slate'}/>
                                                <MiniCard label="Total Uptime" value={ds.totalUptime}/>
                                                <MiniCard label="Range Uptime" value={ds.rangeUptime} accent="teal"/>
                                                <MiniCard label="Incidents (range)" value={ds.offlineIncidentsInRange}
                                                          accent={ds.offlineIncidentsInRange > 5 ? 'red' : 'slate'}/>
                                            </div>
                                            <KV label="Events in range" value={ds.totalEventsInRange?.toLocaleString()}
                                                accent/>
                                        </Section>
                                    )}

                                    {/* Active subscription summary */}
                                    {subs?.active > 0 && subs.activeDetails?.length > 0 && (
                                        <Section title="Active Subscription" icon={Zap} defaultOpen>
                                            {subs.activeDetails.map((sub, i) => (
                                                <div key={i}
                                                     className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-bold text-emerald-800">{sub.planName || sub.plan?.name || 'Plan'}</p>
                                                        <span
                                                            className="text-[9px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">{sub.status}</span>
                                                    </div>
                                                    {sub.currentPeriodEnd && (
                                                        <p className="text-[10px] text-emerald-700">Renews: {fmtDate(sub.currentPeriodEnd)}</p>
                                                    )}
                                                    {sub.amount != null && (
                                                        <p className="text-[10px] text-emerald-700">${sub.amount} / {sub.interval || 'period'}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </Section>
                                    )}

                                    {/* Shares given quick summary */}
                                    {data.sharesGiven?.total > 0 && (
                                        <Section title="Sharing Summary" icon={Share2} defaultOpen>
                                            <div className="grid grid-cols-3 gap-2">
                                                <MiniCard label="Total given" value={data.sharesGiven.total}/>
                                                <MiniCard label="Active" value={data.sharesGiven.active}
                                                          accent="green"/>
                                                <MiniCard label="Revoked" value={data.sharesGiven.revoked}/>
                                            </div>
                                        </Section>
                                    )}
                                </div>
                            )}

                            {/* ── Devices Tab ───────────────────────────────────────── */}
                            {tab === 'devices' && (
                                <div className="space-y-3">
                                    {data.remotes?.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400">
                                            <Wifi className="w-8 h-8 mx-auto mb-2 opacity-40"/>
                                            <p className="text-sm font-medium">No owned remotes.</p>
                                        </div>
                                    ) : (
                                        data.remotes.map((r, i) => (
                                            <RemoteCard key={r.remote?.id || i} remoteData={r}
                                                        timeScope={data.timeScope}/>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* ── Sessions Tab ──────────────────────────────────────── */}
                            {tab === 'sessions' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        <MiniCard label="Total" value={data.loginSessions?.total}/>
                                        <MiniCard label="Active" value={data.loginSessions?.active} accent="green"/>
                                        <MiniCard label="Lost" value={data.loginSessions?.markedLost}
                                                  accent={data.loginSessions?.markedLost > 0 ? 'red' : 'slate'}/>
                                    </div>
                                    {data.loginSessions?.sessions?.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic text-center py-6">No sessions
                                            found.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {data.loginSessions.sessions.map((s) => (
                                                <div key={s.sessionId}
                                                     className={`border rounded-xl p-3 flex items-start justify-between gap-3 ${s.isLost ? 'border-red-200 bg-red-50/50' : s.isActive ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}
                                                >
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <div
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.isActive && !s.isLost ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                                            <Smartphone
                                                                className={`w-4 h-4 ${s.isActive && !s.isLost ? 'text-emerald-600' : 'text-slate-500'}`}/>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="text-sm font-bold text-slate-800">{s.deviceInfo?.deviceName || 'Unknown device'}</p>
                                                                <span
                                                                    className="text-[9px] font-bold uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                  {s.deviceInfo?.platform}
                                </span>
                                                                {s.isLost && (
                                                                    <span
                                                                        className="text-[9px] font-bold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Lost</span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                                v{s.deviceInfo?.appVersion} · Last
                                                                active {timeAgo(s.lastActivityAt)}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400">
                                                                Created {fmtDate(s.createdAt)} ·
                                                                Expires {fmtDate(s.expiresAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`text-[9px] font-black uppercase shrink-0 px-2 py-1 rounded-full ${s.isActive && !s.isLost ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {s.isActive && !s.isLost ? 'Active' : 'Inactive'}
                          </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Subscriptions Tab ─────────────────────────────────── */}
                            {tab === 'subscriptions' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="grid grid-cols-2 gap-2">
                                            <MiniCard label="Total subs" value={subs?.total}/>
                                            <MiniCard label="Active subs" value={subs?.active}
                                                      accent={subs?.active > 0 ? 'green' : 'slate'}/>
                                        </div>
                                        <button
                                            onClick={() => setShowGrantModal(true)}
                                            className="inline-flex items-center gap-2 bg-[#195C51] text-white hover:bg-[#0E3A32] px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5"/>
                                            Grant Subscription
                                        </button>
                                    </div>
                                    {subs?.activeDetails?.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Active
                                                Plans</p>
                                            {subs.activeDetails.map((sub, i) => (
                                                <div key={i}
                                                     className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-2 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-bold text-emerald-900">{sub.planName || sub.plan?.name || 'Active Plan'}</p>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="text-[9px] font-black uppercase bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">{sub.status}</span>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedSubscription(sub.subscriptionId || sub._id);
                                                                    setShowExtendModal(true);
                                                                }}
                                                                className="inline-flex items-center gap-1 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                                                            >
                                                                <Clock className="w-3 h-3"/>
                                                                Extend
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-4 text-[10px]">
                                                        {sub.amount != null && <KV label="Amount"
                                                                                   value={`$${sub.amount} / ${sub.interval || 'period'}`}/>}
                                                        {sub.currentPeriodStart && <KV label="Started"
                                                                                       value={fmtDate(sub.currentPeriodStart)}/>}
                                                        {sub.currentPeriodEnd &&
                                                            <KV label="Renews" value={fmtDate(sub.currentPeriodEnd)}/>}
                                                        {sub.provider && <KV label="Provider" value={sub.provider}/>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {subs?.history?.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">History</p>
                                            <div className="space-y-2">
                                                {subs.history.map((sub, i) => (
                                                    <div key={i}
                                                         className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                                                        <div>
                                                            <p className="text-xs font-semibold text-slate-700">{sub.planName || sub.plan?.name || 'Plan'}</p>
                                                            <p className="text-[10px] text-slate-400">{fmtDate(sub.createdAt)} — {fmtDate(sub.endedAt || sub.cancelledAt)}</p>
                                                        </div>
                                                        <span
                                                            className="text-[9px] font-bold uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{sub.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {!subs?.total && (
                                        <p className="text-sm text-slate-400 italic text-center py-8">No subscription
                                            history.</p>
                                    )}
                                </div>
                            )}

                            {/* ── Sharing Tab ───────────────────────────────────────── */}
                            {tab === 'sharing' && (
                                <div className="space-y-4">
                                    {/* Shares given */}
                                    {data.sharesGiven && (
                                        <Section title={`Shares Given (${data.sharesGiven.active} active)`}
                                                 icon={Share2} defaultOpen badge={data.sharesGiven.total}>
                                            {data.sharesGiven.details?.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic">No shares given.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {data.sharesGiven.details?.map((s) => (
                                                        <div key={s.shareId}
                                                             className={`border rounded-lg p-3 ${s.status === 'active' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50'}`}>
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div>
                                                                    <p className="text-xs font-semibold text-slate-800">
                                                                        {s.sharedWith?.name}
                                                                        {s.nickname && <span
                                                                            className="text-slate-400 font-normal"> "{s.nickname}"</span>}
                                                                    </p>
                                                                    <p className="text-[10px] font-mono text-slate-500">{s.sharedWith?.email}</p>
                                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                                        {s.shareType} · Since {fmtDate(s.createdAt)}
                                                                        {s.expiresAt && ` · Expires ${fmtDate(s.expiresAt)}`}
                                                                        {s.revokedAt && ` · Revoked ${fmtDate(s.revokedAt)}`}
                                                                    </p>
                                                                    {s.excludedButtonCount > 0 && (
                                                                        <p className="text-[10px] text-amber-600">{s.excludedButtonCount} buttons
                                                                            excluded</p>
                                                                    )}
                                                                </div>
                                                                <span
                                                                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                  {s.status}
                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </Section>
                                    )}

                                    {/* Shared remotes (received) */}
                                    {data.sharedRemoteInteractions?.length > 0 && (
                                        <Section
                                            title={`Remotes Shared To Me (${data.sharedRemoteInteractions.length})`}
                                            icon={ExternalLink} defaultOpen>
                                            <div className="space-y-2">
                                                {data.sharedRemoteInteractions.map((sri) => (
                                                    <div key={sri.share.shareId}
                                                         className="border border-sky-200 bg-sky-50/30 rounded-lg p-3">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-xs font-bold text-slate-800">{sri.remote.labelName || sri.remote.serialNumber}</p>
                                                            <span
                                                                className="text-[9px] font-bold uppercase bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">{sri.remote.modelType}</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 font-mono mb-1">{sri.remote.serialNumber}</p>
                                                        <div
                                                            className="flex items-center gap-3 text-[10px] text-slate-600">
                                                            <span><strong
                                                                className="text-[#195C51]">{sri.myInteraction.totalEventsInRange}</strong> events</span>
                                                            <span>·</span>
                                                            <span>Last: {timeAgo(sri.myInteraction.lastEventAt)}</span>
                                                            <span>·</span>
                                                            <span className="capitalize">{sri.share.shareType}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Section>
                                    )}

                                    {!data.sharesGiven?.total && !data.sharedRemoteInteractions?.length && (
                                        <div className="text-center py-12 text-slate-400">
                                            <Share2 className="w-8 h-8 mx-auto mb-2 opacity-40"/>
                                            <p className="text-sm font-medium">No sharing activity.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            {tab === 'account' && (
                                <div className="space-y-4">
                                    {accountActionError && (
                                        <div
                                            className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4 shrink-0"/>
                                            {accountActionError}
                                        </div>
                                    )}

                                    {/* Status */}
                                    <Section title="Account Status" icon={ShieldCheck} defaultOpen>
                                        <div className="mb-3">
                                            <p className="text-xs text-slate-500 mb-1">Current status</p>
                                            <span
                                                className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                                    acc?.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                                        acc?.status === 'suspended' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-red-100 text-red-700'
                                                }`}>
                    <StatusDot online={acc?.status === 'active'}/>
                                                {acc?.status}
                </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {['active', 'suspended', 'deactivated'].map((s) => (
                                                <button
                                                    key={s}
                                                    disabled={accountActionLoading || acc?.status === s}
                                                    onClick={() => handleUpdateStatus(s)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                                        acc?.status === s
                                                            ? 'bg-slate-100 text-slate-400 border border-slate-200'
                                                            : 'bg-white border border-slate-200 text-slate-700 hover:border-[#195C51] hover:text-[#195C51]'
                                                    }`}
                                                >
                                                    Set {s}
                                                </button>
                                            ))}
                                        </div>
                                    </Section>

                                    {/* Trust */}
                                    <Section title="Trust Level" icon={acc?.isTrusted ? ShieldCheck : ShieldOff}
                                             defaultOpen>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {acc?.isTrusted ? 'Trusted account' : 'Not trusted'}
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    Trusted accounts may bypass certain verification checks.
                                                </p>
                                            </div>
                                            <button
                                                disabled={accountActionLoading}
                                                onClick={() => handleUpdateTrust(!acc?.isTrusted)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${
                                                    acc?.isTrusted ? 'bg-[#195C51]' : 'bg-slate-300'
                                                }`}
                                            >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        acc?.isTrusted ? 'translate-x-6' : 'translate-x-1'
                    }`}/>
                                            </button>
                                        </div>
                                    </Section>

                                    {/* Danger zone */}
                                    <Section title="Danger Zone" icon={Ban} defaultOpen>
                                        <div
                                            className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
                                            <div>
                                                <p className="text-sm font-semibold text-red-800">Deactivate account</p>
                                                <p className="text-[10px] text-red-500 mt-0.5">
                                                    Sets the account status to deactivated. Reversible by setting status
                                                    back to active.
                                                </p>
                                            </div>
                                            <button
                                                disabled={accountActionLoading || acc?.status === 'deactivated'}
                                                onClick={() => setShowDeactivateConfirm(true)}
                                                className="shrink-0 inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <UserX className="w-3.5 h-3.5"/>
                                                Deactivate
                                            </button>
                                        </div>
                                    </Section>
                                </div>
                            )}
                            {showDeactivateConfirm && (
                                <div
                                    className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                                        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
                                            <h3 className="text-white font-bold text-lg">Deactivate Account</h3>
                                            <button onClick={() => setShowDeactivateConfirm(false)}
                                                    className="text-white/80 hover:text-white">
                                                <X className="w-5 h-5"/>
                                            </button>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <p className="text-sm text-slate-600">
                                                Deactivate <strong>{acc?.displayName}</strong>'s account? They'll lose
                                                access until reactivated.
                                            </p>
                                            {accountActionError && (
                                                <div
                                                    className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                                                    {accountActionError}
                                                </div>
                                            )}
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => setShowDeactivateConfirm(false)}
                                                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleDeactivateUser}
                                                    disabled={accountActionLoading}
                                                    className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                                                >
                                                    {accountActionLoading ? 'Deactivating...' : 'Deactivate'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── Footer ────────────────────────────────────────────────────── */}
                <div className="border-t border-slate-200 px-5 py-3 bg-slate-50/50 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400">
                        {data ? `User ID: ${acc?.id || userId}` : `Inspecting: ${userId}`}
                    </p>
                    <button onClick={onClose}
                            className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                        Close
                    </button>
                </div>
            </div>

            {/* ── Grant Subscription Modal ─────────────────────────────────────── */}
            {showGrantModal && (
                <div
                    className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-[#195C51] px-6 py-4 flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg">Grant Subscription</h3>
                            <button onClick={() => setShowGrantModal(false)} className="text-white/80 hover:text-white">
                                <X className="w-5 h-5"/>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {subscriptionActionError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                                    {subscriptionActionError}
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Plan</label>
                                <select
                                    value={grantForm.planId}
                                    onChange={(e) => setGrantForm(prev => ({...prev, planId: e.target.value}))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#195C51] focus:border-transparent"
                                >
                                    <option value="">Select a plan</option>
                                    {plans.map(plan => (
                                        <option key={plan._id || plan.id} value={plan._id || plan.id}>
                                            {plan.name} - {plan.pricing[0]?.currency || 'RWF'} {plan.pricing[0]?.pricePerMonth || 'N/A'}/month
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Duration
                                    (months)</label>
                                <input
                                    type="number"
                                    value={grantForm.durationMonths}
                                    onChange={(e) => setGrantForm(prev => ({...prev, durationMonths: e.target.value}))}
                                    min="1"
                                    max="120"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#195C51] focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Country</label>
                                <input
                                    type="text"
                                    value={grantForm.country}
                                    onChange={(e) => setGrantForm(prev => ({...prev, country: e.target.value}))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#195C51] focus:border-transparent font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Reason
                                    (optional)</label>
                                <textarea
                                    value={grantForm.reason}
                                    onChange={(e) => setGrantForm(prev => ({...prev, reason: e.target.value}))}
                                    rows="2"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#195C51] focus:border-transparent resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowGrantModal(false)}
                                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleGrantSubscription}
                                    disabled={subscriptionActionLoading}
                                    className="flex-1 px-4 py-2 bg-[#195C51] text-white hover:bg-[#0E3A32] rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                                >
                                    {subscriptionActionLoading ? 'Granting...' : 'Grant Subscription'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Extend Subscription Modal ─────────────────────────────────────── */}
            {showExtendModal && (
                <div
                    className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-[#195C51] px-6 py-4 flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg">Extend Subscription</h3>
                            <button onClick={() => setShowExtendModal(false)}
                                    className="text-white/80 hover:text-white">
                                <X className="w-5 h-5"/>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {subscriptionActionError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                                    {subscriptionActionError}
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Extension
                                    Days</label>
                                <input
                                    type="number"
                                    value={extendForm.extendDays}
                                    onChange={(e) => setExtendForm(prev => ({...prev, extendDays: e.target.value}))}
                                    min="1"
                                    max="3650"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#195C51] focus:border-transparent"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Max 3650 days (10 years)</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Reason
                                    (optional)</label>
                                <textarea
                                    value={extendForm.reason}
                                    onChange={(e) => setExtendForm(prev => ({...prev, reason: e.target.value}))}
                                    rows="2"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#195C51] focus:border-transparent resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowExtendModal(false)}
                                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExtendSubscription}
                                    disabled={subscriptionActionLoading}
                                    className="flex-1 px-4 py-2 bg-[#195C51] text-white hover:bg-[#0E3A32] rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                                >
                                    {subscriptionActionLoading ? 'Extending...' : 'Extend Subscription'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}