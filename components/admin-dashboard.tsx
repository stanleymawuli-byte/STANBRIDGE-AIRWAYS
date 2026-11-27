"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminControlCenter } from "@/components/admin-control-center";

type Metrics = {
  customers: number;
  allBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  successfulPayments: number;
  successfulPaymentTotal: Array<{ currency: string; amount: string }>;
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  origin: string;
  destination: string;
  departureDate: string;
  cabin: string;
  fareAmount: string;
  fareCurrency: string;
  amadeusOrderStatus: string;
  amadeusOrderId: string | null;
  amadeusRecordLocator: string | null;
  amadeusOrderError: string | null;
  user: { name: string; email: string };
  passengers: Array<{ title: string; firstName: string; lastName: string; type: string }>;
  ticket: { ticketNumber: string; status: string } | null;
  payments: Array<{ reference: string; status: string; amount: string; currency: string }>;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  twoFactorEnabled: boolean;
  createdAt: string;
  _count: { bookings: number };
};

const roles = ["CUSTOMER", "BOOKING_AGENT", "OPERATIONS_MANAGER", "FINANCE_OFFICER", "SUPER_ADMIN"];
const statuses = ["ALL", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "EXPIRED"];

async function responseJson<T>(response: Response) {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "The request could not be completed.");
  return data;
}

export function AdminDashboard({ role }: { role: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState("");
  const [orderDetails, setOrderDetails] = useState<Record<string, unknown> | null>(null);
  const canManageUsers = role === "SUPER_ADMIN";

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const bookingQuery = filter === "ALL" ? "" : `?status=${encodeURIComponent(filter)}`;
      const [overviewResponse, bookingResponse] = await Promise.all([
        fetch("/api/admin/overview", { cache: "no-store" }),
        fetch(`/api/admin/bookings${bookingQuery}`, { cache: "no-store" }),
      ]);
      const [overview, bookingData] = await Promise.all([
        responseJson<{ metrics: Metrics }>(overviewResponse),
        responseJson<{ bookings: Booking[] }>(bookingResponse),
      ]);
      setMetrics(overview.metrics);
      setBookings(bookingData.bookings);
      if (canManageUsers) {
        const usersData = await responseJson<{ users: AdminUser[] }>(
          await fetch("/api/admin/users", { cache: "no-store" }),
        );
        setUsers(usersData.users);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load operations data.");
    } finally {
      setLoading(false);
    }
  }, [canManageUsers, filter]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function cancelBooking(bookingId: string) {
    if (!window.confirm("Cancel this booking? This action cannot be undone here.")) return;
    setUpdating(bookingId);
    setError("");
    try {
      await responseJson(await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status: "CANCELLED" }),
      }));
      await loadDashboard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel booking.");
    } finally {
      setUpdating("");
    }
  }

  async function deleteUser(user: AdminUser) {
    const confirmed = window.confirm("Permanently delete " + user.name + " (" + user.email + ")? This removes the account, login credentials, sessions, 2FA record and linked bookings, passengers, tickets and payments. This cannot be undone.");
    if (!confirmed) return;
    setUpdating(user.id);
    setError("");
    try {
      await responseJson(await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) }));
      setUsers((current) => current.filter((item) => item.id !== user.id));
      await loadDashboard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this user.");
    } finally {
      setUpdating("");
    }
  }

  async function changeRole(userId: string, newRole: string) {
    setUpdating(userId);
    setError("");
    try {
      await responseJson(await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      }));
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, role: newRole } : user));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update user role.");
    } finally {
      setUpdating("");
    }
  }

  async function retrieveOrder(bookingId: string) {
    setUpdating(bookingId);
    setError("");
    try {
      const data = await responseJson<{ order: Record<string, unknown> }>(
        await fetch(`/api/admin/orders/${encodeURIComponent(bookingId)}`, { cache: "no-store" }),
      );
      setOrderDetails(data.order);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not retrieve the Amadeus order.");
    } finally {
      setUpdating("");
    }
  }

  return (
    <section className="admin-content">
      <div className="admin-title-row">
        <div>
          <div className="eyebrow dark"><span /> AIRLINE OPERATIONS</div>
          <h1>Operations dashboard</h1>
          <p>Bookings, customers, and payment activity at a glance.</p>
        </div>
        <button className="admin-refresh" onClick={() => void loadDashboard()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="admin-metrics">
        <Metric label="Total bookings" value={metrics?.allBookings} />
        <Metric label="Awaiting payment" value={metrics?.pendingBookings} />
        <Metric label="Confirmed" value={metrics?.confirmedBookings} />
        <Metric label="Customers" value={metrics?.customers} />
        <Metric label="Successful payments" value={metrics?.successfulPayments} />
        <Metric
          label="Collected by currency"
          value={metrics?.successfulPaymentTotal.length
            ? metrics.successfulPaymentTotal.map(({ currency, amount }) => `${currency} ${amount}`).join(" · ")
            : "—"}
        />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>Bookings</h2><p>Latest booking records and their current status.</p></div>
          <label className="admin-filter">
            <span>STATUS</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
            </select>
          </label>
        </div>
        {loading ? <p className="admin-empty">Loading bookings...</p> : bookings.length === 0 ? (
          <p className="admin-empty">No bookings found for this filter.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Reference / customer</th><th>Journey</th><th>Travel date</th><th>Fare</th><th>Payment</th><th>Booking</th><th>Amadeus order</th><th>Action</th></tr></thead>
              <tbody>{bookings.map((booking) => (
                <tr key={booking.id}>
                  <td><strong>{booking.reference}</strong><small>{booking.user.name} · {booking.user.email}</small></td>
                  <td>{booking.origin} → {booking.destination}<small>{booking.cabin}</small></td>
                  <td>{new Date(booking.departureDate).toLocaleDateString()}</td>
                  <td>{booking.fareCurrency} {booking.fareAmount}</td>
                  <td>{booking.payments[0] ? `${booking.payments[0].status} · ${booking.payments[0].currency} ${booking.payments[0].amount}` : "No payment"}</td>
                  <td><span className={`admin-status ${booking.status.toLowerCase()}`}>{booking.status.replaceAll("_", " ")}</span></td>
                  <td><span className={`admin-status ${booking.amadeusOrderStatus.toLowerCase()}`}>{booking.amadeusOrderStatus.replaceAll("_", " ")}</span><small>{booking.amadeusRecordLocator ?? booking.amadeusOrderError ?? ""}</small></td>
                  <td>
                    {booking.amadeusOrderStatus === "CREATED" && <button className="admin-action" disabled={updating === booking.id} onClick={() => void retrieveOrder(booking.id)}>{updating === booking.id ? "Loading..." : "Retrieve"}</button>}
                    {booking.status === "PENDING_PAYMENT" && <button className="admin-action" disabled={updating === booking.id} onClick={() => void cancelBooking(booking.id)}>{updating === booking.id ? "Updating..." : "Cancel booking"}</button>}
                    {booking.status === "CONFIRMED" && !booking.amadeusOrderId && <small>Order needs review</small>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {orderDetails && <pre className="admin-order-details">{JSON.stringify(orderDetails, null, 2)}</pre>}
      </section>

      {canManageUsers && <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>User and staff roles</h2><p>Assign permissions. Public sign-up cannot grant staff access.</p></div>
        </div>
        {loading ? <p className="admin-empty">Loading users...</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>User</th><th>Verification</th><th>2FA</th><th>Bookings</th><th>Role</th><th>Account</th></tr></thead>
              <tbody>{users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.name}</strong><small>{user.email}</small></td>
                  <td>{user.emailVerified ? "Verified" : "Unverified"}</td>
                  <td>{user.twoFactorEnabled ? "Enabled" : "Off"}</td>
                  <td>{user._count.bookings}</td>
                  <td>
                    <select className="admin-role-select" value={user.role} disabled={updating === user.id} onChange={(event) => void changeRole(user.id, event.target.value)}>
                      {roles.map((userRole) => <option key={userRole} value={userRole}>{userRole.replaceAll("_", " ")}</option>)}
                    </select>
                  </td>
                  <td><button className="admin-action" disabled={updating === user.id} onClick={() => void deleteUser(user)}>Delete user</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>}
      <AdminControlCenter role={role} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value?: number | string }) {
  return <article className="admin-metric"><span>{label}</span><strong>{value ?? "—"}</strong></article>;
}
