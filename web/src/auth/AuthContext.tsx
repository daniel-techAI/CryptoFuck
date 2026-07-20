import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { mapProfile, type ProfileRow, type UserProfile } from "../lib/profile";
import { authRedirectUrl, getSupabaseClient, isCloudProfilesConfigured } from "../lib/supabase";

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  user: User | null;
  profile: UserProfile | null;
  signInWithGoogle: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  updateProfile: (input: { displayName: string; handle: string | null }) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isCloudProfilesConfigured);

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      return;
    }
    const client = await getSupabaseClient();
    if (!client) return;
    const { data, error } = await client.from("profiles").select("id, handle, display_name, avatar_url, created_at, updated_at").eq("id", user.id).single();
    if (error) throw error;
    setProfile(mapProfile(data as ProfileRow));
  }, []);

  useEffect(() => {
    if (!isCloudProfilesConfigured) return undefined;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void getSupabaseClient().then(async (client) => {
      if (!client || !active) return;
      const { data } = await client.auth.getSession();
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user ?? null).catch(() => setProfile(null));
      setLoading(false);
      const listener = client.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        window.setTimeout(() => {
          void loadProfile(nextSession?.user ?? null).catch(() => setProfile(null));
        }, 0);
      });
      unsubscribe = () => listener.data.subscription.unsubscribe();
    }).catch(() => setLoading(false));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    const client = await getSupabaseClient();
    if (!client) throw new Error("Cloud profiles are not configured yet.");
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectUrl() },
    });
    if (error) throw error;
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const client = await getSupabaseClient();
    if (!client) throw new Error("Cloud profiles are not configured yet.");
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true },
    });
    if (error) throw error;
  }, []);

  const updateProfile = useCallback(async (input: { displayName: string; handle: string | null }) => {
    if (!session?.user) throw new Error("Sign in before updating a profile.");
    const client = await getSupabaseClient();
    if (!client) throw new Error("Cloud profiles are not configured yet.");
    const { data, error } = await client.from("profiles").update({
      display_name: input.displayName.trim().slice(0, 60),
      handle: input.handle || null,
    }).eq("id", session.user.id).select("id, handle, display_name, avatar_url, created_at, updated_at").single();
    if (error) throw error;
    const nextProfile = mapProfile(data as ProfileRow);
    setProfile(nextProfile);
    return nextProfile;
  }, [session?.user]);

  const signOut = useCallback(async () => {
    const client = await getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    setSession(null);
    setProfile(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const client = await getSupabaseClient();
    if (!client || !session?.user) throw new Error("Sign in before deleting a profile.");
    const { error } = await client.rpc("delete_my_account");
    if (error) throw error;
    await client.auth.signOut({ scope: "local" });
    setSession(null);
    setProfile(null);
  }, [session?.user]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: isCloudProfilesConfigured,
    loading,
    user: session?.user ?? null,
    profile,
    signInWithGoogle,
    sendMagicLink,
    updateProfile,
    signOut,
    deleteAccount,
  }), [deleteAccount, loading, profile, sendMagicLink, session?.user, signInWithGoogle, signOut, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
