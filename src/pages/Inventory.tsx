import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, History, Save, Share2, X, ArrowDownAZ, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { normalize, formatTriple, toBase } from "@/lib/units";

interface Item {
  id: string; owner_id: string; name: string; amount: number; unit: string;
  safety_stock: number; min_stock: number;
}
interface Profile { id: string; display_name: string | null; email: string | null; }

const MAX_SNAPSHOTS = 2;

/** Stufe: 0 = ok, 1 = unter Sicherheit (orange), 2 = unter Min (rot) */
function level(it: Item): 0 | 1 | 2 {
  const cur = toBase(Number(it.amount), it.unit).amount;
  const safe = toBase(Number(it.safety_stock || 0), it.unit).amount;
  const min = toBase(Number(it.min_stock || 0), it.unit).amount;
  if (min > 0 && cur < min) return 2;
  if (safe > 0 && cur < safe) return 1;
  return 0;
}
const rowClass = (l: 0 | 1 | 2) =>
  l === 2 ? "bg-red-100" : l === 1 ? "bg-orange-100" : "";

export default function Inventory() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [unit, setUnit] = useState("");
  const [safety, setSafety] = useState(""); const [minS, setMinS] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shares, setShares] = useState<{ id: string; shared_with: string; profile?: Profile | null }[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [warnedIds, setWarnedIds] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("inventory_items").select("*").eq("owner_id", user.id).order("name");
    const list = (data ?? []) as Item[];
    setItems(list);
    const { data: sh } = await supabase.from("list_shares").select("*").eq("owner_id", user.id).eq("list_kind", "inventory");
    if (sh && sh.length) {
      const { data: ps } = await supabase.from("profiles").select("id,display_name,email").in("id", sh.map((s: any) => s.shared_with));
      setShares(sh.map((s: any) => ({ id: s.id, shared_with: s.shared_with, profile: ps?.find((p: any) => p.id === s.shared_with) ?? null })));
    } else setShares([]);
    const { data: snaps } = await supabase.from("list_snapshots").select("*").eq("owner_id", user.id).eq("list_kind", "inventory").order("created_at", { ascending: false }).limit(MAX_SNAPSHOTS);
    setSnapshots(snaps ?? []);

    // Warnungen prüfen (einmal pro Session pro item)
    checkAndNotify(list);
  };
  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("inv-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "list_shares" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const checkAndNotify = async (list: Item[]) => {
    if (!user) return;
    const newWarn = new Set(warnedIds);
    for (const it of list) {
      const l = level(it);
      const key = `${it.id}:${l}`;
      if (l === 0 || newWarn.has(key)) continue;
      newWarn.add(key);
      if (l === 2) {
        // Auto-Eintrag in die Einkaufsliste mit Mindestmenge
        const minAmount = Number(it.min_stock || 0);
        if (minAmount > 0) {
          const { data: existing } = await supabase.from("shopping_items").select("id,amount")
            .eq("owner_id", user.id).ilike("name", it.name).eq("unit", it.unit).eq("checked", false).maybeSingle();
          if (!existing) {
            await supabase.from("shopping_items").insert({
              owner_id: user.id, name: it.name, amount: minAmount, unit: it.unit,
            });
          }
        }
        await supabase.from("chat_messages").insert({
          sender_id: user.id, recipient_id: user.id,
          content: `Achtung: Mindestbestand für ${it.name} unterschritten – ${it.min_stock} ${it.unit} der Einkaufsliste hinzugefügt.`,
        });
      } else if (l === 1) {
        await supabase.from("chat_messages").insert({
          sender_id: user.id, recipient_id: user.id,
          content: `Warnung: Sicherheitsbestand für ${it.name} (${it.amount} ${it.unit}) unterschritten.`,
        });
      }
    }
    setWarnedIds(newWarn);
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [items]);

  const add = async () => {
    if (!user || !name.trim()) return;
    const a = parseFloat(amount.replace(",", ".")) || 0;
    const n = normalize(a, unit);
    const { error } = await supabase.from("inventory_items").insert({
      owner_id: user.id, name: name.trim(), amount: n.amount, unit: n.unit,
      safety_stock: parseFloat(safety.replace(",", ".")) || 0,
      min_stock: parseFloat(minS.replace(",", ".")) || 0,
    });
    if (error) toast.error(error.message);
    else { setName(""); setAmount(""); setUnit(""); setSafety(""); setMinS(""); load(); }
  };

  const update = async (it: Item, patch: Partial<Item>) => {
    await supabase.from("inventory_items").update(patch).eq("id", it.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eintrag löschen?")) return;
    await supabase.from("inventory_items").delete().eq("id", id); load();
  };

  const snapshot = async () => {
    if (!user) return;
    await supabase.from("list_snapshots").insert({ owner_id: user.id, list_kind: "inventory", data: items as any });
    toast.success("Stand gespeichert"); load();
  };
  const restore = async (snap: any) => {
    if (!user || !confirm(`Stand vom ${new Date(snap.created_at).toLocaleString()} wiederherstellen?`)) return;
    await supabase.from("inventory_items").delete().eq("owner_id", user.id);
    const rows = (snap.data ?? []).map((it: Item) => ({
      owner_id: user.id, name: it.name, amount: it.amount, unit: it.unit,
      safety_stock: it.safety_stock ?? 0, min_stock: it.min_stock ?? 0,
    }));
    if (rows.length) await supabase.from("inventory_items").insert(rows);
    toast.success("Wiederhergestellt"); load();
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
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="imperial-heading text-3xl text-gold mb-4 break-words">Inventar</h1>

      <Card className="bg-white text-black border-gold/30 p-4 mb-4">
        <div className="text-xs font-bold text-[#006400] mb-2">Neu: Menge | Einheit | Zutat | Sicherheitsbestand | Mindestbestand</div>
        <div className="grid grid-cols-2 md:grid-cols-[100px_100px_1fr_120px_120px_auto] gap-2 items-end">
          <div><label className="text-xs">Menge</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className="bg-white text-black" /></div>
          <div><label className="text-xs">Einheit</label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g/kg/ml/l/Stk" maxLength={20} className="bg-white text-black" /></div>
          <div className="col-span-2 md:col-span-1"><label className="text-xs">Zutat</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Mehl" maxLength={80} className="bg-white text-black" /></div>
          <div><label className="text-xs">Sicherh.</label>
            <Input value={safety} onChange={(e) => setSafety(e.target.value)} inputMode="decimal" placeholder="0" className="bg-white text-black" /></div>
          <div><label className="text-xs">Min.</label>
            <Input value={minS} onChange={(e) => setMinS(e.target.value)} inputMode="decimal" placeholder="0" className="bg-white text-black" /></div>
          <Button onClick={add} variant="gold"><Plus className="w-4 h-4 mr-1" />Hinzufügen</Button>
        </div>
      </Card>

      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <p className="text-xs text-content-fg/70">Orange = unter Sicherheitsbestand · Rot = unter Mindestbestand</p>
        <Button variant="outline" size="sm" onClick={() => setItems([...items].sort((a, b) => a.name.localeCompare(b.name, "de")))}>
          <ArrowDownAZ className="w-4 h-4 mr-1" />Alphabetisch ordnen
        </Button>
      </div>

      <Card className="bg-white text-black border-gold/30 p-0 mb-4 overflow-x-auto">
        {sortedItems.length === 0 ? <p className="text-sm text-content-fg/60 p-3">Noch keine Einträge.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-[#006400]">
              <tr>
                <th className="text-left p-2">Menge</th><th className="text-left p-2">Einheit</th>
                <th className="text-left p-2">Zutat</th>
                <th className="text-left p-2">Sicherh.</th><th className="text-left p-2">Min.</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((it) => {
                const l = level(it);
                return (
                  <tr key={it.id} className={`border-t ${rowClass(l)}`}>
                    <td className="p-1 w-24"><Input defaultValue={String(it.amount)} inputMode="decimal" onBlur={(e) => {
                      const v = parseFloat(e.target.value.replace(",", ".")); if (!isNaN(v) && v !== it.amount) {
                        const n = normalize(v, it.unit); update(it, { amount: n.amount, unit: n.unit });
                      }
                    }} className="bg-white text-black h-8" /></td>
                    <td className="p-1 w-20"><Input defaultValue={it.unit} onBlur={(e) => e.target.value !== it.unit && update(it, { unit: e.target.value })} className="bg-white text-black h-8" /></td>
                    <td className="p-1"><Input defaultValue={it.name} onBlur={(e) => e.target.value !== it.name && update(it, { name: e.target.value })} className="bg-white text-black h-8" /></td>
                    <td className="p-1 w-24"><Input defaultValue={String(it.safety_stock ?? 0)} inputMode="decimal" onBlur={(e) => {
                      const v = parseFloat(e.target.value.replace(",", ".")); if (!isNaN(v)) update(it, { safety_stock: v });
                    }} className="bg-white text-black h-8" /></td>
                    <td className="p-1 w-24"><Input defaultValue={String(it.min_stock ?? 0)} inputMode="decimal" onBlur={(e) => {
                      const v = parseFloat(e.target.value.replace(",", ".")); if (!isNaN(v)) update(it, { min_stock: v });
                    }} className="bg-white text-black h-8" /></td>
                    <td className="p-1 w-10">
                      {l > 0 && <AlertTriangle className={`w-4 h-4 inline mr-1 ${l === 2 ? "text-red-700" : "text-orange-600"}`} />}
                      <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => remove(it.id)}><Trash2 className="w-3 h-3" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-white text-black border-gold/30 p-4">
          <h3 className="imperial-heading text-[#006400] mb-2 flex items-center gap-2"><Share2 className="w-4 h-4" />Freigeben (Echtzeit-Sync)</h3>
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
          <h3 className="imperial-heading text-[#006400] mb-2 flex items-center gap-2"><History className="w-4 h-4" />Letzter Stand (max. {MAX_SNAPSHOTS})</h3>
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
