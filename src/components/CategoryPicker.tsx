import { useMemo, useState } from "react";
import { CategoryRow, getRoots, getChildren, getCategoryPath } from "@/lib/categories";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  categories: CategoryRow[];
  value: string | null;             // ausgewählte Kategorie (Haupt-, Unter- oder Unter-Unter-Kategorie)
  onChange: (id: string | null) => void;
  onCategoriesChanged?: (cs: CategoryRow[]) => void;
  userId?: string;
}

/**
 * Hierarchische Auswahl: Hauptkategorie (Pflicht) → Unterkategorie (optional) → Unter-Unter-Kategorie (optional).
 * Hauptkategorien sind fix (nur auswählbar). Unterkategorien können neu angelegt werden.
 */
export default function CategoryPicker({ categories, value, onChange, onCategoriesChanged, userId }: Props) {
  const path = useMemo(() => getCategoryPath(value, categories), [value, categories]);
  const root = path[0] ?? null;
  const sub = path[1] ?? null;
  const subsub = path[2] ?? null;

  const [newSubName, setNewSubName] = useState("");
  const [newSubsubName, setNewSubsubName] = useState("");

  const roots = getRoots(categories);
  const subs = root ? getChildren(root.id, categories) : [];
  const subsubs = sub ? getChildren(sub.id, categories) : [];

  const createSub = async (parent: CategoryRow, name: string, clear: () => void) => {
    if (!userId || !name.trim()) return;
    const { data, error } = await supabase.from("categories").insert({
      name: name.trim(), is_root: false, parent_id: parent.id, created_by: userId,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    onCategoriesChanged?.([...categories, data as CategoryRow]);
    onChange(data.id);
    clear();
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs text-content-fg/70">Hauptkategorie *</label>
        <Select value={root?.id ?? ""} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="bg-white text-black"><SelectValue placeholder="Wählen…" /></SelectTrigger>
          <SelectContent>
            {roots.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {root && (
        <div>
          <label className="text-xs text-content-fg/70">Unterkategorie</label>
          <div className="flex gap-2">
            <Select value={sub?.id ?? "__root"} onValueChange={(v) => onChange(v === "__root" ? root.id : v)}>
              <SelectTrigger className="bg-white text-black"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__root">— keine —</SelectItem>
                {subs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="neue…" className="bg-white text-black w-40" />
            <Button type="button" size="sm" onClick={() => createSub(root, newSubName, () => setNewSubName(""))}
              className="bg-black text-white hover:bg-black/80"><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {sub && (
        <div>
          <label className="text-xs text-content-fg/70">Unter-Unter-Kategorie</label>
          <div className="flex gap-2">
            <Select value={subsub?.id ?? "__sub"} onValueChange={(v) => onChange(v === "__sub" ? sub.id : v)}>
              <SelectTrigger className="bg-white text-black"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__sub">— keine —</SelectItem>
                {subsubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={newSubsubName} onChange={(e) => setNewSubsubName(e.target.value)} placeholder="neue…" className="bg-white text-black w-40" />
            <Button type="button" size="sm" onClick={() => createSub(sub, newSubsubName, () => setNewSubsubName(""))}
              className="bg-black text-white hover:bg-black/80"><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
