import { Cloud, Download, LockKeyhole, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "../lib/profile";

export function AccountTab({ user, profile, configured, installed, onAccount, onInstall }: { user: User | null; profile: UserProfile | null; configured: boolean; installed: boolean; onAccount: () => void; onInstall: () => void }) {
  return (
    <main className="account-page">
      <header className="page-title"><div><h1>Account and installation</h1><p>Keep the market terminal available as an installable web app and optionally sync your paper profile.</p></div></header>
      <div className="account-tab-grid">
        <section className="account-card"><div className="account-card-icon"><UserRound /></div><h2>{user ? profile?.displayName || user.email || "Your profile" : "Profile and cloud sync"}</h2><p>{user ? "Your authenticated profile can sync private preferences and paper orders through row-level security." : configured ? "Sign in with Google or an email magic link to sync paper activity between devices." : "Guest paper trading works locally. Cloud sign-in becomes available after the owner connects Supabase."}</p><button className="primary-account-action" onClick={onAccount}>{user ? "Manage profile" : configured ? "Sign in" : "View connection status"}</button><span><LockKeyhole />No exchange keys are stored in the browser.</span></section>
        <section className="account-card"><div className="account-card-icon"><Download /></div><h2>{installed ? "NOCTURNE is installed" : "Install the live terminal"}</h2><p>Install the PWA from this browser for a standalone window. App assets update automatically; live market prices still require an internet connection.</p><button className="secondary-account-action" onClick={onInstall}>{installed ? "Installation details" : "Install app"}</button><span><Cloud />The same public Binance stream powers web and installed versions.</span></section>
      </div>
    </main>
  );
}
