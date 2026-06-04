import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChefHat, Crown, ShieldCheck, Trash2, Users, Copy, RefreshCw, LogOut } from "lucide-react";

const SUPERADMIN_EMAIL = "imperium1886@gmail.com";

interface Group { id: string; name: string; owner_id: string; join_code: string; }

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [counts, setCounts] = useState({ favs: 0, hidden: 0, mine: 0, requests: 0 });
  const [showAdminScreen, setShowAdminScreen] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [grantEmail, setGrantEmail] = useState("");

  const [group, setGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<{ id: string; display_name: string | null }[]>([]);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");

  const isSuperadmin = user?.email?.toLowerCase() === SUPERADMIN_EMAIL;

  const loadGroup = async () => {
    if (!user) return;
    const { data: me } = await supabase.from("profiles").select("group_id").eq("id", user.id).maybeSingle();
    const gid = (me as any)?.group_id as string | null;
    if (!gid) { setGroup(null); setGroupMembers([]); return; }
    const { data: g } = await supabase.from("groups").select("id,name,owner_id").eq("id", gid).maybeSingle();
    let joinCode = "";
    if (g && (g as any).owner_id === user.id) {
      const { data: code } = await supabase.rpc("get_group_join_code", { _group_id: gid });
      joinCode = (code as string) ?? "";
    }
    setGroup(g ? ({ ...(g as any), join_code: joinCode } as Group) : null);
    const { data: mates } = await supabase.from("profiles").select("id,display_name").eq("group_id", gid);
    setGroupMembers((mates ?? []) as any);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      setName(p?.display_name ?? "");
      const [f, h, m, r] = await Promise.all([
        supabase.from("favorites").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("hidden_recipes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("recipes").select("*", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("deletion_requests").select("*", { count: "exact", head: true }).eq("requester_id", user.id),
      ]);
      setCounts({ favs: f.count ?? 0, hidden: h.count ?? 0, mine: m.count ?? 0, requests: r.count ?? 0 });
      loadGroup();
    })();
  }, [user]);

  const loadAdmins = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const ids = new Set((roles ?? []).map((r: any) => r.user_id));
    if (!ids.size) { setAdmins([]); return; }
    const { data: profs } = await supabase.rpc("admin_list_users");
    setAdmins((profs ?? []).filter((p: any) => ids.has(p.id)));
  };

  useEffect(() => { if (showAdminScreen && isSuperadmin) loadAdmins(); }, [showAdminScreen, isSuperadmin]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ display_name: name.trim().slice(0, 80) }).eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profil aktualisiert");
  };

  const createGroup = async () => {
    const nm = groupNameInput.trim();
    if (!nm) { toast.error("Name erforderlich"); return; }
    const { error } = await supabase.rpc("create_group", { _name: nm });
    if (error) toast.error(error.message);
    else { toast.success("Gruppe erstellt"); setGroupNameInput(""); loadGroup(); }
  };
  const joinGroup = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    const { error } = await supabase.rpc("join_group", { _code: code });
    if (error) toast.error("Beitrittscode ungültig");
    else { toast.success("Gruppe beigetreten"); setJoinCodeInput(""); loadGroup(); }
  };
  const leaveGroup = async () => {
    if (!confirm("Wollen Sie die Gruppe wirklich verlassen?")) return;
    const { error } = await supabase.rpc("leave_group");
    if (error) toast.error(error.message);
    else { toast.success("Gruppe verlassen"); loadGroup(); }
  };
  const regenCode = async () => {
    if (!group) return;
    const { data, error } = await supabase.rpc("regenerate_join_code", { _group_id: group.id });
    if (error) toast.error(error.message);
    else { toast.success("Neuer Code: " + data); loadGroup(); }
  };
  const copyCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.join_code);
    toast.success("Code kopiert");
  };

  const grantAdmin = async () => {
    const email = grantEmail.trim().toLowerCase();
    if (!email) return;
    const { data: uid } = await supabase.rpc("find_user_id_by_email", { _email: email });
    if (!uid) { toast.error("Nutzer nicht gefunden"); return; }
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (error && error.code !== "23505") toast.error(error.message);
    else { toast.success("Admin-Rolle vergeben"); setGrantEmail(""); loadAdmins(); }
  };

  const revokeAdmin = async (uid: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    if (error) toast.error("Superadmin-Schutz: Aktion blockiert.");
    else { toast.success("Admin-Rolle entzogen"); loadAdmins(); }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="imperial-heading text-3xl text-gold mb-6">Mein Profil</h1>
      <Card className="imperial-surface border-gold/30 p-6 mb-6 space-y-3">
        <div>
          <Label>Anzeigename</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="bg-background/60" />
        </div>
        <div>
          <Label>E-Mail</Label>
          <Input value={user?.email ?? ""} disabled className="bg-background/60" />
        </div>
        <Button onClick={save} className="bg-gold text-gold-foreground hover:bg-gold-soft">Speichern</Button>
        {isAdmin && <p className="text-sm text-gold flex items-center gap-1"><Crown className="w-4 h-4" /> Du hast Admin-Rechte</p>}
      </Card>

      {/* Gruppe per Beitrittscode */}
      <Card className="imperial-surface border-gold/30 p-6 mb-6">
        <h3 className="imperial-heading text-gold mb-3 flex items-center gap-2"><Users className="w-5 h-5" />Gruppe (Inventar &amp; Einkauf werden geteilt)</h3>
        {group ? (
          <div className="space-y-2">
            <p className="text-sm"><strong>{group.name}</strong></p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs">Beitrittscode:</span>
              <code className="bg-background/60 px-2 py-1 rounded font-mono text-sm">{group.join_code}</code>
              <Button size="sm" variant="outline" onClick={copyCode}><Copy className="w-3 h-3 mr-1" />Kopieren</Button>
              {group.owner_id === user?.id && (
                <Button size="sm" variant="outline" onClick={regenCode}><RefreshCw className="w-3 h-3 mr-1" />Code erneuern</Button>
              )}
              <Button size="sm" variant="destructive" onClick={leaveGroup}><LogOut className="w-3 h-3 mr-1" />Verlassen</Button>
            </div>
            {groupMembers.length > 0 && (
              <p className="text-xs text-surface-foreground/70">
                Mitglieder: {groupMembers.map((m) => m.display_name || m.id.slice(0, 6)).join(", ")}
              </p>
            )}
            <p className="text-xs text-surface-foreground/60">Teilen Sie den Code nur mit vertrauten Personen.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Neue Gruppe erstellen</Label>
              <div className="flex gap-2">
                <Input value={groupNameInput} onChange={(e) => setGroupNameInput(e.target.value)} placeholder="z. B. Haushalt Meier" className="bg-background/60" />
                <Button onClick={createGroup} variant="gold">Erstellen</Button>
              </div>
            </div>
            <div>
              <Label>Bestehender Gruppe beitreten</Label>
              <div className="flex gap-2">
                <Input value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())} placeholder="Beitrittscode" maxLength={20} className="bg-background/60 font-mono" />
                <Button onClick={joinGroup} variant="gold">Beitreten</Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Favoriten" value={counts.favs} to="/favorites" />
        <Stat label="Ausgeblendet" value={counts.hidden} />
        <Stat label="Eigene Rezepte" value={counts.mine} to="/my-recipes" icon={<ChefHat className="w-4 h-4" />} />
        <Stat label="Löschanträge" value={counts.requests} />
      </div>

      <Button variant="outline" className="border-gold/40 mb-4" onClick={() => navigate("/my-recipes")}>
        <ChefHat className="w-4 h-4 mr-1" /> Eigene Rezepte ansehen
      </Button>

      {isSuperadmin && (
        <Card className="imperial-surface border-gold/30 p-6">
          <Button variant="outline" className="border-gold/40 mb-3" onClick={() => setShowAdminScreen((v) => !v)}>
            <ShieldCheck className="w-4 h-4 mr-1" /> Adminrechte verwalten {showAdminScreen ? "(verbergen)" : ""}
          </Button>
          {showAdminScreen && (
            <div className="space-y-4">
              <div>
                <h3 className="imperial-heading text-gold mb-2">Aktuelle Admins</h3>
                <ul className="space-y-1">
                  {admins.map((a) => {
                    const isSuper = a.email?.toLowerCase() === SUPERADMIN_EMAIL;
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-2 px-2 py-1 bg-background/40 rounded">
                        <span className="text-sm text-surface-foreground">
                          {a.display_name ?? "—"} <span className="text-surface-foreground/50">({a.email})</span>
                          {isSuper && <span className="ml-1 text-gold">★ Superadmin</span>}
                        </span>
                        {!isSuper && (
                          <Button size="sm" variant="ghost" onClick={() => revokeAdmin(a.id)} className="text-destructive">
                            <Trash2 className="w-3 h-3 mr-1" /> Entziehen
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <Label>Neuen Admin per E-Mail vergeben</Label>
                <div className="flex gap-2">
                  <Input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="user@example.com" className="bg-background/60" />
                  <Button onClick={grantAdmin} className="bg-gold text-gold-foreground hover:bg-gold-soft">Vergeben</Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, to, icon }: { label: string; value: number; to?: string; icon?: React.ReactNode }) {
  const inner = (
    <Card className="imperial-surface border-gold/30 p-4 text-center hover:border-gold transition">
      <div className="imperial-heading text-3xl text-gold flex items-center justify-center gap-1">{icon}{value}</div>
      <div className="text-xs text-surface-foreground/70">{label}</div>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
