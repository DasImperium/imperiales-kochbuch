import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, History, Save, Share2, X } from "lucide-react";
import { toast } from "sonner";

interface Item { id: string; owner_id: string; name: string; amount: number; unit: string; }
interface Profile { id: string; display_name: string | null; email: string | null; }

export default function Inventory() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [unit, setUnit] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shares, setShares] = useState<{ id: string; shared_with: string; profile?: Profile | null }[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("inventory_items").select("*").eq("owner_id", user.id).order("name");
    setItems((data ?? []) as Item[]);
    const { data: sh } = await supabase.from("list_shares").select("*").eq("owner_id", user.id).eq("list_kind", "inventory");
    if (sh && sh.length) {
      const { data: ps } = await supabase.from("profiles").select("id,display_name,email").in("id", sh.map((s: any) => s.shared_with));
      setShares(sh.map((s: any) => ({ id: s.id, shared_with: s.shared_with, profile: ps?.find((p: any) => p.id === s.shared_with) ?? null })));
    } else setShares([]);
    const { data: snaps } = await supabase.from("list_snapshots").select("*").eq("owner_id", user.id).eq("list_kind", "inventory").order("created_at", { ascending: false }).limit(5);
    setSnapshots(snaps ?? []);
  };
  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("inv").on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const snapshot = async () => {
    if (!user) return;
    await supabase.from("list_snapshots").insert({ owner_id: user.id, list_kind: "inventory", data: items as any });
    toast.success("Stand gespeichert"); load();
  };
  const restore = async (snap: any) => {
    if (!user || !confirm(`Stand vom ${new Date(snap.created_at).toLocaleString()} wiederherstellen? Aktueller Inhalt wird ersetzt.`)) return;
    await supabase.from("inventory_items").delete().eq("owner_id", user.id);
    const rows = (snap.data ?? []).map((it: Item) => ({ owner_id: user.id, name: it.name, amount: it.amount, unit: it.unit }));
    if (rows.length) await supabase.from("inventory_items").insert(rows);
    toast.success("Wiederhergestellt"); load();
  };

  const add = async () => {
    if (!user || !name.trim()) return;
    await snapshotIfNeeded();
    const a = parseFloat(amount.replace(",", ".")) || 0;
    const { error } = await supabase.from("inventory_items").insert({ owner_id: user.id, name: name.trim(), amount: a, unit: unit.trim() });
    if (error) toast.error(error.message); else { setName(""); setAmount(""); setUnit(""); load(); }
  };
  const update = async (it: Item, patch: Partial<Item>) => {
    await supabase.from("inventory_items").update(patch).eq("id", it.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Eintrag löschen?")) return;
    await snapshotIfNeeded();
    await supabase.from("inventory_items").delete().eq("id", id); load();
  };
  const snapshotIfNeeded = async () => {
    // Auto-snap on first mutation per session for "Letzter Stand"
    if (!user) return;
    const { count } = await supabase.from("list_snapshots").select("id", { count: "exact", head: true })
      .eq("owner_id", user.id).eq("list_kind", "inventory").gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if (!count) await supabase.from("list_snapshots").insert({ owner_id: user.id, list_kind: "inventory", data: items as any });
  };

  const share = async () => {
    if (!user || !shareEmail.trim()) return;
    const { data: prof } = await supabase.from("profiles").select("id").eq("email", shareEmail.trim().toLowerCase()).maybeSingle();
    if (!prof) { toast.error("Nutzer nicht gefunden"); return; }
    if (prof.id === user.id) { toast.error("Eigene Liste kann nicht freigegeben werden"); return; }
    const { error } = await supabase.from("list_shares").insert({ owner_id: user.id, shared_with: prof.id, list_kind: "inventory" });
    if (error) toast.error(error.code === "23505" ? "Bereits freigegeben" : error.message);
    else { setShareEmail(""); toast.success("Freigegeben"); load(); }
  };
  const unshare = async (id: string) => {
    await supabase.from("list_shares").delete().eq("id", id); load();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="imperial-heading text-3xl text-gold mb-4 break-words">Inventar</h1>

      <Card className="bg-white text-black border-gold/30 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_120px_auto] gap-2 items-end">
          <div><label className="text-xs font-bold text-[#006400]">Lebensmittel</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Mehl" maxLength={80} className="bg-white text-black" /></div>
          <div><label className="text-xs font-bold text-[#006400]">Menge</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className="bg-white text-black" /></div>
          <div><label className="text-xs font-bold text-[#006400]">Einheit</label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g, ml, Stk" maxLength={20} className="bg-white text-black" /></div>
          <Button onClick={add} variant="gold"><Plus className="w-4 h-4 mr-1" />Hinzufügen</Button>
        </div>
      </Card>

      <Card className="bg-white text-black border-gold/30 p-2 mb-4">
        {items.length === 0 ? <p className="text-sm text-content-fg/60 p-3">Noch keine Einträge.</p> : (
          <ul className="divide-y divide-gray-200">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-2 p-2 flex-wrap">
                <Input defaultValue={it.name} onBlur={(e) => e.target.value !== it.name && update(it, { name: e.target.value })} className="flex-1 min-w-[140px] bg-white text-black" />
                <Input defaultValue={String(it.amount)} inputMode="decimal" onBlur={(e) => {
                  const v = parseFloat(e.target.value.replace(",", ".")); if (!isNaN(v) && v !== it.amount) update(it, { amount: v });
                }} className="w-20 bg-white text-black text-center" />
                <Input defaultValue={it.unit} onBlur={(e) => e.target.value !== it.unit && update(it, { unit: e.target.value })} className="w-20 bg-white text-black" />
                <Button size="icon" variant="destructive" onClick={() => remove(it.id)}><Trash2 className="w-4 h-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-white text-black border-gold/30 p-4">
          <h3 className="imperial-heading text-[#006400] mb-2 flex items-center gap-2"><Share2 className="w-4 h-4" />Freigeben</h3>
          <div className="flex gap-2 mb-3">
            <Input value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="E-Mail" className="bg-white text-black" />
            <Button onClick={share}>Teilen</Button>
          </div>
          <ul className="space-y-1">
            {shares.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm bg-gray-100 rounded px-2 py-1">
                <span>{s.profile?.display_name ?? s.profile?.email ?? s.shared_with.slice(0, 8)}</span>
                <Button size="icon" variant="destructive" className="h-6 w-6" onClick={() => unshare(s.id)}><X className="w-3 h-3" /></Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="bg-white text-black border-gold/30 p-4">
          <h3 className="imperial-heading text-[#006400] mb-2 flex items-center gap-2"><History className="w-4 h-4" />Letzter Stand</h3>
          <Button onClick={snapshot} size="sm" className="mb-2"><Save className="w-3 h-3 mr-1" />Aktuellen Stand sichern</Button>
          {snapshots.length === 0 ? <p className="text-xs text-content-fg/60">Noch keine Sicherung.</p> : (
            <ul className="space-y-1">
              {snapshots.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm bg-gray-100 rounded px-2 py-1">
                  <span>{new Date(s.created_at).toLocaleString()}</span>
                  <Button size="sm" variant="outline" onClick={() => restore(s)}>Wiederherstellen</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
