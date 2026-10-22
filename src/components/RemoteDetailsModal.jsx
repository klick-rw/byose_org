// src/components/RemoteDetailsModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { getImageData, getOwnerLabel, lastNChars, sendData } from "../utils/helper.js";
import { presence_server, presence_control_server } from "../config/server_api.js";
import { deviceLogsUrl } from "../utils/deviceControlUrl.js";
import { useNotification } from "../context/NotificationContext.jsx";
import { X, Download, Cpu, Power, Hash, User as UserIcon, Terminal } from "lucide-react";

export default function RemoteDetailsModal({
    remote,
    onClose,
    copyToClipboard,
    handleAddHadware,
    handleTestingHardware,
    handleRemoteStatus
}) {
    const { showNotification } = useNotification();
    const [gradientColor1, setGradientColor1] = useState("#195C51");
    const [gradientColor2, setGradientColor2] = useState("#0E3A32");
    const [qrPreview, setQrPreview] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState(null);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsUnlocked, setLogsUnlocked] = useState(false);
    const debounceRef = useRef(null);

    const postConfig = () => {
        if (!remote?.serialNumber) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);

        setQrLoading(true);
        setQrError(null);

        debounceRef.current = setTimeout(async () => {
            const payload = {
                data: remote.serialNumber,
                config: {
                    bgColor: "#FFFFFF",
                    body: "rounded-pointed",
                    bodyColor: "#000000",
                    eye: "frame5", eyeBall: "ball11",
                    eye1Color: "#000000", eye2Color: "#000000", eye3Color: "#000000",
                    eyeBall1Color: "#000000", eyeBall2Color: "#000000", eyeBall3Color: "#000000",
                    brf1: ["fh"], brf2: [], brf3: ["fh", "fv"],
                    erf1: ["fh"], erf2: [], erf3: ["fh", "fv"],
                    gradientType: "linear",
                    gradientColor1, gradientColor2,
                    gradientOnEyes: true,
                    logo: "https://res.cloudinary.com/ddsojj7zo/image/upload/v1740752483/Branding%20Logo/li6zzanqqokxl4rbsr6g.svg",
                    logoMode: "default",
                    file: "svg", size: 1000, download: "imageUrl"
                }
            };

            const url = presence_server + "/api/admin/get-qrCode";
            const res = await getImageData(url, payload, "");
            if (res?.error || res?.data === -1 || !res?.data) {
                setQrError(res?.error || "Failed to generate QR");
                setQrPreview(null);
                showNotification("Failed to generate QR: " + (res?.error || "unknown error"), "error");
            } else {
                setQrPreview(res.data);
                setQrError(null);
            }
            setQrLoading(false);
        }, 600);
    };

    const handleToggleLogs = async () => {
        const action = logsUnlocked ? "lock" : "unlock";
        setLogsLoading(true);
        // Publishes to the device over MQTT, so it goes to the host that holds the broker connection.
        const url = deviceLogsUrl(presence_control_server, remote.serialNumber);
        const res = await sendData(url, { action });
        if (res?.error || res?.data === -1) {
            showNotification(res?.error || "Failed to toggle logs", "error");
        } else {
            const nowUnlocked = action === "unlock";
            setLogsUnlocked(nowUnlocked);
            showNotification(
                nowUnlocked
                    ? "Serial logs unlocked for 10 minutes"
                    : "Serial logs locked",
                "success"
            );
        }
        setLogsLoading(false);
    };

    useEffect(() => {
        postConfig();
        return () => clearTimeout(debounceRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remote?.serialNumber, gradientColor1, gradientColor2]);

    const isDeployed = remote.state === 'sold';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative z-50 w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">

                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${isDeployed ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-display font-bold text-slate-900">{remote.serialNumber}</h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${isDeployed ? 'bg-indigo-200 text-indigo-800' : 'bg-emerald-200 text-emerald-800'}`}>
                                {isDeployed ? 'Deployed' : 'In Stock'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1">{remote.manufacture}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/50 hover:bg-white rounded-full text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Left Column: Info & Actions */}
                        <div className="lg:col-span-2 space-y-8">

                            {/* Device Info */}
                            <section>
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                    <Cpu size={16} className="text-[#195C51]"/> Hardware Specifications
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Model</p>
                                        <p className="text-sm font-semibold text-slate-900 uppercase">{remote.modelType}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Has Hardware</p>
                                        <p className="text-sm font-semibold text-slate-900">{remote.hasHardware ? "Yes" : "No"}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Firmware Version</p>
                                        <p className="text-sm font-semibold text-slate-900">{remote.version}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 flex items-center gap-1">
                                            <UserIcon size={12}/> Assigned Owner
                                        </p>
                                        <p className={`text-sm font-semibold ${remote.owner ? 'text-[#195C51]' : 'text-slate-400 italic'}`}>
                                            {typeof remote.owner === "object" ? getOwnerLabel(remote.owner) : remote.owner || "Unassigned"}
                                        </p>
                                    </div>
                                </div>

                                {/* Admin Actions */}
                                <div className="flex flex-wrap gap-3 mt-4">
                                    <button onClick={() => copyToClipboard(remote.id, "Remote ID")} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition-colors border border-slate-200">
                                        Copy Remote ID
                                    </button>
                                    {!remote.hasHardware && (
                                        <button onClick={() => handleAddHadware(remote.id)} className="px-4 py-2 bg-[#195C51] text-white font-bold text-xs rounded-lg hover:bg-[#0E3A32] transition-colors shadow-md">
                                            Attach Hardware
                                        </button>
                                    )}
                                    {!remote.owner && (
                                        <button onClick={() => handleTestingHardware(remote.id)} className="px-4 py-2 bg-amber-100 text-amber-700 font-bold text-xs rounded-lg hover:bg-amber-200 border border-amber-200 transition-colors">
                                            Run Diagnostic Test
                                        </button>
                                    )}
                                    {!remote.owner && (
                                        <button onClick={() => handleRemoteStatus(remote.id, remote.isEnabled)} className={`px-4 py-2 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 ${remote.isEnabled ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'}`}>
                                            <Power size={14} /> {remote.isEnabled ? "Disable Device" : "Enable Device"}
                                        </button>
                                    )}

                                    {/* Log Toggle Button */}
                                    <button
                                        onClick={handleToggleLogs}
                                        disabled={logsLoading}
                                        className={`px-4 py-2 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                            logsUnlocked
                                                ? 'bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100'
                                                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        {logsLoading ? (
                                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Terminal size={14} />
                                        )}
                                        {logsUnlocked ? "Lock Serial Logs" : "Unlock Serial Logs"}
                                    </button>

                                </div>

                                {/* Log session active notice */}
                                {logsUnlocked && (
                                    <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
                                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                                        <p className="text-[11px] text-violet-700 font-medium">
                                            Serial logs active — session expires in 10 minutes
                                        </p>
                                    </div>
                                )}
                            </section>

                            {/* Buttons Config */}
                            <section>
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                    <Hash size={16} className="text-[#195C51]"/> Pin Configuration
                                </h4>
                                <div className="space-y-3">
                                    {!remote.buttons || remote.buttons.length === 0 ? (
                                        <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                                            <p className="text-sm text-slate-500 font-medium">No physical buttons configured.</p>
                                        </div>
                                    ) : (
                                        remote.buttons.map((b) => (
                                            <div key={b._id} className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="text-sm font-bold text-slate-900">{b.labelName}</p>
                                                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 rounded">{lastNChars(b._id, 5)}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 capitalize">{b.buttonType} switch</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${b.status ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {b.status ? 'Active' : 'Idle'}
                                                    </span>
                                                    <button disabled={!!remote.owner} onClick={() => copyToClipboard(b._id, "Button ID")} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                                                        Copy ID
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* Right Column: QR Code & Styling */}
                        <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-slate-200 pt-8 lg:pt-0 lg:pl-8">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Device Pairing Code</h4>
                            
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center">
                                {qrLoading ? (
                                    <div className="w-full aspect-square flex flex-col items-center justify-center text-slate-400 gap-3">
                                        <div className="w-8 h-8 border-2 border-[#195C51] border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-xs font-medium">Generating Code...</p>
                                    </div>
                                ) : qrError ? (
                                    <div className="w-full aspect-square flex flex-col items-center justify-center text-center gap-3 p-4">
                                        <p className="text-xs font-medium text-red-600">{qrError}</p>
                                        <button
                                            onClick={postConfig}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-[#195C51] hover:text-[#195C51] transition-all"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                ) : qrPreview ? (
                                    <div className="relative group cursor-pointer w-full aspect-square bg-white rounded-xl p-2 shadow-sm border border-slate-100"
                                         onClick={() => {
                                            const a = document.createElement("a");
                                            a.href = qrPreview;
                                            a.download = `${remote.serialNumber}_PairingQR.png`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                         }}
                                    >
                                        <img src={qrPreview} alt="QR Code" className="w-full h-full object-contain" />
                                        <div className="absolute inset-0 bg-slate-900/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                                            <Download size={24} className="mb-2"/>
                                            <span className="text-xs font-bold uppercase tracking-widest">Download</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full aspect-square flex flex-col items-center justify-center text-slate-400 text-xs">
                                        No QR available
                                    </div>
                                )}
                                
                                <div className="w-full mt-6 space-y-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Brand Gradient</h5>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500">Color 1</label>
                                            <input type="color" value={gradientColor1} onChange={(e) => setGradientColor1(e.target.value)} className="w-full h-8 rounded cursor-pointer border-0 p-0" />
                                        </div>
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500">Color 2</label>
                                            <input type="color" value={gradientColor2} onChange={(e) => setGradientColor2(e.target.value)} className="w-full h-8 rounded cursor-pointer border-0 p-0" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}