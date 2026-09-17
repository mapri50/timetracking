"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Customer = {
  id: string;
  name: string;
  hourlyRate: number;
};

type TimeEntry = {
  id: string;
  customerId: string;
  startIso: string;
  endIso: string;
  description: string;
};

type Payment = {
  id: string;
  customerId: string;
  amount: number;
  dateIso: string;
  note: string;
};

type AppData = {
  customers: Customer[];
  entries: TimeEntry[];
  payments: Payment[];
};

const STORAGE_KEY = "timetracking.v1";
const EMPTY_DATA: AppData = { customers: [], entries: [], payments: [] };

const formatCurrency = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoFromLocalInput(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function getDurationHours(entry: Pick<TimeEntry, "startIso" | "endIso">): number {
  const start = new Date(entry.startIso).getTime();
  const end = new Date(entry.endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }
  return (end - start) / 3_600_000;
}

function normalizeImportedData(raw: unknown): AppData | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<AppData>;
  if (!Array.isArray(candidate.customers) || !Array.isArray(candidate.entries) || !Array.isArray(candidate.payments)) {
    return null;
  }

  const customers = candidate.customers
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const value = item as Partial<Customer>;
      if (typeof value.id !== "string" || typeof value.name !== "string" || typeof value.hourlyRate !== "number") {
        return null;
      }
      return { id: value.id, name: value.name, hourlyRate: value.hourlyRate };
    })
    .filter((item): item is Customer => item !== null);

  const customerIds = new Set(customers.map((customer) => customer.id));

  const entries = candidate.entries
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const value = item as Partial<TimeEntry>;
      if (
        typeof value.id !== "string" ||
        typeof value.customerId !== "string" ||
        typeof value.startIso !== "string" ||
        typeof value.endIso !== "string" ||
        typeof value.description !== "string"
      ) {
        return null;
      }
      if (!customerIds.has(value.customerId)) {
        return null;
      }
      return {
        id: value.id,
        customerId: value.customerId,
        startIso: value.startIso,
        endIso: value.endIso,
        description: value.description,
      };
    })
    .filter((item): item is TimeEntry => item !== null);

  const payments = candidate.payments
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const value = item as Partial<Payment>;
      if (
        typeof value.id !== "string" ||
        typeof value.customerId !== "string" ||
        typeof value.amount !== "number" ||
        typeof value.dateIso !== "string" ||
        typeof value.note !== "string"
      ) {
        return null;
      }
      if (!customerIds.has(value.customerId)) {
        return null;
      }
      return {
        id: value.id,
        customerId: value.customerId,
        amount: value.amount,
        dateIso: value.dateIso,
        note: value.note,
      };
    })
    .filter((item): item is Payment => item !== null);

  return { customers, entries, payments };
}

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [timerCustomerId, setTimerCustomerId] = useState("");
  const [timerStartIso, setTimerStartIso] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [pendingEntry, setPendingEntry] = useState<Omit<TimeEntry, "id"> | null>(null);
  const [rewardVisible, setRewardVisible] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerRate, setCustomerRate] = useState("85");

  const [paymentCustomerId, setPaymentCustomerId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = normalizeImportedData(JSON.parse(raw));
          if (parsed) {
            setData(parsed);
            setTimerCustomerId(parsed.customers[0]?.id ?? "");
            setPaymentCustomerId(parsed.customers[0]?.id ?? "");
          }
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [loaded, data]);

  useEffect(() => {
    if (!timerStartIso) {
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timerStartIso]);

  useEffect(() => {
    if (!rewardVisible) {
      return;
    }
    const id = window.setTimeout(() => setRewardVisible(false), 1400);
    return () => window.clearTimeout(id);
  }, [rewardVisible]);

  const customerNames = useMemo(() => {
    const map = new Map<string, string>();
    data.customers.forEach((customer) => map.set(customer.id, customer.name));
    return map;
  }, [data.customers]);

  const customerOverview = useMemo(() => {
    return data.customers.map((customer) => {
      const trackedHours = data.entries
        .filter((entry) => entry.customerId === customer.id)
        .reduce((sum, entry) => sum + getDurationHours(entry), 0);
      const totalBilled = trackedHours * customer.hourlyRate;
      const totalPaid = data.payments
        .filter((payment) => payment.customerId === customer.id)
        .reduce((sum, payment) => sum + payment.amount, 0);
      const owed = totalBilled - totalPaid;

      return { customer, trackedHours, totalBilled, totalPaid, owed };
    });
  }, [data.customers, data.entries, data.payments]);

  const totalOwed = customerOverview.reduce((sum, item) => sum + item.owed, 0);

  const timerDuration = timerStartIso
    ? Math.max(0, (now - new Date(timerStartIso).getTime()) / 1000)
    : 0;

  const addCustomer = () => {
    const name = customerName.trim();
    const rate = Number(customerRate);
    if (!name || Number.isNaN(rate) || rate < 0) {
      return;
    }

    const customer: Customer = {
      id: crypto.randomUUID(),
      name,
      hourlyRate: rate,
    };

    setData((current) => ({ ...current, customers: [...current.customers, customer] }));
    if (!timerCustomerId) {
      setTimerCustomerId(customer.id);
    }
    if (!paymentCustomerId) {
      setPaymentCustomerId(customer.id);
    }
    setCustomerName("");
  };

  const startTimer = () => {
    if (!timerCustomerId) {
      return;
    }
    setTimerStartIso(new Date().toISOString());
    setNow(Date.now());
  };

  const stopTimer = () => {
    if (!timerStartIso) {
      return;
    }

    setPendingEntry({
      customerId: timerCustomerId,
      description: "",
      startIso: timerStartIso,
      endIso: new Date().toISOString(),
    });
    setTimerStartIso(null);
  };

  const savePendingEntry = () => {
    if (!pendingEntry) {
      return;
    }

    setData((current) => ({
      ...current,
      entries: [...current.entries, { ...pendingEntry, id: crypto.randomUUID() }],
    }));
    setPendingEntry(null);
    setRewardVisible(true);
  };

  const updateCustomer = (id: string, patch: Partial<Customer>) => {
    setData((current) => ({
      ...current,
      customers: current.customers.map((customer) =>
        customer.id === id ? { ...customer, ...patch } : customer,
      ),
    }));
  };

  const removeCustomer = (id: string) => {
    setData((current) => ({
      customers: current.customers.filter((customer) => customer.id !== id),
      entries: current.entries.filter((entry) => entry.customerId !== id),
      payments: current.payments.filter((payment) => payment.customerId !== id),
    }));
    if (timerCustomerId === id) {
      setTimerCustomerId("");
    }
    if (paymentCustomerId === id) {
      setPaymentCustomerId("");
    }
  };

  const updateEntry = (id: string, patch: Partial<TimeEntry>) => {
    setData((current) => ({
      ...current,
      entries: current.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    }));
  };

  const removeEntry = (id: string) => {
    setData((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== id),
    }));
  };

  const addPayment = () => {
    if (!paymentCustomerId) {
      return;
    }
    const amount = Number(paymentAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      return;
    }

    const dateIso = new Date(paymentDate).toISOString();

    setData((current) => ({
      ...current,
      payments: [
        ...current.payments,
        {
          id: crypto.randomUUID(),
          customerId: paymentCustomerId,
          amount,
          dateIso,
          note: paymentNote.trim(),
        },
      ],
    }));

    setPaymentAmount("");
    setPaymentNote("");
  };

  const updatePayment = (id: string, patch: Partial<Payment>) => {
    setData((current) => ({
      ...current,
      payments: current.payments.map((payment) =>
        payment.id === id ? { ...payment, ...patch } : payment,
      ),
    }));
  };

  const removePayment = (id: string) => {
    setData((current) => ({
      ...current,
      payments: current.payments.filter((payment) => payment.id !== id),
    }));
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "timetracking-export.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = normalizeImportedData(JSON.parse(text));
      if (!parsed) {
        return;
      }
      setData(parsed);
      setTimerCustomerId(parsed.customers[0]?.id ?? "");
      setPaymentCustomerId(parsed.customers[0]?.id ?? "");
      setPendingEntry(null);
      setTimerStartIso(null);
    } finally {
      event.target.value = "";
    }
  };

  if (!loaded) {
    return <main className={styles.page}>Loading…</main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <h1>Lovely Time Tracker</h1>
        <p>Track your work, customers, invoices and payments in one tiny local app.</p>
        <p className={styles.totalOwed}>Open balance: {formatCurrency.format(totalOwed)}</p>
        {rewardVisible && <span className={styles.reward}>✨ Nice focus session!</span>}
      </div>

      <section className={styles.card}>
        <h2>Timer</h2>
        <div className={styles.row}>
          <select
            value={timerCustomerId}
            onChange={(event) => setTimerCustomerId(event.target.value)}
            className={styles.input}
          >
            <option value="">Select customer</option>
            {data.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          {!timerStartIso ? (
            <button className={styles.primary} onClick={startTimer} type="button">
              Start
            </button>
          ) : (
            <button className={styles.secondary} onClick={stopTimer} type="button">
              Stop
            </button>
          )}
        </div>
        {timerStartIso && (
          <p className={styles.timerValue}>⏱️ Running: {(timerDuration / 60).toFixed(1)} minutes</p>
        )}
        {pendingEntry && (
          <div className={styles.pendingBox}>
            <h3>Session details</h3>
            <div className={styles.grid}>
              <label>
                Start
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={toLocalInputValue(pendingEntry.startIso)}
                  onChange={(event) => {
                    const iso = toIsoFromLocalInput(event.target.value);
                    if (iso) {
                      setPendingEntry((current) => (current ? { ...current, startIso: iso } : current));
                    }
                  }}
                />
              </label>
              <label>
                End
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={toLocalInputValue(pendingEntry.endIso)}
                  onChange={(event) => {
                    const iso = toIsoFromLocalInput(event.target.value);
                    if (iso) {
                      setPendingEntry((current) => (current ? { ...current, endIso: iso } : current));
                    }
                  }}
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                className={styles.input}
                value={pendingEntry.description}
                onChange={(event) =>
                  setPendingEntry((current) =>
                    current ? { ...current, description: event.target.value } : current,
                  )
                }
                placeholder="What did you work on?"
              />
            </label>
            <div className={styles.row}>
              <button className={styles.primary} onClick={savePendingEntry} type="button">
                Save session
              </button>
              <button className={styles.ghost} onClick={() => setPendingEntry(null)} type="button">
                Discard
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <h2>Customers</h2>
        <div className={styles.row}>
          <input
            className={styles.input}
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Customer name"
          />
          <input
            className={styles.input}
            type="number"
            min="0"
            step="1"
            value={customerRate}
            onChange={(event) => setCustomerRate(event.target.value)}
            placeholder="Hourly rate"
          />
          <button className={styles.primary} onClick={addCustomer} type="button">
            Add customer
          </button>
        </div>
        <div className={styles.list}>
          {customerOverview.map(({ customer, trackedHours, totalBilled, totalPaid, owed }) => (
            <article key={customer.id} className={styles.listItem}>
              <div className={styles.grid}>
                <label>
                  Name
                  <input
                    className={styles.input}
                    value={customer.name}
                    onChange={(event) => updateCustomer(customer.id, { name: event.target.value })}
                  />
                </label>
                <label>
                  Rate (€ / hour)
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="1"
                    value={customer.hourlyRate}
                    onChange={(event) =>
                      updateCustomer(customer.id, { hourlyRate: Number(event.target.value) || 0 })
                    }
                  />
                </label>
              </div>
              <p className={styles.meta}>
                {trackedHours.toFixed(2)}h tracked · Billed {formatCurrency.format(totalBilled)} · Paid{" "}
                {formatCurrency.format(totalPaid)} · Owed <strong>{formatCurrency.format(owed)}</strong>
              </p>
              <button className={styles.ghost} onClick={() => removeCustomer(customer.id)} type="button">
                Delete customer
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Time entries</h2>
        <div className={styles.list}>
          {[...data.entries]
            .sort((a, b) => b.startIso.localeCompare(a.startIso))
            .map((entry) => (
              <article key={entry.id} className={styles.listItem}>
                <div className={styles.grid}>
                  <label>
                    Customer
                    <select
                      className={styles.input}
                      value={entry.customerId}
                      onChange={(event) => updateEntry(entry.id, { customerId: event.target.value })}
                    >
                      {data.customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Duration
                    <p className={styles.meta}>{getDurationHours(entry).toFixed(2)}h</p>
                  </label>
                  <label>
                    Start
                    <input
                      className={styles.input}
                      type="datetime-local"
                      value={toLocalInputValue(entry.startIso)}
                      onChange={(event) => {
                        const iso = toIsoFromLocalInput(event.target.value);
                        if (iso) {
                          updateEntry(entry.id, { startIso: iso });
                        }
                      }}
                    />
                  </label>
                  <label>
                    End
                    <input
                      className={styles.input}
                      type="datetime-local"
                      value={toLocalInputValue(entry.endIso)}
                      onChange={(event) => {
                        const iso = toIsoFromLocalInput(event.target.value);
                        if (iso) {
                          updateEntry(entry.id, { endIso: iso });
                        }
                      }}
                    />
                  </label>
                </div>
                <label>
                  Description
                  <textarea
                    className={styles.input}
                    value={entry.description}
                    onChange={(event) => updateEntry(entry.id, { description: event.target.value })}
                  />
                </label>
                <p className={styles.meta}>Client: {customerNames.get(entry.customerId) ?? "Unknown"}</p>
                <button className={styles.ghost} onClick={() => removeEntry(entry.id)} type="button">
                  Delete entry
                </button>
              </article>
            ))}
          {data.entries.length === 0 && <p className={styles.meta}>No tracked sessions yet.</p>}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Payments</h2>
        <div className={styles.row}>
          <select
            className={styles.input}
            value={paymentCustomerId}
            onChange={(event) => setPaymentCustomerId(event.target.value)}
          >
            <option value="">Select customer</option>
            {data.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <input
            className={styles.input}
            type="number"
            min="0"
            step="0.01"
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(event.target.value)}
            placeholder="Amount paid"
          />
          <input
            className={styles.input}
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
          />
          <input
            className={styles.input}
            value={paymentNote}
            onChange={(event) => setPaymentNote(event.target.value)}
            placeholder="Optional note"
          />
          <button className={styles.primary} onClick={addPayment} type="button">
            Add payment
          </button>
        </div>

        <div className={styles.list}>
          {[...data.payments]
            .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
            .map((payment) => (
              <article key={payment.id} className={styles.listItem}>
                <div className={styles.grid}>
                  <label>
                    Customer
                    <select
                      className={styles.input}
                      value={payment.customerId}
                      onChange={(event) => updatePayment(payment.id, { customerId: event.target.value })}
                    >
                      {data.customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Amount
                    <input
                      className={styles.input}
                      type="number"
                      step="0.01"
                      min="0"
                      value={payment.amount}
                      onChange={(event) =>
                        updatePayment(payment.id, { amount: Number(event.target.value) || 0 })
                      }
                    />
                  </label>
                  <label>
                    Date
                    <input
                      className={styles.input}
                      type="date"
                      value={payment.dateIso.slice(0, 10)}
                      onChange={(event) =>
                        updatePayment(payment.id, {
                          dateIso: new Date(event.target.value).toISOString(),
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Note
                  <input
                    className={styles.input}
                    value={payment.note}
                    onChange={(event) => updatePayment(payment.id, { note: event.target.value })}
                  />
                </label>
                <p className={styles.meta}>
                  {customerNames.get(payment.customerId) ?? "Unknown"} · {formatCurrency.format(payment.amount)}
                </p>
                <button className={styles.ghost} onClick={() => removePayment(payment.id)} type="button">
                  Delete payment
                </button>
              </article>
            ))}
          {data.payments.length === 0 && <p className={styles.meta}>No payments recorded yet.</p>}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Import / export</h2>
        <div className={styles.row}>
          <button className={styles.primary} onClick={exportData} type="button">
            Export JSON
          </button>
          <label className={styles.fileLabel}>
            Import JSON
            <input className={styles.fileInput} type="file" accept="application/json" onChange={importData} />
          </label>
        </div>
      </section>
    </main>
  );
}
