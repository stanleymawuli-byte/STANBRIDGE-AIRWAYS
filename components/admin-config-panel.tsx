"use client";

import { useCallback, useEffect, useState } from "react";

type Configuration = {
  supportEmail: string;
  bookingHoldMinutes: number;
  maintenanceMode: boolean;
};

type Backup = {
  id: string;
  label: string;
  createdAt: string;
  createdBy?: { name: string; email: string } | null;
};

async function responseJson<T>(response: Response) {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "The request could not be completed.");
  return data;
}

export function AdminConfigPanel() {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [configResponse, backupResponse] = await Promise.all([
        fetch("/api/admin/config", { cache: "no-store" }),
        fetch("/api/admin/config/backups", { cache: "no-store" }),
      ]);
      const [configData, backupData] = await Promise.all([
        responseJson<{ configuration: Configuration }>(configResponse),
        responseJson<{ backups: Backup[] }>(backupResponse),
      ]);
      setConfiguration(configData.configuration);
      setBackups(backupData.backups);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveConfiguration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configuration) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await responseJson<{ configuration: Configuration }>(await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configuration),
      }));
      setConfiguration(data.configuration);
      setMessage("Configuration saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function createBackup() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await responseJson<{ backup: Backup }>(await fetch("/api/admin/config/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      }));
      setLabel("");
      setMessage("Configuration backup created. User and booking data were not included.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create configuration backup.");
    } finally {
      setSaving(false);
    }
  }

  async function restoreBackup(backup: Backup) {
    if (!window.confirm(`Restore "${backup.label}"? This replaces configuration settings only; users, bookings, and payments will not change.`)) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await responseJson<{ configuration: Configuration }>(
        await fetch(`/api/admin/config/backups/${encodeURIComponent(backup.id)}/restore`, { method: "POST" }),
      );
      setConfiguration(data.configuration);
      setMessage(`Restored "${backup.label}". User, booking, and payment data were not changed.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restore configuration backup.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-config">
      {error && <p className="admin-error" role="alert">{error}</p>}
      {message && <p className="admin-success" role="status">{message}</p>}
      {loading || !configuration ? <p className="admin-empty">Loading configuration...</p> : <>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><h2>System configuration</h2><p>Changes apply to new bookings. Only super-admins can edit these settings.</p></div>
          </div>
          <form className="admin-config-form" onSubmit={(event) => void saveConfiguration(event)}>
            <label>
              <span>SUPPORT EMAIL</span>
              <input type="email" required maxLength={254} value={configuration.supportEmail}
                onChange={(event) => setConfiguration({ ...configuration, supportEmail: event.target.value })} />
            </label>
            <label>
              <span>BOOKING PAYMENT HOLD (MINUTES)</span>
              <input type="number" min={5} max={120} required value={configuration.bookingHoldMinutes}
                onChange={(event) => setConfiguration({ ...configuration, bookingHoldMinutes: Number(event.target.value) })} />
            </label>
            <label className="admin-config-toggle">
              <input type="checkbox" checked={configuration.maintenanceMode}
                onChange={(event) => setConfiguration({ ...configuration, maintenanceMode: event.target.checked })} />
              <span>Pause new bookings while maintenance is active</span>
            </label>
            <button className="admin-refresh" type="submit" disabled={saving}>{saving ? "Saving..." : "Save configuration"}</button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><h2>Configuration restore points</h2><p>Snapshots contain only the settings above, never user accounts, passwords, bookings, or payments.</p></div>
          </div>
          <div className="admin-backup-create">
            <label>
              <span>BACKUP LABEL (OPTIONAL)</span>
              <input value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} placeholder="Before changing booking settings" />
            </label>
            <button className="admin-refresh" type="button" disabled={saving} onClick={() => void createBackup()}>
              Create configuration backup
            </button>
          </div>
          {backups.length === 0 ? <p className="admin-empty">No configuration backups yet.</p> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Backup</th><th>Created</th><th>Created by</th><th>Action</th></tr></thead>
                <tbody>{backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>{backup.label}</td>
                    <td>{new Date(backup.createdAt).toLocaleString()}</td>
                    <td>{backup.createdBy?.name ?? "Deleted user"}</td>
                    <td><button className="admin-action" type="button" disabled={saving} onClick={() => void restoreBackup(backup)}>Restore settings</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </>}
    </div>
  );
}
