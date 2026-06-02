import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChefHat, Crown, ShieldCheck, Trash2 } from "lucide-react";

const SUPERADMIN_EMAIL = "imperium1886@gmail.com";

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [counts, setCounts] = useState({ favs: 0, hidden: 0, mine: 0, requests: 0 });
  const [showAdminScreen, setShowAdminScreen] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [grantEmail, setGrantEmail] = useState("");

  const isSuperadmin = user?.email?.toLowerCase() === SUPERADMIN_EMAIL;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("display_name,group_name").eq("id", user.id).maybeSingle();
      setName(p?.display_name ?? "");
      setGroupName((p as any)?.group_name ?? "");
      const [f, h, m, r] = await Promise.all([
        supabase.from("favorites").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("hidden_recipes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("recipes").select("*", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("deletion_requests").select("*", { count: "exact", head: true }).eq("requester_id", user.id),
      ]);
      setCounts({ favs: f.count ?? 0, hidden: h.count ?? 0, mine: m.count ?? 0, requests: r.count ?? 0 });
    })();
  }, [user]);

  const loadAdmins = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (!ids.length) { setAdmins([]); return; }
    const { data: profs } = await supabase.from("profiles").select("id,display_name,email").in("id", ids);
    setAdmins(profs ?? []);
  };

  useEffect(() => { if (showAdminScreen && isSuperadmin) loadAdmins(); }, [showAdminScreen, isSuperadmin]);

  const save = async () => {
    if (!user) return;
    const gn = groupName.trim().slice(0, 60);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim().slice(0, 80), group_name: gn || null }).eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profil aktualisiert");
  };

  const grantAdmin = async () => {
    const email = grantEmail.trim().toLowerCase();
    if (!email) return;
    const { data: prof } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!prof) { toast.error("Nutzer nicht gefunden"); return; }
    const { error } = await supabase.from("user_roles").insert({ user_id: prof.id, role: "admin" });
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
        <div>
          <Label>Gruppenname (Inventar &amp; Einkauf werden mit allen Personen geteilt, die exakt diesen Gruppennamen tragen)</Label>
          <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={60} placeholder="z. B. Haushalt Meier" className="bg-background/60" />
        </div>
        <Button onClick={save} className="bg-gold text-gold-foreground hover:bg-gold-soft">Speichern</Button>
        {isAdmin && <p className="text-sm text-gold flex items-center gap-1"><Crown className="w-4 h-4" /> Du hast Admin-Rechte</p>}
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
