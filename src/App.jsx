import { useState, useEffect, useCallback } from "react";

// ══════════════════════════════════════════════════════════════════════════
// API LAYER — troque a BASE_URL para o endereço do seu backend Antigravity
// ══════════════════════════════════════════════════════════════════════════
const API_BASE = import.meta.env.VITE_API_URL || "https://fmupwpyuzetwnguubfbk.supabase.co/functions/v1/api";

// Token helpers
const getToken = () => localStorage.getItem("ag_token");
const setToken = (t) => localStorage.setItem("ag_token", t);
const clearToken = () => localStorage.removeItem("ag_token");

// Base fetch com JWT automático
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { clearToken(); window.location.reload(); }
  if (!res.ok) throw await res.json().catch(() => ({ message: res.statusText }));
  if (res.status === 204) return null;
  return res.json();
}

// ── Endpoints mapeados ────────────────────────────────────────────────────
const api = {
  // Auth
  login: (username, password) =>
    apiFetch("/auth/login", { method: "POST", body: { username, password } }),

  // State (snapshot completo para compatibilidade com o front atual)
  getState: () => apiFetch("/state"),

  // Employees
  getEmployees: () => apiFetch("/employees"),
  createEmployee: (data) => apiFetch("/employees", { method: "POST", body: data }),
  updateEmployee: (id, d) => apiFetch(`/employees/${id}`, { method: "PUT", body: d }),
  deleteEmployee: (id) => apiFetch(`/employees/${id}`, { method: "DELETE" }),

  // Sales (approved)
  getSales: () => apiFetch("/sales"),
  createSale: (data) => apiFetch("/sales", { method: "POST", body: data }),
  deleteSale: (id) => apiFetch(`/sales/${id}`, { method: "DELETE" }),

  // Pending Sales
  getPending: () => apiFetch("/sales/pending"),
  submitSale: (data) => apiFetch("/sales/pending", { method: "POST", body: data }),
  approveSale: (id) => apiFetch(`/sales/pending/${id}/approve`, { method: "POST" }),
  rejectSale: (id) => apiFetch(`/sales/pending/${id}`, { method: "DELETE" }),
  approveAll: () => apiFetch("/sales/pending/approve-all", { method: "POST" }),

  // Traffic (per employee)
  getTraffic: () => apiFetch("/traffic"),
  createTraffic: (data) => apiFetch("/traffic", { method: "POST", body: data }),
  deleteTraffic: (id) => apiFetch(`/traffic/${id}`, { method: "DELETE" }),

  // Expenses
  getExpenses: () => apiFetch("/expenses"),
  createExpense: (data) => apiFetch("/expenses", { method: "POST", body: data }),
  deleteExpense: (id) => apiFetch(`/expenses/${id}`, { method: "DELETE" }),

  // Prompts
  getPrompts: () => apiFetch("/prompts"),
  createPrompt: (data) => apiFetch("/prompts", { method: "POST", body: data }),
  updatePrompt: (id, d) => apiFetch(`/prompts/${id}`, { method: "PUT", body: d }),
  deletePrompt: (id) => apiFetch(`/prompts/${id}`, { method: "DELETE" }),

  // Categories
  getCategories: () => apiFetch("/categories"),
  createCategory: (data) => apiFetch("/categories", { method: "POST", body: data }),
  deleteCategory: (id) => apiFetch(`/categories/${id}`, { method: "DELETE" }),

  // Notification Settings
  getNotifSettings: () => apiFetch("/notification-settings"),
  updateNotifSettings: (data) => apiFetch("/notification-settings", { method: "PUT", body: data }),

  // Push Subscriptions
  subscribePush: (subscription) => apiFetch("/push/subscribe", { method: "POST", body: { subscription } }),
  unsubscribePush: (endpoint) => apiFetch("/push/subscribe", { method: "DELETE", body: { endpoint } }),
};

// VAPID public key for push subscription
const VAPID_PUBLIC_KEY = "BAJ1Ld7ppG66j6hKV5vSAp7B1xp4JWLsbNFdhNWeNGtS69x9ge1HGSUTpbfMLXzLZA-iMpfjTNC4LQEkWxaxG4E";

// Helper: register Service Worker + subscribe to push
async function registerPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)),
    });
    const subJSON = sub.toJSON();
    await api.subscribePush({ endpoint: subJSON.endpoint, keys: subJSON.keys });
    return sub;
  } catch (e) { console.error("Push registration error:", e); return null; }
}

async function unregisterPushSubscription() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.unsubscribePush(sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) { console.error("Push unregister error:", e); }
}

// ── defaultData (fallback offline / loading) ──────────────────────────────
const defaultData = {
  employees: [], expenses: [], prompts: [],
  sales: [], pendingSales: [], empTraffic: [], categories: [],
};

// ── Icons ──────────────────────────────────────────────────────────────────
const Icon = ({ path, size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);
const icons = {
  dashboard: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  dollar: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  target: "M22 12h-4l-3 9L9 3l-3 9H2",
  plus: "M12 5v14M5 12h14",
  copy: "M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  image: "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M21 15l-5-5L5 21",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  check: "M20 6L9 17l-5-5",
  trending: "M23 6l-9.5 9.5-5-5L1 18",
  coins: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z M12 6v6l4 2",
  expense: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  folder: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
  tag: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  back: "M19 12H5 M12 5l-7 7 7 7",
  receipt: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 M12 12h3 M12 16h3 M9 12h.01 M9 16h.01",
  wifi: "M5 12.55a11 11 0 0 1 14.08 0 M1.42 9a16 16 0 0 1 21.16 0 M8.53 16.11a6 6 0 0 1 6.95 0 M12 20h.01",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",
  cart: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0",
};

// ── Styles ─────────────────────────────────────────────────────────────────
// ── Styles ─────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #05080d;
    --surface:  #0a1018;
    --surface2: #101720;
    --surface3: #18222e;
    --border:   #1a2736;
    --border2:  #223040;
    --accent:   #f5a623;
    --accent2:  #ff6535;
    --glow:     rgba(245,166,35,0.15);
    --text:     #e8f0f8;
    --muted:    #4a6070;
    --muted2:   #6a8399;
    --green:    #1fd46a;
    --red:      #ff4060;
    --blue:     #3d9fff;
    --r:        14px;
    --r-sm:     10px;
    --r-lg:     22px;
  }

  html, body {
    height: 100%; background: var(--bg); color: var(--text);
    font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }
  #root { height: 100%; }

  /* Ambient glow background */
  body::after {
    content: ''; position: fixed; pointer-events: none; z-index: 0;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 40% at 20% 0%, rgba(245,166,35,0.05) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 100%, rgba(255,101,53,0.04) 0%, transparent 60%);
  }

  .app { display: flex; height: 100vh; overflow: hidden; position: relative; z-index: 1; }

  /* ══════════════════════════
     SIDEBAR
  ══════════════════════════ */
  .sidebar {
    width: 234px; min-width: 234px; z-index: 20;
    background: linear-gradient(180deg, #0c1520 0%, #08101a 100%);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    box-shadow: 4px 0 40px rgba(0,0,0,0.45);
  }
  .sidebar-logo {
    padding: 30px 22px 22px; border-bottom: 1px solid var(--border);
  }
  .logo-text {
    font-family: 'Outfit', sans-serif; font-size: 19px; font-weight: 900;
    letter-spacing: 3px; text-transform: uppercase;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .logo-sub {
    font-size: 9.5px; color: var(--muted); margin-top: 4px;
    letter-spacing: 2.5px; text-transform: uppercase; font-weight: 600;
  }
  .sidebar-nav {
    flex: 1; padding: 18px 12px; display: flex; flex-direction: column;
    gap: 2px; overflow-y: auto;
  }
  .sidebar-nav::-webkit-scrollbar { width: 0; }
  .nav-item {
    display: flex; align-items: center; gap: 10px; padding: 11px 14px;
    border-radius: var(--r-sm); cursor: pointer; font-size: 13px; font-weight: 500;
    color: var(--muted); transition: all 0.18s; border: 1px solid transparent;
    position: relative; letter-spacing: 0.1px;
  }
  .nav-item:hover { background: var(--surface2); color: var(--muted2); }
  .nav-item.active {
    background: linear-gradient(135deg, rgba(245,166,35,0.11), rgba(255,101,53,0.05));
    color: var(--accent); border-color: rgba(245,166,35,0.18);
  }
  .nav-item.active::before {
    content: ''; position: absolute; left: -1px; top: 22%; bottom: 22%;
    width: 3px; border-radius: 0 3px 3px 0; background: var(--accent);
    box-shadow: 0 0 10px rgba(245,166,35,0.7);
  }
  .sidebar-footer { padding: 14px 12px; border-top: 1px solid var(--border); }
  .role-badge {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    background: var(--surface2); border-radius: var(--r-sm);
    border: 1px solid var(--border2);
    font-size: 12px; color: var(--muted2); cursor: pointer; transition: all 0.2s;
  }
  .role-badge:hover { border-color: rgba(245,166,35,0.3); color: var(--text); }
  .role-dot {
    width: 7px; height: 7px; border-radius: 50%; background: var(--green);
    flex-shrink: 0; box-shadow: 0 0 7px var(--green);
    animation: blink 2.5s ease-in-out infinite;
  }
  @keyframes blink {
    0%,100% { opacity: 1; } 50% { opacity: 0.4; }
  }

  /* ══════════════════════════
     BOTTOM NAV
  ══════════════════════════ */
  .bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
    background: rgba(10,16,24,0.96); backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-top: 1px solid var(--border);
    padding: 6px 0 max(env(safe-area-inset-bottom), 6px);
    box-shadow: 0 -10px 48px rgba(0,0,0,0.55);
  }
  .bottom-nav-items { display: flex; justify-content: space-around; align-items: center; }
  .bottom-nav-item {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 6px 8px; cursor: pointer; color: var(--muted); font-size: 9px; font-weight: 600;
    border-radius: 12px; transition: all 0.2s; position: relative; min-width: 48px;
    -webkit-tap-highlight-color: transparent; letter-spacing: 0.6px; text-transform: uppercase;
  }
  .bottom-nav-item.active { color: var(--accent); }
  .bottom-nav-item.active svg { filter: drop-shadow(0 0 6px rgba(245,166,35,0.8)); }
  .bottom-nav-item .notif {
    position: absolute; top: 0; right: 4px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: #000; font-size: 8px; font-weight: 800; padding: 1px 5px;
    border-radius: 20px; min-width: 15px; text-align: center; line-height: 1.5;
  }

  /* ══════════════════════════
     MAIN + LAYOUT
  ══════════════════════════ */
  .main { flex: 1; overflow-y: auto; background: var(--bg); scroll-behavior: smooth; }
  .main::-webkit-scrollbar { width: 5px; }
  .main::-webkit-scrollbar-track { background: transparent; }
  .main::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

  /* All page content is centered with max-width */
  .page-header {
    padding: 34px 36px 0;
    max-width: 1120px; margin: 0 auto;
    display: flex; align-items: flex-start; justify-content: space-between;
    flex-wrap: wrap; gap: 14px;
  }
  .page-title {
    font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 800;
    letter-spacing: -0.8px; line-height: 1.05;
    background: linear-gradient(135deg, var(--text) 50%, var(--muted2) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .page-sub { font-size: 13px; color: var(--muted); margin-top: 5px; }
  .page-content { padding: 24px 36px 52px; max-width: 1120px; margin: 0 auto; }

  /* ══════════════════════════
     CARDS
  ══════════════════════════ */
  .card {
    background: linear-gradient(145deg, var(--surface), rgba(8,13,20,0.9));
    border: 1px solid var(--border); border-radius: var(--r); padding: 22px;
    margin-bottom: 16px; transition: border-color 0.2s;
  }
  .card:hover { border-color: var(--border2); }
  .card-title {
    font-family: 'Outfit', sans-serif; font-size: 10.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 2.2px; color: var(--muted); margin-bottom: 16px;
  }

  /* ══════════════════════════
     STAT CARDS
  ══════════════════════════ */
  .stats-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 14px; margin-bottom: 26px;
  }
  .stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 22px 24px;
    position: relative; overflow: hidden; transition: all 0.22s;
  }
  /* top color line */
  .stat-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1.5px;
  }
  .stat-card.gold { border-color: rgba(245,166,35,0.18); }
  .stat-card.gold::before { background: linear-gradient(90deg, transparent, var(--accent), var(--accent2), transparent); }
  .stat-card.green { border-color: rgba(31,212,106,0.18); }
  .stat-card.green::before { background: linear-gradient(90deg, transparent, var(--green), transparent); }
  .stat-card.red { border-color: rgba(255,64,96,0.18); }
  .stat-card.red::before { background: linear-gradient(90deg, transparent, var(--red), transparent); }
  .stat-card.blue { border-color: rgba(61,159,255,0.18); }
  .stat-card.blue::before { background: linear-gradient(90deg, transparent, var(--blue), transparent); }
  /* corner glow */
  .stat-card::after {
    content: ''; position: absolute; top: 0; left: 0;
    width: 120px; height: 120px; pointer-events: none;
    background: radial-gradient(circle at 0 0, var(--stat-glow, transparent) 0%, transparent 65%);
  }
  .stat-card.gold { --stat-glow: rgba(245,166,35,0.08); }
  .stat-card.green { --stat-glow: rgba(31,212,106,0.07); }
  .stat-card.red   { --stat-glow: rgba(255,64,96,0.07); }
  .stat-card.blue  { --stat-glow: rgba(61,159,255,0.07); }
  .stat-card:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(0,0,0,0.35); }

  .stat-label {
    font-size: 10px; color: var(--muted); text-transform: uppercase;
    letter-spacing: 2px; margin-bottom: 10px; font-weight: 600;
  }
  .stat-value {
    font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 800;
    letter-spacing: -1.2px; font-variant-numeric: tabular-nums; line-height: 1;
  }
  .stat-value.gold  { color: var(--accent); text-shadow: 0 0 28px rgba(245,166,35,0.3); }
  .stat-value.green { color: var(--green);  text-shadow: 0 0 28px rgba(31,212,106,0.25); }
  .stat-value.red   { color: var(--red);    text-shadow: 0 0 28px rgba(255,64,96,0.25); }
  .stat-value.blue  { color: var(--blue);   text-shadow: 0 0 28px rgba(61,159,255,0.25); }
  .stat-note { font-size: 11px; color: var(--muted); margin-top: 8px; font-weight: 500; }

  /* ══════════════════════════
     GRIDS
  ══════════════════════════ */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px; }

  /* ══════════════════════════
     BUTTONS
  ══════════════════════════ */
  .btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 10px 18px; border-radius: var(--r-sm);
    font-size: 13px; font-weight: 600; cursor: pointer;
    border: none; transition: all 0.18s;
    font-family: 'DM Sans', sans-serif; white-space: nowrap; letter-spacing: 0.2px;
  }
  .btn-primary {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: #000; font-weight: 700;
    box-shadow: 0 4px 18px rgba(245,166,35,0.35);
  }
  .btn-primary:hover { transform: translateY(-1px); filter: brightness(1.08); box-shadow: 0 7px 28px rgba(245,166,35,0.45); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-ghost { background: transparent; color: var(--muted2); border: 1px solid var(--border2); }
  .btn-ghost:hover { color: var(--text); border-color: rgba(245,166,35,0.4); background: rgba(245,166,35,0.04); }
  .btn-danger { background: rgba(255,64,96,0.08); color: var(--red); border: 1px solid rgba(255,64,96,0.2); }
  .btn-danger:hover { background: rgba(255,64,96,0.15); border-color: rgba(255,64,96,0.35); }
  .btn-sm { padding: 7px 13px; font-size: 12px; border-radius: 8px; }
  .btn-icon { padding: 8px; border-radius: 8px; }
  .btn-copy { background: rgba(245,166,35,0.08); color: var(--accent); border: 1px solid rgba(245,166,35,0.2); }
  .btn-copy:hover { background: rgba(245,166,35,0.15); }
  .btn-copy.copied { background: rgba(31,212,106,0.08); color: var(--green); border-color: rgba(31,212,106,0.25); }

  /* ══════════════════════════
     FORMS
  ══════════════════════════ */
  .form-group { margin-bottom: 16px; }
  .form-label {
    font-size: 10.5px; color: var(--muted); margin-bottom: 7px; display: block;
    text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600;
  }
  .form-input {
    width: 100%; padding: 12px 14px;
    background: var(--surface2); border: 1px solid var(--border2);
    border-radius: var(--r-sm); color: var(--text);
    font-size: 14px; font-family: 'DM Sans', sans-serif;
    outline: none; transition: all 0.18s; -webkit-appearance: none;
  }
  .form-input:focus {
    border-color: var(--accent); background: var(--surface3);
    box-shadow: 0 0 0 3px rgba(245,166,35,0.1);
  }
  .form-input::placeholder { color: var(--muted); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  /* ══════════════════════════
     TABLE
  ══════════════════════════ */
  .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 420px; }
  th {
    text-align: left; padding: 11px 16px; font-size: 9.5px; font-weight: 700;
    color: var(--muted); text-transform: uppercase; letter-spacing: 1.8px;
    border-bottom: 1px solid var(--border); background: var(--surface2);
  }
  td { padding: 13px 16px; border-bottom: 1px solid rgba(26,39,54,0.7); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(255,255,255,0.015); }

  /* ══════════════════════════
     PROGRESS
  ══════════════════════════ */
  .progress-bar { height: 5px; background: var(--border2); border-radius: 3px; overflow: hidden; margin-top: 8px; }
  .progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s cubic-bezier(0.4,0,0.2,1); }

  /* ══════════════════════════
     BADGES
  ══════════════════════════ */
  .badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 600; }
  .badge-green { background: rgba(31,212,106,0.1);  color: var(--green); border: 1px solid rgba(31,212,106,0.2); }
  .badge-red   { background: rgba(255,64,96,0.1);   color: var(--red);   border: 1px solid rgba(255,64,96,0.2); }
  .badge-gold  { background: rgba(245,166,35,0.1);  color: var(--accent);border: 1px solid rgba(245,166,35,0.2); }
  .badge-blue  { background: rgba(61,159,255,0.1);  color: var(--blue);  border: 1px solid rgba(61,159,255,0.2); }

  /* ══════════════════════════
     MODAL
  ══════════════════════════ */
  .modal-bg {
    position: fixed; inset: 0; z-index: 300;
    background: rgba(0,0,0,0.78);
    display: flex; align-items: flex-end; justify-content: center;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    animation: bgfade 0.2s ease;
  }
  @keyframes bgfade { from { opacity: 0; } to { opacity: 1; } }
  .modal {
    background: linear-gradient(170deg, #111d2a 0%, #090f18 100%);
    border: 1px solid var(--border2); border-top: 1px solid var(--border2);
    border-radius: 26px 26px 0 0;
    padding: 10px 26px 32px; width: 100%; max-width: 580px;
    max-height: 92vh; overflow-y: auto;
    animation: slideUp 0.28s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 0 -20px 70px rgba(0,0,0,0.65);
  }
  .modal::before {
    content: ''; display: block; width: 38px; height: 4px;
    background: var(--border2); border-radius: 2px;
    margin: 14px auto 20px;
  }
  @keyframes slideUp { from { transform: translateY(70px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .modal-title {
    font-family: 'Outfit', sans-serif; font-size: 19px; font-weight: 800;
    margin-bottom: 20px; letter-spacing: -0.3px;
  }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 22px; }

  /* ══════════════════════════
     PROMPTS
  ══════════════════════════ */
  .prompt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 18px; }
  .prompt-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); overflow: hidden; transition: all 0.22s;
  }
  .prompt-card:hover { transform: translateY(-3px); border-color: rgba(245,166,35,0.35); box-shadow: 0 18px 44px rgba(0,0,0,0.4); }
  .prompt-img-placeholder { width: 100%; aspect-ratio: 1; background: var(--surface2); display: flex; align-items: center; justify-content: center; color: var(--muted); }
  .prompt-body { padding: 16px; }
  .prompt-name { font-size: 13px; font-weight: 700; margin-bottom: 10px; font-family: 'Outfit', sans-serif; }
  .prompt-text {
    font-size: 11.5px; color: var(--muted); line-height: 1.6; margin-bottom: 14px;
    font-family: 'JetBrains Mono', monospace;
    background: rgba(5,8,13,0.8); padding: 10px 12px;
    border-radius: 8px; border: 1px solid var(--border);
    max-height: 80px; overflow-y: auto; word-break: break-word;
  }

  /* ══════════════════════════
     LOGIN
  ══════════════════════════ */
  .login-screen {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: var(--bg); padding: 20px; position: relative; overflow: hidden;
  }
  .login-screen::before {
    content: ''; position: absolute; pointer-events: none;
    width: 700px; height: 700px; border-radius: 50%; top: -250px; left: -200px;
    background: radial-gradient(circle, rgba(245,166,35,0.055) 0%, transparent 70%);
  }
  .login-screen::after {
    content: ''; position: absolute; pointer-events: none;
    width: 500px; height: 500px; border-radius: 50%; bottom: -150px; right: -150px;
    background: radial-gradient(circle, rgba(255,101,53,0.04) 0%, transparent 70%);
  }
  .login-card {
    width: 100%; max-width: 420px; position: relative; z-index: 1;
    background: linear-gradient(155deg, #0e1b28 0%, #08101a 100%);
    border: 1px solid var(--border2); border-radius: 26px; padding: 44px 38px;
    box-shadow: 0 40px 90px rgba(0,0,0,0.65), 0 0 0 1px rgba(245,166,35,0.06);
  }
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-7px)}
    40%{transform:translateX(7px)}
    60%{transform:translateX(-4px)}
    80%{transform:translateX(4px)}
  }
  .login-shake { animation: shake 0.45s ease; }
  .login-logo {
    font-family: 'Outfit', sans-serif; font-size: 30px; font-weight: 900;
    text-align: center; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 4px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .login-sub { text-align: center; font-size: 11.5px; color: var(--muted); margin-bottom: 36px; letter-spacing: 0.5px; }

  /* ══════════════════════════
     MISC
  ══════════════════════════ */
  .divider { height: 1px; background: var(--border); margin: 18px 0; }
  .empty-state { text-align: center; padding: 52px 20px; color: var(--muted); }
  .empty-state-icon { margin-bottom: 14px; opacity: 0.3; }
  .empty-state-text { font-size: 14px; font-weight: 500; color: var(--muted2); }

  .cat-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; align-items: center; }
  .cat-pill {
    padding: 6px 14px; border-radius: 20px; font-size: 11.5px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border); background: var(--surface2);
    color: var(--muted); transition: all 0.18s; display: flex; align-items: center; gap: 7px; letter-spacing: 0.2px;
  }
  .cat-pill:hover { border-color: rgba(245,166,35,0.4); color: var(--text); background: rgba(245,166,35,0.04); }
  .cat-pill.active { background: rgba(245,166,35,0.1); border-color: rgba(245,166,35,0.38); color: var(--accent); }
  .cat-pill .cat-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .cat-count { font-size: 10px; background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 10px; }

  /* Employee cards */
  .emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; margin-bottom: 24px; }
  .emp-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 22px; cursor: pointer;
    transition: all 0.22s; position: relative; overflow: hidden;
  }
  .emp-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
  }
  .emp-card::after {
    content: ''; position: absolute; top: 0; right: 0;
    width: 100px; height: 100px; pointer-events: none;
    background: radial-gradient(circle at top right, rgba(245,166,35,0.06) 0%, transparent 70%);
  }
  .emp-card:hover { border-color: rgba(245,166,35,0.32); transform: translateY(-3px); box-shadow: 0 16px 44px rgba(0,0,0,0.38); }
  .emp-avatar {
    width: 46px; height: 46px; border-radius: 12px;
    background: linear-gradient(135deg, rgba(245,166,35,0.14), rgba(255,101,53,0.1));
    border: 1px solid rgba(245,166,35,0.22);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 900;
    color: var(--accent); margin-bottom: 14px;
  }
  .emp-card-name { font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.3px; }
  .emp-card-meta { font-size: 12px; color: var(--muted); margin-bottom: 14px; }
  .emp-card-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .emp-stat { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
  .emp-stat-label { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 4px; font-weight: 600; }
  .emp-stat-val { font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.3px; }
  .pending-badge {
    position: absolute; top: 14px; right: 14px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: #000; font-size: 10px; font-weight: 800; padding: 3px 9px; border-radius: 20px;
    box-shadow: 0 3px 12px rgba(245,166,35,0.4);
  }

  /* Profile */
  .profile-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
  .profile-avatar {
    width: 54px; height: 54px; border-radius: 14px;
    background: linear-gradient(135deg, rgba(245,166,35,0.15), rgba(255,101,53,0.1));
    border: 1px solid rgba(245,166,35,0.25);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 900; color: var(--accent); flex-shrink: 0;
  }
  .profile-name { font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .profile-sub { font-size: 12px; color: var(--muted); margin-top: 3px; }
  tr.pending-row td { opacity: 0.7; }
  tr.approved-row td:first-child { border-left: 2px solid var(--green); padding-left: 14px; }

  /* Sale history */
  .sale-history-card {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 18px; display: flex; align-items: center; gap: 14px; margin-bottom: 10px;
    transition: border-color 0.15s;
  }
  .sale-history-card:hover { border-color: var(--border2); }
  .sale-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

  .nav-notif {
    margin-left: auto;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: #000; font-size: 10px; font-weight: 800;
    padding: 1px 7px; border-radius: 20px; min-width: 20px; text-align: center;
  }

  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .section-title { font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 7px; letter-spacing: -0.2px; }
  .tag {
    display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 6px; font-size: 11px;
    background: rgba(245,166,35,0.08); color: var(--accent); border: 1px solid rgba(245,166,35,0.2); font-weight: 600;
  }
  .text-muted { color: var(--muted); }
  .text-green { color: var(--green); }
  .text-red   { color: var(--red); }
  .text-accent { color: var(--accent); }
  .font-bold { font-weight: 700; }
  .font-syne { font-family: 'Outfit', sans-serif; }
  .font-num { font-family: 'Outfit', sans-serif; font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
  .alert { padding: 13px 16px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
  .alert-success { background: rgba(31,212,106,0.08); border: 1px solid rgba(31,212,106,0.2); color: var(--green); }

  /* ══════════════════════════
     MOBILE ≤768px
  ══════════════════════════ */
  /* Chart mini-stats responsive */
  .chart-ministats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px; }

  @media (max-width: 768px) {
    .sidebar { display: none; }
    .chart-ministats { grid-template-columns: 1fr 1fr; }
    .main { padding-bottom: 80px; }
    .page-header { padding: 22px 18px 0; flex-direction: column; align-items: flex-start; gap: 14px; }
    .page-title { font-size: 22px; }
    .page-sub { font-size: 12px; }
    .page-content { padding: 16px 18px 28px; }
    .stats-grid { grid-template-columns: 1fr 1fr !important; gap: 10px; }
    .stat-value { font-size: 20px; letter-spacing: -0.5px; }
    .stat-label { font-size: 9px; }
    .stat-card { padding: 16px 14px; }
    .grid-2, .grid-3 { grid-template-columns: 1fr; gap: 12px; }
    .form-row { grid-template-columns: 1fr; gap: 0; }
    .modal-bg { align-items: flex-end; padding: 0; }
    .modal { border-radius: 24px 24px 0 0; max-height: 90vh; padding: 8px 18px calc(env(safe-area-inset-bottom) + 22px); }
    .card { padding: 16px; }
    .emp-card { padding: 16px; }
    .emp-grid { grid-template-columns: 1fr; }
    .prompt-grid { grid-template-columns: 1fr; }
    .page-header > button { width: 100%; justify-content: center; }
    .login-card { padding: 32px 22px; }
    .login-logo { font-size: 26px; }
    .section-header { flex-wrap: wrap; gap: 8px; }
    .cat-bar { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .cat-bar::-webkit-scrollbar { display: none; }
    .modal-actions { flex-direction: column-reverse; }
    .modal-actions .btn { width: 100%; justify-content: center; }
  }
  @media (max-width: 380px) {
    .stats-grid { grid-template-columns: 1fr 1fr !important; }
    .stat-value { font-size: 17px; }
    .bottom-nav-item { min-width: 40px; font-size: 8px; }
  }
`;



// ── Helpers ────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const today = () => new Date().toISOString().slice(0, 10);

const uid = () => Math.random().toString(36).slice(2, 9);

// ── Data hook — carrega estado completo do backend ───────────────────────
// O backend retorna um snapshot { employees, sales, pendingSales, ... }
// via GET /state. Enquanto não há backend, usa window.storage como fallback.
function useStore() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    try {
      if (getToken()) {
        const state = await api.getState();
        setData({ ...defaultData, ...state });
        return true;
      }
    } catch { }
    return false;
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await fetchState();
      if (!ok) {
        // Fallback: window.storage (modo offline / dev sem backend)
        try {
          const r = await window.storage.get("operacao_data");
          if (r?.value) setData(JSON.parse(r.value));
        } catch { }
      }
      setLoading(false);
    })();

    // Poll every 15s for real-time updates (owner sees employee submissions)
    const interval = setInterval(() => {
      if (getToken()) fetchState();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // save: persiste localmente E sincroniza com backend se tiver token
  const save = useCallback(async (next) => {
    setData(next);
    // Fallback offline
    try { await window.storage.set("operacao_data", JSON.stringify(next)); } catch { }
  }, []);

  return [data, save, loading];
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════════════════════

// ── Login ──────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, employees = [] }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // ── Login handler: tenta API primeiro, fallback local ────────────────────
  const handleLogin = async () => {
    if (!user.trim() || !pass) return;
    setLoading(true);
    setError("");

    try {
      // 1) Tenta autenticar no backend Antigravity
      const res = await api.login(user.trim(), pass);
      // Esperado: { token, role: "owner"|"employee", employee?: {...} }
      setToken(res.token);
      onLogin(res.role, res.employee || null);
      return;
    } catch (err) {
      // Se o backend não estiver rodando (dev offline), usa fallback local
      if (err?.message !== "Unauthorized" && !navigator.onLine) {
        const u = user.trim().toLowerCase();
        if (u === "admin" && pass === "admin123") { onLogin("owner", null); return; }
        const emp = employees.find(
          e => e.username && e.username.trim().toLowerCase() === u && e.password === pass
        );
        if (emp) { onLogin("employee", emp); return; }
      }
      setError(err?.message || "Usuário ou senha incorretos");
    } finally {
      setLoading(false);
      setTimeout(() => setError(""), 3500);
    }
  };

  return (
    <div className="login-screen">
      <div className={`login-card${loading ? " login-shake" : ""}`}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="login-logo">OPERAÇÃO</div>
          <div className="login-sub">Sistema de gestão inteligente</div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
            color: "var(--red)", borderRadius: 10, padding: "10px 14px",
            fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8
          }}>
            <span>⚠</span> {error}
          </div>
        )}

        {/* Form */}
        <div className="form-group">
          <label className="form-label">Usuário</label>
          <input
            className="form-input"
            placeholder="Digite seu usuário"
            value={user}
            onChange={e => setUser(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label className="form-label">Senha</label>
          <div style={{ position: "relative" }}>
            <input
              className="form-input"
              type={showPass ? "text" : "password"}
              placeholder="Digite sua senha"
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ paddingRight: 44 }}
            />
            <button
              onClick={() => setShowPass(s => !s)}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--muted)", fontSize: 16, padding: 4,
              }}
            >{showPass ? "🙈" : "👁"}</button>
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", marginTop: 8, padding: "13px", fontSize: 14 }}
          onClick={handleLogin}
        >
          Entrar
        </button>

        <p style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", marginTop: 20 }}>
          Acesso restrito · Entre com suas credenciais
        </p>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ role, empName, page, setPage, onLogout, pendingCount }) {
  const ownerNav = [
    { id: "dashboard", label: "Dashboard", icon: icons.dashboard },
    { id: "financeiro", label: "Financeiro", icon: icons.dollar },
    { id: "funcionarios", label: "Funcionários", icon: icons.users },
    { id: "despesas", label: "Despesas", icon: icons.expense },
    { id: "prompts", label: "Prompts", icon: icons.image },
    { id: "aprovacoes", label: "Aprovações", icon: icons.bell, badge: pendingCount },
    { id: "notificacoes", label: "Notificações", icon: icons.wifi },
  ];
  const empNav = [
    { id: "prompts", label: "Meus Prompts", icon: icons.image },
    { id: "emp-vendas", label: "Minhas Vendas", icon: icons.cart },
  ];
  const nav = role === "owner" ? ownerNav : empNav;

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-text">OPERAÇÃO</div>
        <div className="logo-sub">{role === "owner" ? "Painel do Dono" : "Área do Funcionário"}</div>
      </div>
      <div className="sidebar-nav">
        {nav.map(n => (
          <div key={n.id} className={`nav-item${page === n.id ? " active" : ""}`}
            onClick={() => setPage(n.id)}>
            <Icon path={n.icon} size={16} />
            {n.label}
            {n.badge > 0 && <span className="nav-notif">{n.badge}</span>}
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="role-badge" onClick={onLogout}>
          <span className="role-dot" />
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {role === "owner" ? "Dono" : (empName || "Funcionário")}
          </span>
          <span><Icon path={icons.logout} size={14} /></span>
        </div>
      </div>
    </div>
  );
}

// ── Bottom Nav (mobile) ────────────────────────────────────────────────────
function BottomNav({ role, page, setPage, onLogout, pendingCount }) {
  const ownerNav = [
    { id: "dashboard", label: "Início", icon: icons.dashboard },
    { id: "funcionarios", label: "Equipe", icon: icons.users },
    { id: "aprovacoes", label: "Aprovações", icon: icons.bell, badge: pendingCount },
    { id: "despesas", label: "Gastos", icon: icons.expense },
    { id: "notificacoes", label: "Notif.", icon: icons.wifi },
  ];
  const empNav = [
    { id: "prompts", label: "Prompts", icon: icons.image },
    { id: "emp-vendas", label: "Vendas", icon: icons.cart },
  ];
  const nav = role === "owner" ? ownerNav : empNav;

  return (
    <div className="bottom-nav">
      <div className="bottom-nav-items">
        {nav.map(n => (
          <div key={n.id} className={`bottom-nav-item${page === n.id ? " active" : ""}`}
            onClick={() => setPage(n.id)}>
            {n.badge > 0 && <span className="notif">{n.badge}</span>}
            <Icon path={n.icon} size={22} />
            <span>{n.label}</span>
          </div>
        ))}
        <div className="bottom-nav-item" onClick={onLogout}>
          <Icon path={icons.logout} size={22} />
          <span>Sair</span>
        </div>
      </div>
    </div>
  );
}


function ProfitChart({ data }) {
  const [range, setRange] = useState("7");
  const [showPicker, setShowPicker] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const svgRef = useState(null);

  // Build date range
  const getRange = () => {
    const to = new Date(); to.setHours(23, 59, 59, 999);
    let from = new Date();
    if (range === "custom") {
      return {
        from: customFrom ? new Date(customFrom + "T00:00:00") : new Date(Date.now() - 30 * 864e5),
        to: customTo ? new Date(customTo + "T23:59:59") : to,
      };
    }
    from.setDate(from.getDate() - (parseInt(range) - 1));
    from.setHours(0, 0, 0, 0);
    return { from, to };
  };

  // Build daily profit points within range
  const buildPoints = () => {
    const { from, to } = getRange();
    const days = [];
    const cur = new Date(from);
    while (cur <= to) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    // daily salary cost = sum(salary/30) per employee
    const dailySalaryCost = (data.employees || []).reduce((s, e) => s + (e.salary || 0) / 30, 0);

    return days.map(d => {
      const sales = (data.sales || []).filter(s => s.date === d).reduce((a, b) => a + (b.value || 0), 0);
      const traffic = (data.empTraffic || []).filter(t => t.date === d).reduce((a, b) => a + (b.valueWithTax || b.value || 0), 0);
      const expenses = (data.expenses || []).filter(e => e.date === d).reduce((a, b) => a + (b.value || 0), 0);
      const profit = sales - traffic - expenses - dailySalaryCost;
      return { date: d, profit, sales };
    });
  };

  const points = buildPoints();
  const profits = points.map(p => p.profit);
  const minP = Math.min(...profits, 0);
  const maxP = Math.max(...profits, 0);
  const range_p = maxP - minP || 1;

  const W = 600, H = 180, PAD = 40, PAD_R = 16, PAD_B = 28, PAD_T = 12;
  const chartW = W - PAD - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const xPos = (i) => PAD + (i / Math.max(points.length - 1, 1)) * chartW;
  const yPos = (v) => PAD_T + chartH - ((v - minP) / range_p) * chartH;
  const zeroY = yPos(0);

  const pathD = points.length < 2 ? "" : points.map((p, i) => {
    const x = xPos(i), y = yPos(p.profit);
    if (i === 0) return `M ${x} ${y}`;
    const px = xPos(i - 1), py = yPos(points[i - 1].profit);
    const cp1x = px + (x - px) * 0.5, cp2x = px + (x - px) * 0.5;
    return `C ${cp1x} ${py} ${cp2x} ${y} ${x} ${y}`;
  }).join(" ");

  const areaD = pathD
    ? `${pathD} L ${xPos(points.length - 1)} ${zeroY} L ${xPos(0)} ${zeroY} Z`
    : "";

  const [tooltip, setTooltip] = useState(null);
  const svgEl = { current: null };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    if (points.length < 2) return;
    const idx = Math.round(((svgX - PAD) / chartW) * (points.length - 1));
    const i = Math.max(0, Math.min(idx, points.length - 1));
    const pt = points[i];
    setTooltip({ i, x: xPos(i), y: yPos(pt.profit), profit: pt.profit, date: pt.date, sales: pt.sales });
  };

  const fmtDate = (d) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  // Axis labels — show every nth label to avoid clutter
  const labelEvery = points.length <= 8 ? 1 : points.length <= 16 ? 2 : Math.ceil(points.length / 7);
  const yGridVals = [minP, minP + range_p * 0.25, minP + range_p * 0.5, minP + range_p * 0.75, maxP];

  const totalProfit = profits.reduce((a, b) => a + b, 0);
  const profitableDays = profits.filter(p => p > 0).length;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 2 }}>
            <Icon path={icons.trending} size={15} color="var(--accent)" />
            Lucro Líquido Diário
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Vendas − despesas − tráfego − salários</div>
        </div>
        {/* Range selector */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {["7", "15", "30"].map(r => (
            <button key={r}
              onClick={() => { setRange(r); setShowPicker(false); }}
              style={{
                padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${range === r ? "var(--accent)" : "var(--border2)"}`,
                background: range === r ? "rgba(245,166,35,0.12)" : "var(--surface2)",
                color: range === r ? "var(--accent)" : "var(--muted)",
                transition: "all 0.15s",
              }}>{r}d</button>
          ))}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => { setShowPicker(s => !s); setRange("custom"); }}
              style={{
                padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${range === "custom" ? "var(--accent)" : "var(--border2)"}`,
                background: range === "custom" ? "rgba(245,166,35,0.12)" : "var(--surface2)",
                color: range === "custom" ? "var(--accent)" : "var(--muted)",
                display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
              }}>
              <Icon path={icons.receipt} size={12} />
              {range === "custom" && customFrom ? `${fmtDate(customFrom)}–${fmtDate(customTo || customFrom)}` : "Custom"}
            </button>
            {showPicker && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 99,
                background: "var(--surface)", border: "1px solid var(--border2)",
                borderRadius: 14, padding: 16, width: 240,
                boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
                animation: "slideUp 0.18s ease",
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Período personalizado</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>De</div>
                  <input type="date" className="form-input" style={{ fontSize: 13, padding: "8px 10px" }}
                    value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>Até</div>
                  <input type="date" className="form-input" style={{ fontSize: 13, padding: "8px 10px" }}
                    value={customTo} onChange={e => setCustomTo(e.target.value)} />
                </div>
                <button className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => setShowPicker(false)}>Aplicar</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mini stats */}
      <div className="chart-ministats">
        {[
          { label: "Lucro no período", val: fmtBRL(totalProfit), color: totalProfit >= 0 ? "var(--green)" : "var(--red)" },
          { label: "Dias lucrativos", val: `${profitableDays}/${points.length}`, color: "var(--accent)" },
          { label: "Média diária", val: fmtBRL(totalProfit / (points.length || 1)), color: "var(--muted2)" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--surface2)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5, fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 800, color: s.color, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* SVG Chart */}
      <div style={{ overflowX: "auto", overflowY: "hidden", marginInline: -4 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 260, display: "block", height: "auto" }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}
          onTouchMove={(e) => { e.preventDefault(); handleMouseMove(e.touches[0]); }}
          onTouchEnd={() => setTooltip(null)}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="areaGradRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--red)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--red)" stopOpacity="0.15" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Y grid lines */}
          {yGridVals.map((v, i) => (
            <g key={i}>
              <line x1={PAD} x2={W - PAD_R} y1={yPos(v)} y2={yPos(v)}
                stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <text x={PAD - 4} y={yPos(v) + 4} fontSize="8" fill="rgba(255,255,255,0.2)"
                textAnchor="end" fontFamily="'DM Sans',sans-serif">
                {Math.round(v / 1000) !== 0 ? `${(v / 1000).toFixed(0)}k` : "0"}
              </text>
            </g>
          ))}

          {/* Zero line */}
          {minP < 0 && maxP > 0 && (
            <line x1={PAD} x2={W - PAD_R} y1={zeroY} y2={zeroY}
              stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 4" />
          )}

          {/* Area fill */}
          {areaD && <path d={areaD} fill="url(#areaGrad)" />}

          {/* Line */}
          {pathD && (
            <>
              <path d={pathD} fill="none" stroke="rgba(245,166,35,0.25)" strokeWidth="4" strokeLinecap="round" />
              <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="1.8"
                strokeLinecap="round" filter="url(#glow)" />
            </>
          )}

          {/* X-axis labels */}
          {points.map((p, i) => i % labelEvery === 0 && (
            <text key={i} x={xPos(i)} y={H - 6} fontSize="9" fill="rgba(255,255,255,0.28)"
              textAnchor="middle" fontFamily="'DM Sans',sans-serif">
              {fmtDate(p.date)}
            </text>
          ))}

          {/* Data points */}
          {points.map((p, i) => {
            const x = xPos(i), y = yPos(p.profit);
            const isPos = p.profit >= 0;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="4.5"
                  fill={isPos ? "var(--accent)" : "var(--red)"}
                  opacity="0.9"
                  filter="url(#glow)" />
                <circle cx={x} cy={y} r="2.5" fill="#0a1018" />
              </g>
            );
          })}

          {/* Tooltip */}
          {tooltip && (() => {
            const tx = Math.min(tooltip.x, W - 130);
            const ty = Math.max(tooltip.y - 60, PAD_T);
            const isPos = tooltip.profit >= 0;
            return (
              <g>
                <line x1={tooltip.x} x2={tooltip.x} y1={PAD_T} y2={H - PAD_B}
                  stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={tooltip.x} cy={tooltip.y} r="6"
                  fill={isPos ? "rgba(245,166,35,0.2)" : "rgba(255,64,96,0.2)"}
                  stroke={isPos ? "var(--accent)" : "var(--red)"} strokeWidth="1.5" />
                <rect x={tx} y={ty} width="120" height="48" rx="8" ry="8"
                  fill="#111d2a" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <text x={tx + 10} y={ty + 16} fontSize="9" fill="rgba(255,255,255,0.45)" fontFamily="'DM Sans',sans-serif">{fmtDate(tooltip.date)}</text>
                <text x={tx + 10} y={ty + 30} fontSize="11" fontWeight="700"
                  fill={isPos ? "var(--accent)" : "var(--red)"} fontFamily="'Outfit',sans-serif">
                  {fmtBRL(tooltip.profit)}
                </text>
                <text x={tx + 10} y={ty + 42} fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="'DM Sans',sans-serif">
                  Vendas: {fmtBRL(tooltip.sales)}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {points.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon path={icons.trending} size={32} /></div>
          <div className="empty-state-text">Nenhum dado no período selecionado</div>
        </div>
      )}
    </div>
  );
}

function Dashboard({ data }) {
  const totalSales = (data.sales || []).reduce((s, v) => s + (v.value || 0), 0);
  const totalExp = data.expenses.reduce((s, e) => s + (e.value || 0), 0);
  const totalEmpTraffic = (data.empTraffic || []).reduce((s, t) => s + (t.valueWithTax || t.value || 0), 0);
  const lucro = totalSales - totalExp - totalEmpTraffic;
  const todaySales = (data.sales || []).filter(s => s.date === today()).reduce((a, b) => a + b.value, 0);
  const pendingCount = (data.pendingSales || []).length;

  const salesByEmp = {};
  data.employees.forEach(e => salesByEmp[e.id] = 0);
  (data.sales || []).forEach(s => { salesByEmp[s.employeeId] = (salesByEmp[s.employeeId] || 0) + s.value; });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Visão geral da operação</div>
        </div>
        <div className="tag">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</div>
      </div>
      <div className="page-content">

        {/* Stat Cards */}
        <div className="stats-grid">
          <div className="stat-card gold">
            <div className="stat-label">Receita Total</div>
            <div className="stat-value gold">{fmtBRL(totalSales)}</div>
            <div className="stat-note">{(data.sales || []).length} vendas aprovadas</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Total de Gastos</div>
            <div className="stat-value red">{fmtBRL(totalExp + totalEmpTraffic)}</div>
            <div className="stat-note">{data.expenses.length} despesas + tráfego</div>
          </div>
          <div className={`stat-card ${lucro >= 0 ? "green" : "red"}`}>
            <div className="stat-label">Lucro Líquido</div>
            <div className={`stat-value ${lucro >= 0 ? "green" : "red"}`}>{fmtBRL(lucro)}</div>
            <div className="stat-note">{lucro >= 0 ? "✓ Operação lucrativa" : "⚠ Prejuízo"}</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label">Vendas Hoje</div>
            <div className="stat-value blue">{fmtBRL(todaySales)}</div>
            <div className="stat-note">
              {(data.sales || []).filter(s => s.date === today()).length} aprovadas
              {pendingCount > 0 && <span style={{ color: "var(--accent)" }}> · {pendingCount} pendentes</span>}
            </div>
          </div>
        </div>

        {/* Profit Chart */}
        <ProfitChart data={data} />

        {/* Goals + Ranking */}
        <div className="grid-2">
          <div className="card">
            <div className="card-title">Meta Diária — Funcionários</div>
            {data.employees.length === 0 ? (
              <div className="empty-state"><div className="empty-state-text">Nenhum funcionário cadastrado</div></div>
            ) : data.employees.map(emp => {
              const salDiario = (emp.salary || 0) / 30;
              const vendHoje = (data.sales || [])
                .filter(s => s.employeeId === emp.id && s.date === today())
                .reduce((a, b) => a + b.value, 0);
              const pct = salDiario > 0 ? Math.min((vendHoje / salDiario) * 100, 100) : 0;
              const ok = vendHoje >= salDiario;
              return (
                <div key={emp.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{emp.name}</span>
                    <span className={ok ? "text-green" : "text-muted"} style={{ fontSize: 12 }}>
                      {fmtBRL(vendHoje)} / {fmtBRL(salDiario)}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: pct + "%", background: ok ? "var(--green)" : "var(--accent)" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                    {pct.toFixed(0)}% da meta diária {ok ? "✓ Atingida!" : ""}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <div className="card-title">Ranking de Vendas</div>
            {data.employees.length === 0 ? (
              <div className="empty-state"><div className="empty-state-text">Sem dados</div></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.employees
                  .map(e => ({ ...e, total: salesByEmp[e.id] || 0 }))
                  .sort((a, b) => b.total - a.total)
                  .map((e, i) => (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: i === 0 ? "rgba(245,166,35,0.15)" : "var(--surface2)",
                        border: i === 0 ? "1px solid rgba(245,166,35,0.3)" : "1px solid var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700,
                        color: i === 0 ? "var(--accent)" : "var(--muted)", flexShrink: 0
                      }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{e.role}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 14, fontWeight: 800, color: "var(--accent)", letterSpacing: -0.5 }}>{fmtBRL(e.total)}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>total</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}

// ── Financeiro ─────────────────────────────────────────────────────────────
function Financeiro({ data, save }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employeeId: "", value: "", description: "", date: today() });

  const totalSales = data.sales.reduce((s, v) => s + (v.value || 0), 0);
  const totalExp = data.expenses.reduce((s, e) => s + (e.value || 0), 0);
  const lucro = totalSales - totalExp;

  const addSale = async () => {
    if (!form.value || !form.employeeId) return;
    try {
      const created = await api.createSale({ employeeId: form.employeeId, value: parseFloat(form.value), description: form.description, date: form.date });
      save({ ...data, sales: [...data.sales, created] });
      setShowModal(false);
      setForm({ employeeId: "", value: "", description: "", date: today() });
    } catch (e) { alert(e?.message || "Erro ao criar venda"); }
  };

  const delSale = async (id) => {
    try { await api.deleteSale(id); save({ ...data, sales: data.sales.filter(s => s.id !== id) }); }
    catch (e) { alert(e?.message || "Erro ao deletar venda"); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Financeiro</div>
          <div className="page-sub">Controle de receitas e vendas</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Icon path={icons.plus} size={14} /> Nova Venda
        </button>
      </div>
      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="stat-card gold">
            <div className="stat-label">Receita Total</div>
            <div className="stat-value gold">{fmtBRL(totalSales)}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Total Gastos</div>
            <div className="stat-value red">{fmtBRL(totalExp)}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Lucro Líquido</div>
            <div className={`stat-value ${lucro >= 0 ? "green" : "red"}`}>{fmtBRL(lucro)}</div>
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <div className="section-title">Histórico de Vendas</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th><th>Funcionário</th><th>Descrição</th><th>Valor</th><th></th>
                </tr>
              </thead>
              <tbody>
                {data.sales.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>Nenhuma venda registrada</td></tr>
                )}
                {[...data.sales].reverse().map(s => {
                  const emp = data.employees.find(e => e.id === s.employeeId);
                  return (
                    <tr key={s.id}>
                      <td className="text-muted">{new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                      <td><span className="font-bold">{emp?.name || "—"}</span></td>
                      <td className="text-muted">{s.description || "—"}</td>
                      <td><span className="text-green font-bold">{fmtBRL(s.value)}</span></td>
                      <td>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => delSale(s.id)}>
                          <Icon path={icons.trash} size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-bg" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Registrar Venda</div>
            <div className="form-group">
              <label className="form-label">Funcionário</label>
              <select className="form-input" value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}>
                <option value="">Selecionar...</option>
                {data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" placeholder="0,00"
                  value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input className="form-input" type="date" value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input className="form-input" placeholder="Ex: Pacote 10 fotos..."
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addSale}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Employee Profile Page ──────────────────────────────────────────────────
function EmployeeProfile({ emp, data, save, onBack }) {
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleForm, setSaleForm] = useState({ value: "", description: "", date: today() });
  const [trafficForm, setTrafficForm] = useState({ value: "", date: today() });
  const [filterDate, setFilterDate] = useState(today());

  const TAX = 0.13;

  const pendingSales = (data.pendingSales || []).filter(s => s.employeeId === emp.id);
  const approvedSales = (data.sales || []).filter(s => s.employeeId === emp.id);
  const empTraffic = (data.empTraffic || []).filter(t => t.employeeId === emp.id);

  // Day-filtered data
  const pendingToday = pendingSales.filter(s => s.date === filterDate);
  const approvedToday = approvedSales.filter(s => s.date === filterDate);
  const trafficToday = empTraffic.filter(t => t.date === filterDate);

  const approvedTodayTotal = approvedToday.reduce((a, b) => a + b.value, 0);
  const trafficTodayTotal = trafficToday.reduce((a, b) => a + (b.valueWithTax || b.value), 0);
  const salaryDaily = (emp.salary || 0) / 30;
  const lucroHoje = approvedTodayTotal - trafficTodayTotal - salaryDaily;

  // All-time totals
  const totalApproved = approvedSales.reduce((a, b) => a + b.value, 0);
  const pendingCount = pendingSales.filter(s => !s.approved).length;

  const addPendingSale = async () => {
    if (!saleForm.value) return;
    try {
      const created = await api.submitSale({ employeeId: emp.id, employeeName: emp.name, value: parseFloat(saleForm.value), description: saleForm.description, date: saleForm.date });
      save({ ...data, pendingSales: [...(data.pendingSales || []), created] });
      setShowSaleModal(false);
      setSaleForm({ value: "", description: "", date: today() });
    } catch (e) { alert(e?.message || "Erro ao enviar venda"); }
  };

  const approveSale = async (saleId) => {
    try {
      const res = await api.approveSale(saleId);
      save({
        ...data,
        pendingSales: (data.pendingSales || []).filter(s => s.id !== saleId),
        sales: [...(data.sales || []), res.approved],
      });
    } catch (e) { alert(e?.message || "Erro ao aprovar venda"); }
  };

  const rejectSale = async (saleId) => {
    try {
      await api.rejectSale(saleId);
      save({ ...data, pendingSales: (data.pendingSales || []).filter(s => s.id !== saleId) });
    } catch (e) { alert(e?.message || "Erro ao rejeitar venda"); }
  };

  const delApprovedSale = async (saleId) => {
    try {
      await api.deleteSale(saleId);
      save({ ...data, sales: (data.sales || []).filter(s => s.id !== saleId) });
    } catch (e) { alert(e?.message || "Erro ao deletar venda"); }
  };

  const addTraffic = async () => {
    if (!trafficForm.value) return;
    const raw = parseFloat(trafficForm.value);
    const withTax = raw * (1 + TAX);
    try {
      const created = await api.createTraffic({ employeeId: emp.id, value: raw, valueWithTax: withTax, date: trafficForm.date });
      save({ ...data, empTraffic: [...(data.empTraffic || []), created] });
      setTrafficForm({ value: "", date: today() });
    } catch (e) { alert(e?.message || "Erro ao criar tráfego"); }
  };

  const delTraffic = async (id) => {
    try { await api.deleteTraffic(id); save({ ...data, empTraffic: (data.empTraffic || []).filter(t => t.id !== id) }); }
    catch (e) { alert(e?.message || "Erro ao deletar tráfego"); }
  };

  const allExtrato = [
    ...pendingSales.map(s => ({ ...s, _type: "pending" })),
    ...approvedSales.map(s => ({ ...s, _type: "approved" })),
  ].filter(s => s.date === filterDate).sort((a, b) => a.date > b.date ? -1 : 1);

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ padding: "7px 12px" }}>
            <Icon path={icons.back} size={14} /> Voltar
          </button>
          <div>
            <div className="page-title">{emp.name}</div>
            <div className="page-sub">Perfil do funcionário · Salário {fmtBRL(emp.salary)} · Meta/dia {fmtBRL(salaryDaily)}</div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowSaleModal(true)}>
          <Icon path={icons.plus} size={14} /> Lançar Venda
        </button>
      </div>

      <div className="page-content">
        {/* Day selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>Visualizando dia:</span>
          <input type="date" className="form-input" value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ width: 160, padding: "6px 10px" }} />
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterDate(today())}>Hoje</button>
        </div>

        {/* Day stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
          <div className="stat-card gold">
            <div className="stat-label">Vendas Aprovadas</div>
            <div className="stat-value gold">{fmtBRL(approvedTodayTotal)}</div>
            <div className="stat-note">{approvedToday.length} vendas</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Tráfego do Dia</div>
            <div className="stat-value red">{fmtBRL(trafficTodayTotal)}</div>
            <div className="stat-note">c/ 13% imposto</div>
          </div>
          <div className="stat-card" style={{ "--t": "var(--blue)" }}>
            <div className="stat-label">Custo Funcionário</div>
            <div className="stat-value blue">{fmtBRL(salaryDaily)}</div>
            <div className="stat-note">salário ÷ 30</div>
          </div>
          <div className="stat-card" style={{ borderColor: lucroHoje >= 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)" }}>
            <div className="stat-label" style={{ color: lucroHoje >= 0 ? "var(--green)" : "var(--red)" }}>Lucro do Dia</div>
            <div className={`stat-value ${lucroHoje >= 0 ? "green" : "red"}`}>{fmtBRL(lucroHoje)}</div>
            <div className="stat-note">{lucroHoje >= 0 ? "✓ Positivo" : "⚠ Negativo"}</div>
          </div>
        </div>

        <div className="grid-2">
          {/* Extrato */}
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="section-header">
              <div className="section-title">
                <Icon path={icons.receipt} size={16} /> Extrato de Vendas
                {pendingToday.length > 0 && (
                  <span style={{
                    marginLeft: 10, background: "var(--accent)", color: "#000",
                    fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20
                  }}>
                    {pendingToday.length} pendente{pendingToday.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            {allExtrato.length === 0 ? (
              <div className="empty-state" style={{ padding: "28px 0" }}>
                <div className="empty-state-text">Nenhuma venda neste dia.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Status</th><th>Descrição</th><th>Valor</th><th>Ações</th></tr>
                  </thead>
                  <tbody>
                    {allExtrato.map(s => (
                      <tr key={s.id} className={s._type === "pending" ? "pending-row" : "approved-row"}>
                        <td>
                          {s._type === "pending"
                            ? <span className="badge badge-gold">⏳ Pendente</span>
                            : <span className="badge badge-green">✓ Aprovada</span>
                          }
                        </td>
                        <td className="text-muted">{s.description || "—"}</td>
                        <td><span className="font-bold text-accent">{fmtBRL(s.value)}</span></td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            {s._type === "pending" && (
                              <>
                                <button className="btn btn-sm" style={{ background: "rgba(34,197,94,0.1)", color: "var(--green)", border: "1px solid rgba(34,197,94,0.2)" }}
                                  onClick={() => approveSale(s.id)}>
                                  <Icon path={icons.check} size={12} /> Aprovar
                                </button>
                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => rejectSale(s.id)}>
                                  <Icon path={icons.trash} size={12} />
                                </button>
                              </>
                            )}
                            {s._type === "approved" && (
                              <button className="btn btn-danger btn-sm btn-icon" onClick={() => delApprovedSale(s.id)}>
                                <Icon path={icons.trash} size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Traffic section */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-header">
            <div className="section-title"><Icon path={icons.wifi} size={16} /> Tráfego Pago do Dia</div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ marginBottom: 0, flex: "1 1 180px" }}>
              <label className="form-label">Valor do tráfego (R$)</label>
              <input className="form-input" type="number" step="0.01" placeholder="0,00"
                value={trafficForm.value} onChange={e => setTrafficForm({ ...trafficForm, value: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: "0 0 150px" }}>
              <label className="form-label">Data</label>
              <input className="form-input" type="date" value={trafficForm.date}
                onChange={e => setTrafficForm({ ...trafficForm, date: e.target.value })} />
            </div>
            <div>
              {trafficForm.value && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                  c/ imposto: <span className="text-accent">{fmtBRL(parseFloat(trafficForm.value || 0) * 1.13)}</span>
                </div>
              )}
              <button className="btn btn-primary" onClick={addTraffic}>
                <Icon path={icons.plus} size={13} /> Adicionar
              </button>
            </div>
          </div>

          {trafficToday.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Valor base</th><th>Com 13%</th><th></th></tr></thead>
                <tbody>
                  {trafficToday.map(t => (
                    <tr key={t.id}>
                      <td className="text-muted">{new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                      <td>{fmtBRL(t.value)}</td>
                      <td className="text-red font-bold">{fmtBRL(t.valueWithTax || t.value)}</td>
                      <td>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => delTraffic(t.id)}>
                          <Icon path={icons.trash} size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* All-time summary */}
        <div className="card">
          <div className="card-title">Resumo Geral</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div><div style={{ fontSize: 11, color: "var(--muted)" }}>Total aprovado (histórico)</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)", fontFamily: "'Space Grotesk', sans-serif", fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>{fmtBRL(totalApproved)}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--muted)" }}>Vendas pendentes</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", fontFamily: "'Space Grotesk', sans-serif", fontVariantNumeric: "tabular-nums" }}>{pendingCount}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--muted)" }}>Salário mensal</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>{fmtBRL(emp.salary)}</div></div>
          </div>
        </div>
      </div>

      {/* Add sale modal */}
      {showSaleModal && (
        <div className="modal-bg" onClick={() => setShowSaleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Lançar Venda — {emp.name}</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" placeholder="0,00"
                  value={saleForm.value} onChange={e => setSaleForm({ ...saleForm, value: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input className="form-input" type="date" value={saleForm.date}
                  onChange={e => setSaleForm({ ...saleForm, date: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input className="form-input" placeholder="Ex: Pacote 10 fotos, cliente..."
                value={saleForm.description} onChange={e => setSaleForm({ ...saleForm, description: e.target.value })} />
            </div>
            <div style={{ background: "rgba(240,165,0,0.06)", border: "1px solid rgba(240,165,0,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              ⚠ A venda entrará como <strong style={{ color: "var(--accent)" }}>pendente</strong> até você aprovar no extrato.
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowSaleModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addPendingSale}>Lançar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Reusable Employee Form (create + edit) ─────────────────────────────────
function EmpFormModal({ initial, onSave, onClose, title, saveLabel }) {
  const [form, setForm] = useState(initial);
  const [showPass, setShowPass] = useState(false);
  const ok = !!form.name.trim();
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-title">{title}</div>

        <div className="form-group">
          <label className="form-label">Nome completo</label>
          <input className="form-input" placeholder="Ex: Maria Silva" autoFocus
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Cargo / Função</label>
            <input className="form-input" placeholder="Ex: Vendedora..."
              value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Salário mensal (R$)</label>
            <input className="form-input" type="number" placeholder="Ex: 1500"
              value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} />
          </div>
        </div>
        {form.salary && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -8, marginBottom: 14 }}>
            Meta diária: <span className="text-accent font-bold">{fmtBRL(parseFloat(form.salary || 0) / 30)}</span>
          </div>
        )}

        <div style={{ height: 1, background: "var(--border)", margin: "4px 0 16px" }} />
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          🔐 <span>Credenciais de acesso ao sistema</span>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Usuário</label>
            <input className="form-input" placeholder="Ex: maria.silva"
              value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
              autoComplete="off" />
          </div>
          <div className="form-group">
            <label className="form-label">Senha</label>
            <div style={{ position: "relative" }}>
              <input className="form-input" type={showPass ? "text" : "password"}
                placeholder={initial.password ? "••••••• (deixe em branco p/ manter)" : "Crie uma senha"}
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password" style={{ paddingRight: 36 }} />
              <button onClick={() => setShowPass(s => !s)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13
                }}>
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>
        </div>
        {form.username && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: -8, marginBottom: 4 }}>
            Login: <span className="text-accent">@{form.username}</span>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!ok} onClick={() => ok && onSave(form)}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation popup ──────────────────────────────────────────────
function ConfirmDeleteModal({ emp, onConfirm, onCancel }) {
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
        <div className="modal-title" style={{ textAlign: "center" }}>Excluir funcionário?</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
          Você está prestes a excluir <strong style={{ color: "var(--text)" }}>{emp.name}</strong>.
        </div>
        <div style={{
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)",
          borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "var(--red)", marginBottom: 24
        }}>
          ⚠ Todas as vendas, histórico e dados deste funcionário serão <strong>permanentemente removidos</strong>. Esta ação não pode ser desfeita.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-danger" style={{ flex: 1, justifyContent: "center" }} onClick={onConfirm}>
            <Icon path={icons.trash} size={14} /> Sim, excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Funcionários list ──────────────────────────────────────────────────────
function Funcionarios({ data, save }) {
  const EMPTY_FORM = { name: "", salary: "", role: "", username: "", password: "" };
  const [showCreate, setShowCreate] = useState(false);
  const [editEmp, setEditEmp] = useState(null);   // employee object being edited
  const [deleteEmp, setDeleteEmp] = useState(null);   // employee object pending delete
  const [selectedEmp, setSelectedEmp] = useState(null);

  if (selectedEmp) {
    const emp = data.employees.find(e => e.id === selectedEmp);
    if (emp) return <EmployeeProfile emp={emp} data={data} save={save} onBack={() => setSelectedEmp(null)} />;
  }

  const createEmp = async (form) => {
    try {
      const created = await api.createEmployee({
        name: form.name,
        salary: parseFloat(form.salary) || 0,
        role: form.role,
        username: form.username.trim(),
        password: form.password,
      });
      save({ ...data, employees: [...data.employees, created] });
      setShowCreate(false);
    } catch (e) {
      alert(e?.message || "Erro ao criar funcionário");
    }
  };

  const saveEdit = async (form) => {
    try {
      const updated = await api.updateEmployee(editEmp.id, {
        name: form.name,
        salary: parseFloat(form.salary) || 0,
        role: form.role,
        username: form.username.trim(),
        password: form.password || "",
      });
      save({
        ...data, employees: data.employees.map(e =>
          e.id !== editEmp.id ? e : updated
        )
      });
      setEditEmp(null);
    } catch (e) {
      alert(e?.message || "Erro ao atualizar funcionário");
    }
  };

  const confirmDelete = async () => {
    try {
      const id = deleteEmp.id;
      await api.deleteEmployee(id);
      save({
        ...data,
        employees: data.employees.filter(e => e.id !== id),
        sales: (data.sales || []).filter(s => s.employeeId !== id),
        pendingSales: (data.pendingSales || []).filter(s => s.employeeId !== id),
        empTraffic: (data.empTraffic || []).filter(t => t.employeeId !== id),
      });
      setDeleteEmp(null);
    } catch (e) {
      alert(e?.message || "Erro ao deletar funcionário");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Funcionários</div>
          <div className="page-sub">Clique no card para abrir o perfil completo</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Icon path={icons.plus} size={14} /> Novo Funcionário
        </button>
      </div>

      <div className="page-content">
        {data.employees.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <div className="empty-state-icon"><Icon path={icons.users} size={48} /></div>
            <div className="empty-state-text">Nenhum funcionário cadastrado. Clique em "Novo Funcionário".</div>
          </div>
        ) : (
          <div className="emp-grid">
            {data.employees.map(emp => {
              const approved = (data.sales || []).filter(s => s.employeeId === emp.id);
              const pending = (data.pendingSales || []).filter(s => s.employeeId === emp.id);
              const totalApproved = approved.reduce((a, b) => a + b.value, 0);
              const todayApproved = approved.filter(s => s.date === today()).reduce((a, b) => a + b.value, 0);
              const metaDia = (emp.salary || 0) / 30;
              const ok = todayApproved >= metaDia && metaDia > 0;
              return (
                <div key={emp.id} className="emp-card" onClick={() => setSelectedEmp(emp.id)}>
                  {pending.length > 0 && (
                    <span className="pending-badge">{pending.length} pendente{pending.length > 1 ? "s" : ""}</span>
                  )}
                  <div className="emp-avatar">{emp.name.charAt(0).toUpperCase()}</div>
                  <div className="emp-card-name">{emp.name}</div>
                  <div className="emp-card-meta">
                    {emp.role || "Vendedor(a)"} · {fmtBRL(emp.salary)}/mês
                    {emp.username && (
                      <span style={{ display: "block", marginTop: 2, color: "var(--accent)", fontSize: 11 }}>
                        🔐 @{emp.username}
                      </span>
                    )}
                  </div>
                  <div className="emp-card-stats">
                    <div className="emp-stat">
                      <div className="emp-stat-label">Total vendido</div>
                      <div className="emp-stat-val text-green">{fmtBRL(totalApproved)}</div>
                    </div>
                    <div className="emp-stat">
                      <div className="emp-stat-label">Hoje</div>
                      <div className={`emp-stat-val ${ok ? "text-green" : "text-accent"}`}>{fmtBRL(todayApproved)}</div>
                    </div>
                    <div className="emp-stat" style={{ gridColumn: "1/-1" }}>
                      <div className="emp-stat-label">Meta diária</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div className="emp-stat-val text-accent">{fmtBRL(metaDia)}</div>
                        <span className={`badge ${ok ? "badge-green" : "badge-gold"}`}>{ok ? "✓ Batida" : "Em aberto"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: "7px 14px", fontSize: 12 }}
                      onClick={e => {
                        e.stopPropagation();
                        setEditEmp(emp);
                      }}>
                      <Icon path={icons.edit} size={13} /> Editar
                    </button>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={e => {
                        e.stopPropagation();
                        setDeleteEmp(emp);
                      }}>
                      <Icon path={icons.trash} size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <EmpFormModal
          initial={EMPTY_FORM}
          title="Novo Funcionário"
          saveLabel="Criar Cadastro"
          onSave={createEmp}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Edit modal */}
      {editEmp && (
        <EmpFormModal
          initial={{ name: editEmp.name, salary: String(editEmp.salary), role: editEmp.role || "", username: editEmp.username || "", password: "" }}
          title={`Editar — ${editEmp.name}`}
          saveLabel="Salvar Alterações"
          onSave={saveEdit}
          onClose={() => setEditEmp(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteEmp && (
        <ConfirmDeleteModal
          emp={deleteEmp}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteEmp(null)}
        />
      )}
    </>
  );
}

// ── Despesas ───────────────────────────────────────────────────────────────
function Despesas({ data, save }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ description: "", value: "", type: "geral", date: today(), traffic: false });

  const TAX_RATE = 0.13;

  const addExp = async () => {
    if (!form.value) return;
    const v = parseFloat(form.value);
    const total = form.traffic ? v * (1 + TAX_RATE) : v;
    try {
      const created = await api.createExpense({ description: form.description, value: total, rawValue: v, traffic: form.traffic, date: form.date });
      save({ ...data, expenses: [...data.expenses, created] });
      setShowModal(false);
      setForm({ description: "", value: "", type: "geral", date: today(), traffic: false });
    } catch (e) { alert(e?.message || "Erro ao criar despesa"); }
  };

  const delExp = async (id) => {
    try { await api.deleteExpense(id); save({ ...data, expenses: data.expenses.filter(e => e.id !== id) }); }
    catch (e) { alert(e?.message || "Erro ao deletar despesa"); }
  };

  const totalGeral = data.expenses.reduce((s, e) => s + e.value, 0);
  const totalTrafego = data.expenses.filter(e => e.traffic).reduce((s, e) => s + e.value, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Despesas</div>
          <div className="page-sub">Controle de gastos + tráfego pago (13% imposto)</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Icon path={icons.plus} size={14} /> Adicionar Gasto
        </button>
      </div>
      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="stat-card red">
            <div className="stat-label">Total de Despesas</div>
            <div className="stat-value red">{fmtBRL(totalGeral)}</div>
            <div className="stat-note">{data.expenses.length} lançamentos</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label">Tráfego Pago (c/ imposto)</div>
            <div className="stat-value blue">{fmtBRL(totalTrafego)}</div>
            <div className="stat-note">Já inclui 13% de imposto</div>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th></th></tr>
              </thead>
              <tbody>
                {data.expenses.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>Nenhuma despesa registrada</td></tr>
                )}
                {[...data.expenses].reverse().map(e => (
                  <tr key={e.id}>
                    <td className="text-muted">{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                    <td className="font-bold">{e.description || "—"}</td>
                    <td>
                      {e.traffic
                        ? <span className="badge badge-gold">Tráfego Pago</span>
                        : <span className="badge" style={{ background: "rgba(100,100,100,0.1)", color: "var(--muted)" }}>Geral</span>
                      }
                    </td>
                    <td>
                      <span className="text-red font-bold">{fmtBRL(e.value)}</span>
                      {e.traffic && e.rawValue && (
                        <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>
                          (base {fmtBRL(e.rawValue)} + 13%)
                        </span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => delExp(e.id)}>
                        <Icon path={icons.trash} size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-bg" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Nova Despesa</div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input className="form-input" placeholder="Ex: Meta Ads, Servidor..."
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" placeholder="0,00"
                  value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input className="form-input" type="date" value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.traffic}
                  onChange={e => setForm({ ...form, traffic: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                <span style={{ fontSize: 13 }}>É tráfego pago? <span className="text-accent">(+13% imposto automático)</span></span>
              </label>
              {form.traffic && form.value && (
                <div className="alert alert-success" style={{ marginTop: 10 }}>
                  Valor final: <strong>{fmtBRL(parseFloat(form.value || 0) * 1.13)}</strong>
                  <span style={{ fontSize: 11 }}> (base {fmtBRL(parseFloat(form.value))} + {fmtBRL(parseFloat(form.value) * 0.13)} imposto)</span>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addExp}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Category colors ────────────────────────────────────────────────────────
const CAT_COLORS = [
  "#f0a500", "#e05c00", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#f43f5e",
];

// ── Prompts (shared) ───────────────────────────────────────────────────────
function Prompts({ data, save, isOwner }) {
  const categories = data.categories || [];
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [form, setForm] = useState({ title: "", promptText: "", imageUrl: "", categoryId: "" });
  const [catForm, setCatForm] = useState({ name: "", color: CAT_COLORS[0] });
  const [copied, setCopied] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [dragOver, setDragOver] = useState(false);

  const copyPrompt = (id, text) => {
    // Try modern clipboard API first, fallback to execCommand
    const doFallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { }
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => { }, doFallback);
    } else {
      doFallback();
    }
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const addPrompt = async () => {
    if (!form.promptText) return;
    try {
      const created = await api.createPrompt({ title: form.title, promptText: form.promptText, imageUrl: form.imageUrl, categoryId: form.categoryId || null });
      save({ ...data, prompts: [...data.prompts, created] });
      setShowPromptModal(false);
      setForm({ title: "", promptText: "", imageUrl: "", categoryId: "" });
    } catch (e) { alert(e?.message || "Erro ao criar prompt"); }
  };

  const delPrompt = async (id) => {
    try { await api.deletePrompt(id); save({ ...data, prompts: data.prompts.filter(p => p.id !== id) }); }
    catch (e) { alert(e?.message || "Erro ao deletar prompt"); }
  };

  const addCategory = async () => {
    if (!catForm.name.trim()) return;
    try {
      const created = await api.createCategory({ name: catForm.name, color: catForm.color });
      save({ ...data, categories: [...categories, created] });
      setShowCatModal(false);
      setCatForm({ name: "", color: CAT_COLORS[0] });
    } catch (e) { alert(e?.message || "Erro ao criar categoria"); }
  };

  const delCategory = async (id) => {
    try {
      await api.deleteCategory(id);
      save({
        ...data,
        categories: categories.filter(c => c.id !== id),
        prompts: data.prompts.map(p => p.categoryId === id ? { ...p, categoryId: "" } : p),
      });
    } catch (e) { alert(e?.message || "Erro ao deletar categoria"); }
  };

  const handleImageUpload = (e) => {
    const file = e.target?.files?.[0] || e;
    if (!file || !(file instanceof File)) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, imageUrl: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageUpload(file);
        return;
      }
    }
  };

  const filtered = activeCategory === "all"
    ? data.prompts
    : activeCategory === "uncategorized"
      ? data.prompts.filter(p => !p.categoryId)
      : data.prompts.filter(p => p.categoryId === activeCategory);

  const getCat = (id) => categories.find(c => c.id === id);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isOwner ? "Biblioteca de Prompts" : "Meus Prompts"}</div>
          <div className="page-sub">{isOwner ? "Gerencie prompts e categorias de imagens I.A" : "Filtre por categoria e copie o prompt"}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setShowCatModal(true)}>
            <Icon path={icons.folder} size={14} />
            {isOwner ? "Gerenciar Categorias" : "Ver Categorias"}
          </button>
          {isOwner && (
            <button className="btn btn-primary" onClick={() => setShowPromptModal(true)}>
              <Icon path={icons.plus} size={14} /> Novo Prompt
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Category filter pills */}
        {(data.prompts.length > 0 || categories.length > 0) && (
          <div className="cat-bar">
            <div className={`cat-pill${activeCategory === "all" ? " active" : ""}`}
              onClick={() => setActiveCategory("all")}>
              Todos
              <span className="cat-count">{data.prompts.length}</span>
            </div>
            {categories.map(c => (
              <div key={c.id}
                className={`cat-pill${activeCategory === c.id ? " active" : ""}`}
                onClick={() => setActiveCategory(c.id)}
                style={activeCategory === c.id ? { borderColor: c.color, background: c.color + "18", color: c.color } : {}}>
                <span className="cat-dot" style={{ background: c.color }} />
                {c.name}
                <span className="cat-count">{data.prompts.filter(p => p.categoryId === c.id).length}</span>
              </div>
            ))}
            {data.prompts.some(p => !p.categoryId) && (
              <div className={`cat-pill${activeCategory === "uncategorized" ? " active" : ""}`}
                onClick={() => setActiveCategory("uncategorized")}>
                <span className="cat-dot" style={{ background: "var(--muted)" }} />
                Sem categoria
                <span className="cat-count">{data.prompts.filter(p => !p.categoryId).length}</span>
              </div>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <div className="empty-state-icon"><Icon path={icons.image} size={48} /></div>
            <div className="empty-state-text">
              {data.prompts.length === 0
                ? isOwner ? "Nenhum prompt cadastrado ainda." : "Nenhum prompt disponível ainda."
                : "Nenhum prompt nesta categoria."}
            </div>
          </div>
        ) : (
          <div className="prompt-grid">
            {filtered.map(p => {
              const cat = getCat(p.categoryId);
              return (
                <div key={p.id} className="prompt-card">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.title} style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                    : <div className="prompt-img-placeholder"><Icon path={icons.image} size={40} /></div>
                  }
                  <div className="prompt-body">
                    {cat && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: cat.color + "18", color: cat.color, border: `1px solid ${cat.color}40`
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: cat.color, display: "inline-block" }} />
                          {cat.name}
                        </span>
                      </div>
                    )}
                    <div className="prompt-name">{p.title || "Prompt sem título"}</div>
                    <div className="prompt-text">{p.promptText}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className={`btn btn-copy btn-sm${copied === p.id ? " copied" : ""}`}
                        style={{ flex: 1, justifyContent: "center" }}
                        onClick={() => copyPrompt(p.id, p.promptText)}>
                        <Icon path={copied === p.id ? icons.check : icons.copy} size={13} />
                        {copied === p.id ? "Copiado!" : "Copiar Prompt"}
                      </button>
                      {isOwner && (
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => delPrompt(p.id)}>
                          <Icon path={icons.trash} size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prompt Modal */}
      {showPromptModal && (
        <div className="modal-bg" onClick={() => setShowPromptModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Novo Prompt</div>
            <div className="form-group">
              <label className="form-label">Título</label>
              <input className="form-input" placeholder="Ex: Foto profissional feminina..."
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-input" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Texto do Prompt</label>
              <textarea className="form-input" rows={4} placeholder="Cole o prompt aqui..."
                value={form.promptText} onChange={e => setForm({ ...form, promptText: e.target.value })}
                style={{ resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Imagem de Referência</label>
              <input type="text" className="form-input" placeholder="URL da imagem (https://...) ou cole uma imagem (Ctrl+V)"
                value={typeof form.imageUrl === "string" && !form.imageUrl.startsWith("data:") ? form.imageUrl : ""}
                onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                onPaste={handlePaste}
                style={{ marginBottom: 8 }} />
              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 8, padding: "20px 16px", marginTop: 6,
                  border: dragOver ? "2px dashed var(--accent)" : "2px dashed rgba(255,255,255,0.12)",
                  borderRadius: 12, cursor: "pointer",
                  background: dragOver ? "rgba(240,165,0,0.08)" : "rgba(255,255,255,0.02)",
                  transition: "all 0.2s ease",
                  textAlign: "center",
                }}
              >
                <Icon path={icons.upload} size={22} />
                <div style={{ fontSize: 13, fontWeight: 600, color: dragOver ? "var(--accent)" : "var(--text)" }}>
                  {dragOver ? "Solte a imagem aqui" : "Arraste uma imagem ou clique para enviar"}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>PNG, JPG, WEBP — ou cole com Ctrl+V</div>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
              </label>
              {form.imageUrl && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, marginTop: 12,
                  padding: 10, background: "var(--surface2)", borderRadius: 10,
                  border: "1px solid rgba(34,197,94,0.25)"
                }}>
                  <img
                    src={form.imageUrl}
                    alt="Preview"
                    style={{
                      width: 56, height: 56, objectFit: "cover", borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", marginBottom: 2 }}>✓ Imagem carregada</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {form.imageUrl.startsWith("data:") ? "Upload local" : form.imageUrl}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm btn-icon"
                    onClick={() => setForm(f => ({ ...f, imageUrl: "" }))}
                    style={{ flexShrink: 0 }}
                  >
                    <Icon path={icons.trash} size={13} />
                  </button>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowPromptModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addPrompt}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Modal */}
      {showCatModal && (
        <div className="modal-bg" onClick={() => setShowCatModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-title">
              <Icon path={icons.folder} size={18} /> Categorias
            </div>

            {isOwner && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Nome da categoria</label>
                    <input className="form-input" placeholder="Ex: Retratos, Paisagens..."
                      value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                      onKeyDown={e => e.key === "Enter" && addCategory()} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cor</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {CAT_COLORS.map(c => (
                        <div key={c} onClick={() => setCatForm({ ...catForm, color: c })}
                          style={{
                            width: 28, height: 28, borderRadius: "50%", background: c,
                            cursor: "pointer", border: catForm.color === c ? "3px solid white" : "3px solid transparent",
                            boxShadow: catForm.color === c ? `0 0 0 2px ${c}` : "none",
                            transition: "all 0.15s"
                          }} />
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={addCategory}>
                    <Icon path={icons.plus} size={13} /> Criar Categoria
                  </button>
                </div>
                {categories.length > 0 && <div className="divider" />}
              </>
            )}

            {categories.length === 0 ? (
              <div className="empty-state" style={{ padding: "24px 0" }}>
                <div className="empty-state-text">Nenhuma categoria criada ainda.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {categories.map(c => (
                  <div key={c.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", background: "var(--surface2)", borderRadius: 8,
                    border: `1px solid ${c.color}30`
                  }}>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      {data.prompts.filter(p => p.categoryId === c.id).length} prompts
                    </span>
                    {isOwner && (
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => delCategory(c.id)}>
                        <Icon path={icons.trash} size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowCatModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// EMPLOYEE — MINHAS VENDAS
// ══════════════════════════════════════════════════════════════════════════
function EmpVendas({ data, save, loggedEmp }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ value: "", description: "", date: today() });
  const [success, setSuccess] = useState(false);

  if (!loggedEmp) return null;

  const mySales = [
    ...(data.pendingSales || []).filter(s => s.employeeId === loggedEmp.id).map(s => ({ ...s, _status: "pending" })),
    ...(data.sales || []).filter(s => s.employeeId === loggedEmp.id).map(s => ({ ...s, _status: "approved" })),
  ].sort((a, b) => (b.date > a.date ? 1 : -1));

  const totalApproved = (data.sales || []).filter(s => s.employeeId === loggedEmp.id).reduce((a, b) => a + b.value, 0);
  const totalPending = (data.pendingSales || []).filter(s => s.employeeId === loggedEmp.id).reduce((a, b) => a + b.value, 0);

  const submitSale = async () => {
    if (!form.value) return;
    try {
      const created = await api.submitSale({ employeeId: loggedEmp.id, employeeName: loggedEmp.name, value: parseFloat(form.value), description: form.description, date: form.date });
      save({ ...data, pendingSales: [...(data.pendingSales || []), created] });
      setShowModal(false);
      setForm({ value: "", description: "", date: today() });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (e) { alert(e?.message || "Erro ao enviar venda"); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Minhas Vendas</div>
          <div className="page-sub">Registre suas vendas para o dono verificar</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Icon path={icons.plus} size={14} /> Registrar Venda
        </button>
      </div>

      <div className="page-content">
        {success && (
          <div className="alert alert-success" style={{ marginBottom: 20 }}>
            ✓ Venda enviada! Aguardando aprovação do dono.
          </div>
        )}

        {/* Mini stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 24 }}>
          <div className="stat-card green">
            <div className="stat-label">Total Aprovado</div>
            <div className="stat-value green">{fmtBRL(totalApproved)}</div>
            <div className="stat-note">{(data.sales || []).filter(s => s.employeeId === loggedEmp.id).length} vendas</div>
          </div>
          <div className="stat-card gold">
            <div className="stat-label">Aguardando</div>
            <div className="stat-value gold">{fmtBRL(totalPending)}</div>
            <div className="stat-note">{(data.pendingSales || []).filter(s => s.employeeId === loggedEmp.id).length} pendentes</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label">Meta Hoje</div>
            <div className="stat-value blue">{fmtBRL((loggedEmp.salary || 0) / 30)}</div>
            <div className="stat-note">salário ÷ 30 dias</div>
          </div>
        </div>

        {/* History */}
        <div className="card">
          <div className="section-header" style={{ marginBottom: 16 }}>
            <div className="section-title">Histórico de Vendas</div>
          </div>

          {mySales.length === 0 ? (
            <div className="empty-state" style={{ padding: "36px 0" }}>
              <div className="empty-state-icon"><Icon path={icons.cart} size={44} /></div>
              <div className="empty-state-text">Nenhuma venda registrada ainda.<br />Clique em "Registrar Venda" para começar.</div>
            </div>
          ) : mySales.map(s => (
            <div key={s.id} className="sale-history-card">
              <div className="sale-status-dot"
                style={{ background: s._status === "approved" ? "var(--green)" : "var(--accent)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {s.description || "Venda"}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR")} ·{" "}
                  {s._status === "approved"
                    ? <span style={{ color: "var(--green)" }}>✓ Aprovada</span>
                    : <span style={{ color: "var(--accent)" }}>⏳ Aguardando aprovação</span>
                  }
                </div>
              </div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5,
                color: s._status === "approved" ? "var(--green)" : "var(--accent)"
              }}>
                {fmtBRL(s.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="modal-bg" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Registrar Venda</div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18, lineHeight: 1.6 }}>
              Sua venda ficará <strong style={{ color: "var(--accent)" }}>pendente</strong> até o dono verificar e aprovar.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" placeholder="0,00" autoFocus
                  value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input className="form-input" type="date" value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição (opcional)</label>
              <input className="form-input" placeholder="Ex: Pacote 5 fotos, cliente João..."
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={submitSale}>Enviar para Aprovação</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// OWNER — APROVAÇÕES
// ══════════════════════════════════════════════════════════════════════════
function Aprovacoes({ data, save }) {
  const pending = (data.pendingSales || []);

  const approve = async (id) => {
    const sale = pending.find(s => s.id === id);
    if (!sale) return;
    try {
      const res = await api.approveSale(id);
      save({
        ...data,
        pendingSales: pending.filter(s => s.id !== id),
        sales: [...(data.sales || []), res.approved || { ...sale, approved: true }],
      });
    } catch (e) { alert(e?.message || "Erro ao aprovar venda"); }
  };

  const reject = async (id) => {
    try {
      await api.rejectSale(id);
      save({ ...data, pendingSales: pending.filter(s => s.id !== id) });
    } catch (e) { alert(e?.message || "Erro ao rejeitar venda"); }
  };

  const approveAll = async () => {
    if (!pending.length) return;
    try {
      await api.approveAll();
      save({
        ...data,
        pendingSales: [],
        sales: [...(data.sales || []), ...pending.map(s => ({ ...s, approved: true }))],
      });
    } catch (e) { alert(e?.message || "Erro ao aprovar todas"); }
  };

  // Group by employee
  const grouped = {};
  pending.forEach(s => {
    const emp = data.employees.find(e => e.id === s.employeeId);
    const key = s.employeeId;
    if (!grouped[key]) grouped[key] = { emp, sales: [] };
    grouped[key].sales.push(s);
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Aprovações</div>
          <div className="page-sub">Vendas enviadas pelos funcionários aguardando sua verificação</div>
        </div>
        {pending.length > 0 && (
          <button className="btn btn-primary" onClick={approveAll}>
            <Icon path={icons.check} size={14} /> Aprovar Todas ({pending.length})
          </button>
        )}
      </div>

      <div className="page-content">
        {pending.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 80 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
            <div className="empty-state-text" style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              Nenhuma venda pendente!
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
              Quando um funcionário registrar uma venda, ela aparecerá aqui.
            </div>
          </div>
        ) : (
          Object.values(grouped).map(({ emp, sales }) => (
            <div key={emp?.id || "unknown"} className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: "rgba(240,165,0,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, color: "var(--accent)"
                }}>
                  {emp?.name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{emp?.name || "Funcionário"}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{sales.length} venda{sales.length > 1 ? "s" : ""} pendente{sales.length > 1 ? "s" : ""} · Total: <span style={{ color: "var(--accent)" }}>{fmtBRL(sales.reduce((a, b) => a + b.value, 0))}</span></div>
                </div>
              </div>

              {sales.map(s => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  background: "var(--surface2)", borderRadius: 10, marginBottom: 8,
                  border: "1px solid rgba(240,165,0,0.12)"
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.description || "Venda sem descrição"}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, color: "var(--accent)", marginRight: 8 }}>
                    {fmtBRL(s.value)}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: "rgba(34,197,94,0.1)", color: "var(--green)", border: "1px solid rgba(34,197,94,0.25)", padding: "7px 14px" }}
                      onClick={() => approve(s.id)}>
                      <Icon path={icons.check} size={13} /> Aprovar
                    </button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => reject(s.id)}>
                      <Icon path={icons.trash} size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// NOTIFICAÇÕES — Configuração de Push Notifications
// ══════════════════════════════════════════════════════════════════════════
function Notificacoes() {
  const [settings, setSettings] = useState({ title: "💰 Nova Venda Recebida!", subtitle: "{employeeName} registrou R$ {value}", enabled: true });
  const [pushStatus, setPushStatus] = useState("checking"); // checking, active, inactive, unsupported
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load settings
    (async () => {
      try {
        const s = await api.getNotifSettings();
        setSettings(s);
      } catch { }
    })();
    // Check push status
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
    } else {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setPushStatus(sub ? "active" : "inactive");
      }).catch(() => setPushStatus("inactive"));
    }
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updated = await api.updateNotifSettings(settings);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert(e?.message || "Erro ao salvar"); }
    setSaving(false);
  };

  const togglePush = async () => {
    if (pushStatus === "active") {
      await unregisterPushSubscription();
      setPushStatus("inactive");
    } else {
      const sub = await registerPushSubscription();
      setPushStatus(sub ? "active" : "inactive");
    }
  };

  const previewTitle = settings.title
    .replace("{employeeName}", "Maria Silva")
    .replace("{value}", "350,00")
    .replace("{description}", "Pacote Premium");
  const previewBody = settings.subtitle
    .replace("{employeeName}", "Maria Silva")
    .replace("{value}", "350,00")
    .replace("{description}", "Pacote Premium");

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Notificações</div>
          <div className="page-sub">Configure as notificações push para vendas pendentes</div>
        </div>
      </div>

      <div className="page-content">
        {/* Push Status */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Status das Notificações Push</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: pushStatus === "active" ? "var(--green)" : pushStatus === "unsupported" ? "var(--red)" : "var(--muted)",
                boxShadow: pushStatus === "active" ? "0 0 8px var(--green)" : "none",
              }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {pushStatus === "active" && "Push ativado"}
                {pushStatus === "inactive" && "Push desativado"}
                {pushStatus === "checking" && "Verificando..."}
                {pushStatus === "unsupported" && "Não suportado neste navegador"}
              </span>
            </div>
            {pushStatus !== "unsupported" && pushStatus !== "checking" && (
              <button className={`btn ${pushStatus === "active" ? "btn-danger" : "btn-primary"} btn-sm`} onClick={togglePush}>
                {pushStatus === "active" ? "Desativar" : "Ativar Push"}
              </button>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="card">
          <div className="card-title">Configurar Notificação</div>

          <div className="form-group">
            <label className="form-label">Título da Notificação</label>
            <input
              className="form-input"
              value={settings.title}
              onChange={e => setSettings(s => ({ ...s, title: e.target.value }))}
              placeholder="Ex: 💰 Nova Venda!"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Subtítulo / Corpo</label>
            <input
              className="form-input"
              value={settings.subtitle}
              onChange={e => setSettings(s => ({ ...s, subtitle: e.target.value }))}
              placeholder="Ex: {employeeName} registrou R$ {value}"
            />
          </div>

          {/* Variables */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600, marginBottom: 8 }}>Variáveis Disponíveis</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["{employeeName}", "{value}", "{description}"].map(v => (
                <span key={v} className="tag" style={{ cursor: "pointer", fontSize: 11 }}
                  onClick={() => {
                    // Copy to clipboard
                    navigator.clipboard?.writeText(v);
                  }}>
                  {v}
                </span>
              ))}
            </div>
          </div>

          {/* Enable/Disable */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <label style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))}
                style={{ accentColor: "var(--accent)", width: 16, height: 16 }}
              />
              Enviar notificação quando funcionário registrar venda
            </label>
          </div>

          {/* Save */}
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? "Salvando..." : saved ? "✓ Salvo!" : "Salvar Configurações"}
          </button>
        </div>

        {/* Preview */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-title">Preview da Notificação</div>
          <div style={{
            background: "var(--surface2)", border: "1px solid var(--border2)",
            borderRadius: 14, padding: 18, display: "flex", gap: 14, alignItems: "flex-start",
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, rgba(245,166,35,0.2), rgba(255,101,53,0.15))",
              border: "1px solid rgba(245,166,35,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20,
            }}>🔔</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{previewTitle}</div>
              <div style={{ fontSize: 13, color: "var(--muted2)" }}>{previewBody}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>agora</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [role, setRole] = useState(null);
  const [loggedEmp, setLoggedEmp] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [data, save, loading] = useStore();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // ── Inject viewport meta ──────────────────────────────────────────────
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Auto-login se já tiver token válido ───────────────────────────────
  useEffect(() => {
    if (getToken() && !role && !loading) {
      (async () => {
        try {
          const me = await apiFetch("/auth/me");
          setRole(me.role);
          setLoggedEmp(me.employee || null);
          setPage(me.role === "owner" ? "dashboard" : "prompts");
          // Auto-register push for admin
          if (me.role === "owner") registerPushSubscription();
        } catch { clearToken(); }
      })();
    }
  }, [loading]);

  const handleLogin = (r, emp) => {
    setRole(r);
    setLoggedEmp(emp || null);
    setPage(r === "owner" ? "dashboard" : "prompts");
    // Register push for admin on login
    if (r === "owner") registerPushSubscription();
  };

  const handleLogout = () => {
    clearToken();
    setRole(null);
    setLoggedEmp(null);
  };

  const pendingCount = (data.pendingSales || []).length;

  if (!role) return (
    <>
      <style>{css}</style>
      <LoginScreen onLogin={handleLogin} employees={data.employees} />
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <Sidebar
          role={role} empName={loggedEmp?.name}
          page={page} setPage={setPage}
          onLogout={handleLogout}
          pendingCount={pendingCount}
        />
        <div className="main">
          {page === "dashboard" && role === "owner" && <Dashboard data={data} />}
          {page === "financeiro" && role === "owner" && <Financeiro data={data} save={save} />}
          {page === "funcionarios" && role === "owner" && <Funcionarios data={data} save={save} />}
          {page === "despesas" && role === "owner" && <Despesas data={data} save={save} />}
          {page === "prompts" && <Prompts data={data} save={save} isOwner={role === "owner"} />}
          {page === "aprovacoes" && role === "owner" && <Aprovacoes data={data} save={save} />}
          {page === "notificacoes" && role === "owner" && <Notificacoes />}
          {page === "emp-vendas" && role === "employee" && <EmpVendas data={data} save={save} loggedEmp={loggedEmp} />}
        </div>
        {isMobile && (
          <BottomNav
            role={role} page={page} setPage={setPage}
            onLogout={handleLogout} pendingCount={pendingCount}
          />
        )}
      </div>
    </>
  );
}
