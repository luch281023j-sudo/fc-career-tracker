import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const SUPABASE_URL = "https://sjopkftxqrtuilxsjoza.supabase.co";
const SUPABASE_KEY = "sb_publishable_yOJa_0AFvflnf0ZPS6lctA_pSqZxJkI";
const EMAIL_DOMAIN = "users.fctracker.app";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const EMOJIS = ["🔥", "👏", "😂", "😮", "😢", "⚽"];

const state = {
  session: null, me: null, profiles: new Map(), careers: [],
  career: null, careerStats: null, careerMatches: null, careerSeasons: null,
  feed: { items: [], done: false, scope: null },
  comments: new Map(), reactions: new Map(), openComments: new Set(),
  squadSort: { key: "role", dir: 1 }, fxFilter: "all",
};
const $app = document.getElementById("app");

// ------------------------------------------------------------------ utilidades
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const parseD = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = (iso, opts = {}) => {
  if (!iso) return "";
  const d = parseD(iso.slice(0, 10));
  return opts.short ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`
    : `${opts.day ? DIAS[d.getDay()] + " " : ""}${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
};
const ago = (ts) => {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(ts).toLocaleDateString("es");
};
const rgb = (c, a = 1) => (c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : `rgba(40,50,70,${a})`);
const lum = (c) => { if (!c) return 0; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const handle = (n) => String(n || "").normalize("NFD").replace(/[^\w]/g, "");
const toast = (msg) => { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.getElementById("toast-root").append(t); setTimeout(() => t.remove(), 2600); };

function crestSvg(team, cls = "crest") {
  const c1 = rgb(team?.c1), c2 = rgb(team?.c2);
  return `<svg class="${cls}" viewBox="0 0 40 46" aria-hidden="true"><path d="M20 1 2 7v15c0 12 8 19 18 23 10-4 18-11 18-23V7z" fill="${c1}" stroke="${c2}" stroke-width="2.5"/><text x="20" y="27" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="13" fill="${lum(team?.c1) > 0.5 ? "#111" : "#fff"}">${esc(initials(team?.name))}</text></svg>`;
}
function crest(team, cls = "crest") {
  if (team?.crest) return `<img class="${cls}" src="${esc(team.crest)}" alt="" loading="lazy" onerror="this.outerHTML=window.__crestFallback(this)" data-team='${esc(JSON.stringify({ name: team.name, c1: team.c1, c2: team.c2 }))}'>`;
  return crestSvg(team, cls);
}
window.__crestFallback = (img) => crestSvg(JSON.parse(img.dataset.team || "{}"), img.className);
function photo(p, cls = "pphoto") {
  const img = p?.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy" onerror="this.remove()">` : "";
  return `<div class="${cls}">${img || esc(initials(p?.name))}</div>`;
}
function avatar(profile, size = 34) {
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${esc(profile?.color || "#334")}">${esc(initials(profile?.display_name || profile?.username))}</div>`;
}
const posGroup = (pos) => ({ POR: "GK", LD: "DEF", LI: "DEF", DFC: "DEF", CAD: "DEF", CAI: "DEF", LIB: "DEF", MCD: "MID", MC: "MID", MD: "MID", MI: "MID", MCO: "MID", ED: "ATT", EI: "ATT", DC: "ATT", SD: "ATT" }[pos] || "NA");
const posChip = (pos) => `<span class="poschip pos-${posGroup(pos)}">${esc(pos || "—")}</span>`;
const ratingCls = (r) => (r >= 8 ? "r-elite" : r >= 7 ? "r-good" : r >= 6 ? "r-ok" : "r-poor");
const ratingChip = (r) => (r == null || isNaN(r) ? '<span class="muted">—</span>' : `<span class="rating ${ratingCls(r)}">${Number(r).toFixed(r % 1 ? 1 : 0)}</span>`);

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  feed: '<path d="M4 5h16M4 12h16M4 19h10"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>',
  swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  download: '<path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.2-7 8-7s7 2.5 8 7"/>',
  live: '<circle cx="12" cy="12" r="3"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 8.5a4.5 4.5 0 0 0 0 7M15.5 8.5a4.5 4.5 0 0 1 0 7"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  comment: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  share: '<path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
  check: '<path d="M12 2.5 14.2 4l2.6-.3.9 2.5 2.3 1.3-.4 2.6L21 12l-1.4 2.2.4 2.6-2.3 1.3-.9 2.5-2.6-.3L12 21.5 9.8 20l-2.6.3-.9-2.5L4 16.5l.4-2.6L3 12l1.4-2.2L4 7.2l2.3-1.3.9-2.5 2.6.3z" fill="currentColor"/><path d="m8.5 12 2.3 2.3 4.7-4.8" stroke="#0b1220" stroke-width="2" fill="none"/>',
};
const icon = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ""}</svg>`;

// ------------------------------------------------------------------ datos
async function loadBase() {
  const [{ data: profiles }, { data: careers }] = await Promise.all([
    sb.from("profiles").select("*"),
    sb.from("careers").select("id,owner,title,team_id,team_name,season,game_date,last_sync,crest,colors,created_at,mgr:snapshot->manager,ctype:snapshot->career_type,sstart:snapshot->>season_start").order("last_sync", { ascending: false, nullsFirst: false }),
  ]);
  state.profiles = new Map((profiles || []).map((p) => [p.id, p]));
  state.me = state.profiles.get(state.session.user.id) || null;
  state.careers = careers || [];
}
const careerTeam = (c) => ({ name: c?.team_name, crest: c?.crest, c1: c?.colors?.[0], c2: c?.colors?.[1] });

async function loadCareer(id) {
  if (state.career?.id === id) return state.career;
  const { data, error } = await sb.from("careers").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("No se encontró la carrera");
  state.career = data;
  state.careerStats = null; state.careerMatches = null; state.careerSeasons = null;
  return data;
}
async function loadStats(c) {
  if (state.careerStats) return state.careerStats;
  const { data } = await sb.rpc("season_player_stats", { p_career: c.id, p_from: c.snapshot.season_start });
  state.careerStats = new Map((data || []).map((r) => [r.player_id, r]));
  return state.careerStats;
}
async function loadMatches(c) {
  if (state.careerMatches) return state.careerMatches;
  const { data } = await sb.from("matches").select("*").eq("career_id", c.id).order("match_date");
  state.careerMatches = data || [];
  return state.careerMatches;
}
async function loadSeasons(c) {
  if (state.careerSeasons) return state.careerSeasons;
  const { data } = await sb.from("seasons").select("*").eq("career_id", c.id).order("season", { ascending: false });
  state.careerSeasons = data || [];
  return state.careerSeasons;
}

const POST_SELECT = "*, career:careers(id,owner,title,team_id,team_name,crest,colors)";
async function loadFeed(scope, more = false) {
  if (!more || state.feed.scope !== scope) state.feed = { items: [], done: false, scope };
  let q = sb.from("posts").select(POST_SELECT).order("game_date", { ascending: false }).order("created_at", { ascending: false })
    .range(state.feed.items.length, state.feed.items.length + 19);
  if (scope) q = q.eq("career_id", scope);
  const { data } = await q;
  const items = data || [];
  state.feed.items.push(...items);
  state.feed.done = items.length < 20;
  await loadSocial(items.map((p) => p.id));
}
async function loadSocial(ids) {
  if (!ids.length) return;
  const [{ data: cm }, { data: rx }] = await Promise.all([
    sb.from("comments").select("*").in("post_id", ids).order("created_at"),
    sb.from("reactions").select("*").in("post_id", ids),
  ]);
  for (const id of ids) { state.comments.set(id, []); state.reactions.set(id, []); }
  for (const c of cm || []) state.comments.get(c.post_id)?.push(c);
  for (const r of rx || []) state.reactions.get(r.post_id)?.push(r);
}

// ------------------------------------------------------------------ tema del club
function applyTheme(team) {
  const root = document.documentElement.style;
  if (!team?.c1) {
    ["--accent", "--accent-ink", "--club-1", "--club-2"].forEach((v) => root.removeProperty(v));
    return;
  }
  let a = team.c1;
  const alt = team.c2;
  if (lum(a) < 0.04 && alt && lum(alt) > lum(a)) a = alt;
  if (lum(a) < 0.07) a = a.map((v) => Math.min(255, v + 90));
  if (lum(a) > 0.85) a = [34, 197, 94];
  root.setProperty("--accent", rgb(a));
  root.setProperty("--accent-ink", lum(a) > 0.35 ? "#081008" : "#ffffff");
  root.setProperty("--club-1", rgb(team.c1));
  root.setProperty("--club-2", rgb(team.c1.map((v) => Math.round(v * 0.35))));
}

// ------------------------------------------------------------------ layout
function shell({ title, crumbs = "", right = "", body, active = "" }) {
  const careers = state.careers.map((c) => `
    <a class="nav-item nav-career ${active === "c:" + c.id ? "active" : ""}" href="#/c/${c.id}">
      ${crest(careerTeam(c), "crest")}<span>${esc(c.team_name || c.title)}<br><small class="muted">${esc(state.profiles.get(c.owner)?.display_name || "")}</small></span>
    </a>`).join("");
  const mine = state.careers.find((c) => c.owner === state.me?.id);
  return `
  <div class="shell">
    <aside class="rail">
      <a class="brand" href="#/">
        <svg class="brand-logo" viewBox="0 0 64 64"><path d="M32 4 8 12v18c0 15 10 25 24 30 14-5 24-15 24-30V12z" fill="var(--accent)"/><path d="M22 24h20M22 32h14M22 40h8" stroke="#0a0e17" stroke-width="5" stroke-linecap="round"/></svg>
        <div><b>Career Tracker</b><small>EA SPORTS FC 27</small></div>
      </a>
      <a class="nav-item ${active === "home" ? "active" : ""}" href="#/">${icon("home")} Inicio</a>
      ${mine ? `<a class="nav-item ${active === "c:" + mine.id ? "active" : ""}" href="#/c/${mine.id}">${icon("shield")} Mi club</a>` : ""}
      <a class="nav-item ${active === "conectar" ? "active" : ""}" href="#/conectar">${icon("download")} Conectar mi juego</a>
      <div class="rail-section">Carreras del grupo</div>
      ${careers || '<div class="muted small" style="padding:4px 10px">Todavía no hay carreras.</div>'}
      <div class="rail-foot">
        <a class="me-card" href="#/perfil">${avatar(state.me)}<div><b>${esc(state.me?.display_name || "")}</b><small>@${esc(state.me?.username || "")}</small></div></a>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div><h1>${title}</h1>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ""}</div>
        <div class="spacer"></div>${right}
      </header>
      <div class="content">${body}</div>
    </main>
    <nav class="mobile-nav">
      <a href="#/" class="${active === "home" ? "active" : ""}">${icon("home")}Inicio</a>
      ${mine ? `<a href="#/c/${mine.id}" class="${active === "c:" + mine.id ? "active" : ""}">${icon("shield")}Mi club</a>` : ""}
      <a href="#/carreras" class="${active === "carreras" ? "active" : ""}">${icon("users")}Carreras</a>
      <a href="#/conectar" class="${active === "conectar" ? "active" : ""}">${icon("download")}Conectar</a>
      <a href="#/perfil" class="${active === "perfil" ? "active" : ""}">${icon("user")}Perfil</a>
    </nav>
  </div>`;
}

// ------------------------------------------------------------------ auth
function viewAuth(mode) {
  const reg = mode === "registro";
  applyTheme(null);
  $app.innerHTML = `
  <div class="auth">
    <section class="auth-art">
      <div class="brand"><svg class="brand-logo" viewBox="0 0 64 64"><path d="M32 4 8 12v18c0 15 10 25 24 30 14-5 24-15 24-30V12z" fill="#22c55e"/><path d="M22 24h20M22 32h14M22 40h8" stroke="#0a0e17" stroke-width="5" stroke-linecap="round"/></svg><div><b>Career Tracker</b><small>EA SPORTS FC 27</small></div></div>
      <div>
        <h1>Tu carrera,<br><em>en vivo.</em></h1>
        <p>Jugá tu Modo Carrera como siempre. Cada vez que el juego guarda, tus resultados, tablas, fichajes y estadísticas aparecen acá para que tus amigos los vean y comenten.</p>
      </div>
      <div class="auth-feats">
        <div><b>⚡ Sincronización automática</b>Lee el guardado de FC 27 en tu PC.</div>
        <div><b>📣 Publicaciones del club</b>Resultados, resúmenes y fichajes.</div>
        <div><b>💬 Comentarios</b>Reaccioná y comentá las carreras del grupo.</div>
        <div><b>📊 Estadísticas</b>Plantilla, notas y tablas al día.</div>
      </div>
    </section>
    <section class="auth-form">
      <form class="auth-card" id="auth-form" autocomplete="on">
        <h2>${reg ? "Crear cuenta" : "Ingresar"}</h2>
        <div class="muted">${reg ? "Necesitás el código de invitación del grupo." : "Bienvenido de nuevo, mister."}</div>
        <label class="field"><span>Usuario</span><input class="input" name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9_]+" placeholder="ej: lucas_10"></label>
        ${reg ? `<label class="field"><span>Nombre para mostrar</span><input class="input" name="display" maxlength="40" placeholder="ej: Lucas"></label>` : ""}
        <label class="field"><span>Contraseña</span><input class="input" type="password" name="password" autocomplete="${reg ? "new-password" : "current-password"}" required minlength="6"></label>
        ${reg ? `<label class="field"><span>Código de invitación</span><input class="input" name="invite" required placeholder="XXXXXXXX" style="text-transform:uppercase"></label>` : ""}
        <div class="err" id="auth-err"></div>
        <button class="btn primary block" type="submit">${reg ? "Crear cuenta" : "Entrar"}</button>
        <div class="switch">${reg ? 'Ya tenés cuenta? <a href="#/login">Ingresá</a>' : '¿No tenés cuenta? <a href="#/registro">Creá una</a>'}</div>
      </form>
    </section>
  </div>`;
  const form = document.getElementById("auth-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const username = String(fd.get("username")).trim().toLowerCase();
    const password = String(fd.get("password"));
    const err = document.getElementById("auth-err");
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; err.textContent = "";
    try {
      if (reg) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/register`, {
          method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
          body: JSON.stringify({ username, password, display_name: String(fd.get("display") || ""), invite: String(fd.get("invite") || "") }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "No se pudo crear la cuenta");
      }
      const { error } = await sb.auth.signInWithPassword({ email: `${username}@${EMAIL_DOMAIN}`, password });
      if (error) throw new Error("Usuario o contraseña incorrectos");
      location.hash = reg ? "#/conectar" : "#/";
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  };
}

// ------------------------------------------------------------------ posts
function postHtml(p, opts = {}) {
  const c = p.career || {};
  const team = careerTeam(c);
  const owner = state.profiles.get(c.owner);
  const d = p.data || {};
  let media = "";
  const teams = state.career?.id === c.id ? state.career.snapshot?.teams : null;
  if (p.kind === "result" && d.fixture) {
    const f = d.fixture;
    const T = (id) => d.teams?.[id] || teams?.[id] || (id === c.team_id ? team : { name: "" });
    const home = T(f.home), away = T(f.away);
    const userHome = f.home === c.team_id;
    const other = userHome ? away : home;
    media = `<div class="post-media"><div class="score-banner">
      <div class="blur" style="background: radial-gradient(circle at 25% 50%, ${rgb(home.c1 || other?.c1)}, transparent 55%), radial-gradient(circle at 75% 50%, ${rgb(away.c1)}, transparent 55%)"></div>
      <div class="content-b">${crest(home)}<div class="sc">${f.hg}–${f.ag}</div>${crest(away)}</div>
      <div class="comp">${esc(d.comp_name || "")}${f.hp != null ? ` · Penales ${f.hp}–${f.ap}` : ""}</div>
    </div></div>`;
  } else if (p.kind === "roundup" && d.fixtures) {
    const rows = d.fixtures.map((f, i) => {
      const userHome = f.home === c.team_id;
      const oppId = userHome ? f.away : f.home;
      const opp = d.teams?.[oppId] || teams?.[oppId] || { name: "" };
      const us = userHome ? f.hg : f.ag, them = userHome ? f.ag : f.hg;
      return `<div class="roundup-row"><span class="d">${fmtDate(f.date, { short: true })}</span>${crest(opp, "crest sm")}<span>${userHome ? "" : '<span class="muted">@ </span>'}${esc(opp.name || d.names?.[oppId] || "Rival")}</span><span class="score-pill ${d.results?.[i] || "N"}">${us}–${them}</span></div>`;
    }).join("");
    media = `<div class="post-media"><div class="roundup">${rows}</div></div>`;
  } else if ((p.kind === "transfer_in" || p.kind === "transfer_out") && d.player) {
    const pl = d.player;
    media = `<div class="post-media"><div class="player-card">${photo(pl)}<div><div class="kicker">${p.kind === "transfer_in" ? "Nuevo fichaje" : "Salida"}</div><div style="font-family:var(--display);font-size:28px;text-transform:uppercase;line-height:1">${esc(pl.name)}</div><div class="muted" style="margin-top:4px">${posChip(pl.pos)} &nbsp;${esc(pl.age ?? "")} años</div></div><div class="ovr-big"><b>${esc(pl.ovr ?? "")}</b><span class="muted small">MEDIA</span></div></div></div>`;
  } else if (p.kind === "trophy") {
    media = `<div class="post-media"><div class="trophy-card"><div class="cup">🏆</div><b>${esc(d.comp_name || "")}</b><div class="muted">Temporada ${esc(state.career?.snapshot?.season || "")}</div></div></div>`;
  }
  const rx = state.reactions.get(p.id) || [];
  const counts = {};
  rx.forEach((r) => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
  const mine = new Set(rx.filter((r) => r.user_id === state.me?.id).map((r) => r.emoji));
  const reacts = Object.entries(counts).map(([e, n]) => `<button data-act="toggle-react" data-post="${p.id}" data-emoji="${e}" class="${mine.has(e) ? "mine" : ""}">${e} ${n}</button>`).join("");
  const comments = state.comments.get(p.id) || [];
  const open = state.openComments.has(p.id) || opts.expanded;
  return `
  <article class="post" data-post-id="${p.id}">
    <div class="post-h">
      <a class="post-av" href="#/c/${c.id}" style="background:${rgb(team.c1, 0.12)}">${crest(team)}</a>
      <div style="min-width:0;flex:1">
        <div class="post-who"><a href="#/c/${c.id}"><b>${esc(c.team_name || "")}</b></a>${icon("check", "verified")}<span class="handle">@${esc(handle(c.team_name))} · ${fmtDate(p.game_date)}</span></div>
        <div class="muted small">Carrera de ${esc(owner?.display_name || "")}</div>
        <div class="post-title">${esc(p.title.replace(/^⏱️ Final:/, "⏱️ Final:"))}</div>
        ${p.body ? `<div class="post-body">${esc(p.body)}</div>` : ""}
        <a class="hashtag" href="#/c/${c.id}">#${esc(handle(c.team_name))}</a>
        ${media}
        <div class="post-actions">
          <button class="act react" data-act="react" data-post="${p.id}">${icon("smile")} Reaccionar</button>
          <div class="reacts">${reacts}</div>
          <span style="flex:1"></span>
          <button class="act" data-act="comments" data-post="${p.id}">${icon("comment")} ${comments.length || ""} <span class="hide-sm">Comentar</span></button>
          <button class="act" data-act="share" data-post="${p.id}">${icon("share")} <span class="hide-sm">Compartir</span></button>
        </div>
        ${open ? commentsHtml(p.id) : ""}
      </div>
    </div>
  </article>`;
}
function commentsHtml(postId) {
  const list = (state.comments.get(postId) || []).map((c) => {
    const a = state.profiles.get(c.author);
    return `<div class="comment">${avatar(a, 30)}<div style="min-width:0"><div class="bubble"><b>${esc(a?.display_name || "?")}</b><p>${esc(c.body)}</p></div>
      <div class="meta"><span>${ago(c.created_at)}</span>${c.author === state.me?.id ? `<button data-act="del-comment" data-id="${c.id}" data-post="${postId}">Borrar</button>` : ""}</div></div></div>`;
  }).join("");
  return `<div class="comments">${list}
    <form class="comment-form" data-post="${postId}">${avatar(state.me, 30)}<textarea rows="1" maxlength="1000" placeholder="Escribí un comentario…"></textarea><button class="btn primary" type="submit">Enviar</button></form>
  </div>`;
}
function rerenderPost(id) {
  const el = document.querySelector(`[data-post-id="${id}"]`);
  const p = state.feed.items.find((x) => x.id === id) || state.singlePost;
  if (el && p) { el.outerHTML = postHtml(p, { expanded: state.singlePost?.id === id }); }
}

// ------------------------------------------------------------------ tarjetas de carreras
function seasonNumber(c) {
  const j = c.mgr?.joined, st = c.sstart;
  if (!j || !st) return 1;
  const jd = parseD(j), sy = Number(st.slice(0, 4));
  const jy = jd.getMonth() >= 5 ? jd.getFullYear() : jd.getFullYear() - 1;
  return Math.max(1, sy - jy + 1);
}
function careerCard(c) {
  const owner = state.profiles.get(c.owner) || {};
  const team = careerTeam(c);
  const live = c.last_sync && Date.now() - new Date(c.last_sync) < 24 * 3600e3;
  const n = seasonNumber(c);
  const flag = c.mgr?.flag ? `<img class="cc-flag" src="${esc(c.mgr.flag)}" alt="" loading="lazy">` : "";
  return `<a class="cc" href="#/c/${c.id}">
    <div class="cc-head"><div class="cc-av" style="border-color:${esc(owner.color || "#22c55e")};color:${esc(owner.color || "#22c55e")}">${esc(initials(owner.display_name))}</div>
      <div style="min-width:0"><b>${esc(owner.display_name || "")}</b><small>@${esc(owner.username || "")}</small></div>${flag}</div>
    <div class="cc-body"><div class="cc-photo" style="background:linear-gradient(160deg, ${rgb(team.c1, .9)}, ${rgb(team.c1 && team.c1.map((v) => v * 0.3), 1)})">${esc(initials(c.mgr?.name || "?"))}</div>
      <div style="min-width:0;flex:1"><div class="cc-tag">${c.mgr?.real ? "Técnico real" : "Técnico creado"}</div><div class="cc-name">${esc(c.mgr?.name || "Mánager")}</div>
        <div class="cc-team">${crest(team, "crest")}<span>${esc(team.name || "")}</span></div></div></div>
    <div class="cc-foot"><span class="cc-chip">${esc(c.ctype?.mode || "Mánager")}</span><span class="cc-chip">${esc(c.ctype?.start || "Clásica")}</span><span class="cc-chip">${n}ª temp.</span>${live ? '<span class="cc-chip live">⟳ Live</span>' : ""}<span class="cc-logo">FC27</span></div>
  </a>`;
}

// ------------------------------------------------------------------ vistas: inicio
async function viewHome() {
  applyTheme(null);
  await loadFeed(null);
  const careers = state.careers.map((c) => `
    <a class="career-card" href="#/c/${c.id}">${crest(careerTeam(c), "crest lg")}
      <div style="min-width:0"><div class="t">${esc(c.team_name || c.title)}</div><div class="s">${esc(state.profiles.get(c.owner)?.display_name || "")} · ${esc(c.season || "")}</div><div class="s">${c.game_date ? "📅 " + fmtDate(c.game_date) : ""}</div></div>
      <span class="chip ${c.last_sync && Date.now() - new Date(c.last_sync) < 3 * 3600e3 ? "accent live" : ""}" style="margin-left:auto">${c.last_sync ? ago(c.last_sync) : "sin datos"}</span>
    </a>`).join("");
  const hasMine = state.careers.some((c) => c.owner === state.me?.id);
  const body = `
  <div class="panel-h panel" style="border-radius:10px;margin-bottom:14px">${icon("users", "ic")}<h3>Carreras</h3><span class="right">${state.careers.length}</span></div>
  <div class="cc-grid">${state.careers.map(careerCard).join("") || '<div class="panel empty" style="grid-column:1/-1">Nadie conectó su juego todavía.</div>'}</div>
  <div class="panel-h panel" style="border-radius:10px;margin:22px 0 14px">${icon("feed", "ic")}<h3>Últimas publicaciones</h3></div>
  <div class="grid cols-2">
    <div>
      ${!hasMine ? `<div class="download" style="margin-bottom:16px"><div style="font-size:34px">🎮</div><div><b>Conectá tu Modo Carrera</b><div class="muted">Descargá el sincronizador para que tu carrera aparezca acá automáticamente.</div></div><a class="btn primary" style="margin-left:auto" href="#/conectar">Conectar</a></div>` : ""}
      <div class="feed" id="feed">${state.feed.items.map((p) => postHtml(p)).join("") || '<div class="panel empty">Todavía no hay publicaciones. ¡Conectá tu juego y jugá un partido!</div>'}</div>
      ${state.feed.done ? "" : '<div style="text-align:center;margin-top:16px"><button class="btn" data-act="more">Cargar más</button></div>'}
    </div>
    <div class="stack">
      <section class="panel"><div class="panel-h">${icon("users", "ic")}<h3>Carreras del grupo</h3><span class="right">${state.careers.length}</span></div><div class="panel-b flush">${careers || '<div class="empty">Nadie conectó su juego todavía.</div>'}</div></section>
      <section class="panel"><div class="panel-h">${icon("star", "ic")}<h3>Miembros</h3></div><div class="panel-b" style="display:flex;flex-wrap:wrap;gap:10px">${[...state.profiles.values()].map((p) => `<div style="display:flex;align-items:center;gap:8px">${avatar(p, 28)}<span>${esc(p.display_name)}</span></div>`).join("")}</div></section>
    </div>
  </div>`;
  $app.innerHTML = shell({ title: "Inicio", crumbs: "Lo último de todas las carreras", body, active: "home" });
}

function viewCareersList() {
  applyTheme(null);
  const list = state.careers.map((c) => `<a class="career-card" href="#/c/${c.id}">${crest(careerTeam(c), "crest lg")}<div><div class="t">${esc(c.team_name || c.title)}</div><div class="s">${esc(state.profiles.get(c.owner)?.display_name || "")} · ${esc(c.season || "")} · ${c.game_date ? fmtDate(c.game_date) : ""}</div></div></a>`).join("");
  void list;
  $app.innerHTML = shell({ title: "Carreras", body: `<div class="cc-grid">${state.careers.map(careerCard).join("") || '<div class="panel empty">Sin carreras.</div>'}</div>`, active: "carreras" });
}

// ------------------------------------------------------------------ vistas: carrera
const TABS = [["", "Resumen"], ["noticias", "Noticias"], ["plantilla", "Plantilla"], ["partidos", "Partidos"], ["competiciones", "Competiciones"], ["fichajes", "Fichajes"], ["estadisticas", "Estadísticas"], ["historial", "Historial"]];

function careerFrame(c, tab, body) {
  const s = c.snapshot;
  const team = s.teams[s.user_team] || careerTeam(c);
  applyTheme(team);
  const owner = state.profiles.get(c.owner);
  const next = s.fixtures.find((f) => !f.played);
  const hero = `
  <section class="club-hero">
    <div class="club-hero-inner">
      ${crest(team, "crest")}
      <div>
        <h2>${esc(team.name)}</h2>
        <div class="sub"><span>👔 ${esc(s.manager?.name || "Mánager")} <span class="chip">${s.manager?.real ? "Técnico real" : "Técnico creado"}</span></span><span>🎮 ${esc(s.career_type?.mode || "Mánager")} · ${esc(s.career_type?.start || "Clásica")}</span><span>📅 ${fmtDate(s.game_date, { day: true })} en el juego</span><span>Temporada ${esc(s.season)}</span></div>
        <div class="badges"><span class="chip">EA FC 27</span><span class="chip accent live">Live Tracker</span><span class="chip">Actualizado ${ago(c.last_sync)}</span></div>
      </div>
      <div class="owner">${avatar(owner, 40)}<div style="margin-top:6px"><b>${esc(owner?.display_name || "")}</b></div><div class="muted">@${esc(owner?.username || "")}</div></div>
    </div>
    <nav class="tabs">${TABS.map(([k, n]) => `<a class="tab ${tab === k ? "active" : ""}" href="#/c/${c.id}${k ? "/" + k : ""}">${n}</a>`).join("")}</nav>
  </section>`;
  const right = next ? `<div class="date-chip"><small>Próximo partido</small><b>${esc(s.teams[next.home === s.user_team ? next.away : next.home]?.name || "")}</b><small>${fmtDate(next.date)} · ${esc(next.time)}</small></div>` : "";
  return shell({ title: esc(team.name), crumbs: `${esc(c.title || "")}`, right, body: hero + body, active: "c:" + c.id });
}

function resultOf(f, user) {
  if (!f.played) return null;
  let us = f.home === user ? f.hg : f.ag, them = f.home === user ? f.ag : f.hg;
  if (us === them && f.hp != null) { us = f.home === user ? f.hp : f.ap; them = f.home === user ? f.ap : f.hp; return us > them ? "W" : "L"; }
  return us > them ? "W" : us === them ? "D" : "L";
}
const compById = (s, id) => s.competitions.find((x) => x.id === id);
const userGroup = (comp, user) => comp?.groups.filter((g) => g.table.some((r) => r.team === user)).slice(-1)[0];

function compStatus(s, comp) {
  const user = s.user_team;
  const fx = s.fixtures.filter((f) => f.comp === comp.id && f.date >= s.season_start);
  if (comp.league) {
    const g = userGroup(comp, user);
    const pos = g ? g.table.findIndex((r) => r.team === user) + 1 : 0;
    const done = fx.length && fx.every((f) => f.played);
    return { text: pos ? `${pos}º` : "—", live: !done, champion: done && pos === 1 };
  }
  if (!fx.length) return { text: "Sin jugar", live: true };
  const next = fx.find((f) => !f.played);
  const last = [...fx].reverse().find((f) => f.played);
  const g = userGroup(comp, user);
  if (g && g.table.length > 4 && g.has_table) {
    const pos = g.table.findIndex((r) => r.team === user) + 1;
    return { text: `${pos}º ${g.stage.toLowerCase()}`, live: !!next };
  }
  if (next) return { text: g?.stage || "En juego", live: true };
  if (last && resultOf(last, user) === "W" && (g?.stage === "Final" || fx.length === 1)) return { text: "🏆 Campeón", champion: true };
  if (last && resultOf(last, user) === "L") return { text: `Eliminado${g?.stage ? " · " + g.stage : ""}`, live: false };
  return { text: g?.stage || "—", live: false };
}
const compIcon = (comp) => (comp.league ? "🏟️" : /Champions|Europa|Conference|Super/.test(comp.name) ? "⭐" : /Shield|Supercopa|Super/.test(comp.name) ? "🛡️" : /pretemporada/i.test(comp.name) ? "🌍" : "🏆");

async function viewCareerOverview(c) {
  const s = c.snapshot;
  const stats = await loadStats(c);
  const user = s.user_team;
  const T = (id) => s.teams[id] || { name: "?" };
  const played = s.fixtures.filter((f) => f.played);
  const last = played[played.length - 1];
  const next = s.fixtures.find((f) => !f.played);

  // tabla de la liga (top 3 + entorno del usuario)
  const league = s.competitions.find((x) => x.league);
  const lg = league && userGroup(league, user);
  let tableHtml = '<div class="empty">Sin liga</div>';
  if (lg) {
    const idx = lg.table.findIndex((r) => r.team === user);
    const show = new Set([0, 1, 2, idx - 1, idx, idx + 1].filter((i) => i >= 0 && i < lg.table.length));
    let prev = -1, rows = "";
    [...show].sort((a, b) => a - b).forEach((i) => {
      if (prev >= 0 && i - prev > 1) rows += `<tr><td colspan="8" class="muted" style="text-align:center;padding:2px">···</td></tr>`;
      const r = lg.table[i];
      rows += `<tr class="${r.team === user ? "me" : ""}"><td class="pos-num">${i + 1}</td><td><div class="team">${crest(T(r.team), "crest sm")}${esc(T(r.team).name)}</div></td><td class="num">${r.p}</td><td class="num hide-sm">${r.w}</td><td class="num hide-sm">${r.d}</td><td class="num hide-sm">${r.l}</td><td class="num">${r.gd > 0 ? "+" : ""}${r.gd}</td><td class="num pts">${r.pts}</td></tr>`;
      prev = i;
    });
    tableHtml = `<div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Equipo</th><th class="num">PJ</th><th class="num hide-sm">G</th><th class="num hide-sm">E</th><th class="num hide-sm">P</th><th class="num">DG</th><th class="num">Pts</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  const mc = (f, kind) => {
    if (!f) return `<div class="matchcard mc-next"><div class="side muted" style="grid-column:1/-1">Sin partidos</div></div>`;
    const comp = compById(s, f.comp);
    const res = resultOf(f, user);
    return `<div class="matchcard ${kind === "last" ? "mc-last " + res : "mc-next"}">
      <div class="meta"><span class="kicker">${kind === "last" ? "Último resultado" : "Próximo partido"}</span><span>${esc(comp?.name || "")}</span></div>
      <div class="side">${crest(T(f.home))}<span>${esc(T(f.home).name)}</span></div>
      ${kind === "last" ? `<div class="big">${f.hg}–${f.ag}</div>` : `<div style="text-align:center"><div class="vs">VS</div><div class="muted small">${fmtDate(f.date, { short: true })}<br>${esc(f.time)}</div></div>`}
      <div class="side">${crest(T(f.away))}<span>${esc(T(f.away).name)}</span></div>
    </div>`;
  };
  // temporada en curso
  const comps = s.competitions.filter((x) => !/pretemporada|Amistoso/i.test(x.name)).map((comp) => {
    const st = compStatus(s, comp);
    return `<div class="comp-row"><div class="comp-ic">${compIcon(comp)}</div><div class="name">${esc(comp.name)}${st.live ? ' <span style="color:var(--draw)">*</span>' : ""}</div><div class="val" style="${st.champion ? "color:var(--gold)" : ""}">${esc(st.text)}</div></div>`;
  }).join("");
  // destacados
  const sq = s.squad.map((p) => ({ ...p, st: stats.get(p.id) || {} }));
  const by = (fn) => [...sq].sort((a, b) => fn(b) - fn(a))[0];
  const topG = by((p) => p.league_goals || 0);
  const topA = by((p) => Number(p.st.apps || 0));
  const rated = sq.filter((p) => Number(p.st.apps || 0) >= 3);
  const topR = rated.length ? [...rated].sort((a, b) => Number(b.st.avg_rating) - Number(a.st.avg_rating))[0] : null;
  const topM = by((p) => Number(p.st.minutes || 0));
  const so = (lbl, p, val, unit) => p ? `<div class="so" data-act="player" data-pid="${p.id}">${photo(p)}<div><div class="lbl">${lbl}</div><div class="nm">${esc(p.name)}</div></div><div class="val">${val}<small>${unit}</small></div></div>` : "";
  // forma
  const form = played.slice(-6).map((f) => `<i class="${resultOf(f, user)}">${{ W: "G", D: "E", L: "P" }[resultOf(f, user)]}</i>`).join("");
  const rec = { W: 0, D: 0, L: 0, gf: 0, ga: 0 };
  played.filter((f) => f.date >= s.season_start).forEach((f) => { rec[resultOf(f, user)]++; rec.gf += f.home === user ? f.hg : f.ag; rec.ga += f.home === user ? f.ag : f.hg; });
  const club = s.club || {};

  // noticias
  await loadFeed(c.id);
  const news = state.feed.items.slice(0, 3).map((p) => postHtml(p)).join("") || '<div class="panel empty">Sin noticias todavía.</div>';

  const body = `
  <div class="grid cols-3">
    <section class="panel"><div class="panel-h">${icon("live", "ic")}<h3>Ahora mismo</h3><span class="right">🔄 ${ago(c.last_sync)}</span></div>
      <div class="panel-b flush"><div style="padding:10px 14px 4px;display:flex;align-items:center;gap:8px">${league ? `<b>${esc(league.name)}</b>` : ""}<span class="muted small" style="margin-left:auto">${esc(lg?.stage || "")}</span></div>${tableHtml}</div>
      <div class="panel-b mc-grid">${mc(last, "last")}${mc(next, "next")}</div>
    </section>
    <section class="panel"><div class="panel-h">${icon("calendar", "ic")}<h3>Temporada en curso</h3><span class="right">${esc(s.season)}</span></div>
      <div class="panel-b flush">${comps}</div>
      <div class="panel-b"><div class="muted small" style="margin-bottom:8px">* Sigue en juego</div>
        <div class="kpis"><div class="kpi"><b style="color:var(--good)">${rec.W}</b><span>Ganados</span></div><div class="kpi"><b style="color:var(--draw)">${rec.D}</b><span>Empates</span></div><div class="kpi"><b style="color:var(--bad)">${rec.L}</b><span>Perdidos</span></div><div class="kpi"><b>${rec.gf}:${rec.ga}</b><span>Goles</span></div></div>
        <div style="margin-top:12px;display:flex;align-items:center;gap:10px"><span class="kicker">Forma</span><span class="form">${form}</span></div>
      </div>
    </section>
    <section class="panel"><div class="panel-h">${icon("star", "ic")}<h3>Jugadores destacados</h3></div>
      <div class="panel-b"><div class="standout" style="grid-template-columns:1fr">
        ${so("Máximo goleador (liga)", topG, topG?.league_goals || 0, "G")}
        ${so("Más partidos", topA, topA?.st.apps || 0, "PJ")}
        ${so("Mejor nota media", topR, topR ? Number(topR.st.avg_rating).toFixed(2) : "-", "")}
        ${so("Más minutos", topM, topM?.st.minutes || 0, "'")}
      </div></div>
    </section>
  </div>
  <div class="grid cols-2" style="margin-top:16px">
    <section><div class="panel-h panel" style="border-radius:10px 10px 0 0;border-bottom:0">${icon("feed", "ic")}<h3>Últimas noticias</h3><a class="right" href="#/c/${c.id}/noticias">Ver todo →</a></div><div class="feed" style="margin-top:12px">${news}</div></section>
    <div class="stack">
      <section class="panel"><div class="panel-h">${icon("trophy", "ic")}<h3>Palmarés del club</h3></div>
        <div class="panel-b"><div class="trophies">
          <div class="trophy"><b>${club.league_titles ?? 0}</b> Ligas</div><div class="trophy"><b>${club.domestic_cups ?? 0}</b> Copas</div>
          <div class="trophy"><b>${club.ucl ?? 0}</b> Champions</div><div class="trophy"><b>${club.uel ?? 0}</b> Europa League</div>
        </div>
        <div class="muted small" style="margin-top:12px">Fundado en ${esc(club.founded ?? "—")} · Estadio para ${Number(club.stadium_capacity || 0).toLocaleString("es")} personas</div></div>
      </section>
      <section class="panel"><div class="panel-h">${icon("users", "ic")}<h3>Mánager</h3></div>
        <div class="panel-b"><div style="display:flex;gap:12px;align-items:center"><div class="avatar" style="width:52px;height:52px;font-size:18px;background:var(--club-1)">${esc(initials(s.manager?.name))}</div><div><b style="font-size:16px">${esc(s.manager?.name || "")}</b><div class="muted">En el club desde ${s.manager?.joined ? fmtDate(s.manager.joined) : "—"}</div></div></div></div>
      </section>
    </div>
  </div>`;
  $app.innerHTML = careerFrame(c, "", body);
}

async function viewCareerNews(c) {
  await loadFeed(c.id);
  const body = `<div class="grid cols-2"><div><div class="feed">${state.feed.items.map((p) => postHtml(p)).join("") || '<div class="panel empty">Sin noticias.</div>'}</div>
    ${state.feed.done ? "" : '<div style="text-align:center;margin-top:16px"><button class="btn" data-act="more">Cargar más</button></div>'}</div>
    <div>${c.owner === state.me?.id ? `<section class="panel"><div class="panel-h">${icon("feed", "ic")}<h3>Publicar algo</h3></div><form class="panel-b" id="new-post"><textarea class="input" rows="3" maxlength="500" placeholder="Rueda de prensa, rumores, objetivos..." required></textarea><button class="btn primary" style="margin-top:10px">Publicar</button></form></section>` : ""}</div></div>`;
  $app.innerHTML = careerFrame(c, "noticias", body);
  const f = document.getElementById("new-post");
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const txt = f.querySelector("textarea").value.trim();
    if (!txt) return;
    const { error } = await sb.from("posts").insert({ career_id: c.id, author: state.me.id, kind: "custom", dedupe_key: "custom:" + crypto.randomUUID(), title: "🎙️ Comunicado oficial", body: txt, game_date: c.snapshot.game_date });
    if (error) return toast("No se pudo publicar");
    route();
  };
}

function squadRows(c, stats) {
  const s = c.snapshot;
  const k = state.squadSort;
  const val = (p) => {
    const st = stats.get(p.id) || {};
    return { role: (p.role === "SUP" ? 1 : p.role === "RES" ? 2 : 0) * 1000 - (p.ovr || 0), jersey: p.jersey, name: p.name, pos: p.pos, age: p.age, ovr: p.ovr, pot: p.pot, apps: Number(st.apps || 0), mins: Number(st.minutes || 0), avg: Number(st.avg_rating || 0), goals: p.league_goals || 0, contract: p.contract }[k.key];
  };
  const list = [...s.squad].sort((a, b) => { const x = val(a), y = val(b); return (typeof x === "string" ? x.localeCompare(y) : (x ?? 0) - (y ?? 0)) * k.dir; });
  return list.map((p) => {
    const st = stats.get(p.id) || {};
    return `<tr class="click" data-act="player" data-pid="${p.id}"><td class="num muted">${esc(p.jersey ?? "")}</td>
      <td><div class="team">${photo(p, "pphoto")}<div><div>${esc(p.name)}</div><div class="muted small">${p.role === "SUP" ? "Suplente" : p.role === "RES" ? "Reserva" : "Titular · " + esc(p.role)}</div></div></div></td>
      <td>${posChip(p.pos)}</td><td class="num">${esc(p.age ?? "")}</td><td class="num"><span class="ovr">${esc(p.ovr ?? "")}</span></td><td class="num muted">${esc(p.pot ?? "")}</td>
      <td class="num">${st.apps ?? 0}</td><td class="num">${st.minutes ?? 0}</td><td class="num">${st.avg_rating ? ratingChip(Number(st.avg_rating)) : '<span class="muted">—</span>'}</td>
      <td class="num">${p.league_goals || 0}</td><td class="num muted">${p.contract || "—"}</td></tr>`;
  }).join("");
}
async function viewCareerSquad(c) {
  const stats = await loadStats(c);
  const th = (k, n, cls = "num") => `<th class="sortable ${cls}" data-act="sort" data-key="${k}">${n}${state.squadSort.key === k ? (state.squadSort.dir > 0 ? " ▲" : " ▼") : ""}</th>`;
  const s = c.snapshot;
  const avgAge = (s.squad.reduce((a, p) => a + (p.age || 0), 0) / s.squad.length).toFixed(1);
  const avgOvr = (s.squad.reduce((a, p) => a + (p.ovr || 0), 0) / s.squad.length).toFixed(1);
  const body = `
  <div class="kpis" style="margin-bottom:16px"><div class="kpi"><b>${s.squad.length}</b><span>Jugadores</span></div><div class="kpi"><b>${avgOvr}</b><span>Media del plantel</span></div><div class="kpi"><b>${avgAge}</b><span>Edad media</span></div><div class="kpi"><b>${s.squad.filter((p) => p.joined >= s.season_start).length}</b><span>Fichajes de la temporada</span></div></div>
  <section class="panel"><div class="panel-h">${icon("users", "ic")}<h3>Plantilla</h3><span class="right">PJ / Min / Nota: partidos registrados por el tracker esta temporada</span></div>
    <div class="table-wrap"><table class="tbl"><thead><tr>${th("jersey", "#")}${th("name", "Jugador", "")}${th("pos", "Pos", "")}${th("age", "Edad")}${th("ovr", "Med")}${th("pot", "Pot")}${th("apps", "PJ")}${th("mins", "Min")}${th("avg", "Nota")}${th("goals", "Goles liga")}${th("contract", "Contrato")}</tr></thead>
    <tbody>${squadRows(c, stats)}</tbody></table></div></section>`;
  $app.innerHTML = careerFrame(c, "plantilla", body);
}

async function viewCareerFixtures(c) {
  const s = c.snapshot;
  const user = s.user_team;
  const T = (id) => s.teams[id] || { name: "?" };
  const comps = s.competitions.filter((x) => s.fixtures.some((f) => f.comp === x.id));
  const fx = s.fixtures.filter((f) => state.fxFilter === "all" || String(f.comp) === state.fxFilter);
  const byMonth = new Map();
  fx.forEach((f) => { const k = f.date.slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(f); });
  const MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const sections = [...byMonth.entries()].map(([k, list]) => {
    const [y, m] = k.split("-");
    const rows = list.map((f) => {
      const res = resultOf(f, user);
      const comp = compById(s, f.comp);
      return `<tr class="${f.played ? "" : "upcoming"}"><td class="muted">${fmtDate(f.date, { day: true })}</td><td class="muted hide-sm">${esc(f.time)}</td>
        <td><span class="chip">${compIcon(comp || {})} ${esc(comp?.name || "")}</span></td>
        <td style="text-align:right"><div class="team" style="justify-content:flex-end;${f.home === user ? "font-weight:700" : ""}">${esc(T(f.home).name)}${crest(T(f.home), "crest sm")}</div></td>
        <td class="num">${f.played ? `<span class="score-pill ${res}">${f.hg}–${f.ag}</span>${f.hp != null ? `<div class="muted small">(${f.hp}–${f.ap} pen.)</div>` : ""}` : '<span class="score-pill N">vs</span>'}</td>
        <td><div class="team" style="${f.away === user ? "font-weight:700" : ""}">${crest(T(f.away), "crest sm")}${esc(T(f.away).name)}</div></td></tr>`;
    }).join("");
    return `<section class="panel" style="margin-bottom:14px"><div class="panel-h"><h3>${MES[+m - 1]} ${y}</h3><span class="right">${list.length} partidos</span></div><div class="table-wrap"><table class="tbl"><tbody>${rows}</tbody></table></div></section>`;
  }).join("");
  const body = `<div class="toolbar"><div class="seg"><button data-act="fxf" data-v="all" class="${state.fxFilter === "all" ? "on" : ""}">Todas</button>${comps.map((x) => `<button data-act="fxf" data-v="${x.id}" class="${state.fxFilter === String(x.id) ? "on" : ""}">${esc(x.name)}</button>`).join("")}</div></div>${sections || '<div class="panel empty">Sin partidos.</div>'}`;
  $app.innerHTML = careerFrame(c, "partidos", body);
}

function tableHtml(s, g, comp) {
  const user = s.user_team;
  const T = (id) => s.teams[id] || { name: "?" };
  const n = g.table.length;
  const zone = (i) => {
    if (!comp.league || comp.code !== 13) return "";
    if (i < 4) return "zone-ucl"; if (i < 6) return "zone-uel"; if (i >= n - 3) return "zone-rel"; return "";
  };
  const rows = g.table.map((r, i) => `<tr class="${r.team === user ? "me" : ""} ${zone(i)}"><td class="pos-num">${i + 1}</td><td><div class="team">${crest(T(r.team), "crest sm")}${esc(T(r.team).name)}</div></td><td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td><td class="num hide-sm">${r.gf}</td><td class="num hide-sm">${r.ga}</td><td class="num">${r.gd > 0 ? "+" : ""}${r.gd}</td><td class="num pts">${r.pts}</td></tr>`).join("");
  return `<table class="tbl"><thead><tr><th>#</th><th>Equipo</th><th class="num">PJ</th><th class="num">G</th><th class="num">E</th><th class="num">P</th><th class="num hide-sm">GF</th><th class="num hide-sm">GC</th><th class="num">DG</th><th class="num">Pts</th></tr></thead><tbody>${rows}</tbody></table>`;
}
async function viewCareerTables(c) {
  const s = c.snapshot;
  const T = (id) => s.teams[id] || { name: "?" };
  const parts = s.competitions.map((comp) => {
    const groups = comp.groups.filter((g) => g.table.length > 2);
    const ko = comp.groups.filter((g) => g.table.length === 2);
    const tables = groups.map((g) => `<div class="panel-h" style="background:none"><span class="kicker">${esc(g.stage)}</span></div><div class="table-wrap">${tableHtml(s, g, comp)}</div>`).join("");
    const ties = ko.map((g) => {
      const [a, b] = g.table;
      return `<div class="comp-row"><span class="kicker" style="width:130px">${esc(g.stage)}</span><div class="team" style="flex:1">${crest(T(a.team), "crest sm")}${esc(T(a.team).name)} <span class="muted">vs</span> ${crest(T(b.team), "crest sm")}${esc(T(b.team).name)}</div></div>`;
    }).join("");
    if (!tables && !ties) return "";
    return `<section class="panel" style="margin-bottom:16px"><div class="panel-h"><div class="comp-ic">${compIcon(comp)}</div><h3>${esc(comp.name)}</h3><span class="right">${esc(compStatus(s, comp).text)}</span></div>${tables}${ties}</section>`;
  }).join("");
  const scorers = (s.scorers || []).map((p, i) => `<tr data-act="player" data-pid="${p.id}"><td class="pos-num">${i + 1}</td><td><div class="team">${photo(p)}<div>${esc(p.name)}<div class="muted small">${esc(T(p.team).name)}</div></div></div></td><td class="num pts">${p.goals}</td></tr>`).join("");
  const body = `<div class="grid cols-2"><div>${parts}</div><div><section class="panel"><div class="panel-h">${icon("star", "ic")}<h3>Pichichi de la liga</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Jugador</th><th class="num">Goles</th></tr></thead><tbody>${scorers || '<tr><td colspan="3" class="empty">Sin datos</td></tr>'}</tbody></table></div></section>
    <div class="muted small" style="margin-top:10px">🟦 Champions · 🟧 Europa League · 🟥 Descenso</div></div></div>`;
  $app.innerHTML = careerFrame(c, "competiciones", body);
}

async function viewCareerTransfers(c) {
  const s = c.snapshot;
  const T = (id) => s.teams[id] || { name: "" };
  const ins = s.squad.filter((p) => p.joined && p.joined >= s.season_start).sort((a, b) => b.joined.localeCompare(a.joined));
  const { data: outs } = await sb.from("posts").select("*").eq("career_id", c.id).eq("kind", "transfer_out").order("game_date", { ascending: false });
  const { data: allIns } = await sb.from("posts").select("*").eq("career_id", c.id).eq("kind", "transfer_in").order("game_date", { ascending: false });
  const row = (p, extra) => `<div class="career-card" data-act="player" data-pid="${p.id}">${photo(p)}<div style="flex:1;min-width:0"><div class="t">${esc(p.name)}</div><div class="s">${posChip(p.pos)} ${esc(p.age ?? "")} años${extra ? " · " + extra : ""}</div></div><span class="ovr">${esc(p.ovr ?? "")}</span></div>`;
  const histIns = (allIns || []).filter((x) => !ins.some((p) => p.id === x.data?.player?.id)).map((x) => row(x.data.player, fmtDate(x.game_date))).join("");
  const body = `<div class="grid cols-2-even">
    <section class="panel"><div class="panel-h">${icon("swap", "ic")}<h3>Altas ${esc(s.season)}</h3><span class="right">${ins.length}</span></div><div class="panel-b flush">${ins.map((p) => row(p, `${p.from ? "desde " + esc(T(p.from).name) + " · " : ""}${fmtDate(p.joined)}`)).join("") || '<div class="empty">Sin altas esta temporada.</div>'}</div>
      ${histIns ? `<div class="panel-h"><h3>Altas anteriores</h3></div><div class="panel-b flush">${histIns}</div>` : ""}</section>
    <section class="panel"><div class="panel-h">${icon("swap", "ic")}<h3>Bajas</h3><span class="right">${(outs || []).length}</span></div><div class="panel-b flush">${(outs || []).map((x) => row(x.data.player, fmtDate(x.game_date))).join("") || '<div class="empty">Las bajas aparecen cuando un jugador deja el club entre dos sincronizaciones.</div>'}</div></section>
  </div>`;
  $app.innerHTML = careerFrame(c, "fichajes", body);
}

async function viewCareerStats(c) {
  const s = c.snapshot;
  const stats = await loadStats(c);
  const sq = s.squad.map((p) => ({ ...p, st: stats.get(p.id) || {} }));
  const bars = (title, ic, list, fmt, valFn) => {
    const max = Math.max(1, ...list.map(valFn));
    return `<section class="panel"><div class="panel-h">${icon(ic, "ic")}<h3>${title}</h3></div><div class="panel-b"><div class="bars">${list.map((p) => `<div class="bar-row" data-act="player" data-pid="${p.id}" style="cursor:pointer"><div class="nm">${photo(p, "pphoto")}<span>${esc(p.short || p.name)}</span></div><div class="track"><div class="fill" style="width:${(valFn(p) / max) * 100}%"></div></div><b style="text-align:right">${fmt(p)}</b></div>`).join("") || '<div class="empty">Sin datos</div>'}</div></div></section>`;
  };
  const top = (fn, n = 8) => [...sq].filter((p) => fn(p) > 0).sort((a, b) => fn(b) - fn(a)).slice(0, n);
  const ratedL = [...sq].filter((p) => Number(p.st.apps || 0) >= 3).sort((a, b) => Number(b.st.avg_rating) - Number(a.st.avg_rating)).slice(0, 8);
  // nota media del equipo por partido (historial del tracker)
  const { data: pm } = await sb.from("player_matches").select("match_date,rating,minutes").eq("career_id", c.id).gte("match_date", s.season_start).gt("minutes", 0);
  const byDate = new Map();
  (pm || []).forEach((r) => { const a = byDate.get(r.match_date) || []; a.push(r.rating); byDate.set(r.match_date, a); });
  const series = [...byDate.entries()].sort().map(([d, a]) => [d, a.reduce((x, y) => x + y, 0) / a.length]);
  let chart = '<div class="empty">Sin datos todavía</div>';
  if (series.length > 1) {
    const W = 600, H = 150, min = 5, max = 8.5;
    const pts = series.map(([, v], i) => [20 + (i / (series.length - 1)) * (W - 40), H - 15 - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * (H - 30)]);
    chart = `<svg viewBox="0 0 ${W} ${H}" class="spark" style="height:170px"><defs><linearGradient id="g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      ${[6, 7, 8].map((v) => { const y = H - 15 - ((v - min) / (max - min)) * (H - 30); return `<line x1="20" x2="${W - 20}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="2" y="${y + 4}" fill="var(--muted)" font-size="10">${v}</text>`; }).join("")}
      <path d="M${pts[0][0]},${H - 15} ${pts.map((p) => `L${p[0]},${p[1]}`).join(" ")} L${pts[pts.length - 1][0]},${H - 15}Z" fill="url(#g1)"/>
      <polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
      ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--accent)"><title>${fmtDate(series[i][0])}: ${series[i][1].toFixed(2)}</title></circle>`).join("")}</svg>`;
  }
  const body = `
  <section class="panel" style="margin-bottom:16px"><div class="panel-h">${icon("chart", "ic")}<h3>Nota media del equipo por partido</h3><span class="right">${series.length} partidos registrados</span></div><div class="panel-b">${chart}</div></section>
  <div class="grid cols-2-even">
    ${bars("Goles en liga", "star", top((p) => p.league_goals || 0), (p) => p.league_goals, (p) => p.league_goals || 0)}
    ${bars("Mejor nota media (mín. 3 PJ)", "chart", ratedL, (p) => Number(p.st.avg_rating).toFixed(2), (p) => Number(p.st.avg_rating) - 4)}
    ${bars("Partidos jugados", "calendar", top((p) => Number(p.st.apps || 0)), (p) => p.st.apps, (p) => Number(p.st.apps || 0))}
    ${bars("Minutos", "history", top((p) => Number(p.st.minutes || 0)), (p) => p.st.minutes + "'", (p) => Number(p.st.minutes || 0))}
  </div>
  <div class="muted small" style="margin-top:12px">Los partidos, minutos y notas se acumulan con cada sincronización (el juego guarda las últimas 15 actuaciones de cada jugador).</div>`;
  $app.innerHTML = careerFrame(c, "estadisticas", body);
}

async function viewCareerHistory(c) {
  const seasons = await loadSeasons(c);
  const matches = await loadMatches(c);
  const user = c.snapshot.user_team;
  const rows = seasons.map((x) => {
    const d = x.data || {};
    const r = d.record || {};
    const lg = (d.comps || []).find((k) => k.league && k.pos);
    return `<tr><td><b>${esc(x.season)}</b></td><td><div class="team">${esc(x.team_name || "")}</div></td><td class="num">${lg ? lg.pos + "º" : "—"}</td><td class="num">${lg?.pts ?? "—"}</td><td class="num" style="color:var(--good)">${r.W ?? 0}</td><td class="num" style="color:var(--draw)">${r.D ?? 0}</td><td class="num" style="color:var(--bad)">${r.L ?? 0}</td><td class="num">${r.gf ?? 0}:${r.ga ?? 0}</td><td>${d.top_scorer ? `${esc(d.top_scorer.name)} (${d.top_scorer.goals})` : "—"}</td></tr>`;
  }).join("");
  // por club
  const byTeam = new Map();
  matches.filter((m) => m.played).forEach((m) => {
    const t = m.user_team;
    const name = t === m.home_id ? m.home_name : m.away_name;
    const crestUrl = t === m.home_id ? m.home_crest : m.away_crest;
    const o = byTeam.get(t) || { name, crest: crestUrl, p: 0, W: 0, D: 0, L: 0, from: m.season };
    const res = resultOf({ played: true, home: m.home_id, hg: m.hg, ag: m.ag, hp: m.hp, ap: m.ap }, t);
    o.p++; o[res]++; byTeam.set(t, o);
  });
  const clubs = [...byTeam.values()].map((o) => `<tr><td><div class="team">${crest({ name: o.name, crest: o.crest })}<div>${esc(o.name)}<div class="muted small">${esc(o.from)}–</div></div></div></td><td class="num">${o.p}</td><td class="num" style="color:var(--good)">${o.W}</td><td class="num" style="color:var(--draw)">${o.D}</td><td class="num" style="color:var(--bad)">${o.L}</td><td class="num">${o.p ? Math.round((o.W / o.p) * 100) : 0}%</td></tr>`).join("");
  const { data: trophies } = await sb.from("posts").select("*").eq("career_id", c.id).eq("kind", "trophy").order("game_date", { ascending: false });
  const body = `<div class="grid cols-2">
    <section class="panel"><div class="panel-h">${icon("history", "ic")}<h3>Temporadas</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Temporada</th><th>Club</th><th class="num">Liga</th><th class="num">Pts</th><th class="num">G</th><th class="num">E</th><th class="num">P</th><th class="num">Goles</th><th>Goleador</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="empty">Sin datos</td></tr>'}</tbody></table></div></section>
    <div class="stack">
      <section class="panel"><div class="panel-h">${icon("shield", "ic")}<h3>Clubes dirigidos</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Equipo</th><th class="num">PJ</th><th class="num">G</th><th class="num">E</th><th class="num">P</th><th class="num">%G</th></tr></thead><tbody>${clubs || '<tr><td colspan="6" class="empty">Sin datos</td></tr>'}</tbody></table></div></section>
      <section class="panel"><div class="panel-h">${icon("trophy", "ic")}<h3>Títulos conseguidos</h3></div><div class="panel-b">${(trophies || []).map((t) => `<div class="comp-row"><div class="comp-ic">🏆</div><div class="name">${esc(t.data?.comp_name || t.title)}</div><span class="muted">${fmtDate(t.game_date)}</span></div>`).join("") || '<div class="empty">Todavía ninguno. ¡A por ellos!</div>'}</div></section>
    </div></div>`;
  $app.innerHTML = careerFrame(c, "historial", body);
}

// ------------------------------------------------------------------ jugador (modal)
const ATTR_GROUPS = [
  ["Ataque", [["finishing", "Definición"], ["shotpower", "Potencia de tiro"], ["longshots", "Tiros lejanos"], ["volleys", "Voleas"], ["penalties", "Penales"], ["positioning", "Posicionamiento"], ["headingaccuracy", "Cabezazo"]]],
  ["Técnica y pase", [["ballcontrol", "Control"], ["dribbling", "Regate"], ["shortpassing", "Pase corto"], ["longpassing", "Pase largo"], ["crossing", "Centros"], ["curve", "Efecto"], ["freekickaccuracy", "Tiros libres"], ["vision", "Visión"]]],
  ["Físico y defensa", [["acceleration", "Aceleración"], ["sprintspeed", "Velocidad"], ["agility", "Agilidad"], ["balance", "Equilibrio"], ["stamina", "Resistencia"], ["strength", "Fuerza"], ["jumping", "Salto"], ["reactions", "Reacciones"], ["composure", "Compostura"], ["aggression", "Agresividad"], ["interceptions", "Intercepciones"], ["defensiveawareness", "Marcaje"], ["standingtackle", "Entrada de pie"], ["slidingtackle", "Barrida"]]],
];
const GK_GROUP = ["Portero", [["gkdiving", "Estirada"], ["gkhandling", "Manejo"], ["gkkicking", "Saque"], ["gkpositioning", "Colocación"], ["gkreflexes", "Reflejos"], ["reactions", "Reacciones"], ["composure", "Compostura"]]];
const fm = (v) => Math.max(1, Math.min(20, Math.round((v || 0) / 5)));
const fmCls = (v) => (v >= 18 ? "a5" : v >= 15 ? "a4" : v >= 11 ? "a3" : v >= 6 ? "a2" : "a1");

async function openPlayer(pid) {
  const c = state.career;
  if (!c) return;
  const s = c.snapshot;
  const p = s.squad.find((x) => x.id === pid) || (s.scorers || []).find((x) => x.id === pid);
  if (!p) return;
  const stats = await loadStats(c);
  const st = stats.get(pid) || {};
  const groups = p.pos === "POR" ? [GK_GROUP, ATTR_GROUPS[1], ATTR_GROUPS[2]] : ATTR_GROUPS;
  const attrs = p.attrs ? groups.map(([g, list]) => `<div><h4>${g}</h4>${list.map(([k, n]) => { const v = fm(p.attrs[k]); return `<div class="attr"><span>${n}</span><b class="${fmCls(v)}" title="${p.attrs[k] ?? ""}">${v}</b></div>`; }).join("")}</div>`).join("") : "";
  const { data: hist } = await sb.from("player_matches").select("*").eq("career_id", c.id).eq("player_id", pid).order("match_date", { ascending: false }).limit(15);
  const T = (id) => s.teams[id] || { name: "" };
  const fxByDate = new Map(s.fixtures.map((f) => [f.date, f]));
  const histRows = (hist || []).map((h) => {
    const f = fxByDate.get(h.match_date);
    const opp = f ? T(f.home === s.user_team ? f.away : f.home) : null;
    return `<tr><td class="muted">${fmtDate(h.match_date, { short: true })}</td><td>${opp ? `<div class="team">${crest(opp, "crest sm")}${esc(opp.name)}</div>` : '<span class="muted">—</span>'}</td><td>${f?.played ? `<span class="score-pill ${resultOf(f, s.user_team)}">${f.hg}–${f.ag}</span>` : ""}</td><td>${posChip(h.position)}</td><td class="num">${h.minutes}'</td><td class="num">${ratingChip(h.rating)}</td></tr>`;
  }).join("");
  const team = T(s.user_team);
  document.getElementById("modal-root").innerHTML = `
  <div class="modal-bg" data-act="close-modal"><div class="modal" role="dialog" aria-modal="true">
    <button class="modal-close" data-act="close-modal" aria-label="Cerrar">✕</button>
    <div class="ph">${photo(p)}<div><div class="kicker">${esc(team.name)} · #${esc(p.jersey ?? "")}</div><h2>${esc(p.name)}</h2>
      <div class="facts">${p.pos ? posChip(p.pos) : ""}${(p.pos2 || []).map(posChip).join(" ")}<span>${esc(p.age ?? "?")} años</span>${p.height ? `<span>${p.height} cm</span>` : ""}${p.foot ? `<span>Pie ${esc(p.foot)}</span>` : ""}${p.contract ? `<span>Contrato hasta ${p.contract}</span>` : ""}${p.joined ? `<span>En el club desde ${fmtDate(p.joined)}</span>` : ""}</div></div>
      <div class="ovr-box"><div><b>${esc(p.ovr ?? "-")}</b><span>Media</span></div><div><b style="color:var(--muted)">${esc(p.pot ?? "-")}</b><span>Potencial</span></div></div></div>
    <div class="kpis" style="padding:16px 22px 0"><div class="kpi"><b>${st.apps ?? 0}</b><span>Partidos</span></div><div class="kpi"><b>${st.minutes ?? 0}</b><span>Minutos</span></div><div class="kpi"><b>${st.avg_rating ? Number(st.avg_rating).toFixed(2) : "—"}</b><span>Nota media</span></div><div class="kpi"><b>${p.league_goals ?? p.goals ?? 0}</b><span>Goles en liga</span></div></div>
    ${attrs ? `<div class="attrs">${attrs}</div><div class="muted small" style="padding:0 22px 6px">Atributos en escala 1–20 al estilo Football Manager (pasá el mouse para ver el valor de FC).</div>` : ""}
    ${histRows ? `<div style="padding:10px 22px 22px"><h4 style="font-family:var(--display);text-transform:uppercase;letter-spacing:.6px;margin:8px 0">Últimos partidos</h4><div class="table-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Rival</th><th>Res.</th><th>Pos</th><th class="num">Min</th><th class="num">Nota</th></tr></thead><tbody>${histRows}</tbody></table></div></div>` : ""}
  </div></div>`;
}

// ------------------------------------------------------------------ conectar / perfil / post
function viewConnect() {
  applyTheme(null);
  const body = `<div class="grid cols-2">
    <section class="panel"><div class="panel-h">${icon("download", "ic")}<h3>Conectá tu EA SPORTS FC 27</h3></div>
      <div class="panel-b">
        <div class="download" style="margin-bottom:20px"><div style="font-size:40px">💾</div><div><b style="font-size:16px">FC Tracker Sync para Windows</b><div class="muted">Programa liviano que lee tu guardado de Modo Carrera. No toca el juego ni el antitrampas.</div></div><button class="btn primary" style="margin-left:auto" data-act="download">Descargar</button></div>
        <ol class="steps">
          <li><b>Descargá y abrí</b> <code>FCTrackerSync.exe</code>. Si Windows muestra "Windows protegió su PC", tocá <i>Más información → Ejecutar de todas formas</i> (el programa no está firmado).</li>
          <li><b>Ingresá con tu usuario y contraseña</b> de esta web. Solo se pide la primera vez.</li>
          <li><b>Dejalo abierto y jugá</b> tu Modo Carrera de Mánager en PC. Cada vez que el juego guarde (autoguardado o manual), tu carrera se actualiza acá en segundos.</li>
          <li>Tus amigos ven tus resultados, tablas y fichajes, y pueden <b>comentar y reaccionar</b> en las publicaciones de tu club.</li>
        </ol>
      </div></section>
    <section class="panel"><div class="panel-h">${icon("live", "ic")}<h3>¿Qué se sincroniza?</h3></div><div class="panel-b">
      <div class="comp-row"><div class="comp-ic">⚽</div><div class="name">Resultados y calendario de todas las competiciones</div></div>
      <div class="comp-row"><div class="comp-ic">📊</div><div class="name">Tablas de posiciones y fases de grupos</div></div>
      <div class="comp-row"><div class="comp-ic">👥</div><div class="name">Plantilla, medias, potencial, atributos y contratos</div></div>
      <div class="comp-row"><div class="comp-ic">⭐</div><div class="name">Notas y minutos de cada partido</div></div>
      <div class="comp-row"><div class="comp-ic">✍️</div><div class="name">Fichajes y bajas</div></div>
      <div class="comp-row"><div class="comp-ic">🏆</div><div class="name">Títulos conseguidos</div></div>
      <div class="muted small" style="margin-top:12px">Requisitos: Windows 10/11 y EA SPORTS FC 27 en PC (EA app o Steam). Solo Modo Carrera de Mánager.</div>
    </div></section>
  </div>`;
  $app.innerHTML = shell({ title: "Conectar mi juego", body, active: "conectar" });
}

function viewProfile() {
  applyTheme(null);
  const me = state.me || {};
  const mine = state.careers.filter((c) => c.owner === me.id);
  const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#ec4899", "#eab308"];
  const body = `<div class="grid cols-2-even">
    <section class="panel"><div class="panel-h">${icon("user", "ic")}<h3>Mi perfil</h3></div><form class="panel-b" id="profile-form">
      <div style="display:flex;gap:14px;align-items:center">${avatar(me, 56)}<div><b style="font-size:17px">${esc(me.display_name)}</b><div class="muted">@${esc(me.username)}</div></div></div>
      <label class="field"><span>Nombre para mostrar</span><input class="input" name="display" value="${esc(me.display_name)}" maxlength="40" required></label>
      <label class="field"><span>Color</span><div style="display:flex;gap:8px;flex-wrap:wrap">${colors.map((c) => `<label style="cursor:pointer"><input type="radio" name="color" value="${c}" ${me.color === c ? "checked" : ""} style="display:none"><span style="display:block;width:30px;height:30px;border-radius:50%;background:${c};outline:${me.color === c ? "3px solid #fff" : "none"};outline-offset:2px"></span></label>`).join("")}</div></label>
      <button class="btn primary" style="margin-top:16px">Guardar</button>
      <button class="btn danger" type="button" data-act="logout" style="margin-top:16px;margin-left:8px">Cerrar sesión</button>
    </form></section>
    <section class="panel"><div class="panel-h">${icon("shield", "ic")}<h3>Mis carreras</h3></div><div class="panel-b">
      ${mine.map((c) => `<div class="comp-row" style="padding-left:0;padding-right:0">${crest(careerTeam(c))}<div class="name"><input class="input" data-career-title="${c.id}" value="${esc(c.title || "")}" maxlength="60"></div><button class="btn" data-act="save-title" data-id="${c.id}">Guardar</button><button class="btn danger" data-act="del-career" data-id="${c.id}" title="Borrar carrera">🗑</button></div>`).join("") || '<div class="empty">Conectá tu juego para crear tu primera carrera.</div>'}
    </div></section></div>`;
  $app.innerHTML = shell({ title: "Perfil", body, active: "perfil" });
  const f = document.getElementById("profile-form");
  f.onchange = () => f.querySelectorAll("input[name=color]").forEach((r) => { r.nextElementSibling.style.outline = r.checked ? "3px solid #fff" : "none"; });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const { error } = await sb.from("profiles").update({ display_name: String(fd.get("display")).trim(), color: fd.get("color") || me.color }).eq("id", me.id);
    if (error) return toast("No se pudo guardar");
    await loadBase(); toast("Perfil guardado"); viewProfile();
  };
}

async function viewPost(id) {
  const { data: p } = await sb.from("posts").select(POST_SELECT).eq("id", id).maybeSingle();
  if (!p) { $app.innerHTML = shell({ title: "Publicación", body: '<div class="panel empty">No existe.</div>' }); return; }
  await loadCareer(p.career_id);
  await loadSocial([p.id]);
  state.singlePost = p;
  state.openComments.add(p.id);
  const team = state.career.snapshot.teams[state.career.snapshot.user_team];
  applyTheme(team);
  $app.innerHTML = shell({ title: "Publicación", crumbs: `<a href="#/c/${p.career_id}/noticias">← Volver a ${esc(team?.name || "")}</a>`, body: `<div style="max-width:720px">${postHtml(p, { expanded: true })}</div>` });
}

// ------------------------------------------------------------------ eventos
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) {
    document.querySelectorAll(".emoji-pop").forEach((x) => x.remove());
    return;
  }
  const act = el.dataset.act;
  if (act === "close-modal") {
    if (e.target === el || el.classList.contains("modal-close")) document.getElementById("modal-root").innerHTML = "";
    return;
  }
  if (act === "player") { openPlayer(Number(el.dataset.pid)); return; }
  if (act === "sort") {
    const k = el.dataset.key;
    state.squadSort = { key: k, dir: state.squadSort.key === k ? -state.squadSort.dir : (["name", "pos", "jersey", "age", "role", "contract"].includes(k) ? 1 : -1) };
    viewCareerSquad(state.career); return;
  }
  if (act === "fxf") { state.fxFilter = el.dataset.v; viewCareerFixtures(state.career); return; }
  if (act === "more") { el.disabled = true; await loadFeed(state.feed.scope, true); route(true); return; }
  if (act === "comments") {
    const id = el.dataset.post;
    state.openComments.has(id) ? state.openComments.delete(id) : state.openComments.add(id);
    rerenderPost(id);
    document.querySelector(`[data-post-id="${id}"] textarea`)?.focus();
    return;
  }
  if (act === "share") {
    const url = `${location.origin}${location.pathname}#/p/${el.dataset.post}`;
    try { await navigator.clipboard.writeText(url); toast("Enlace copiado"); } catch { prompt("Copiá el enlace:", url); }
    return;
  }
  if (act === "react") {
    document.querySelectorAll(".emoji-pop").forEach((x) => x.remove());
    const pop = document.createElement("div");
    pop.className = "emoji-pop";
    pop.innerHTML = EMOJIS.map((em) => `<button data-act="toggle-react" data-post="${el.dataset.post}" data-emoji="${em}">${em}</button>`).join("");
    const r = el.getBoundingClientRect();
    pop.style.left = `${r.left + window.scrollX}px`;
    pop.style.top = `${r.top + window.scrollY - 52}px`;
    document.body.append(pop);
    return;
  }
  if (act === "toggle-react") {
    document.querySelectorAll(".emoji-pop").forEach((x) => x.remove());
    const id = el.dataset.post, emoji = el.dataset.emoji;
    const list = state.reactions.get(id) || [];
    const has = list.find((r) => r.user_id === state.me.id && r.emoji === emoji);
    if (has) {
      state.reactions.set(id, list.filter((r) => r !== has));
      await sb.from("reactions").delete().match({ post_id: id, user_id: state.me.id, emoji });
    } else {
      const row = { post_id: id, user_id: state.me.id, emoji };
      list.push(row); state.reactions.set(id, list);
      await sb.from("reactions").insert(row);
    }
    rerenderPost(id); return;
  }
  if (act === "del-comment") {
    const { error } = await sb.from("comments").delete().eq("id", el.dataset.id);
    if (!error) { state.comments.set(el.dataset.post, (state.comments.get(el.dataset.post) || []).filter((x) => x.id !== el.dataset.id)); rerenderPost(el.dataset.post); }
    return;
  }
  if (act === "logout") { await sb.auth.signOut(); location.hash = "#/login"; return; }
  if (act === "save-title") {
    const v = document.querySelector(`[data-career-title="${el.dataset.id}"]`).value.trim();
    const { error } = await sb.from("careers").update({ title: v }).eq("id", el.dataset.id);
    toast(error ? "No se pudo guardar" : "Guardado"); await loadBase(); return;
  }
  if (act === "del-career") {
    if (!confirm("¿Borrar esta carrera y todas sus publicaciones? No se puede deshacer.")) return;
    await sb.from("careers").delete().eq("id", el.dataset.id);
    await loadBase(); toast("Carrera borrada"); viewProfile(); return;
  }
  if (act === "download") {
    const { data, error } = await sb.storage.from("downloads").createSignedUrl("FCTrackerSync.exe", 600, { download: true });
    if (error || !data) return toast("La descarga todavía no está disponible");
    location.href = data.signedUrl; return;
  }
});
document.addEventListener("submit", async (e) => {
  const f = e.target.closest(".comment-form");
  if (!f) return;
  e.preventDefault();
  const ta = f.querySelector("textarea");
  const body = ta.value.trim();
  if (!body) return;
  ta.disabled = true;
  const { data, error } = await sb.from("comments").insert({ post_id: f.dataset.post, author: state.me.id, body }).select().single();
  if (error) { toast("No se pudo comentar"); ta.disabled = false; return; }
  const list = state.comments.get(f.dataset.post) || [];
  if (!list.some((x) => x.id === data.id)) list.push(data);
  state.comments.set(f.dataset.post, list);
  rerenderPost(f.dataset.post);
  document.querySelector(`[data-post-id="${f.dataset.post}"] textarea`)?.focus();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.getElementById("modal-root").innerHTML = "";
  if (e.key === "Enter" && !e.shiftKey && e.target.matches(".comment-form textarea")) { e.preventDefault(); e.target.form.requestSubmit(); }
});

// realtime: comentarios, reacciones y publicaciones nuevas
function realtime() {
  sb.channel("social")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, ({ new: c }) => {
      if (!state.comments.has(c.post_id)) return;
      const list = state.comments.get(c.post_id);
      if (!list.some((x) => x.id === c.id)) { list.push(c); rerenderPost(c.post_id); }
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions" }, ({ new: r }) => {
      if (!state.reactions.has(r.post_id) || r.user_id === state.me?.id) return;
      state.reactions.get(r.post_id).push(r); rerenderPost(r.post_id);
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => { state.pendingPosts = true; })
    .subscribe();
}

// ------------------------------------------------------------------ router
async function route(keepScroll) {
  const hash = location.hash || "#/";
  const parts = hash.slice(2).split("/").filter(Boolean);
  if (!state.session) { if (parts[0] !== "registro") return viewAuth("login"); return viewAuth("registro"); }
  if (parts[0] === "login" || parts[0] === "registro") { location.hash = "#/"; return; }
  document.getElementById("modal-root").innerHTML = "";
  state.singlePost = null;
  const y = window.scrollY;
  try {
    if (!parts.length) await viewHome();
    else if (parts[0] === "c") {
      const c = await loadCareer(parts[1]);
      if (!c.snapshot) { $app.innerHTML = shell({ title: esc(c.team_name || "Carrera"), body: '<div class="panel empty">Esta carrera todavía no tiene datos.</div>' }); return; }
      const tab = parts[2] || "";
      const views = { "": viewCareerOverview, noticias: viewCareerNews, plantilla: viewCareerSquad, partidos: viewCareerFixtures, competiciones: viewCareerTables, fichajes: viewCareerTransfers, estadisticas: viewCareerStats, historial: viewCareerHistory };
      await (views[tab] || viewCareerOverview)(c);
    } else if (parts[0] === "p") await viewPost(parts[1]);
    else if (parts[0] === "conectar") viewConnect();
    else if (parts[0] === "perfil") viewProfile();
    else if (parts[0] === "carreras") viewCareersList();
    else await viewHome();
  } catch (err) {
    console.error(err);
    $app.innerHTML = shell({ title: "Ups", body: `<div class="panel empty">${esc(err.message || "Algo salió mal")}</div>` });
  }
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
}

window.addEventListener("hashchange", () => {
  if (!location.hash.startsWith("#/c/") || state.career?.id !== location.hash.split("/")[2]) { state.fxFilter = "all"; }
  if (location.hash.startsWith("#/c/") && state.career && state.career.id !== location.hash.split("/")[2]) state.career = null;
  route();
});

(async function init() {
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  sb.auth.onAuthStateChange(async (ev, session) => {
    const had = !!state.session;
    state.session = session;
    if (ev === "SIGNED_IN" && !had) { await loadBase(); realtime(); route(); }
    if (ev === "SIGNED_OUT") { state.me = null; route(); }
  });
  if (state.session) { await loadBase(); realtime(); }
  route();
  // refresco suave cada 60s si hay datos nuevos
  setInterval(async () => {
    if (!state.session || document.hidden || document.getElementById("modal-root").innerHTML) return;
    if (state.pendingPosts) {
      state.pendingPosts = false;
      await loadBase();
      if (state.career) { const id = state.career.id; state.career = null; await loadCareer(id); }
      route(true);
    }
  }, 60000);
})();
