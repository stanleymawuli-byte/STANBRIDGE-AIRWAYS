"use client";

import { useEffect, useState } from "react";

type ReportData = {
  bookingsByStatus: Array<{ status: string; count: number }>;
  popularRoutes: Array<{ origin: string; destination: string; bookings: number }>;
  paymentsByCurrency: Array<{ currency: string; status: string; amount: string; count: number }>;
};

async function fetchReportData() {
  const response = await fetch("/api/admin/reports", { cache: "no-store" });
  const data = await response.json() as ReportData & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Could not load reports.");
  return data;
}

export function AdminReportsPanel() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetchReportData().then((report) => {
      if (active) setData(report);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load reports.");
    });
    return () => { active = false; };
  }, []);

  if (error) return <p className="admin-error" role="alert">{error}</p>;
  if (!data) return <p className="admin-empty">Loading reports...</p>;

  return (
    <div className="admin-report-grid">
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>Bookings by status</h2><p>Current booking record counts.</p></div>
        </div>
        {data.bookingsByStatus.length === 0 ? <p className="admin-empty">No booking records yet.</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Status</th><th>Bookings</th></tr></thead>
              <tbody>{data.bookingsByStatus.map((row) => (
                <tr key={row.status}><td>{row.status.replaceAll("_", " ")}</td><td>{row.count}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>Popular routes</h2><p>Most frequently booked city pairs.</p></div>
        </div>
        {data.popularRoutes.length === 0 ? <p className="admin-empty">No route activity yet.</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Route</th><th>Bookings</th></tr></thead>
              <tbody>{data.popularRoutes.map((row) => (
                <tr key={`${row.origin}-${row.destination}`}>
                  <td>{row.origin} → {row.destination}</td><td>{row.bookings}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>Payment summary</h2><p>Amounts are grouped by currency and payment status.</p></div>
        </div>
        {data.paymentsByCurrency.length === 0 ? <p className="admin-empty">No payment records yet.</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Currency</th><th>Status</th><th>Transactions</th><th>Total amount</th></tr></thead>
              <tbody>{data.paymentsByCurrency.map((row) => (
                <tr key={`${row.currency}-${row.status}`}>
                  <td>{row.currency}</td><td>{row.status}</td><td>{row.count}</td><td>{row.amount}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
