import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Utensils, Search, Trash2, Edit3, User } from "lucide-react";
import { toast } from "sonner";

interface Menu { id: string; owner_id: string; name: string; description: string | null; tags: string[]; created_at: string; }
interface MenuItem { id: string; menu_id: string; recipe_id: string; default_servings: number; position: number; }
interface RecipeLite { id: string; title: string; }
interface ProfileLite { id: string; display_name: string | null; }

export default function Menus() {
  const { user, isAdmin } = useAuth();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeLite[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [scope, setScope] = useState<"own" | "all">("all");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState<string>("all");

  // Erstellung
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recipeSearch, setRecipeSearch] = useState("");

  const load = async () => {
    const [m, i, r, p] = await Promise.all([
      (supabase.from("menus" as any).select("*").order("created_at", { ascending: false }) as any),
      (supabase.from("menu_items" as any).select("*") as any),
      supabase.from("recipes").select("id,title").eq("is_draft", false).order("title"),
      supabase.from("profiles").select("id,display_name"),
    ]);
    setMenus((m.data ?? []) as Menu[]);
    setItems((i.data ?? []) as MenuItem[]);
    setRecipes((r.data ?? []) as RecipeLite[]);
    setProfiles((p.data ?? []) as ProfileLite[]);
  };
  useEffect(() => { load(); }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    menus.forEach((m) => (m.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [menus]);

  const itemsOf = (mid: string) => items.filter((it) => it.menu_id === mid);
  const recipeTitle = (rid: string) => recipes.find((r) => r.id === rid)?.title ?? "—";
  const authorName = (uid: string) => profiles.find((p) => p.id === uid)?.display_name ?? "Unbekannt";

  const filtered = menus.filter((m) => {
    if (scope === "own" && m.owner_id !== user?.id) return false;
    if (authorFilter !== "all" && m.owner_id !== authorFilter) return false;
    if (tagFilter && !(m.tags ?? []).includes(tagFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      const inName = m.name.toLowerCase().includes(q);
      const inRecipes = itemsOf(m.id).some((it) => recipeTitle(it.recipe_id).toLowerCase().includes(q));
      if (!inName && !inRecipes) return false;
    }
    return true;
  });

  const filteredRecipes = recipes.filter((r) => !recipeSearch || r.title.toLowerCase().includes(recipeSearch.toLowerCase()));

  const toggleSel = (rid: string) => {
    const s = new Set(selected); s.has(rid) ? s.delete(rid) : s.add(rid); setSelected(s);
  };

  const createMenu = async () => {
    if (!user || !name.trim()) { toast.error("Name fehlt"); return; }
    if (selected.size === 0) { toast.error("Mindestens ein Rezept wählen"); return; }
    const tags = tagsInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const { data: menu, error } = await (supabase.from("menus" as any).insert({
      owner_id: user.id, name: name.trim(), description: description.trim() || null, tags,
    }).select().single() as any);
    if (error || !menu) { toast.error(error?.message ?? "Fehler"); return; }
    const rows = Array.from(selected).map((rid, idx) => {
      const rec: any = (recipes as any[]).find((r) => r.id === rid);
      return { menu_id: menu.id, recipe_id: rid, position: idx, default_servings: rec?.servings ?? 4 };
    });
    // fetch servings
    const { data: full } = await supabase.from("recipes").select("id,servings").in("id", Array.from(selected));
    const sv = new Map((full ?? []).map((r: any) => [r.id, r.servings]));
    const finalRows = rows.map((r) => ({ ...r, default_servings: sv.get(r.recipe_id) ?? 4 }));
    const { error: e2 } = await (supabase.from("menu_items" as any).insert(finalRows) as any);
    if (e2) toast.error(e2.message);
    else {
      toast.success("Menü erstellt");
      setCreating(false); setName(""); setDescription(""); setTagsInput(""); setSelected(new Set());
      load();
    }
  };

  const deleteMenu = async (id: string) => {
    if (!confirm("Menü endgültig löschen?")) return;
    const { error } = await (supabase.from("menus" as any).delete().eq("id", id) as any);
    if (error) toast.error(error.message); else { toast.success("Gelöscht"); load(); }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="imperial-heading text-3xl text-gold flex items-center gap-2"><Utensils className="w-7 h-7" /> Menüs</h1>
        <Button variant="gold" onClick={() => setCreating((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> {creating ? "Abbrechen" : "Neues Menü"}
        </Button>
      </div>

      {creating && (
        <Card className="bg-white text-black border-gold/30 p-4 mb-6 space-y-3">
          <h2 className="imperial-heading text-[#006400]">Neues Menü erstellen</h2>
          <Input placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} className="bg-white text-black" maxLength={120} />
          <Input placeholder="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-white text-black" maxLength={300} />
          <Input placeholder="Tags (Komma-getrennt, z. B. Vegetarisch, Weihnachten)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="bg-white text-black" />
          <div>
            <label className="text-sm font-bold text-[#006400]">Rezepte auswählen ({selected.size})</label>
            <Input placeholder="Rezept suchen…" value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="bg-white text-black mt-1" />
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-1 max-h-64 overflow-y-auto mt-2 border rounded p-2">
              {filteredRecipes.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-black bg-gray-50 hover:bg-gray-100 rounded px-2 py-1 cursor-pointer">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} />
                  {r.title}
                </label>
              ))}
            </div>
          </div>
          <Button variant="gold" onClick={createMenu}>Menü speichern</Button>
        </Card>
      )}

      <Card className="imperial-surface border-gold/30 p-4 mb-6 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <Select value={scope} onValueChange={(v) => setScope(v as any)}>
            <SelectTrigger className="bg-white text-black"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Menüs</SelectItem>
              <SelectItem value="own">Meine Menüs</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative md:col-span-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input placeholder="Menüname oder Rezept…" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white text-black pl-8" />
          </div>
          <Select value={tagFilter || "__none"} onValueChange={(v) => setTagFilter(v === "__none" ? "" : v)}>
            <SelectTrigger className="bg-white text-black"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Alle Tags</SelectItem>
              {allTags.map((t) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={authorFilter} onValueChange={setAuthorFilter}>
            <SelectTrigger className="bg-white text-black"><SelectValue placeholder="Ersteller" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Ersteller</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name ?? "Unbekannt"}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <p className="text-center text-foreground/60 py-12">Keine Menüs.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const its = itemsOf(m.id);
            const canEdit = m.owner_id === user?.id || isAdmin;
            return (
              <article key={m.id} className="recipe-card p-4 flex flex-col">
                <Link to={`/menus/${m.id}`} className="imperial-heading text-lg text-content-fg hover:text-[#006400]">{m.name}</Link>
                <div className="text-xs text-content-fg/70 flex items-center gap-1 mb-2">
                  <User className="w-3 h-3" /> {authorName(m.owner_id)}
                </div>
                {m.description && <p className="text-sm text-content-fg/70 line-clamp-2 mb-2">{m.description}</p>}
                <div className="flex flex-wrap gap-1 mb-2">
                  {(m.tags ?? []).map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 bg-white text-[#006400] font-bold rounded border border-[#006400]/30">#{t}</span>
                  ))}
                </div>
                <ul className="text-sm text-content-fg/80 space-y-0.5 flex-1">
                  {its.slice(0, 5).map((it) => <li key={it.id}>• {recipeTitle(it.recipe_id)} ({it.default_servings})</li>)}
                  {its.length > 5 && <li className="text-content-fg/60">+ {its.length - 5} weitere…</li>}
                </ul>
                <div className="flex gap-2 mt-3 justify-end">
                  {canEdit && (
                    <>
                      <Button asChild variant="outline" size="sm"><Link to={`/menus/${m.id}`}><Edit3 className="w-3 h-3 mr-1" />Öffnen</Link></Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteMenu(m.id)}><Trash2 className="w-3 h-3" /></Button>
                    </>
                  )}
                  {!canEdit && <Button asChild variant="outline" size="sm"><Link to={`/menus/${m.id}`}>Ansehen</Link></Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
