import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  MdRefresh,
  MdErrorOutline,
  MdOutlineVideocam,
  MdOutlineSensors,
  MdOutlineSystemUpdateAlt,
  MdOutlineReportProblem,
  MdClose,
} from "react-icons/md";
import { fetchData, patchData, sendData, updateData, returnToken } from "../../utils/helper.js";
import { presence_server } from "../../config/server_api.js";
import { useNotification } from "../../context/NotificationContext.jsx";

// Camera fleet: which version every camera runs, whether it is being updated, what failed, and the release controls.
// All data comes from the backend's admin routes (/api/admin/ota for the fleet and releases, /api/admin/provisioning for
// factory-provisioned units). The portal only reads and sends admin actions; the camera verifies every package itself.

const OTA = `${presence_server}/api/admin/ota`;
const PROV = `${presence_server}/api/admin/provisioning`;

const relative = (iso) => {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

const needsAttention = (d) => d.lastResult === "failed" || d.lastResult === "rolled-back" || Boolean(d.hint);

const CHIP = {
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  gray: "bg-gray-100 text-gray-500",
};

const Chip = ({ tone = "gray", children }) => (
  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${CHIP[tone]}`}>{children}</span>
);

Chip.propTypes = { tone: PropTypes.string, children: PropTypes.node };

const StatCard = ({ title, value, subtitle, icon }) => (
  <div className="google-card p-4 sm:p-6 flex items-start justify-between bg-white border border-gray-100 rounded-3xl shadow-sm">
    <div>
      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</p>
      <p className="text-2xl sm:text-3xl font-bold text-[#333333] mt-1">{value}</p>
      <p className="text-[10px] text-gray-500 mt-1">{subtitle}</p>
    </div>
    <div className="text-[#195C51]">{icon}</div>
  </div>
);

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  subtitle: PropTypes.string,
  icon: PropTypes.node,
};

const updateTone = (state) => (state === "idle" ? "gray" : "amber");
const resultTone = (r) => (r === "committed" ? "green" : r ? "red" : "gray");
const releaseTone = (s) => ({ active: "green", draft: "gray", paused: "amber", revoked: "red" }[s] || "gray");
const unitTone = (s) => ({ ready: "green", provisioning: "amber", recovering: "amber", retired: "red" }[s] || "gray");

const CameraFleet = () => {
  const { showNotification } = useNotification();
  const [tab, setTab] = useState("cameras");
  const [reporting, setReporting] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [releases, setReleases] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterState, setFilterState] = useState("");
  const [failingOnly, setFailingOnly] = useState(false);
  const [detail, setDetail] = useState(null);
  const [cohortDraft, setCohortDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = returnToken();
    const params = new URLSearchParams();
    if (filterState) params.set("state", filterState);
    if (failingOnly) params.set("failing", "true");
    const [fleet, rel, prov, cams] = await Promise.all([
      fetchData(`${OTA}/fleet?${params.toString()}`, token),
      fetchData(`${OTA}/releases`, token),
      fetchData(`${PROV}/units`, token),
      fetchData(`${presence_server}/api/admin/remotes?modelType=camera`, token),
    ]);
    if (fleet.error) setError(fleet.error);
    else setReporting(fleet.data.devices || []);
    if (!cams.error) setCameras(cams.data.remotes || []);
    if (!rel.error) setReleases(rel.data.releases || []);
    if (!prov.error) setUnits(prov.data.units || []);
    setLoading(false);
  }, [filterState, failingOnly]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  // every camera in the database, whether or not its updater has reported yet (those show as "not reporting")
  const devices = useMemo(() => {
    const known = new Set(reporting.map((d) => d.serial));
    const filtering = Boolean(filterState || failingOnly);
    const silent = filtering ? [] : cameras
      .filter((c) => c.modelType === "camera" && !known.has(c.serialNumber))
      .map((c) => ({ serial: c.serialNumber, notReporting: true, owner: c.owner?.email || null, seenRecently: false }));
    return [...reporting, ...silent];
  }, [reporting, cameras, filterState, failingOnly]);

  const newest = useMemo(() => releases.filter((r) => r.status === "active").sort((a, b) => b.sequence - a.sequence)[0], [releases]);
  const stats = useMemo(() => ({
    total: devices.length,
    seen: devices.filter((d) => d.seenRecently).length,
    silent: devices.filter((d) => d.notReporting).length,
    updating: devices.filter((d) => d.updateState && d.updateState !== "idle").length,
    attention: devices.filter(needsAttention).length,
    current: newest ? devices.filter((d) => d.version === newest.version).length : null,
  }), [devices, newest]);

  const openDetail = async (serial) => {
    const res = await fetchData(`${OTA}/fleet/${serial}`, returnToken());
    if (res.error) return;
    setDetail(res.data);
    setCohortDraft(res.data.device.cohort || "");
  };

  const saveCohort = async () => {
    const res = await patchData(`${OTA}/fleet/${detail.device.serial}`, { cohort: cohortDraft.trim() || null }, returnToken());
    if (!res.error) {
      showNotification("Cohort saved", "success");
      openDetail(detail.device.serial);
      load();
    }
  };

  const clearFailed = async (version) => {
    if (!window.confirm(`Allow ${version} to be offered to ${detail.device.serial} again?`)) return;
    const res = await patchData(`${OTA}/fleet/${detail.device.serial}`, { clearFailed: [version] }, returnToken());
    if (!res.error) {
      showNotification(`${version} can be offered again`, "success");
      openDetail(detail.device.serial);
      load();
    }
  };

  const releaseAction = async (rel, action) => {
    if (!window.confirm(`${action} release ${rel.version} (sequence ${rel.sequence})?`)) return;
    const res = await sendData(`${OTA}/releases/${rel.id}/${action}`, { confirm: true }, returnToken());
    if (!res.error) {
      showNotification(`Release ${rel.version} ${action}d`, "success");
      load();
    }
  };

  const setPercentage = async (rel) => {
    const answer = window.prompt(`Rollout percentage for ${rel.version} (0-100). 0 means only the allow-list and cohorts.`, String(rel.rollout?.percentage ?? 0));
    if (answer === null) return;
    const percentage = Number(answer);
    if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
      showNotification("Enter a whole number from 0 to 100", "error");
      return;
    }
    const res = await updateData(`${OTA}/releases/${rel.id}/rollout`, { ...rel.rollout, percentage }, returnToken());
    if (!res.error) {
      showNotification("Rollout saved", "success");
      load();
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-slide-entrance pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#333333]">Camera Fleet</h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            Versions, update progress, failures and release controls for the cameras.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2.5 sm:p-3 bg-white border border-gray-100 rounded-2xl text-[#195C51] shadow-sm hover:bg-gray-50 transition-all self-start"
          aria-label="Refresh"
        >
          <MdRefresh size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="mx-2 p-3 sm:p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
          <MdErrorOutline size={18} />
          <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 px-2">
        <StatCard title="Cameras" value={stats.total} subtitle={`${stats.total - stats.silent} reporting, ${stats.silent} not yet`} icon={<MdOutlineVideocam size={22} />} />
        <StatCard title="Seen recently" value={stats.seen} subtitle="Checked in within 40 minutes" icon={<MdOutlineSensors size={22} />} />
        <StatCard
          title="Updating"
          value={stats.updating}
          subtitle={newest ? `Newest active: ${newest.version} (${stats.current} on it)` : "No active release"}
          icon={<MdOutlineSystemUpdateAlt size={22} />}
        />
        <StatCard title="Need attention" value={stats.attention} subtitle="Failed, rolled back or blocked" icon={<MdOutlineReportProblem size={22} />} />
      </div>

      <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit mx-2">
        {[["cameras", "Cameras"], ["releases", "Releases"], ["units", "Provisioned"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === key ? "bg-[#195C51] text-white shadow-lg" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cameras" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 px-4">
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="bg-white rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-widest text-[#195C51] shadow-sm outline-none"
            >
              <option value="">All update states</option>
              {["idle", "downloading", "verified", "staged", "installing"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <input type="checkbox" checked={failingOnly} onChange={(e) => setFailingOnly(e.target.checked)} />
              Only cameras needing attention
            </label>
          </div>
          <div className="google-card mx-2 bg-white border border-gray-100 rounded-3xl shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {["Camera", "Version", "Last seen", "Update", "Last result", "Blocked versions"].map((h) => (
                    <th key={h} className="px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{loading ? "Loading…" : "No cameras match."}</td></tr>
                )}
                {devices.map((d) => (
                  <tr key={d.serial} onClick={() => !d.notReporting && openDetail(d.serial)} className={`border-t border-gray-50 ${d.notReporting ? "" : "hover:bg-gray-50 cursor-pointer"}`}>
                    <td className="px-4 py-3 font-bold text-[#333333]">{d.serial}{d.cohort && <span className="ml-2 text-gray-400">({d.cohort})</span>}</td>
                    <td className="px-4 py-3">{d.notReporting ? <span className="text-gray-400">not reporting{d.owner ? ` · ${d.owner}` : ""}</span> : d.version || "unknown"}{d.build && <span className="text-gray-400"> · {d.build}</span>}</td>
                    <td className="px-4 py-3"><span className={d.seenRecently ? "text-emerald-700" : "text-gray-500"}>{relative(d.lastSeenAt)}</span></td>
                    <td className="px-4 py-3">{d.notReporting ? <Chip>no updater key</Chip> : <Chip tone={updateTone(d.updateState)}>{d.updateState || "idle"}</Chip>}{d.updateTarget && <span className="ml-2 text-gray-500">to {d.updateTarget}</span>}</td>
                    <td className="px-4 py-3">{d.notReporting ? <span className="text-gray-400">—</span> : d.lastResult ? <><Chip tone={resultTone(d.lastResult)}>{d.lastResult}</Chip><span className="ml-2 text-gray-400">{relative(d.lastResultAt)}</span></> : <span className="text-gray-400">none</span>}</td>
                    <td className="px-4 py-3">{d.failedVersions?.length ? d.failedVersions.join(", ") : "—"}{d.hint && <Chip tone="amber">{d.hint.kind}</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "releases" && (
        <div className="google-card mx-2 bg-white border border-gray-100 rounded-3xl shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {["Version", "Sequence", "Channel", "Status", "Rollout", "Actions"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {releases.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No releases yet.</td></tr>}
              {releases.map((r) => (
                <tr key={r.id} className="border-t border-gray-50">
                  <td className="px-4 py-3 font-bold text-[#333333]">{r.version}{r.rollback && <Chip tone="amber">rollback</Chip>}</td>
                  <td className="px-4 py-3">{r.sequence}</td>
                  <td className="px-4 py-3">{r.channel}</td>
                  <td className="px-4 py-3"><Chip tone={releaseTone(r.status)}>{r.status}</Chip></td>
                  <td className="px-4 py-3">{r.rollout?.percentage ?? 0}%{r.rollout?.cohorts?.length ? ` + ${r.rollout.cohorts.length} cohort(s)` : ""}{r.rollout?.allowlist?.length ? ` + ${r.rollout.allowlist.length} named` : ""}</td>
                  <td className="px-4 py-3 space-x-3 font-bold text-[#195C51]">
                    {["draft", "paused"].includes(r.status) && <button onClick={() => releaseAction(r, "activate")}>Activate</button>}
                    {r.status === "active" && <button onClick={() => releaseAction(r, "pause")}>Pause</button>}
                    {r.status !== "revoked" && <button onClick={() => setPercentage(r)}>Rollout</button>}
                    {r.status !== "revoked" && <button className="text-red-600" onClick={() => releaseAction(r, "revoke")}>Revoke</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "units" && (
        <div className="google-card mx-2 bg-white border border-gray-100 rounded-3xl shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {["Serial", "Status", "Image", "Batch", "Updated"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {units.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No factory-provisioned cameras yet.</td></tr>}
              {units.map((u) => (
                <tr key={u.serial} className="border-t border-gray-50">
                  <td className="px-4 py-3 font-bold text-[#333333]">{u.serial}</td>
                  <td className="px-4 py-3"><Chip tone={unitTone(u.status)}>{u.status}</Chip></td>
                  <td className="px-4 py-3">{u.image || "—"}</td>
                  <td className="px-4 py-3">{u.batch || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{relative(u.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-[10px] text-gray-400">Provisioning and recovery run from the factory tool; this list is read-only.</p>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setDetail(null)}>
          <div className="w-full sm:w-[440px] bg-white h-full overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#333333]">{detail.device.serial}</h2>
                <p className="text-xs text-gray-500">{detail.device.version || "unknown"} · updater {detail.device.updaterVersion || "unknown"} · seen {relative(detail.device.lastSeenAt)}</p>
              </div>
              <button onClick={() => setDetail(null)} aria-label="Close"><MdClose size={20} /></button>
            </div>

            {detail.device.lastFailure && (
              <div className="p-3 bg-red-50 rounded-2xl text-xs text-red-700">
                Last failure: {detail.device.lastFailure.version} — {detail.device.lastFailure.reason} ({relative(detail.device.lastFailure.at)})
              </div>
            )}

            {detail.device.health && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(detail.device.health).map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-xl px-3 py-2"><span className="text-gray-400">{k}</span> <span className="font-bold">{String(v)}</span></div>
                ))}
              </div>
            )}

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Cohort</p>
              <div className="flex gap-2">
                <input value={cohortDraft} onChange={(e) => setCohortDraft(e.target.value)} placeholder="none" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs" />
                <button onClick={saveCohort} className="px-4 py-2 rounded-xl bg-[#195C51] text-white text-xs font-bold">Save</button>
              </div>
            </div>

            {detail.device.failedVersions?.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Blocked versions</p>
                {detail.device.failedVersions.map((v) => (
                  <div key={v} className="flex items-center justify-between text-xs py-1">
                    <span>{v}</span>
                    <button className="font-bold text-[#195C51]" onClick={() => clearFailed(v)}>Allow again</button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Recent events</p>
              <div className="space-y-1">
                {detail.events.length === 0 && <p className="text-xs text-gray-400">No events yet.</p>}
                {detail.events.map((e) => (
                  <div key={e.id} className="text-xs flex justify-between gap-3 border-b border-gray-50 py-1">
                    <span><b>{e.event}</b> {e.from && `${e.from} → `}{e.to}{e.reason && <span className="text-gray-400"> ({e.reason})</span>}</span>
                    <span className="text-gray-400 whitespace-nowrap">{relative(e.receivedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraFleet;
