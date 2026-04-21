import { useState, useCallback, useEffect, useRef } from "react";

// ── DADOS BASE ──────────────────────────────────────────────────────────────

const USERS = [
  { id: 1, name: "João Silva",    email: "joao@empresa.com",   password: "12345", role: "employee", dept: "Comercial",  initials: "JS", color: "#2563eb" },
  { id: 2, name: "Maria Santos",  email: "maria@empresa.com",  password: "12345", role: "employee", dept: "Marketing",  initials: "MS", color: "#7c3aed" },
  { id: 3, name: "Carlos Mendes", email: "carlos@empresa.com", password: "12345", role: "manager",  dept: "Financeiro", initials: "CM", color: "#059669" },
  { id: 4, name: "Admin Sistema", email: "admin@empresa.com",  password: "12345", role: "admin",    dept: "TI",         initials: "AS", color: "#d97706" },
];

const POLICY = {
  "Alimentação":    { limit: 150,  note: "por refeição" },
  "Transporte":     { limit: 300,  note: "por trajeto" },
  "Hotel":          { limit: 400,  note: "por diária" },
  "Combustível":    { limit: 200,  note: "por abastecimento" },
  "Entretenimento": { limit: 200,  note: "por evento" },
  "Passagem Aérea": { limit: 2500, note: "por trecho" },
  "Outros":         { limit: 300,  note: "por item" },
};

const TRIPS = [
  "Visita cliente ABC — São Paulo",
  "Reunião corporativa — Rio de Janeiro",
  "Conferência Tech — Florianópolis",
  "Visita clientes — Interior SP",
  "Treinamento — Brasília",
];

const SEED_EXPENSES = [
  { id: 1, userId: 1, userName: "João Silva",    dept: "Comercial",  category: "Hotel",          description: "Hotel Grand SP — 2 noites",             amount: 950,  date: "2025-04-08", status: "pending",  violation: true,  grossAmount: 150, approvedAmount: 800,  trip: "Visita cliente ABC — São Paulo",    aiAnalysis: "FORA DA POLÍTICA — Valor de R$ 950,00 excede o limite de R$ 400,00/diária. Para 2 noites o permitido é R$ 800,00. Excedente de R$ 150,00 sujeito a glosa." },
  { id: 2, userId: 1, userName: "João Silva",    dept: "Comercial",  category: "Alimentação",    description: "Jantar com cliente — Restaurante Fasano", amount: 380,  date: "2025-04-08", status: "pending",  violation: true,  grossAmount: 230, approvedAmount: 150,  trip: "Visita cliente ABC — São Paulo",    aiAnalysis: "FORA DA POLÍTICA — R$ 380,00 excede em R$ 230,00 o limite de R$ 150,00 por refeição. Glosa parcial recomendada." },
  { id: 3, userId: 2, userName: "Maria Santos",  dept: "Marketing",  category: "Passagem Aérea", description: "Passagem GRU → SDU",                      amount: 890,  date: "2025-04-03", status: "approved", violation: false, grossAmount: 0,   approvedAmount: 890,  trip: "Reunião corporativa — Rio de Janeiro", aiAnalysis: "DENTRO DA POLÍTICA — R$ 890,00 está dentro do limite de R$ 2.500,00. Aprovado sem ressalvas." },
  { id: 4, userId: 2, userName: "Maria Santos",  dept: "Marketing",  category: "Transporte",     description: "Uber aeroporto + transfer hotel",          amount: 145,  date: "2025-04-03", status: "approved", violation: false, grossAmount: 0,   approvedAmount: 145,  trip: "Reunião corporativa — Rio de Janeiro", aiAnalysis: "DENTRO DA POLÍTICA — R$ 145,00 dentro do limite de R$ 300,00. Aprovado." },
  { id: 5, userId: 1, userName: "João Silva",    dept: "Comercial",  category: "Combustível",    description: "Abastecimento — Posto Shell BR-101",       amount: 210,  date: "2025-04-01", status: "rejected", violation: true,  grossAmount: 10,  approvedAmount: 0,    trip: "Visita clientes — Interior SP",      aiAnalysis: "FORA DA POLÍTICA — R$ 210,00 excede em R$ 10,00 o limite de R$ 200,00. Despesa não reembolsável conforme política." },
  { id: 6, userId: 2, userName: "Maria Santos",  dept: "Marketing",  category: "Hotel",          description: "Hotel Ibis Floripa — 1 noite",             amount: 320,  date: "2025-03-22", status: "approved", violation: false, grossAmount: 0,   approvedAmount: 320,  trip: "Conferência Tech — Florianópolis",   aiAnalysis: "DENTRO DA POLÍTICA — R$ 320,00 dentro do limite de R$ 400,00/diária. Aprovado." },
  { id: 7, userId: 1, userName: "João Silva",    dept: "Comercial",  category: "Entretenimento", description: "Confraternização pós-reunião",             amount: 480,  date: "2025-03-20", status: "pending",  violation: true,  grossAmount: 280, approvedAmount: 200,  trip: "Visita cliente ABC — São Paulo",    aiAnalysis: "FORA DA POLÍTICA — R$ 480,00 excede em R$ 280,00 o limite de R$ 200,00 por evento. Glosa parcial recomendada." },
];

// ── HELPERS ─────────────────────────────────────────────────────────────────

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
let nextId = 100;

// ── CLAUDE AI ANALYSIS ───────────────────────────────────────────────────────

async function analyzeExpense(category, amount, description, trip) {
  const policyInfo = Object.entries(POLICY).map(([k, v]) => `${k}: R$ ${v.limit} ${v.note}`).join(", ");
  const prompt = `Você é o sistema de auditoria de despesas de viagem da empresa. Analise a despesa abaixo com base na política da empresa e retorne uma análise objetiva em português brasileiro.

POLÍTICA DE DESPESAS:
${policyInfo}

DESPESA SUBMETIDA:
- Categoria: ${category}
- Valor: R$ ${amount}
- Descrição: ${description}
- Viagem: ${trip}
- Limite da categoria: R$ ${POLICY[category]?.limit || 300}

Retorne APENAS um JSON com este formato exato (sem markdown, sem texto extra):
{
  "status": "ok" ou "violation",
  "analysis": "análise detalhada em 2-3 frases explicando se está dentro ou fora da política",
  "grossAmount": número (valor a glosar, 0 se dentro da política),
  "approvedAmount": número (valor aprovado),
  "recommendation": "APROVAR", "GLOSAR PARCIALMENTE" ou "REJEITAR"
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    const limit = POLICY[category]?.limit || 300;
    const gross = Math.max(0, amount - limit);
    return {
      status: gross > 0 ? "violation" : "ok",
      analysis: gross > 0
        ? `FORA DA POLÍTICA — R$ ${amount} excede em R$ ${gross} o limite de R$ ${limit} para ${category}.`
        : `DENTRO DA POLÍTICA — R$ ${amount} está dentro do limite de R$ ${limit} para ${category}.`,
      grossAmount: gross,
      approvedAmount: amount - gross,
      recommendation: gross > 0 ? (gross >= amount ? "REJEITAR" : "GLOSAR PARCIALMENTE") : "APROVAR"
    };
  }
}

// ── THEME & SHARED STYLES ────────────────────────────────────────────────────

const T = {
  bg: "var(--color-background-tertiary)",
  surface: "var(--color-background-primary)",
  surface2: "var(--color-background-secondary)",
  border: "var(--color-border-tertiary)",
  borderMid: "var(--color-border-secondary)",
  text: "var(--color-text-primary)",
  muted: "var(--color-text-secondary)",
  hint: "var(--color-text-tertiary)",
  success: "var(--color-background-success)",
  successText: "var(--color-text-success)",
  danger: "var(--color-background-danger)",
  dangerText: "var(--color-text-danger)",
  warning: "var(--color-background-warning)",
  warningText: "var(--color-text-warning)",
  info: "var(--color-background-info)",
  infoText: "var(--color-text-info)",
  radius: "var(--border-radius-md)",
  radiusLg: "var(--border-radius-lg)",
};

const card = {
  background: T.surface,
  borderRadius: T.radiusLg,
  border: `0.5px solid ${T.border}`,
  padding: "1.25rem",
};

const statusConfig = {
  pending:  { label: "Pendente",  bg: T.warning, color: T.warningText },
  approved: { label: "Aprovado",  bg: T.success, color: T.successText },
  rejected: { label: "Rejeitado", bg: T.danger,  color: T.dangerText  },
  glossed:  { label: "Glosado",   bg: T.info,    color: T.infoText    },
};

function Badge({ status }) {
  const cfg = statusConfig[status] || statusConfig.pending;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 500,
      padding: "3px 10px", borderRadius: T.radius, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

function Avatar({ user, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: user.color,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 500, fontSize: size * 0.35, flexShrink: 0 }}>
      {user.initials}
    </div>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: [T.success, T.successText], error: [T.danger, T.dangerText], info: [T.info, T.infoText] };
  const [bg, color] = colors[type] || colors.info;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: bg, color, padding: "12px 20px", borderRadius: T.radiusLg,
      border: `0.5px solid ${T.borderMid}`, maxWidth: 360, fontSize: 14, fontWeight: 500,
      display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer",
        color, fontSize: 18, lineHeight: 1, padding: 0, opacity: 0.7 }}>x</button>
    </div>
  );
}

// ── LOGIN ────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const user = USERS.find(u => u.email === email && u.password === password);
      if (user) onLogin(user);
      else { setError("E-mail ou senha incorretos"); setLoading(false); }
    }, 600);
  };

  const quickLogin = (user) => { setEmail(user.email); setPassword("12345"); };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center",
      justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: T.radiusLg, background: T.info,
            marginBottom: "1rem" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.infoText} strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: T.text }}>TravelExpense</h1>
          <p style={{ fontSize: 13, color: T.muted, margin: "4px 0 0" }}>Controle de Despesas de Viagem</p>
        </div>

        {/* Form */}
        <div style={{ ...card, padding: "2rem" }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 1.5rem", color: T.text }}>Acesso ao sistema</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: 13, color: T.muted, marginBottom: 6 }}>E-mail</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                placeholder="seu@email.com" required style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: 13, color: T.muted, marginBottom: 6 }}>Senha</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                placeholder="••••••" required style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
            {error && <p style={{ color: T.dangerText, fontSize: 13, margin: "0 0 1rem",
              background: T.danger, padding: "8px 12px", borderRadius: T.radius }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px",
              background: T.info, color: T.infoText, border: "none", borderRadius: T.radius,
              fontWeight: 500, cursor: "pointer", fontSize: 14 }}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        {/* Quick access */}
        <div style={{ ...card, marginTop: "1rem" }}>
          <p style={{ fontSize: 12, color: T.hint, margin: "0 0 12px", fontWeight: 500 }}>ACESSO RAPIDO — TODOS COM SENHA 12345</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {USERS.map(u => (
              <button key={u.id} onClick={() => quickLogin(u)} style={{ display: "flex", alignItems: "center",
                gap: 12, padding: "8px 12px", background: T.surface2, border: `0.5px solid ${T.border}`,
                borderRadius: T.radius, cursor: "pointer", textAlign: "left", width: "100%" }}>
                <Avatar user={u} size={28} />
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.text }}>{u.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{u.dept} · {u.role === "manager" ? "Gestor" : u.role === "admin" ? "Admin" : "Colaborador"}</p>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 11, color: T.hint }}>{u.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NAV ──────────────────────────────────────────────────────────────────────

function TopNav({ user, view, setView, onLogout, pendingCount, alertCount }) {
  const isManager = user.role === "manager" || user.role === "admin";
  const navItems = isManager
    ? [
        { id: "dashboard", label: "Dashboard" },
        { id: "pending", label: "Pendentes", badge: pendingCount },
        { id: "alerts", label: "Alertas", badge: alertCount },
        { id: "all", label: "Todas" },
      ]
    : [
        { id: "dashboard", label: "Início" },
        { id: "submit", label: "Nova Despesa" },
        { id: "myexpenses", label: "Minhas Despesas" },
      ];

  return (
    <nav style={{ background: T.surface, borderBottom: `0.5px solid ${T.border}`,
      position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem",
        display: "flex", alignItems: "center", gap: "1.5rem", height: 56 }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.infoText} strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <span style={{ fontWeight: 500, fontSize: 15, color: T.text }}>TravelExpense</span>
        </div>

        {/* Nav Items */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, overflowX: "auto" }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                borderRadius: T.radius, border: "none", cursor: "pointer", fontSize: 13,
                background: view === item.id ? T.surface2 : "transparent",
                color: view === item.id ? T.text : T.muted, fontWeight: view === item.id ? 500 : 400,
                whiteSpace: "nowrap" }}>
              {item.label}
              {item.badge > 0 && (
                <span style={{ background: T.danger, color: T.dangerText, fontSize: 10,
                  padding: "1px 6px", borderRadius: 999, fontWeight: 600 }}>{item.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* User */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <Avatar user={user} size={30} />
          <div style={{ display: "none", "@media (min-width: 600px)": { display: "block" } }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.text }}>{user.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{user.dept}</p>
          </div>
          <button onClick={onLogout} style={{ padding: "5px 10px", fontSize: 12, color: T.muted,
            background: "none", border: `0.5px solid ${T.border}`, borderRadius: T.radius, cursor: "pointer" }}>
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
}

// ── EMPLOYEE DASHBOARD ───────────────────────────────────────────────────────

function EmployeeDashboard({ user, expenses, setView }) {
  const mine = expenses.filter(e => e.userId === user.id);
  const pending = mine.filter(e => e.status === "pending").length;
  const approved = mine.filter(e => e.status === "approved").length;
  const total = mine.reduce((s, e) => s + e.amount, 0);
  const violations = mine.filter(e => e.violation);
  const recentViolations = violations.slice(0, 3);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 1.5rem", color: T.text }}>
        Olá, {user.name.split(" ")[0]}
      </h2>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: "1.5rem" }}>
        {[
          { label: "Total enviado", value: fmt(total), color: T.text },
          { label: "Pendentes",     value: pending,    color: T.warningText },
          { label: "Aprovados",     value: approved,   color: T.successText },
          { label: "Com glosa",     value: violations.length, color: T.dangerText },
        ].map(s => (
          <div key={s.label} style={{ background: T.surface2, borderRadius: T.radius, padding: "1rem" }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: T.muted }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 500, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 12, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button onClick={() => setView("submit")} style={{ padding: "10px 20px", background: T.info,
          color: T.infoText, border: "none", borderRadius: T.radius, fontWeight: 500,
          cursor: "pointer", fontSize: 14 }}>
          + Nova Despesa
        </button>
        <button onClick={() => setView("myexpenses")} style={{ padding: "10px 20px",
          background: "none", border: `0.5px solid ${T.borderMid}`, borderRadius: T.radius,
          cursor: "pointer", fontSize: 14, color: T.text }}>
          Ver todas as despesas
        </button>
      </div>

      {/* Violation alerts */}
      {recentViolations.length > 0 && (
        <div style={{ ...card, borderColor: "var(--color-border-danger)", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: 14, fontWeight: 500, color: T.dangerText }}>
            Alertas de Politica — Itens com Glosa
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentViolations.map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", background: T.danger, borderRadius: T.radius,
                border: `0.5px solid var(--color-border-danger)` }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.dangerText }}>{e.description}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: T.dangerText, opacity: 0.8 }}>
                    Solicitado: {fmt(e.amount)} · Glosa: {fmt(e.grossAmount)} · Aprovado: {fmt(e.approvedAmount)}
                  </p>
                </div>
                <Badge status={e.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent expenses */}
      <div style={card}>
        <h3 style={{ margin: "0 0 1rem", fontSize: 14, fontWeight: 500, color: T.text }}>Despesas Recentes</h3>
        {mine.length === 0 ? (
          <p style={{ color: T.muted, fontSize: 14, textAlign: "center", padding: "2rem" }}>
            Nenhuma despesa registrada.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mine.slice(0, 5).map(e => (
              <ExpenseRow key={e.id} expense={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── EXPENSE ROW ──────────────────────────────────────────────────────────────

function ExpenseRow({ expense: e, showUser = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      background: T.surface2, borderRadius: T.radius, border: `0.5px solid ${T.border}` }}>
      {e.violation && (
        <span style={{ width: 4, height: 36, background: "var(--color-border-danger)",
          borderRadius: 4, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {e.description}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: T.muted }}>
          {showUser && `${e.userName} · `}{e.category} · {fmtDate(e.date)}
        </p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.text }}>{fmt(e.amount)}</p>
        {e.violation && <p style={{ margin: 0, fontSize: 11, color: T.dangerText }}>Glosa: {fmt(e.grossAmount)}</p>}
      </div>
      <Badge status={e.status} />
    </div>
  );
}

// ── SUBMIT EXPENSE ───────────────────────────────────────────────────────────

function SubmitExpense({ user, onSubmit }) {
  const [form, setForm] = useState({
    category: "Alimentação", amount: "", description: "", date: new Date().toISOString().slice(0,10), trip: TRIPS[0]
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setAnalysis(null); };

  const handleAnalyze = async () => {
    if (!form.amount || !form.description) return;
    setAnalyzing(true);
    setAnalysis(null);
    const result = await analyzeExpense(form.category, parseFloat(form.amount), form.description, form.trip);
    setAnalysis(result);
    setAnalyzing(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!analysis) return;
    const expense = {
      id: nextId++,
      userId: user.id,
      userName: user.name,
      dept: user.dept,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
      trip: form.trip,
      status: "pending",
      violation: analysis.status === "violation",
      grossAmount: analysis.grossAmount,
      approvedAmount: analysis.approvedAmount,
      aiAnalysis: analysis.analysis,
    };
    onSubmit(expense);
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{ ...card, textAlign: "center", padding: "3rem 2rem" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.success,
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.successText} strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 500, color: T.text, margin: "0 0 8px" }}>Despesa enviada!</h3>
      <p style={{ color: T.muted, fontSize: 14, margin: "0 0 1.5rem" }}>
        Sua solicitação foi encaminhada ao gestor para análise.
      </p>
      <button onClick={() => setSubmitted(false)} style={{ padding: "8px 20px",
        border: `0.5px solid ${T.borderMid}`, borderRadius: T.radius,
        cursor: "pointer", fontSize: 14, color: T.text, background: "none" }}>
        Enviar outra despesa
      </button>
    </div>
  );

  const policyLimit = POLICY[form.category]?.limit || 0;

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 1.5rem", color: T.text }}>Nova Despesa</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Form */}
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 1.25rem", color: T.text }}>Dados da despesa</h3>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            <div>
              <label style={{ display: "block", fontSize: 13, color: T.muted, marginBottom: 6 }}>Categoria</label>
              <select value={form.category} onChange={e => set("category", e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}>
                {Object.keys(POLICY).map(k => <option key={k}>{k}</option>)}
              </select>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: T.hint }}>
                Limite: {fmt(policyLimit)} {POLICY[form.category]?.note}
              </p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, color: T.muted, marginBottom: 6 }}>Valor (R$)</label>
              <input type="number" min="0.01" step="0.01" required
                value={form.amount} onChange={e => set("amount", e.target.value)}
                placeholder="0,00" style={{ width: "100%", boxSizing: "border-box" }} />
              {form.amount && parseFloat(form.amount) > policyLimit && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: T.dangerText }}>
                  Excede o limite em {fmt(parseFloat(form.amount) - policyLimit)}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, color: T.muted, marginBottom: 6 }}>Descricao</label>
              <input type="text" required value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="Descreva a despesa..." style={{ width: "100%", boxSizing: "border-box" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, color: T.muted, marginBottom: 6 }}>Data</label>
              <input type="date" required value={form.date} onChange={e => set("date", e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, color: T.muted, marginBottom: 6 }}>Viagem</label>
              <select value={form.trip} onChange={e => set("trip", e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}>
                {TRIPS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <button type="button" onClick={handleAnalyze}
              disabled={analyzing || !form.amount || !form.description}
              style={{ padding: "9px", background: T.info, color: T.infoText, border: "none",
                borderRadius: T.radius, fontWeight: 500, cursor: "pointer", fontSize: 13 }}>
              {analyzing ? "Analisando com IA..." : "Analisar com Claude AI"}
            </button>

            {analysis && (
              <button type="submit"
                style={{ padding: "9px", background: T.success, color: T.successText,
                  border: "none", borderRadius: T.radius, fontWeight: 500, cursor: "pointer", fontSize: 13 }}>
                Confirmar e Enviar
              </button>
            )}
          </form>
        </div>

        {/* AI Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Policy reference */}
          <div style={card}>
            <h3 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 12px", color: T.text }}>Politica Vigente</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(POLICY).map(([cat, { limit, note }]) => (
                <div key={cat} style={{ display: "flex", justifyContent: "space-between",
                  fontSize: 12, color: form.category === cat ? T.infoText : T.muted,
                  fontWeight: form.category === cat ? 500 : 400,
                  padding: form.category === cat ? "4px 8px" : "2px 0",
                  background: form.category === cat ? T.info : "none",
                  borderRadius: T.radius }}>
                  <span>{cat}</span>
                  <span>{fmt(limit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Analysis result */}
          {analyzing && (
            <div style={{ ...card, textAlign: "center", padding: "2rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${T.borderMid}`,
                borderTopColor: T.infoText, margin: "0 auto 12px",
                animation: "spin 1s linear infinite" }} />
              <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>Claude revisando sua despesa...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {analysis && !analyzing && (
            <div style={{ ...card, borderColor: analysis.status === "violation"
              ? "var(--color-border-danger)" : "var(--color-border-success)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%",
                  background: analysis.status === "violation" ? T.danger : T.success,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={analysis.status === "violation" ? T.dangerText : T.successText} strokeWidth="2.5">
                    {analysis.status === "violation"
                      ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                      : <polyline points="20 6 9 17 4 12"/>}
                  </svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500,
                    color: analysis.status === "violation" ? T.dangerText : T.successText }}>
                    Analise Claude AI
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{analysis.recommendation}</p>
                </div>
              </div>
              <p style={{ margin: "0 0 1rem", fontSize: 13, color: T.text, lineHeight: 1.5 }}>{analysis.analysis}</p>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, background: T.surface2, borderRadius: T.radius, padding: "8px 12px" }}>
                  <p style={{ margin: 0, fontSize: 11, color: T.muted }}>Valor aprovado</p>
                  <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 500, color: T.successText }}>
                    {fmt(analysis.approvedAmount)}
                  </p>
                </div>
                {analysis.grossAmount > 0 && (
                  <div style={{ flex: 1, background: T.danger, borderRadius: T.radius, padding: "8px 12px" }}>
                    <p style={{ margin: 0, fontSize: 11, color: T.dangerText }}>Glosa</p>
                    <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 500, color: T.dangerText }}>
                      {fmt(analysis.grossAmount)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MY EXPENSES ──────────────────────────────────────────────────────────────

function MyExpenses({ user, expenses }) {
  const mine = expenses.filter(e => e.userId === user.id);
  const [filter, setFilter] = useState("all");
  const filters = ["all", "pending", "approved", "rejected"];
  const filtered = filter === "all" ? mine : mine.filter(e => e.status === filter);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 1.25rem", color: T.text }}>Minhas Despesas</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", fontSize: 13,
            borderRadius: T.radius, border: `0.5px solid ${filter === f ? T.borderMid : T.border}`,
            background: filter === f ? T.surface2 : "none", cursor: "pointer",
            color: filter === f ? T.text : T.muted, fontWeight: filter === f ? 500 : 400 }}>
            {f === "all" ? "Todas" : statusConfig[f]?.label}
            <span style={{ marginLeft: 6, fontSize: 11, color: T.hint }}>
              ({mine.filter(e => f === "all" || e.status === f).length})
            </span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <p style={{ color: T.muted, textAlign: "center", padding: "3rem", fontSize: 14 }}>Nenhuma despesa nesta categoria.</p>
        ) : filtered.map(e => (
          <div key={e.id} style={{ ...card, padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {e.violation && <span style={{ width: 4, minHeight: 40, background: "var(--color-border-danger)",
                borderRadius: 4, flexShrink: 0, marginTop: 2 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{e.description}</span>
                  <Badge status={e.status} />
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: T.muted }}>
                  {e.category} · {fmtDate(e.date)} · {e.trip}
                </p>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: T.text }}>Solicitado: <strong>{fmt(e.amount)}</strong></span>
                  <span style={{ fontSize: 12, color: T.successText }}>Aprovado: <strong>{fmt(e.approvedAmount)}</strong></span>
                  {e.grossAmount > 0 && <span style={{ fontSize: 12, color: T.dangerText }}>Glosa: <strong>{fmt(e.grossAmount)}</strong></span>}
                </div>
                {e.aiAnalysis && (
                  <div style={{ marginTop: 8, padding: "8px 10px", background: T.surface2,
                    borderRadius: T.radius, fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                    <strong style={{ color: T.text }}>Analise IA:</strong> {e.aiAnalysis}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MANAGER DASHBOARD ────────────────────────────────────────────────────────

function ManagerDashboard({ expenses, setView }) {
  const pending   = expenses.filter(e => e.status === "pending");
  const alerts    = expenses.filter(e => e.violation);
  const approved  = expenses.filter(e => e.status === "approved");
  const totalPending = pending.reduce((s, e) => s + e.amount, 0);
  const totalGlosa   = alerts.reduce((s, e) => s + e.grossAmount, 0);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 1.5rem", color: T.text }}>Dashboard do Gestor</h2>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: "1.5rem" }}>
        {[
          { label: "Pendentes de aprovacao", value: pending.length, color: T.warningText },
          { label: "Total pendente (R$)", value: fmt(totalPending), color: T.text },
          { label: "Violacoes de politica", value: alerts.length, color: T.dangerText },
          { label: "Total a glosar (R$)", value: fmt(totalGlosa), color: T.dangerText },
          { label: "Aprovados este mes", value: approved.length, color: T.successText },
        ].map(s => (
          <div key={s.label} style={{ background: T.surface2, borderRadius: T.radius, padding: "1rem" }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: T.muted }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 500, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Alerts box */}
      {alerts.filter(e => e.status === "pending").length > 0 && (
        <div style={{ ...card, borderColor: "var(--color-border-danger)", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.dangerText }}>
              Alertas — Itens fora da politica ({alerts.filter(e=>e.status==="pending").length})
            </h3>
            <button onClick={() => setView("alerts")} style={{ fontSize: 12, color: T.infoText,
              background: "none", border: "none", cursor: "pointer" }}>Ver todos</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.filter(e => e.status === "pending").slice(0, 3).map(e => (
              <div key={e.id} style={{ background: T.danger, borderRadius: T.radius, padding: "10px 14px",
                border: `0.5px solid var(--color-border-danger)` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.dangerText }}>{e.description}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: T.dangerText, opacity: 0.8 }}>{e.userName} · {e.dept} · {fmtDate(e.date)}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.dangerText }}>{fmt(e.amount)}</p>
                    <p style={{ margin: 0, fontSize: 11, color: T.dangerText }}>Glosa recom.: {fmt(e.grossAmount)}</p>
                  </div>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: T.dangerText, opacity: 0.9, lineHeight: 1.5 }}>{e.aiAnalysis}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending queue */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.text }}>Fila de aprovacao</h3>
          <button onClick={() => setView("pending")} style={{ fontSize: 12, color: T.infoText,
            background: "none", border: "none", cursor: "pointer" }}>Ver todas</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pending.slice(0, 4).map(e => <ExpenseRow key={e.id} expense={e} showUser />)}
          {pending.length === 0 && (
            <p style={{ color: T.muted, textAlign: "center", padding: "2rem", fontSize: 14 }}>
              Nenhuma despesa pendente.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PENDING QUEUE + ALERTS (Manager) ─────────────────────────────────────────

function PendingQueue({ expenses, onAction, violationOnly = false }) {
  const [selected, setSelected] = useState(null);
  const [grossInput, setGrossInput] = useState("");
  const [comment, setComment] = useState("");
  const [processing, setProcessing] = useState(false);

  const list = violationOnly
    ? expenses.filter(e => e.violation && e.status === "pending")
    : expenses.filter(e => e.status === "pending");

  const handleAction = async (expense, action) => {
    setProcessing(true);
    await new Promise(r => setTimeout(r, 600));
    const grossVal = parseFloat(grossInput) || 0;
    onAction(expense.id, action, grossVal, comment);
    setSelected(null);
    setGrossInput("");
    setComment("");
    setProcessing(false);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 1.25rem", color: T.text }}>
          {violationOnly ? "Alertas de Politica" : "Pendentes de Aprovacao"} ({list.length})
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.length === 0 ? (
            <div style={{ ...card, textAlign: "center", padding: "3rem" }}>
              <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>Nenhum item pendente.</p>
            </div>
          ) : list.map(e => (
            <button key={e.id} onClick={() => { setSelected(e); setGrossInput(String(e.grossAmount || "")); }}
              style={{ ...card, cursor: "pointer", textAlign: "left", width: "100%",
                borderColor: selected?.id === e.id ? "var(--color-border-info)" : (e.violation ? "var(--color-border-danger)" : T.border),
                borderWidth: selected?.id === e.id ? "1.5px" : "0.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.text }}>{e.description}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: T.muted }}>{e.userName} · {e.dept} · {fmtDate(e.date)}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.text }}>{fmt(e.amount)}</p>
                  {e.violation && <p style={{ margin: 0, fontSize: 11, color: T.dangerText }}>Glosa: {fmt(e.grossAmount)}</p>}
                </div>
              </div>
              {e.violation && (
                <div style={{ background: T.danger, borderRadius: T.radius, padding: "6px 10px" }}>
                  <p style={{ margin: 0, fontSize: 12, color: T.dangerText, lineHeight: 1.4 }}>{e.aiAnalysis}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Action panel */}
      {selected && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.text }}>Revisar despesa</h3>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none",
              cursor: "pointer", fontSize: 18, color: T.muted }}>x</button>
          </div>

          <div style={{ background: T.surface2, borderRadius: T.radius, padding: "12px", marginBottom: "1rem" }}>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 500, color: T.text }}>{selected.description}</p>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: T.muted }}>{selected.category} · {selected.trip}</p>
            <div style={{ display: "flex", gap: 16 }}>
              <div><p style={{ margin: 0, fontSize: 11, color: T.muted }}>Solicitado</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: T.text }}>{fmt(selected.amount)}</p></div>
              <div><p style={{ margin: 0, fontSize: 11, color: T.muted }}>Limite</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: T.muted }}>{fmt(POLICY[selected.category]?.limit || 0)}</p></div>
            </div>
          </div>

          {selected.aiAnalysis && (
            <div style={{ background: selected.violation ? T.danger : T.success,
              borderRadius: T.radius, padding: "10px 12px", marginBottom: "1rem" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 500,
                color: selected.violation ? T.dangerText : T.successText }}>ANALISE CLAUDE AI</p>
              <p style={{ margin: 0, fontSize: 12, color: selected.violation ? T.dangerText : T.successText,
                lineHeight: 1.5 }}>{selected.aiAnalysis}</p>
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: 13, color: T.muted, marginBottom: 6 }}>
              Valor da glosa (R$)
            </label>
            <input type="number" min="0" step="0.01" value={grossInput}
              onChange={e => setGrossInput(e.target.value)} placeholder="0,00"
              style={{ width: "100%", boxSizing: "border-box" }} />
            {grossInput && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: T.muted }}>
                Valor aprovado: {fmt(selected.amount - parseFloat(grossInput || 0))}
              </p>
            )}
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: 13, color: T.muted, marginBottom: 6 }}>
              Comentario do gestor
            </label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Justificativa da decisao..." rows={3}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => handleAction(selected, "approved")} disabled={processing}
              style={{ padding: "9px", background: T.success, color: T.successText,
                border: "none", borderRadius: T.radius, fontWeight: 500, cursor: "pointer", fontSize: 13 }}>
              {processing ? "Processando..." : "Aprovar integral"}
            </button>
            {selected.violation && (
              <button onClick={() => handleAction(selected, "glossed")} disabled={processing}
                style={{ padding: "9px", background: T.warning, color: T.warningText,
                  border: "none", borderRadius: T.radius, fontWeight: 500, cursor: "pointer", fontSize: 13 }}>
                Aprovar com glosa
              </button>
            )}
            <button onClick={() => handleAction(selected, "rejected")} disabled={processing}
              style={{ padding: "9px", background: T.danger, color: T.dangerText,
                border: "none", borderRadius: T.radius, fontWeight: 500, cursor: "pointer", fontSize: 13 }}>
              Rejeitar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ALL EXPENSES (Manager) ───────────────────────────────────────────────────

function AllExpenses({ expenses }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? expenses : expenses.filter(e => e.status === filter);
  const totalApproved = expenses.filter(e => e.status === "approved").reduce((s, e) => s + e.approvedAmount, 0);
  const totalGlossed  = expenses.filter(e => e.status === "glossed").reduce((s, e) => s + e.approvedAmount, 0);
  const totalGlosa    = expenses.reduce((s, e) => s + e.grossAmount, 0);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 1rem", color: T.text }}>Todas as Despesas</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: "1.5rem" }}>
        {[
          { label: "Total aprovado", value: fmt(totalApproved + totalGlossed) },
          { label: "Total glosado", value: fmt(totalGlosa) },
          { label: "Total registros", value: expenses.length },
        ].map(s => (
          <div key={s.label} style={{ background: T.surface2, borderRadius: T.radius, padding: "1rem" }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: T.muted }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 500, color: T.text }}>{s.value}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
        {["all", "pending", "approved", "glossed", "rejected"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 12px", fontSize: 12,
            borderRadius: T.radius, border: `0.5px solid ${filter === f ? T.borderMid : T.border}`,
            background: filter === f ? T.surface2 : "none", cursor: "pointer",
            color: filter === f ? T.text : T.muted }}>
            {f === "all" ? "Todas" : statusConfig[f]?.label || f}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(e => <ExpenseRow key={e.id} expense={e} showUser />)}
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser]         = useState(null);
  const [view, setView]         = useState("login");
  const [expenses, setExpenses] = useState(SEED_EXPENSES);
  const [toast, setToast]       = useState(null);

  const showToast = useCallback((msg, type = "info") => setToast({ msg, type }), []);

  const handleLogin  = (u) => { setUser(u); setView("dashboard"); };
  const handleLogout = ()  => { setUser(null); setView("login"); };

  const handleSubmitExpense = useCallback((expense) => {
    setExpenses(prev => [expense, ...prev]);
    showToast("Despesa enviada com sucesso! Aguardando aprovacao do gestor.", "success");
    setView("myexpenses");
  }, [showToast]);

  const handleManagerAction = useCallback((id, action, grossAmount, comment) => {
    setExpenses(prev => prev.map(e => {
      if (e.id !== id) return e;
      const gross  = action === "approved" ? 0 : (grossAmount || e.grossAmount || 0);
      const approved = e.amount - gross;
      return { ...e, status: action, grossAmount: gross, approvedAmount: approved,
        managerComment: comment };
    }));
    const labels = { approved: "Aprovada", rejected: "Rejeitada", glossed: "Aprovada com glosa" };
    showToast(`Despesa ${labels[action] || action} com sucesso.`, action === "rejected" ? "error" : "success");
  }, [showToast]);

  const isManager = user && (user.role === "manager" || user.role === "admin");
  const pendingCount = expenses.filter(e => e.status === "pending").length;
  const alertCount   = expenses.filter(e => e.violation && e.status === "pending").length;

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const renderView = () => {
    if (isManager) {
      switch (view) {
        case "dashboard": return <ManagerDashboard expenses={expenses} setView={setView} />;
        case "pending":   return <PendingQueue expenses={expenses} onAction={handleManagerAction} />;
        case "alerts":    return <PendingQueue expenses={expenses} onAction={handleManagerAction} violationOnly />;
        case "all":       return <AllExpenses expenses={expenses} />;
        default:          return <ManagerDashboard expenses={expenses} setView={setView} />;
      }
    } else {
      switch (view) {
        case "dashboard":  return <EmployeeDashboard user={user} expenses={expenses} setView={setView} />;
        case "submit":     return <SubmitExpense user={user} onSubmit={handleSubmitExpense} />;
        case "myexpenses": return <MyExpenses user={user} expenses={expenses} />;
        default:           return <EmployeeDashboard user={user} expenses={expenses} setView={setView} />;
      }
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <TopNav user={user} view={view} setView={setView} onLogout={handleLogout}
        pendingCount={pendingCount} alertCount={alertCount} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {renderView()}
      </main>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
