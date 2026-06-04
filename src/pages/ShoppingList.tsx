import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, ArrowDown, History, Save, ArrowDownAZ } from "lucide-react";
import { toast } from "sonner";
import { normalize, sumSameUnit } from "@/lib/units";

interface Item { id: string; owner_id: string; name: string; amount: number; unit: string; checked: boolean; }
const MAX_SNAPSHOTS = 2;

export default function ShoppingList() {
  const { user } = useAuth();
  const [raw, setRaw] = useState<Item[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [unit, setUnit] = useState("");
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [sortAlpha, setSortAlpha] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: me } = await supabase.from("profiles").select("group_id").eq("id", user.id).maybeSingle();
    const gid = (me as any)?.group_id as string | null;
    const ids = new Set<string>([user.id]);
    if (gid) {
      const { data: mates } = await supabase.from("profiles").select("id").eq("group_id", gid);
      (mates ?? []).forEach((m: any) => ids.add(m.id));
    }
    const { data: sharedTo } = await supabase.from("list_shares").select("owner_id").eq("shared_with", user.id).eq("list_kind", "shopping");
    (sharedTo ?? []).forEach((s: any) => ids.add(s.owner_id));
    const owners = Array.from(ids);
    setOwnerIds(owners);

    const { data } = await supabase.from("shopping_items").select("*").in("owner_id", owners).order("checked").order("name");
    setRaw((data ?? []) as Item[]);
    const { data: snaps } = await supabase.from("list_snapshots").select("*").eq("owner_id", user.id).eq("list_kind", "shopping").order("created_at", { ascending: false }).limit(MAX_SNAPSHOTS);
    setSnapshots(snaps ?? []);
  };

  useEffect(() => { load(); }, [user]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("shop-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "list_shares" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const items = useMemo(() => {
    const groups = new Map<string, Item>();
    for (const it of raw) {
      const key = `${it.name.toLowerCase().trim()}::${it.checked}`;
      const existing = groups.get(key);
      if (existing) {
        const sum = sumSameUnit({ amount: Number(existing.amount), unit: existing.unit }, { amount: Number(it.amount), unit: it.unit });
        if (sum) { existing.amount = sum.amount; existing.unit = sum.unit; }
      } else {
        const n = normalize(Number(it.amount), it.unit);
        groups.set(key, { ...it, amount: n.amount, unit: n.unit });
      }
    }
    let arr = Array.from(groups.values());
    if (sortAlpha) arr.sort((a, b) => a.name.localeCompare(b.name, "de"));
    return arr;
  }, [raw, sortAlpha]);

  const add = async () => {
    if (!user || !name.trim()) return;
    const a = parseFloat(amount.replace(",", ".")) || 0;
    const n = normalize(a, unit);
    await supabase.from("shopping_items").insert({ owner_id: user.id, name: name.trim(), amount: n.amount, unit: n.unit });
    setName(""); setAmount(""); setUnit(""); load();
  };

  const allMatchingIds = (it: Item) =>
    raw.filter((r) => r.name.toLowerCase().trim() === it.name.toLowerCase().trim() && r.checked === it.checked).map((r) => r.id);

  // Aktualisiert veränderte Werte für alle matchenden IDs der Gruppierung
  const update = async (it: Item, patch: Partial<Item>) => {
    const ids = allMatchingIds(it);
    if (ids.length === 0) return;
    const { error } = await supabase.from("shopping_items").update(patch).in("id", ids);
    if (error) toast.error(error.message);
    else load();
  };

  const toggle = async (it: Item) => {
    const ids = allMatchingIds(it);
    await supabase.from("shopping_items").update({ checked: !it.checked }).in("id", ids); load();
  };

  const remove = async (it: Item) => {
    if (!confirm(`Wollen Sie "${it.name}" wirklich löschen?`)) return;
    const ids = allMatchingIds(it);
    await supabase.from("shopping_items").delete().in("id", ids); load();
  };

  const snapshot = async () => {
    if (!user) return;
    await supabase.from("list_snapshots").insert({ owner_id: user.id, list_kind: "shopping", data: raw as any });
    toast.success("Stand gespeichert"); load();
  };

  const restore = async (snap: any) => {
    if (!user || !confirm(`Stand wiederherstellen?`)) return;
    await supabase.from("shopping_items").delete().eq("owner_id", user.id);
    const rows = (snap.data ?? []).map((it: Item) => ({ owner_id: user.id, name: it.name, amount: it.amount, unit: it.unit, checked: it.checked }));
    if (rows.length) await supabase.from("shopping_items").insert(rows);
    toast.success("Wiederhergestellt"); load();
  };

  const moveCheckedToInventory = async () => {
    if (!user) return;
    const checked = items.filter((i) => i.checked);
    if (checked.length === 0) { toast("Keine abgehakten Artikel"); return; }
    if (!confirm(`${checked.length} abgehakte Artikel ins Inventar verschieben?`)) return;
    const { data: inv } = await supabase.from("inventory_items").select("*").eq("owner_id", user.id);
    for (const it of checked) {
      const existing = (inv ?? []).find((x: any) => x.name.toLowerCase() === it.name.toLowerCase());
      if (existing) {
        const sum = sumSameUnit({ amount: Number(existing.amount), unit: existing.unit }, { amount: Number(it.amount), unit: it.unit });
        if (sum) await supabase.from("inventory_items").update({ amount: sum.amount, unit: sum.unit }).eq("id", existing.id);
        else await supabase.from("inventory_items").update({ amount: Number(existing.amount) + Number(it.amount) }).eq("id", existing.id);
      } else {
        await supabase.from("inventory_items").insert({ owner_id: user.id, name: it.name, amount: it.amount, unit: it.unit });
      }
      const ids = allMatchingIds(it);
      await supabase.from("shopping_items").delete().in("id", ids);
    }
    toast.success("Übertragen"); load();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="imperial-heading text-3xl text-gold mb-4 break-words">Einkaufsliste</h1>
      {ownerIds.length > 1 && (
        <p className="text-xs text-content-fg/70 mb-2">Synchronisiert mit {ownerIds.length - 1} weitere(n) Mitglied(ern).</p>
      )}

      <Card className="bg-white text-black border-gold/30 p-4 mb-4">
        <div className="text-xs font-bold text-[#006400] mb-2">Format: Menge | Einheit | Zutat</div>
        <div className="grid grid-cols-2 md:grid-cols-[100px_100px_1fr_auto] gap-2 items-end">
          <div><label className="text-xs">Menge</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className="bg-white text-black" /></div>
          <div><label className="text-xs">Einheit</label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g/kg/ml/l/Stk" maxLength={20} className="bg-white text-black" /></div>
          <div className="col-span-2 md:col-span-1"><label className="text-xs">Zutat</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Tomaten" maxLength={80} className="bg-white text-black" /></div>
          <Button onClick={add} variant="gold"><Plus className="w-4 h-4 mr-1" />Hinzufügen</Button>
        </div>
      </Card>

      <div className="flex items-center justify-end mb-2">
        <Button size="sm" variant="outline" onClick={() => setSortAlpha((v) => !v)}>
          <ArrowDownAZ className="w-4 h-4 mr-1" />{sortAlpha ? "Standard-Sortierung" : "Alphabetisch ordnen"}
        </Button>
      </div>

      <Card className="bg-white text-black border-gold/30 p-2 mb-4">
        {items.length === 0 ? <p className="text-sm text-content-fg/60 p-3">Liste ist leer.</p> : (
          <ul className="divide-y divide-gray-200">
            {items.map((it) => (
              <li key={it.id} className={`flex items-center gap-2 p-2 flex-wrap ${it.checked ? "opacity-60" : ""}`}>
                <Checkbox checked={it.checked} onCheckedChange={() => toggle(it)} />
                
                {/* Menge editierbar */}
                <Input 
                  defaultValue={it.amount > 0 ? String(it.amount) : ""} 
                  inputMode="decimal"
                  placeholder="0"
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value.replace(",", "."));
                    if (!isNaN(v) && v !== it.amount) {
                      const n = normalize(v, it.unit);
                      update(it, { amount: n.amount, unit: n.unit });
                    }
                  }}
                  className="w-20 text-right font-mono h-8 bg-white text-black"
                />

                {/* Einheit editierbar */}
                <Input 
                  defaultValue={it.unit}
                  placeholder="Einheit"
                  maxLength={20}
                  onBlur={(e) => {
                    if (e.target.value !== it.unit) {
                      update(it, { unit: e.target.value });
                    }
                  }}
                  className="w-16 text-sm h-8 bg-white text-black"
                />

                {/* Zutat / Name editierbar (Substituieren) */}
                <Input 
                  defaultValue={it.name}
                  maxLength={80}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value.trim() !== it.name) {
                      update(it, { name: e.target.value.trim() });
                    }
                  }}
                  className={`flex-1 min-w-[150px] h-8 bg-white text-black ${it.checked ? "line-through opacity-70" : ""}`}
                />

                <Button size="icon" variant="destructive" onClick={() => remove(it)} className="h-8 w-8"><Trash2 className="w-4 h-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex gap-2 flex-wrap mb-4">
        <Button onClick={moveCheckedToInventory} variant="gold"><ArrowDown className="w-4 h-4 mr-1" />Abgehakte ins Inventar</Button>
        <Button onClick={snapshot} variant="outline"><Save className="w-4 h-4 mr-1" />Stand sichern</Button>
      </div>

      <Card className="bg-white text-black border-gold/30 p-4">
        <h3 className="imperial-heading text-[#006400] mb-2 flex items-center gap-2"><History className="w-4 h-4" />Letzter Stand (max. {MAX_SNAPSHOTS})</h3>
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
  );
}