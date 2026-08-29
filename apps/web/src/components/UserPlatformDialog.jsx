import { useEffect, useState } from "react";
import {
  BarChart3,
  Clock3,
  Copy,
  FileCode2,
  FolderOpen,
  LogOut,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
  X
} from "lucide-react";

import {
  formatPlatformDate,
  userPlatformApi
} from "../utils/user-platform-api";

const EMPTY_DASHBOARD = {
  projectCount: 0,
  executionCount: 0,
  languages: {},
  recentProjects: [],
  recentHistory: []
};

function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", token: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    setForm((current) => ({ ...current, password: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        const result = await userPlatformApi.forgotPassword(form.email);
        setNotice(result.message);
        if (result.developmentResetToken) {
          setForm((current) => ({ ...current, token: result.developmentResetToken, password: "" }));
          setMode("reset");
          setNotice("Development reset token received. Enter and confirm your new password.");
        }
      } else if (mode === "reset") {
        const result = await userPlatformApi.resetPassword(form.token, form.password);
        setMode("login");
        setForm((current) => ({ ...current, password: "", token: "" }));
        setNotice(result.message);
      } else {
        const user = mode === "register"
          ? await userPlatformApi.register(form)
          : await userPlatformApi.login({ email: form.email, password: form.password });
        onAuthenticated(user);
      }
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="platform-auth-layout">
      <div className="platform-auth-promise">
        <span className="platform-eyebrow">YOUR CODEFLOW</span>
        <h2>Keep every learning session connected.</h2>
        <p>Save programs, revisit verified execution history, and continue from any project.</p>
        <div className="platform-feature-list">
          <span><FolderOpen size={16} /> Private saved projects</span>
          <span><Clock3 size={16} /> Execution history</span>
          <span><BarChart3 size={16} /> Personal dashboard</span>
        </div>
      </div>

      <form className="platform-auth-form" onSubmit={submit}>
        {(mode === "login" || mode === "register") ? (
          <div className="platform-auth-switch" role="tablist" aria-label="Authentication mode">
            <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => changeMode("login")}>Sign in</button>
            <button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => changeMode("register")}>Create account</button>
          </div>
        ) : (
          <div className="platform-auth-flow-heading">
            <span className="platform-eyebrow">ACCOUNT RECOVERY</span>
            <h3>{mode === "forgot" ? "Forgot your password?" : "Choose a new password"}</h3>
            <p>{mode === "forgot" ? "Enter the email used for your CodeFlow account." : "Reset tokens expire after 15 minutes and work only once."}</p>
          </div>
        )}

        {mode === "register" && (
          <label>
            <span>Name</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" required minLength={2} maxLength={80} />
          </label>
        )}
        {mode !== "reset" && (
          <label>
            <span>Email</span>
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" required />
          </label>
        )}
        {mode === "reset" && (
          <label>
            <span>Reset token</span>
            <input value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })} autoComplete="off" required />
          </label>
        )}
        {mode !== "forgot" && (
          <label>
            <span>{mode === "reset" ? "New password" : "Password"}</span>
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
          </label>
        )}
        {(mode === "register" || mode === "reset") && <small>Use uppercase, lowercase, a number, and at least 8 characters.</small>}
        {error && <div className="platform-inline-error" role="alert">{error}</div>}
        {notice && <div className="platform-form-message" role="status">{notice}</div>}
        <button className="platform-submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : mode === "forgot" ? "Create reset instruction" : mode === "reset" ? "Reset password" : "Sign in"}</button>
        <div className="platform-auth-links">
          {mode === "login" && <button type="button" onClick={() => changeMode("forgot")}>Forgot password?</button>}
          {mode === "login" && <span>Don&apos;t have an account? <button type="button" onClick={() => changeMode("register")}>Create account</button></span>}
          {mode === "register" && <span>Already have an account? <button type="button" onClick={() => changeMode("login")}>Sign in</button></span>}
          {(mode === "forgot" || mode === "reset") && <button type="button" onClick={() => changeMode("login")}>Back to sign in</button>}
        </div>
      </form>
    </div>
  );
}

function DashboardPanel({ dashboard }) {
  const topLanguage = Object.entries(dashboard.languages).sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="platform-dashboard">
      <div className="platform-stats">
        <article><FolderOpen size={18} /><span>Saved projects</span><strong>{dashboard.projectCount}</strong></article>
        <article><Clock3 size={18} /><span>Verified runs</span><strong>{dashboard.executionCount}</strong></article>
        <article><BarChart3 size={18} /><span>Top language</span><strong>{topLanguage?.[0] || "—"}</strong></article>
      </div>
      <div className="platform-dashboard-grid">
        <section>
          <h3>Recent projects</h3>
          {dashboard.recentProjects.length ? dashboard.recentProjects.map((project) => (
            <div className="platform-compact-row" key={project.id}>
              <FileCode2 size={15} /><span>{project.title}</span><small>{project.language}</small>
            </div>
          )) : <p className="platform-empty">Save your current code to create the first project.</p>}
        </section>
        <section>
          <h3>Recent executions</h3>
          {dashboard.recentHistory.length ? dashboard.recentHistory.map((item) => (
            <div className="platform-compact-row" key={item.id}>
              <Clock3 size={15} /><span>{item.language}</span><small>{item.eventCount} events</small>
            </div>
          )) : <p className="platform-empty">Signed-in executions will appear here.</p>}
        </section>
      </div>
    </div>
  );
}

function ProjectsPanel({ projects, language, source, onRefresh, onLoad }) {
  const [draft, setDraft] = useState({ title: "", description: "" });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function perform(action) {
    setBusy(true);
    setError("");
    try { await action(); await onRefresh(); }
    catch (actionError) { setError(actionError.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="platform-projects">
      <section className="platform-save-card">
        <div><span className="platform-eyebrow">CURRENT WORKSPACE</span><h3>Save this program</h3></div>
        <input placeholder="Project title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={100} />
        <input placeholder="Short description (optional)" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={500} />
        <button disabled={busy || !draft.title.trim()} onClick={() => perform(async () => {
          await userPlatformApi.createProject({ ...draft, language, source });
          setDraft({ title: "", description: "" });
        })}><Save size={15} /> Save project</button>
      </section>

      {error && <div className="platform-inline-error" role="alert">{error}</div>}
      <div className="platform-project-list">
        {projects.map((project) => (
          <article className="platform-project-card" key={project.id}>
            <div className="platform-project-icon"><FileCode2 size={18} /></div>
            <div className="platform-project-copy">
              {editing?.id === project.id ? (
                <div className="platform-rename-row">
                  <input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
                  <button onClick={() => perform(async () => {
                    await userPlatformApi.updateProject(project.id, { title: editing.title });
                    setEditing(null);
                  })}>Save</button>
                </div>
              ) : <h3>{project.title}</h3>}
              <p>{project.description || "No description"}</p>
              <span>{project.language} · Updated {formatPlatformDate(project.updatedAt)}</span>
            </div>
            <div className="platform-project-actions">
              <button onClick={() => onLoad(project)} title="Load project"><FolderOpen size={15} /></button>
              <button onClick={() => setEditing({ id: project.id, title: project.title })} title="Rename project"><Pencil size={15} /></button>
              <button onClick={() => perform(() => userPlatformApi.duplicateProject(project.id))} title="Duplicate project"><Copy size={15} /></button>
              <button className="is-danger" onClick={() => perform(() => userPlatformApi.deleteProject(project.id))} title="Delete project"><Trash2 size={15} /></button>
            </div>
          </article>
        ))}
        {!projects.length && <p className="platform-empty">No saved projects yet.</p>}
      </div>
    </div>
  );
}

function HistoryPanel({ history, onRefresh }) {
  return (
    <div className="platform-history">
      <div className="platform-section-heading">
        <div><span className="platform-eyebrow">VERIFIED RUNS</span><h3>Execution history</h3></div>
        {history.length > 0 && <button onClick={async () => { await userPlatformApi.clearHistory(); await onRefresh(); }}><Trash2 size={14} /> Clear history</button>}
      </div>
      {history.map((item) => (
        <article className="platform-history-row" key={item.id}>
          <span className={`platform-language-dot language-${item.language}`} />
          <div><strong>{item.language}</strong><p>{item.outputPreview || `${item.status} execution`}</p></div>
          <div><strong>{item.eventCount}</strong><small>events</small></div>
          <time>{formatPlatformDate(item.createdAt)}</time>
        </article>
      ))}
      {!history.length && <p className="platform-empty">Run code while signed in to build your history.</p>}
    </div>
  );
}

function ProfilePanel({ user, onUpdated }) {
  const [form, setForm] = useState({ name: user.name, bio: user.bio || "" });
  const [message, setMessage] = useState("");
  async function save(event) {
    event.preventDefault();
    try { onUpdated(await userPlatformApi.updateProfile(form)); setMessage("Profile updated."); }
    catch (error) { setMessage(error.message); }
  }
  return (
    <form className="platform-profile" onSubmit={save}>
      <div className="platform-profile-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
      <div><h3>{user.name}</h3><p>{user.email}</p></div>
      <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={80} /></label>
      <label><span>Bio</span><textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} maxLength={240} rows={4} /></label>
      {message && <div className="platform-form-message">{message}</div>}
      <button className="platform-submit"><Save size={15} /> Save profile</button>
    </form>
  );
}

export default function UserPlatformDialog({
  open,
  user,
  language,
  source,
  onClose,
  onUserChange,
  onLoadProject
}) {
  const [tab, setTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [projects, setProjects] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refreshData() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [nextDashboard, nextProjects, nextHistory] = await Promise.all([
        userPlatformApi.dashboard(),
        userPlatformApi.projects(),
        userPlatformApi.history()
      ]);
      setDashboard(nextDashboard);
      setProjects(nextProjects);
      setHistory(nextHistory);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && user) refreshData();
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  async function signOut() {
    try {
      await userPlatformApi.logout();
    } finally {
      onUserChange(null);
      setTab("dashboard");
    }
  }

  const tabs = [
    ["dashboard", BarChart3, "Dashboard"],
    ["projects", FolderOpen, "Projects"],
    ["history", Clock3, "History"],
    ["profile", UserRound, "Profile"]
  ];

  return (
    <div className="platform-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="platform-dialog" role="dialog" aria-modal="true" aria-label="CodeFlow user platform">
        <header className="platform-dialog-header">
          <div><div className="platform-dialog-mark"><UserRound size={18} /></div><div><strong>{user ? `Welcome, ${user.name.split(" ")[0]}` : "Your CodeFlow workspace"}</strong><span>{user ? "Projects, progress, and account" : "Sign in or create an account"}</span></div></div>
          <button onClick={onClose} aria-label="Close user platform"><X size={18} /></button>
        </header>

        {!user ? <AuthPanel onAuthenticated={onUserChange} /> : (
          <div className="platform-authenticated-layout">
            <nav className="platform-nav" aria-label="User platform sections">
              {tabs.map(([id, Icon, label]) => <button key={id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}><Icon size={16} /><span>{label}</span></button>)}
              <button className="platform-signout" onClick={signOut}><LogOut size={16} /><span>Sign out</span></button>
            </nav>
            <main className="platform-content">
              {loading && <div className="platform-loading">Refreshing your workspace…</div>}
              {error && <div className="platform-inline-error" role="alert">{error}</div>}
              {!loading && tab === "dashboard" && <DashboardPanel dashboard={dashboard} />}
              {!loading && tab === "projects" && <ProjectsPanel projects={projects} language={language} source={source} onRefresh={refreshData} onLoad={onLoadProject} />}
              {!loading && tab === "history" && <HistoryPanel history={history} onRefresh={refreshData} />}
              {!loading && tab === "profile" && <ProfilePanel user={user} onUpdated={onUserChange} />}
            </main>
          </div>
        )}
      </section>
    </div>
  );
}
