import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [counts, setCounts] = useState({ favs: 0, hidden: 0, mine: 0, requests: 0 });

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
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ display_name: name.trim().slice(0, 80) }).eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profil aktualisiert");
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
        {isAdmin && <p className="text-sm text-gold">★ Du hast Admin-Rechte</p>}
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Favoriten" value={counts.favs} to="/favorites" />
        <Stat label="Ausgeblendet" value={counts.hidden} />
        <Stat label="Eigene Rezepte" value={counts.mine} to="/recipes" />
        <Stat label="Löschanträge" value={counts.requests} />
      </div>
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: number; to?: string }) {
  const inner = (
    <Card className="imperial-surface border-gold/30 p-4 text-center hover:border-gold transition">
      <div className="imperial-heading text-3xl text-gold">{value}</div>
      <div className="text-xs text-surface-foreground/70">{label}</div>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
