import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "user" | "admin" | "superadmin" | "imperator";
export const ROLE_TIER: Record<Role, number> = { user: 1, admin: 2, superadmin: 3, imperator: 4 };

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);

  const fetchRoles = async (uid: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const list = (data ?? []).map((r: any) => r.role as Role);
    setRoles(list);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) setTimeout(() => fetchRoles(s.user.id), 0);
      else setRoles([]);
    });
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s); setUser(s?.user ?? null);
      if (s?.user) await fetchRoles(s.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const tier = roles.reduce((m, r) => Math.max(m, ROLE_TIER[r] ?? 1), 1);
  const isAdmin = tier >= 2;
  const isSuperadmin = tier >= 3;
  const isImperator = tier >= 4;

  return { session, user, loading, roles, tier, isAdmin, isSuperadmin, isImperator, refreshRoles: () => user && fetchRoles(user.id) };
}
