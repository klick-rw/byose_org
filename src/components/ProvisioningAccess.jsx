import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { MdOutlineKey, MdContentCopy, MdRefresh } from "react-icons/md";
import { fetchData, sendData, deleteData, returnToken } from "../utils/helper.js";
import { presence_server } from "../config/server_api.js";
import { useNotification } from "../context/NotificationContext.jsx";

// Short-lived provisioning tokens for the factory tool. Each operator signs in with their own account and creates their own
// token here: it expires on its own (30 minutes by default, 60 at most), is shown only once, can be revoked at any time, and
// opens ONLY the provisioning routes. There is no shared factory password. (Backend: /api/factory/tokens)

const API = `${presence_server}/api/factory/tokens`;

const minutesLeft = (iso) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));

const ProvisioningAccess = ({ isAdmin }) => {
  const { showNotification } = useNotification();
  const [minutes, setMinutes] = useState(30);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState(null);       // the token just created: shown once
  const [mine, setMine] = useState([]);
  const [all, setAll] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = returnToken();
    const own = await fetchData(API, token);
    if (!own.error) setMine(own.data.tokens || []);
    if (isAdmin) {
      const everyone = await fetchData(`${API}/all`, token);
      if (!everyone.error) setAll(everyone.data.tokens || []);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    const res = await sendData(API, { minutes, label: label.trim() }, returnToken());
    setBusy(false);
    if (res.error) return;
    setFresh(res.data);
    setLabel("");
    load();
  };

  const revoke = async (id) => {
    if (!window.confirm("Revoke this token now? The factory tool using it stops working at once.")) return;
    const res = await deleteData(`${API}/${id}`, returnToken());
    if (!res.error) {
      showNotification("Token revoked", "success");
      if (fresh && fresh.id === id) setFresh(null);
      load();
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification("Copied", "success");
    } catch {
      showNotification("Could not copy: select the text and copy it by hand", "error");
    }
  };

  const rows = (list, showUser) => (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          {["Label", ...(showUser ? ["Operator"] : []), "Allowed", "Expires in", "Uses", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {list.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-gray-400">None.</td></tr>}
        {list.map((t) => (
          <tr key={t.id} className="border-t border-gray-50">
            <td className="px-3 py-2">{t.label || "—"}</td>
            {showUser && <td className="px-3 py-2 text-gray-500">{t.user.slice(-6)}</td>}
            <td className="px-3 py-2">{t.scopes.join(", ")}</td>
            <td className="px-3 py-2">{minutesLeft(t.expiresAt)} min</td>
            <td className="px-3 py-2">{t.uses}</td>
            <td className="px-3 py-2"><button className="font-bold text-red-600" onClick={() => revoke(t.id)}>Revoke</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-5">
      <div className="google-card mx-2 bg-white border border-gray-100 rounded-3xl shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 text-[#333333]">
          <MdOutlineKey size={20} className="text-[#195C51]" />
          <h2 className="text-lg font-bold">Provisioning access</h2>
          <button onClick={load} className="ml-auto p-2 rounded-xl text-[#195C51]" aria-label="Refresh"><MdRefresh size={18} /></button>
        </div>
        <p className="text-xs text-gray-500">
          A token lets the factory tool provision or recover cameras as you. It is yours alone, expires on its own, is shown
          once and can be revoked here at any time. Never save it in a file or share it.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-gray-500">Lasts
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="ml-2 border border-gray-200 rounded-xl px-3 py-2 text-xs">
              {[15, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-gray-500">Label
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="bench 1" className="ml-2 border border-gray-200 rounded-xl px-3 py-2 text-xs" />
          </label>
          <button onClick={create} disabled={busy} className="px-4 py-2 rounded-xl bg-[#195C51] text-white text-xs font-bold disabled:opacity-50">
            {busy ? "Creating…" : "Create token"}
          </button>
        </div>
        {fresh && (
          <div className="p-4 bg-amber-50 rounded-2xl space-y-2 text-xs">
            <p className="font-bold text-amber-800">Copy it now: it is shown only once. It expires in {minutesLeft(fresh.expiresAt)} minutes.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all bg-white rounded-xl px-3 py-2">export PEYE_PROVISION_TOKEN={fresh.token}</code>
              <button onClick={() => copy(`export PEYE_PROVISION_TOKEN=${fresh.token}`)} aria-label="Copy" className="p-2 rounded-xl bg-white"><MdContentCopy size={16} /></button>
            </div>
            <button className="font-bold text-gray-500" onClick={() => setFresh(null)}>I have copied it</button>
          </div>
        )}
        <div className="overflow-x-auto">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">My live tokens</p>
          {rows(mine, false)}
        </div>
        {isAdmin && (
          <div className="overflow-x-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">All live tokens (admin)</p>
            {rows(all, true)}
          </div>
        )}
      </div>
    </div>
  );
};

ProvisioningAccess.propTypes = { isAdmin: PropTypes.bool };

export default ProvisioningAccess;
