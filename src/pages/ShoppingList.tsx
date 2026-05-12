import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, ArrowDown, History, Save } from "lucide-react";
import { toast } from "sonner";

interface Item { id: string; owner_id: string; name: string; amount: number; unit: string; checked: boolean; }

export default function ShoppingList() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [unit, setUnit] = useState("");
  const [snapshots, setSnapshots] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("shopping_items").select("*").eq("owner_id", user.id).order("checked").order("name");
    setItems((data ?? []) as Item[]);
    const { data: snaps } = await supabase.from("list_snapshots").select("*").eq("owner_id", user.id).eq("list_kind", "shopping").order("created_at", { ascending: false }).limit(5);
    setSnapshots(snaps ?? []);
  };
  useEffect(() => { load(); }, [user]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("shop").on("postgres_changes", { event: "*", schema: "public", table: "shopping_items" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const add = async () => {
    if (!user || !name.trim()) return;
    const a = parseFloat(amount.replace(",", ".")) || 0;
    await supabase.from("shopping_items").insert({ owner_id: user.id, name: name.trim(), amount: a, unit: unit.trim() });
    setName(""); setAmount(""); setUnit(""); load();
  };

  const toggle = async (it: Item) => {
    await supabase.from("shopping_items").update({ checked: !it.checked }).eq("id", it.id); load();
  };

  const remove = async (id: string) => { await supabase.from("shopping_items").delete().eq("id", id); load(); };

  const snapshot = async () => {
    if (!user) return;
    await supabase.from("list_snapshots").insert({ owner_id: user.id, list_kind: "shopping", data: items as any });
    toast.success("Stand gespeichert"); load();
  };

  const restore = async (snap: any) => {
    if (!user || !confirm(`Stand wiederherstellen? Aktueller Inhalt wird ersetzt.`)) return;
    await supabase.from("shopping_items").delete().eq("owner_id", user.id);
    const rows = (snap.data ?? []).map((it: Item) => ({ owner_id: user.id, name: it.name, amount: it.amount, unit: it.unit, checked: it.checked }));
    if (rows.length) await supabase.from("shopping_items").insert(rows);
    toast.success("Wiederhergestellt"); load();
  };

  /** Abgehakte ins Inventar verschieben */
  const moveCheckedToInventory = async () => {
    if (!user) return;
    const checked = items.filter((i) => i.checked);
    if (checked.length === 0) { toast("Keine abgehakten Artikel"); return; }
    if (!confirm(`${checked.length} abgehakte Artikel ins Inventar verschieben?`)) return;
    // Existierende Inventar-Einträge finden
    const { data: inv } = await supabase.from("inventory_items").select("*").eq("owner_id", user.id);
    for (const it of checked) {
      const existing = (inv ?? []).find((x: any) => x.name.toLowerCase() === it.name.toLowerCase() && (x.unit ?? "").toLowerCase() === (it.unit ?? "").toLowerCase());
      if (existing) {
        await supabase.from("inventory_items").update({ amount: Number(existing.amount) + Number(it.amount) }).eq("id", existing.id);
      } else {
        await supabase.from("inventory_items").insert({ owner_id: user.id, name: it.name, amount: it.amount, unit: it.unit });
      }
      await supabase.from("shopping_items").delete().eq("id", it.id);
    }
    toast.success("Übertragen"); load();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="imperial-heading text-3xl text-gold mb-4 break-words">Einkaufsliste</h1>

      <Card className="bg-white text-black border-gold/30 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_120px_auto] gap-2 items-end">
          <div><label className="text-xs font-bold text-[#006400]">Artikel</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Tomaten" maxLength={80} className="bg-white text-black" /></div>
          <div><label className="text-xs font-bold text-[#006400]">Menge</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className="bg-white text-black" /></div>
          <div><label className="text-xs font-bold text-[#006400]">Einheit</label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g, Stk" maxLength={20} className="bg-white text-black" /></div>
          <Button onClick={add} variant="gold"><Plus className="w-4 h-4 mr-1" />Hinzufügen</Button>
        </div>
      </Card>

      <Card className="bg-white text-black border-gold/30 p-2 mb-4">
        {items.length === 0 ? <p className="text-sm text-content-fg/60 p-3">Liste ist leer.</p> : (
          <ul className="divide-y divide-gray-200">
            {items.map((it) => (
              <li key={it.id} className={`flex items-center gap-2 p-2 ${it.checked ? "opacity-60" : ""}`}>
                <Checkbox checked={it.checked} onCheckedChange={() => toggle(it)} />
                <span className={`flex-1 break-words ${it.checked ? "line-through" : ""}`}>{it.name}</span>
                <span className="text-sm whitespace-nowrap">{it.amount > 0 ? `${it.amount} ${it.unit}` : ""}</span>
                <Button size="icon" variant="destructive" onClick={() => remove(it.id)}><Trash2 className="w-4 h-4" /></Button>
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
        <h3 className="imperial-heading text-[#006400] mb-2 flex items-center gap-2"><History className="w-4 h-4" />Letzter Stand</h3>
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
