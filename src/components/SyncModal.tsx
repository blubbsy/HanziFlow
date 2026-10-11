import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Copy,
  Edit2,
  KeyRound,
  Laptop,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type { UserState } from '../types';
import {
  generateSyncKey,
  normalizeSyncKey,
} from '../utils/syncCrypto';
import {
  fetchVaultDevices,
  getCachedDevices,
  getDeviceName,
  getLastSyncedTime,
  getOrCreateDeviceId,
  getStoredSyncKey,
  pushVault,
  revokeDevice,
  setDeviceName,
  setStoredSyncKey,
  syncBidirectional,
  unlinkAllOtherDevices,
  type SyncDevice,
} from '../utils/syncService';
import { useI18n, type I18n } from '../i18n/react';
import { ModalFrame } from './ModalFrame';

interface Props {
  state: UserState;
  isOpen: boolean;
  onClose: () => void;
  onStateMerged: (mergedState: UserState) => void;
}

/** "Active now", "5 min. ago", … or the date, in the interface language. */
function formatRelativeTime(isoString: string, i18n: I18n): string {
  try {
    const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSec < 45) return i18n.t('sync.activeNow');
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return i18n.formatRelative(-diffMin, 'minute');
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return i18n.formatRelative(-diffHours, 'hour');
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return i18n.formatRelative(-diffDays, 'day');
    return i18n.formatDate(new Date(isoString));
  } catch {
    return i18n.t('sync.recently');
  }
}

export function SyncModal({ state, isOpen, onClose, onStateMerged }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const [syncKey, setSyncKey] = useState<string | null>(getStoredSyncKey);
  const [lastSynced, setLastSynced] = useState<string | null>(getLastSyncedTime);
  const [inputCode, setInputCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Device management state
  const myDeviceId = getOrCreateDeviceId();
  const [devices, setDevices] = useState<Record<string, SyncDevice>>(getCachedDevices);
  const [myDeviceName, setMyDeviceName] = useState<string>(getDeviceName);
  const [editingDeviceName, setEditingDeviceName] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState(getDeviceName);
  const [unlinkingDeviceId, setUnlinkingDeviceId] = useState<string | null>(null);
  const [rotatingKey, setRotatingKey] = useState(false);

  // Sync link for QR and direct sharing
  const syncLink = syncKey
    ? `${window.location.origin}${window.location.pathname}#/sync-pair?key=${encodeURIComponent(syncKey)}`
    : '';

  // Generate QR Code when syncKey is active
  useEffect(() => {
    if (!syncKey) {
      setQrDataUrl(null);
      return;
    }

    QRCode.toDataURL(syncLink, {
      width: 260,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [syncKey, syncLink]);

  // Fetch updated device list when modal opens
  useEffect(() => {
    if (isOpen && syncKey) {
      fetchVaultDevices(syncKey)
        .then((devs) => setDevices(devs))
        .catch(() => {});
    }
  }, [isOpen, syncKey]);

  if (!isOpen) return null;

  const handleStartNewSync = async () => {
    setErrorMsg(null);
    setSyncing(true);
    try {
      const newKey = generateSyncKey();
      const res = await syncBidirectional(newKey, state);
      setStoredSyncKey(newKey);
      setSyncKey(newKey);
      setDevices(res.devices);
      setLastSynced(new Date().toISOString());
      onStateMerged(res.mergedState);
      setSuccessMsg(t('sync.ok.initialized'));
    } catch (err) {
      setErrorMsg(t('sync.error.init', { message: (err as Error).message }));
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectWithCode = async () => {
    const clean = normalizeSyncKey(inputCode);
    if (!clean || clean.length < 10) {
      setErrorMsg(t('sync.error.invalidCode'));
      return;
    }
    setErrorMsg(null);
    setSyncing(true);
    try {
      const formattedKey = inputCode.trim().toUpperCase();
      const res = await syncBidirectional(formattedKey, state);
      setStoredSyncKey(formattedKey);
      setSyncKey(formattedKey);
      setDevices(res.devices);
      setLastSynced(new Date().toISOString());
      onStateMerged(res.mergedState);
      setInputCode('');
      setSuccessMsg(t('sync.ok.connected'));
    } catch (err) {
      setErrorMsg(t('sync.error.link', { message: (err as Error).message }));
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSyncNow = async () => {
    if (!syncKey) return;
    setErrorMsg(null);
    setSyncing(true);
    try {
      const res = await syncBidirectional(syncKey, state);
      setDevices(res.devices);
      setLastSynced(new Date().toISOString());
      onStateMerged(res.mergedState);
      setSuccessMsg(t('sync.ok.synced'));
    } catch (err) {
      setErrorMsg(t('sync.error.sync', { message: (err as Error).message }));
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveDeviceName = () => {
    const trimmed = deviceNameInput.trim();
    if (!trimmed) return;
    setDeviceName(trimmed);
    setMyDeviceName(trimmed);
    setEditingDeviceName(false);
    setDevices((prev) => ({
      ...prev,
      [myDeviceId]: {
        ...prev[myDeviceId],
        name: trimmed,
      },
    }));
    if (syncKey) {
      pushVault(syncKey, state).catch(() => {});
    }
  };

  const handleRevokeRemote = async (targetId: string, targetName: string) => {
    if (!syncKey) return;
    if (!window.confirm(t('sync.confirm.revoke', { name: targetName }))) {
      return;
    }
    setUnlinkingDeviceId(targetId);
    setErrorMsg(null);
    try {
      const updatedDevices = await revokeDevice(syncKey, targetId, state);
      setDevices(updatedDevices);
      setSuccessMsg(t('sync.ok.unlinked', { name: targetName }));
    } catch (err) {
      setErrorMsg(t('sync.error.unlink', { message: (err as Error).message }));
    } finally {
      setUnlinkingDeviceId(null);
    }
  };

  const handleRotateAndUnlinkOthers = async () => {
    if (!syncKey) return;
    if (!window.confirm(t('sync.confirm.rotate'))) {
      return;
    }
    setRotatingKey(true);
    setErrorMsg(null);
    try {
      const { newKey, devices: freshDevices } = await unlinkAllOtherDevices(syncKey, state);
      setSyncKey(newKey);
      setDevices(freshDevices);
      setLastSynced(new Date().toISOString());
      setSuccessMsg(t('sync.ok.rotated'));
    } catch (err) {
      setErrorMsg(t('sync.error.unlinkOthers', { message: (err as Error).message }));
    } finally {
      setRotatingKey(false);
    }
  };

  const handleUnlink = () => {
    if (window.confirm(t('sync.confirm.disconnect'))) {
      if (syncKey) {
        revokeDevice(syncKey, myDeviceId, state).catch(() => {});
      }
      setStoredSyncKey(null);
      setSyncKey(null);
      setLastSynced(null);
      setSuccessMsg(t('sync.ok.disconnected'));
    }
  };

  const copyToClipboard = (text: string, isLink: boolean) => {
    navigator.clipboard.writeText(text).then(() => {
      if (isLink) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    });
  };

  const activeDeviceList = Object.values(devices).filter((d) => !d.revoked);

  const getDeviceIcon = (type: SyncDevice['type']) => {
    if (type === 'mobile') return <Smartphone className="h-4 w-4" />;
    if (type === 'tablet') return <Tablet className="h-4 w-4" />;
    return <Laptop className="h-4 w-4" />;
  };

  return (
    <ModalFrame label={t('app.cloudSync')} onClose={onClose} className="animate-fade-in relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <Zap className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('settings.group.sync')}</h2>
                {syncKey && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t('settings.sync.badge')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('sync.tagline')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {syncKey ? (
            /* ACTIVE SYNC VIEW */
            <div className="space-y-6">
              {/* Sync Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('sync.lastSynced')}</div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {lastSynced ? i18n.formatDate(new Date(lastSynced), { dateStyle: 'medium', timeStyle: 'short' }) : t('sync.justNow')}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualSyncNow}
                    disabled={syncing}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                  >
                    {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {t('sync.syncNow')}
                  </button>
                  <button
                    onClick={handleUnlink}
                    className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/40"
                    title={t('sync.disconnect')}
                    aria-label={t('sync.disconnect')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Linked Devices Management Section */}
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {t('sync.linkedDevices', { count: activeDeviceList.length })}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">{t('sync.manageHint')}</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border-t border-slate-100 dark:border-slate-800/70">
                  {activeDeviceList.map((dev) => {
                    const isCurrent = dev.id === myDeviceId;
                    const isUnlinking = unlinkingDeviceId === dev.id;

                    return (
                      <div key={dev.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            isCurrent
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {getDeviceIcon(dev.type)}
                          </span>

                          <div className="space-y-0.5">
                            {isCurrent && editingDeviceName ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={deviceNameInput}
                                  onChange={(e) => setDeviceNameInput(e.target.value)}
                                  className="rounded-lg border border-slate-300 px-2 py-0.5 text-xs text-slate-800 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveDeviceName();
                                    if (e.key === 'Escape') setEditingDeviceName(false);
                                  }}
                                />
                                <button
                                  onClick={handleSaveDeviceName}
                                  className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                  title={t('sync.saveName')}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingDeviceName(false)}
                                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title={t('common.cancel')}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                  {isCurrent ? myDeviceName : dev.name}
                                </span>
                                {isCurrent && (
                                  <>
                                    <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                      {t('sync.thisDevice')}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setDeviceNameInput(myDeviceName);
                                        setEditingDeviceName(true);
                                      }}
                                      className="text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                                      title={t('sync.rename')}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            <div className="text-xs text-slate-500">
                              {isCurrent ? t('sync.activeNow') : t('sync.lastActive', { time: formatRelativeTime(dev.lastActiveAt, i18n) })}
                            </div>
                          </div>
                        </div>

                        {!isCurrent && (
                          <button
                            onClick={() => handleRevokeRemote(dev.id, dev.name)}
                            disabled={isUnlinking}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            title={t('sync.unlinkTitle')}
                          >
                            {isUnlinking ? (
                              <Loader2 className="h-3 w-3 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            <span>{t('sync.unlink')}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QR Code Card */}
              <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-800/60 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-3">
                  <Smartphone className="h-4 w-4" /> {t('sync.scanTitle')}
                </div>

                {qrDataUrl ? (
                  <div className="overflow-hidden rounded-2xl border-4 border-white bg-white p-2 shadow-md">
                    <img src={qrDataUrl} alt={t('sync.qrAlt')} className="h-48 w-48" />
                  </div>
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                  </div>
                )}

                <p className="mt-3 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  {t('sync.scanHint')}
                </p>

                {/* 1-Click Link Copy */}
                <div className="mt-4 flex w-full max-w-md items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                  <span className="truncate font-mono text-slate-600 dark:text-slate-300 text-xs">
                    {syncLink}
                  </span>
                  <button
                    onClick={() => copyToClipboard(syncLink, true)}
                    className="ml-2 inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedLink ? t('sync.copied') : t('sync.copy')}
                  </button>
                </div>
              </div>

              {/* Pairing Code Card */}
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('sync.pairingCode')}</div>
                    <div className="font-mono text-base font-bold tracking-wider text-slate-900 dark:text-white">
                      {syncKey}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(syncKey, false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedCode ? t('sync.copied') : t('sync.copyCode')}
                  </button>
                </div>
              </div>

              {/* Danger / Key Rotation Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                      <span>{t('sync.security.title')}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t('sync.security.desc')}
                    </p>
                  </div>
                  <button
                    onClick={handleRotateAndUnlinkOthers}
                    disabled={rotatingKey}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    {rotatingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                    {t('sync.security.action')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* NOT SYNCED YET VIEW */
            <div className="space-y-6">
              {/* Feature highlight */}
              <div className="rounded-2xl border border-rose-200/60 bg-rose-50/50 p-4 dark:border-rose-950 dark:bg-rose-950/20">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-slate-900 dark:text-white">{t('sync.intro.title')}</div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {i18n.rich('sync.intro.desc', undefined, { strong: (text) => <strong>{text}</strong> })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 1: Start New Sync */}
              <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Laptop className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('sync.new.title')}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('sync.new.desc')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleStartNewSync}
                  disabled={syncing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  {t('sync.new.action')}
                </button>
              </div>

              {/* Option 2: Connect Existing Code */}
              <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('sync.existing.title')}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('sync.existing.desc')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder={t('sync.existing.placeholder')}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-900 placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    onClick={handleConnectWithCode}
                    disabled={syncing || !inputCode.trim()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                  >
                    {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('sync.existing.connect')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
    </ModalFrame>
  );
}

