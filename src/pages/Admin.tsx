import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Eye, Crown, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const { isAdmin, user, loading } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [grantEmail, setGrantEmail] = useState("");

  const load = async () => {
    const [{ data: rq }, { data: rs }] = await Promise.all([
      supabase.from("deletion_requests").select("*, recipe:recipes(title), requester:profiles!deletion_requests_requester_id_fkey(display_name)").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("recipes").select("id,title,forced_visible").order("created_at", { ascending: false }).limit(50),
    ]);
    setRequests(rq ?? []);
    setRecipes(rs ?? []);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return <div className="p-8">Lade…</div>;
  if (!isAdmin) return <div className="container mx-auto p-8 text-center text-foreground/70">Kein Admin-Zugriff.</div>;

  const approve = async (req: any) => {
    await supabase.from("recipes").delete().eq("id", req.recipe_id);
    await supabase.from("deletion_requests").update({ status: "approved" }).eq("id", req.id);
    await supabase.from("chat_messages").insert({
      sender_id: user!.id, recipient_id: req.requester_id,
      content: `Dein Löschantrag wurde genehmigt. Rezept gelöscht.`,
    });
    toast.success("Genehmigt"); load();
  };
  const reject = async (req: any) => {
    await supabase.from("deletion_requests").update({ status: "rejected" }).eq("id", req.id);
    await supabase.from("chat_messages").insert({
      sender_id: user!.id, recipient_id: req.requester_id,
      content: `Dein Löschantrag wurde abgelehnt.`,
    });
    toast.success("Abgelehnt"); load();
  };
  const toggleForced = async (r: any) => {
    await supabase.from("recipes").update({ forced_visible: !r.forced_visible }).eq("id", r.id);
    load();
  };
  const grantAdmin = async () => {
    const email = grantEmail.trim().toLowerCase();
    if (!email) return;
    const { data: prof } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!prof) { toast.error("Nutzer nicht gefunden"); return; }
    const { error } = await supabase.from("user_roles").insert({ user_id: prof.id, role: "admin" });
    if (error && error.code !== "23505") toast.error(error.message);
    else { toast.success("Admin-Rolle vergeben"); setGrantEmail(""); }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-2 mb-6">
        <Crown className="w-7 h-7 text-gold" />
        <h1 className="imperial-heading text-3xl text-gold">Admin-Bereich</h1>
      </div>

      <Card className="imperial-surface border-gold/30 p-6 mb-6">
        <h2 className="imperial-heading text-xl text-gold mb-3">Löschanträge ({requests.length})</h2>
        {requests.length === 0 ? <p className="text-surface-foreground/60 text-sm">Keine offenen Anträge.</p> : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-2 bg-background/40 rounded">
                <div className="text-sm">
                  <Link to={`/recipes/${r.recipe_id}`} className="text-gold hover:underline">{r.recipe?.title}</Link>
                  <span className="text-surface-foreground/60"> — von {r.requester?.display_name ?? "?"}</span>
                  {r.reason && <div className="text-xs text-surface-foreground/60">„{r.reason}"</div>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => approve(r)}>Löschen</Button>
                  <Button size="sm" variant="outline" onClick={() => reject(r)}>Ablehnen</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="imperial-surface border-gold/30 p-6 mb-6">
        <h2 className="imperial-heading text-xl text-gold mb-3">Sichtbarkeit erzwingen</h2>
        <p className="text-xs text-surface-foreground/60 mb-3">Erzwingt, dass das Rezept für alle sichtbar bleibt (z. B. nicht durch Hide-Listen verdeckt).</p>
        <ul className="space-y-1 max-h-80 overflow-y-auto">
          {recipes.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-2 py-1 hover:bg-background/40 rounded">
              <Link to={`/recipes/${r.id}`} className="text-sm text-surface-foreground hover:text-gold truncate flex-1">{r.title}</Link>
              <Button size="sm" variant={r.forced_visible ? "default" : "outline"} onClick={() => toggleForced(r)} className={r.forced_visible ? "bg-gold text-gold-foreground" : ""}>
                <Eye className="w-3 h-3 mr-1" />{r.forced_visible ? "Erzwungen" : "Erzwingen"}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="imperial-surface border-gold/30 p-6">
        <h2 className="imperial-heading text-xl text-gold mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Admin-Rolle vergeben</h2>
        <div className="flex gap-2">
          <Input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="user@example.com" className="bg-background/60" />
          <Button onClick={grantAdmin} className="bg-gold text-gold-foreground hover:bg-gold-soft">Vergeben</Button>
        </div>
      </Card>
    </div>
  );
}
