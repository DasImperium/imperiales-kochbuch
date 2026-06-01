import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_TIER, type Role } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Eye, Crown, ShieldCheck, RotateCcw, Copy, Lock } from "lucide-react";
import { toast } from "sonner";
import { restoreRecipe, purgeRecipe, TIER_COLOR, TIER_LABEL } from "@/lib/recipeAdmin";

interface UserRow { id: string; display_name: string | null; email: string | null; }

export default function Admin() {
  const { isAdmin, user, loading, tier, isImperator, refreshRoles } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [requestStatus, setRequestStatus] = useState<string>("pending");
  const [recipes, setRecipes] = useState<any[]>([]);
  const [tombstones, setTombstones] = useState<any[]>([]);
  const [tombFilter, setTombFilter] = useState<string>("all");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, Role[]>>({});
  const [grantEmail, setGrantEmail] = useState("");
  const [grantRole, setGrantRole] = useState<Role>("admin");

  const load = async () => {
    let rqQuery: any = supabase.from("deletion_requests")
      .select("*, recipe:recipes(title), requester:profiles!deletion_requests_requester_id_fkey(display_name)")
      .order("created_at", { ascending: false });
    if (requestStatus !== "all") rqQuery = rqQuery.eq("status", requestStatus);
    const [{ data: rq }, { data: rs }, { data: tomb }, { data: profs }, { data: rls }] = await Promise.all([
      rqQuery,
      supabase.from("recipes").select("id,title,forced_visible,protection_tier").is("deleted_at", null).order("created_at", { ascending: false }).limit(80),
      supabase.from("recipes").select("id,title,deleted_at,deleted_by_tier,deleted_by_user,protection_tier").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
      supabase.from("profiles").select("id,display_name,email").order("display_name"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    setRequests(rq ?? []);
    setRecipes(rs ?? []);
    setTombstones(tomb ?? []);
    setUsers((profs ?? []) as UserRow[]);
    const map: Record<string, Role[]> = {};
    (rls ?? []).forEach((r: any) => { (map[r.user_id] ??= []).push(r.role); });
    setUserRoles(map);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, requestStatus]);

  if (loading) return <div className="p-8">Lade…</div>;
  if (!isAdmin) return <div className="container mx-auto p-8 text-center text-foreground/70">Kein Admin-Zugriff.</div>;

  const approve = async (req: any) => {
    if (!user) return;
    await supabase.from("recipes").update({ deleted_at: new Date().toISOString(), deleted_by_user: user.id, deleted_by_tier: tier }).eq("id", req.recipe_id);
    await supabase.from("deletion_requests").update({ status: "approved" }).eq("id", req.id);
    await supabase.from("chat_messages").insert({
      sender_id: user.id, recipient_id: req.requester_id,
      content: `Dein Löschantrag wurde genehmigt. Rezept gelöscht.`,
    });
    toast.success("Genehmigt"); load();
  };
  const reject = async (req: any) => {
    if (!user) return;
    await supabase.from("deletion_requests").update({ status: "rejected" }).eq("id", req.id);
    await supabase.from("chat_messages").insert({
      sender_id: user.id, recipient_id: req.requester_id, content: `Dein Löschantrag wurde abgelehnt.`,
    });
    toast.success("Abgelehnt"); load();
  };
  const toggleForced = async (r: any) => {
    await supabase.from("recipes").update({ forced_visible: !r.forced_visible }).eq("id", r.id);
    load();
  };

  const grant = async () => {
    const email = grantEmail.trim().toLowerCase();
    if (!email) return;
    const requiredTier = ROLE_TIER[grantRole];
    if (requiredTier > tier) { toast.error(`Nur ${TIER_LABEL[requiredTier] ?? "höhere Stufe"} darf das vergeben`); return; }
    const { data: prof } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!prof) { toast.error("Nutzer nicht gefunden"); return; }
    const { error } = await supabase.from("user_roles").insert({ user_id: prof.id, role: grantRole });
    if (error && error.code !== "23505") toast.error(error.message);
    else { toast.success(`${TIER_LABEL[requiredTier]}-Rolle vergeben`); setGrantEmail(""); load(); }
  };
  const revoke = async (uid: string, role: Role) => {
    const t = ROLE_TIER[role];
    if (t > tier) { toast.error("Höhere Stufe nötig"); return; }
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    if (error) toast.error(error.message); else { toast.success("Entzogen"); load(); }
  };

  const restore = async (r: any) => { if (await restoreRecipe(r.id)) { toast.success("Wiederhergestellt"); load(); } };
  const purge = async (r: any) => {
    if ((r.protection_tier ?? 0) > tier) { toast.error("Schutz höher als deine Stufe"); return; }
    if (!confirm(`„${r.title}" endgültig löschen?`)) return;
    if (await purgeRecipe(r.id)) { toast.success("Endgültig gelöscht"); load(); }
  };
  const copyAsNew = async (r: any) => {
    if (!user) return;
    const newTitle = prompt("Titel der Kopie:", `${r.title} (Kopie)`);
    if (!newTitle) return;
    const { data: orig } = await supabase.from("recipes").select("*").eq("id", r.id).maybeSingle();
    if (!orig) return;
    const { error } = await supabase.from("recipes").insert({
      title: newTitle.trim(), description: orig.description, ingredients: orig.ingredients,
      instructions: orig.instructions, image_url: orig.image_url, category_id: orig.category_id,
      author_id: user.id, time_required: orig.time_required, tags: orig.tags,
      servings: orig.servings, servings_unit: orig.servings_unit,
    });
    if (error) toast.error(error.code === "23505" ? "Titel existiert bereits" : error.message);
    else { toast.success("Als neues Rezept erstellt"); load(); }
  };

  const availableRoles: Role[] = (["admin", "superadmin", "imperator"] as Role[]).filter((r) => ROLE_TIER[r] <= tier);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Crown className="w-7 h-7 text-gold" />
        <h1 className="imperial-heading text-3xl text-gold break-words">Admin-Bereich</h1>
        <span className="ml-2 text-xs px-2 py-1 rounded bg-white text-black font-bold">{TIER_LABEL[tier] ?? "Nutzer"}</span>
      </div>

      {/* Löschanträge mit Status-Filter */}
      <Card className="imperial-surface border-gold/30 p-6 mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="imperial-heading text-xl text-gold">Löschanträge ({requests.length})</h2>
          <Select value={requestStatus} onValueChange={setRequestStatus}>
            <SelectTrigger className="w-[200px] bg-white text-black"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Offen</SelectItem>
              <SelectItem value="approved">Genehmigt</SelectItem>
              <SelectItem value="rejected">Abgelehnt</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {requests.length === 0 ? <p className="text-surface-foreground/60 text-sm">Keine Anträge.</p> : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-2 bg-background/40 rounded flex-wrap">
                <div className="text-sm min-w-0 flex-1">
                  <Link to={`/recipes/${r.recipe_id}`} className="text-gold hover:underline break-words">{r.recipe?.title ?? "(unbekannt)"}</Link>
                  <span className="text-surface-foreground/60"> — von {r.requester?.display_name ?? "?"}</span>
                  <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-white text-black font-bold uppercase">{r.status}</span>
                  {r.reason && <div className="text-xs text-surface-foreground/60 break-words">„{r.reason}"</div>}
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="destructive" onClick={() => approve(r)}>Löschen</Button>
                    <Button size="sm" variant="outline" onClick={() => reject(r)}>Ablehnen</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Tombstones nach Stufe gruppiert */}
      <Card className="imperial-surface border-gold/30 p-6 mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="imperial-heading text-xl text-gold">Gelöschte Rezepte ({tombstones.length})</h2>
          <Select value={tombFilter} onValueChange={setTombFilter}>
            <SelectTrigger className="w-[220px] bg-white text-black"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Stufen</SelectItem>
              <SelectItem value="2">Nur Admin-Löschungen</SelectItem>
              <SelectItem value="3">Nur Superadmin-Löschungen</SelectItem>
              <SelectItem value="4">Nur Imperator-Löschungen</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {tombstones.length === 0 ? <p className="text-surface-foreground/60 text-sm">Keine gelöschten Rezepte.</p> : (
          <ul className="space-y-1 max-h-96 overflow-y-auto">
            {tombstones
              .filter((r) => tombFilter === "all" || String(r.deleted_by_tier) === tombFilter)
              .map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-2 py-1 hover:bg-background/40 rounded flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {(r.protection_tier ?? 0) > 0 && (
                    <Lock className="w-4 h-4 shrink-0" style={{ color: TIER_COLOR[r.protection_tier!] }} />
                  )}
                  <Link to={`/recipes/${r.id}`} className="text-sm text-surface-foreground hover:text-gold break-words flex-1 min-w-0">{r.title}</Link>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-black font-bold shrink-0">
                    gelöscht durch {TIER_LABEL[r.deleted_by_tier ?? 2] ?? "?"}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => restore(r)}><RotateCcw className="w-3 h-3 mr-1" />Wiederherstellen</Button>
                  <Button size="sm" variant="outline" onClick={() => copyAsNew(r)}><Copy className="w-3 h-3 mr-1" />Als Kopie</Button>
                  <Button size="sm" variant="destructive" onClick={() => purge(r)}><Trash2 className="w-3 h-3 mr-1" />Endgültig</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Sichtbarkeit erzwingen */}
      <Card className="imperial-surface border-gold/30 p-6 mb-6">
        <h2 className="imperial-heading text-xl text-gold mb-3">Sichtbarkeit erzwingen</h2>
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {recipes.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-2 py-1 hover:bg-background/40 rounded">
              <Link to={`/recipes/${r.id}`} className="text-sm text-surface-foreground hover:text-gold flex-1 break-words">{r.title}</Link>
              <Button size="sm" variant={r.forced_visible ? "gold" : "outline"} onClick={() => toggleForced(r)}>
                <Eye className="w-3 h-3 mr-1" />{r.forced_visible ? "Erzwungen" : "Erzwingen"}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {/* Rollen vergeben */}
      <Card className="imperial-surface border-gold/30 p-6 mb-6">
        <h2 className="imperial-heading text-xl text-gold mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Rolle vergeben</h2>
        <div className="flex gap-2 flex-wrap">
          <Input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="user@example.com" className="bg-white text-black flex-1 min-w-[200px]" />
          <Select value={grantRole} onValueChange={(v) => setGrantRole(v as Role)}>
            <SelectTrigger className="bg-white text-black w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableRoles.map((r) => <SelectItem key={r} value={r}>{TIER_LABEL[ROLE_TIER[r]]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={grant} variant="gold">Vergeben</Button>
        </div>
      </Card>

      {/* Aktuelle Rollen-Übersicht */}
      <Card className="imperial-surface border-gold/30 p-6">
        <h2 className="imperial-heading text-xl text-gold mb-3">Nutzer & Rollen</h2>
        <ul className="space-y-1 max-h-96 overflow-y-auto">
          {users.map((u) => {
            const rr = (userRoles[u.id] ?? []).filter((r) => r !== "user");
            if (rr.length === 0 && !isImperator) return null;
            return (
              <li key={u.id} className="flex items-center justify-between gap-2 px-2 py-1 hover:bg-background/40 rounded flex-wrap">
                <div className="text-sm flex-1 min-w-0">
                  <span className="text-surface-foreground break-words">{u.display_name ?? u.email ?? u.id.slice(0, 8)}</span>
                  <span className="text-xs text-surface-foreground/60 ml-2 break-all">{u.email}</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {rr.length === 0 && <span className="text-xs text-surface-foreground/40">Nutzer</span>}
                  {rr.map((role) => (
                    <span key={role} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-white text-black font-bold">
                      {TIER_LABEL[ROLE_TIER[role]]}
                      {ROLE_TIER[role] <= tier && (
                        <button onClick={() => revoke(u.id, role)} className="text-[#C0392B] font-bold ml-1" title="Rolle entziehen">×</button>
                      )}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
