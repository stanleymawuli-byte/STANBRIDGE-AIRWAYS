"use client";
import { useCallback, useEffect, useState } from "react";

type Config = { maintenanceMode: boolean; bookingEnabled: boolean; supportEmail: string; announcement: string; displayCurrency: "USD" | "GHS" | "GBP" | "EUR" };
type Report = { title: string; rows: Record<string, unknown>[]; summary?: Record<string, string | number> };
type Snapshot = { id: string; name: string; createdAt: string; createdBy?: { name: string; email: string } | null };
type Backup = { id: string; filename: string; storageType: string; status: string; sizeBytes: string; sha256: string; createdAt: string };
type SystemState = { status: string; checkedAt: string; environment: string; database: string; counts: Record<string, number>; integrations: Record<string, boolean>; latestBackup: { filename: string; status: string; storageType: string; sizeBytes: string } | null; backupStorageConfigured: boolean };

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

export function AdminControlCenter({ role }: { role: string }) {
  const isSuperAdmin = role === "SUPER_ADMIN";
  const canSeeBookings = ["SUPER_ADMIN", "OPERATIONS_MANAGER", "BOOKING_AGENT"].includes(role);
  const canSeePayments = ["SUPER_ADMIN", "FINANCE_OFFICER"].includes(role);
  const [tab, setTab] = useState("reports");
  const [reportType, setReportType] = useState(canSeeBookings ? "bookings" : "payments");
  const [report, setReport] = useState<Report | null>(null);
  const [configuration, setConfiguration] = useState<Config | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [system, setSystem] = useState<SystemState | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadReport = useCallback(async (type: string) => {
    setBusy(true); setError("");
    try { setReport(await readJson<Report>(await fetch("/api/admin/reports?type=" + encodeURIComponent(type), { cache: "no-store" }))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load report."); }
    finally { setBusy(false); }
  }, []);
  const loadSystem = useCallback(async () => {
    try { setSystem(await readJson<SystemState>(await fetch("/api/admin/system-state", { cache: "no-store" }))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load system state."); }
  }, []);
  const loadConfiguration = useCallback(async () => {
    try { const data = await readJson<{ configuration: Config }>(await fetch("/api/admin/configuration", { cache: "no-store" })); setConfiguration(data.configuration); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load configuration."); }
  }, []);
  const loadSnapshots = useCallback(async () => {
    try { const data = await readJson<{ snapshots: Snapshot[] }>(await fetch("/api/admin/configuration/snapshots", { cache: "no-store" })); setSnapshots(data.snapshots); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load restore points."); }
  }, []);
  const loadBackups = useCallback(async () => {
    try { const data = await readJson<{ backups: Backup[] }>(await fetch("/api/admin/backups", { cache: "no-store" })); setBackups(data.backups); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load backups."); }
  }, []);

  useEffect(() => { if (tab === "reports") void loadReport(reportType); if (tab === "system") void loadSystem(); if (tab === "configuration") { void loadConfiguration(); void loadSnapshots(); } if (tab === "backups") void loadBackups(); }, [tab, reportType, loadReport, loadSystem, loadConfiguration, loadSnapshots, loadBackups]);

  async function saveConfiguration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!configuration) return; setBusy(true); setError(""); setMessage("");
    try { await readJson(await fetch("/api/admin/configuration", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ configuration }) })); setMessage("Configuration saved. Existing airline records were not changed."); await loadSystem(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save configuration."); }
    finally { setBusy(false); }
  }
  async function createSnapshot() {
    setBusy(true); setError(""); setMessage("");
    try { await readJson(await fetch("/api/admin/configuration/snapshots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Configuration snapshot " + new Date().toLocaleString() }) })); setMessage("Configuration restore point created."); await loadSnapshots(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create restore point."); }
    finally { setBusy(false); }
  }
  async function restoreSnapshot(snapshot: Snapshot) {
    if (!window.confirm("Restore configuration snapshot " + snapshot.name + "? This changes system settings only; users, bookings, passengers, tickets and payments remain untouched.")) return;
    setBusy(true); setError(""); setMessage("");
    try { const result = await readJson<{ dataTablesModified: boolean }>(await fetch("/api/admin/configuration/snapshots/" + encodeURIComponent(snapshot.id) + "/restore", { method: "POST" })); setMessage(result.dataTablesModified ? "Unexpected data-table change reported." : "Configuration restored. Airline records were not modified."); await loadConfiguration(); await loadSystem(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not restore configuration."); }
    finally { setBusy(false); }
  }
  async function createBackup() {
    setBusy(true); setError(""); setMessage("");
    try { await readJson(await fetch("/api/admin/backups", { method: "POST" })); setMessage("Database backup completed and checksum recorded."); await loadBackups(); await loadSystem(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create backup."); }
    finally { setBusy(false); }
  }

  function chooseTab(value: string) { setError(""); setMessage(""); setTab(value); }
  const reportTabs = [ ...(canSeeBookings ? [{ id: "bookings", label: "Bookings" }] : []), ...(isSuperAdmin ? [{ id: "users", label: "Users" }] : []), ...(canSeePayments ? [{ id: "payments", label: "Payments" }] : []), ...(isSuperAdmin ? [{ id: "security", label: "Security" }, { id: "audit", label: "Audit logs" }] : []), { id: "system", label: "System" } ];

  return (
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><h2>System administration</h2><p>Reports, configuration restore points, database backups and system health.</p></div></div>
      <div className="admin-report-tabs" role="tablist" aria-label="System administration tabs">
        <button type="button" role="tab" aria-selected={tab === "reports"} className={tab === "reports" ? "active" : ""} onClick={() => { setReportType(reportTabs[0]?.id || "system"); chooseTab("reports"); }}>Reports</button>
        {isSuperAdmin && <button type="button" role="tab" aria-selected={tab === "configuration"} className={tab === "configuration" ? "active" : ""} onClick={() => chooseTab("configuration")}>Configuration & restore</button>}
        {isSuperAdmin && <button type="button" role="tab" aria-selected={tab === "backups"} className={tab === "backups" ? "active" : ""} onClick={() => chooseTab("backups")}>Database backups</button>}
        <button type="button" role="tab" aria-selected={tab === "system"} className={tab === "system" ? "active" : ""} onClick={() => chooseTab("system")}>Current state</button>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {message && <p className="admin-note" role="status">{message}</p>}
      {tab === "reports" && <div className="admin-control-body">
        <div className="admin-report-tabs" role="tablist" aria-label="Reports">{reportTabs.map((item) => <button type="button" role="tab" key={item.id} aria-selected={reportType === item.id} className={reportType === item.id ? "active" : ""} onClick={() => setReportType(item.id)}>{item.label}</button>)}</div>
        {busy ? <p className="admin-empty">Loading report...</p> : report ? <><h3>{report.title}</h3>{report.summary && <div className="admin-metrics">{Object.entries(report.summary).map(([key, value]) => <Metric key={key} label={key} value={value} />)}</div>}{report.rows.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{Object.keys(report.rows[0]).map((key) => <th key={key}>{key.replace(/[A-Z]/g, (letter) => " " + letter).toUpperCase()}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={index}>{Object.values(row).map((value, cell) => <td key={cell}>{String(value ?? "—")}</td>)}</tr>)}</tbody></table></div> : <p className="admin-empty">No report records available.</p>}</> : <p className="admin-empty">Choose a report tab.</p>}
      </div>}
      {tab === "configuration" && isSuperAdmin && <div className="admin-control-body">
        {configuration ? <form className="security-form" onSubmit={saveConfiguration}>
          <label><span>Support email</span><input type="email" value={configuration.supportEmail} onChange={(event) => setConfiguration({ ...configuration, supportEmail: event.target.value })} required /></label>
          <label><span>Announcement</span><textarea maxLength={500} value={configuration.announcement} onChange={(event) => setConfiguration({ ...configuration, announcement: event.target.value })} /></label>
          <label><span>Display currency</span><select value={configuration.displayCurrency} onChange={(event) => setConfiguration({ ...configuration, displayCurrency: event.target.value as Config["displayCurrency"] })}><option>USD</option><option>GHS</option><option>GBP</option><option>EUR</option></select></label>
          <label><span><input type="checkbox" checked={configuration.bookingEnabled} onChange={(event) => setConfiguration({ ...configuration, bookingEnabled: event.target.checked })} /> Enable new bookings</span></label>
          <label><span><input type="checkbox" checked={configuration.maintenanceMode} onChange={(event) => setConfiguration({ ...configuration, maintenanceMode: event.target.checked })} /> Maintenance mode</span></label>
          <button className="admin-action primary" type="submit" disabled={busy}>Save configuration</button>
        </form> : <p className="admin-empty">Loading configuration...</p>}
        <div className="admin-list"><h3>Configuration restore points</h3><button type="button" className="admin-action" disabled={busy} onClick={() => void createSnapshot()}>Create restore point</button>{snapshots.map((item) => <div className="admin-list-row" key={item.id}><div><strong>{item.name}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div><button type="button" className="admin-action" disabled={busy} onClick={() => void restoreSnapshot(item)}>Restore settings</button></div>)}{snapshots.length === 0 && <p className="admin-empty">No configuration restore points yet.</p>}</div>
      </div>}
      {tab === "backups" && isSuperAdmin && <div className="admin-control-body">
        <p className="admin-note">Database dumps are separate from configuration restore points. Configure pg_dump and durable S3 or persistent storage before production use.</p>
        <button type="button" className="admin-action primary" disabled={busy} onClick={() => void createBackup()}>Create database backup</button>
        <div className="admin-list"><h3>Backup history</h3>{backups.map((item) => <div className="admin-list-row" key={item.id}><div><strong>{item.filename}</strong><small>{new Date(item.createdAt).toLocaleString()} · {formatBytes(item.sizeBytes)} · {item.storageType} · SHA-256 {item.sha256.slice(0, 16)}…</small></div><a className="admin-action" href={"/api/admin/backups/" + encodeURIComponent(item.id)}>Download backup</a></div>)}{backups.length === 0 && <p className="admin-empty">No database backups recorded.</p>}</div>
      </div>}
      {tab === "system" && <div className="admin-control-body">
        <button type="button" className="admin-action" disabled={busy} onClick={() => void loadSystem()}>Refresh system state</button>
        {system ? <><div className="admin-metrics"><Metric label="Status" value={system.status} /><Metric label="Database" value={system.database} /><Metric label="Users" value={system.counts.users} /><Metric label="Bookings" value={system.counts.bookings} /><Metric label="Payments" value={system.counts.payments} /><Metric label="Audit events" value={system.counts.auditEvents} /></div><p className="admin-note">Checked {new Date(system.checkedAt).toLocaleString()} · {system.environment}</p><div className="admin-list">{Object.entries(system.integrations).map(([key, value]) => <div className="admin-list-row" key={key}><strong>{key.replace(/([A-Z])/g, " $1")}</strong><span className={"admin-status " + (value ? "confirmed" : "pending")}>{value ? "Configured" : "Not configured"}</span></div>)}</div><p className="admin-note">Latest backup: {system.latestBackup ? system.latestBackup.filename + " · " + system.latestBackup.status + " · " + formatBytes(system.latestBackup.sizeBytes) : "No backup recorded"}</p>{!system.backupStorageConfigured && <p className="admin-error">Production backup storage is not configured.</p>}</> : <p className="admin-empty">Loading system state...</p>}
      </div>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value?: string | number }) {
  return <article className="admin-metric"><span>{label}</span><strong>{value ?? "—"}</strong></article>;
}
function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "Unknown size";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
