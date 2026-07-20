import { CheckCircle2, Cloud, ExternalLink, LogOut, Mail, Save, ShieldCheck, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { normalizeHandle, validateHandle } from "../lib/profile";

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
      <path fill="#34a853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#fbbc05" d="M6.4 14a6 6 0 0 1 0-3.9V7.3H3a10 10 0 0 0 0 9.4L6.4 14Z" />
      <path fill="#ea4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9 5.3L6.4 10A6 6 0 0 1 12 5.9Z" />
    </svg>
  );
}

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const { configured, loading, user, profile, signInWithGoogle, sendMagicLink, updateProfile, signOut, deleteAccount } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string }>();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setHandle(profile?.handle ?? "");
  }, [profile]);

  useEffect(() => {
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(undefined);
    try { await action(); }
    catch (reason) {
      const raw = reason instanceof Error ? reason.message : "The account request failed.";
      setMessage({ kind: "error", text: raw.includes("profiles_handle_lower_idx") ? "That handle is already taken." : raw });
    } finally { setBusy(false); }
  };

  const submitEmail = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await sendMagicLink(email);
      setMessage({ kind: "success", text: "Check your inbox for the secure sign-in link." });
    });
  };

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeHandle(handle);
    const handleError = validateHandle(normalized);
    if (handleError) {
      setMessage({ kind: "error", text: handleError });
      return;
    }
    void run(async () => {
      await updateProfile({ displayName, handle: normalized || null });
      setHandle(normalized);
      setMessage({ kind: "success", text: "Profile saved and synced." });
    });
  };

  const provider = user?.app_metadata.provider === "google" ? "Google" : "Email";

  return (
    <div className="modal-backdrop account-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <header>
          <div><span className="dialog-icon"><UserRound /></span><div><h2 id="account-title">Trader profile</h2><p>One identity, private paper data, every device.</p></div></div>
          <button ref={closeButton} className="dialog-close" onClick={onClose} aria-label="Close account"><X /></button>
        </header>

        {loading ? <div className="account-loading"><Cloud className="spinning" /><span>Loading secure profile…</span></div> : null}

        {!loading && !configured ? (
          <div className="account-unconfigured">
            <Cloud /><h3>Cloud profiles need one connection</h3>
            <p>The app is ready for Google and magic-link email login. The project owner still needs to connect a free Supabase project; guest paper trading remains local and private meanwhile.</p>
            <a href="https://github.com/daniel-techAI/CryptoFuck/blob/main/docs/auth-and-deployment.md" target="_blank" rel="noreferrer">Open the 10-minute setup <ExternalLink /></a>
          </div>
        ) : null}

        {!loading && configured && !user ? (
          <div className="signin-panel">
            <button className="google-button" disabled={busy} onClick={() => void run(signInWithGoogle)}><GoogleMark />Continue with Google</button>
            <div className="signin-divider"><span>or use any email</span></div>
            <form onSubmit={submitEmail}>
              <label htmlFor="signin-email">Email address</label>
              <div className="email-control"><Mail /><input id="signin-email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
              <button className="primary-button" disabled={busy || !email.trim()}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
            </form>
            <p className="account-privacy"><ShieldCheck /><span>No password is stored by NOCTURNE. Your email never appears on your public profile. <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">Privacy</a> · <a href={`${import.meta.env.BASE_URL}terms.html`} target="_blank" rel="noreferrer">Terms</a></span></p>
          </div>
        ) : null}

        {!loading && user ? (
          <form className="profile-form" onSubmit={saveProfile}>
            <div className="profile-identity">
              {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span>{(profile?.displayName || user.email || "N")[0].toUpperCase()}</span>}
              <div><strong>{profile?.displayName || "NOCTURNE trader"}</strong><small>{user.email}</small></div>
              <i><CheckCircle2 />{provider} linked</i>
            </div>
            <label>Display name<input maxLength={60} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
            <label>Public handle<div className="handle-control"><span>@</span><input maxLength={24} placeholder="night_trader" value={handle} onChange={(event) => setHandle(event.target.value)} /></div><small>Optional. Your email stays private.</small></label>
            <div className="profile-actions">
              <button type="button" className="secondary-button danger-button" disabled={busy} onClick={() => void run(async () => { await signOut(); onClose(); })}><LogOut />Sign out</button>
              <button className="primary-button" disabled={busy || !displayName.trim()}><Save />{busy ? "Saving…" : "Save profile"}</button>
            </div>
            <div className="profile-footnotes"><a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">Privacy</a><span>·</span><a href={`${import.meta.env.BASE_URL}terms.html`} target="_blank" rel="noreferrer">Terms</a><span>·</span><button type="button" disabled={busy} onClick={() => { if (window.confirm("Permanently delete this cloud profile and every synced paper trade? This cannot be undone.")) void run(async () => { await deleteAccount(); onClose(); }); }}>Delete cloud profile</button></div>
          </form>
        ) : null}

        {message ? <p className={`account-message ${message.kind}`} role="status">{message.text}</p> : null}
      </section>
    </div>
  );
}
