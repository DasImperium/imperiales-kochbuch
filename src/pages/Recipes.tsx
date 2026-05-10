import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, EyeOff, Eye, Clock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/lib/timeFormat";

interface Recipe {
  id: string; title: string; description: string | null; image_url: string | null;
  category_id: string | null; author_id: string; forced_visible: boolean; is_draft: boolean;
  time_required: string; tags: string[];
}
interface Category { id: string; name: string; parent_id: string | null; is_root: boolean; }
interface Profile { id: string; display_name: string | null; }

export default function Recipes() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [newSubcatName, setNewSubcatName] = useState("");
  const [newSubcatParent, setNewSubcatParent] = useState<string>("");

  const load = async () => {
    const [{ data: rs }, { data: cs }, { data: hs }] = await Promise.all([
      supabase.from("recipes").select("*").eq("is_draft", false).order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("is_root", { ascending: false }).order("name"),
      user ? supabase.from("hidden_recipes").select("recipe_id").eq("user_id", user.id) : Promise.resolve({ data: [] as any }),
    ]);
    setRecipes((rs ?? []) as Recipe[]);
    setCategories(cs ?? []);
    setHidden(new Set((hs ?? []).map((h: any) => h.recipe_id)));
    const ids = Array.from(new Set((rs ?? []).map((r: any) => r.author_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,display_name").in("id", ids);
      setProfiles(ps ?? []);
    }
  };

  useEffect(() => { load(); }, [user]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    recipes.forEach((r) => (r.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [recipes]);

  const toggleHide = async (rid: string) => {
    if (!user) return;
    if (hidden.has(rid)) await supabase.from("hidden_recipes").delete().eq("user_id", user.id).eq("recipe_id", rid);
    else await supabase.from("hidden_recipes").insert({ user_id: user.id, recipe_id: rid });
    load();
  };

  const addSubcategory = async () => {
    if (!user || !newSubcatName.trim() || !newSubcatParent) return;
    const { error } = await supabase.from("categories").insert({
      name: newSubcatName.trim(), parent_id: newSubcatParent, is_root: false, created_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Unterkategorie erstellt"); setNewSubcatName(""); load(); }
  };

  const resetFilters = () => {
    setFilter("all"); setAuthorFilter("all"); setTagFilter(""); setSearch(""); setShowHidden(false);
  };

  const filtered = recipes.filter((r) => {
    if (!showHidden && hidden.has(r.id)) return false;
    if (showHidden && !hidden.has(r.id)) return false;
    if (filter !== "all" && r.category_id !== filter) return false;
    if (authorFilter !== "all" && r.author_id !== authorFilter) return false;
    if (tagFilter && !(r.tags ?? []).includes(tagFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      const inTags = (r.tags ?? []).some((t) => t.includes(q));
      if (!r.title.toLowerCase().includes(q) && !inTags) return false;
    }
    return true;
  });

  const rootCats = categories.filter((c) => c.is_root);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="imperial-heading text-3xl text-gold">Rezeptsammlung</h1>
        <Button asChild className="bg-gold text-gold-foreground hover:bg-gold-soft">
          <Link to="/recipes/new"><Plus className="w-4 h-4 mr-1" /> Neues Rezept</Link>
        </Button>
      </div>

      <Card className="imperial-surface border-gold/30 p-4 mb-6 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Suche (Titel, Tags)…" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-background/60" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="bg-background/60"><SelectValue placeholder="Kategorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kategorien</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.is_root ? `★ ${c.name}` : `— ${c.name}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={authorFilter} onValueChange={setAuthorFilter}>
            <SelectTrigger className="bg-background/60"><SelectValue placeholder="Ersteller" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Ersteller</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name ?? "Unbekannt"}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Select value={tagFilter || "__none"} onValueChange={(v) => setTagFilter(v === "__none" ? "" : v)}>
            <SelectTrigger className="bg-background/60"><SelectValue placeholder="Tag wählen…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Alle Tags</SelectItem>
              {allTags.map((t) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowHidden((v) => !v)} className="border-gold/40">
            {showHidden ? <><Eye className="w-4 h-4 mr-1" />Sichtbare</> : <><EyeOff className="w-4 h-4 mr-1" />Ausgeblendete</>}
          </Button>
          <Button variant="outline" onClick={resetFilters} className="border-gold/40">
            <RotateCcw className="w-4 h-4 mr-1" /> Alle Filter zurücksetzen
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-gold/20">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-surface-foreground/70">Neue Unterkategorie</label>
            <Input value={newSubcatName} onChange={(e) => setNewSubcatName(e.target.value)} placeholder="z. B. Suppen" className="bg-background/60" />
          </div>
          <Select value={newSubcatParent} onValueChange={setNewSubcatParent}>
            <SelectTrigger className="w-[180px] bg-background/60"><SelectValue placeholder="Übergeordnet" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.is_root ? `★ ${c.name}` : `— ${c.name}`}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={addSubcategory} className="bg-gold text-gold-foreground hover:bg-gold-soft">Hinzufügen</Button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <p className="text-center text-foreground/60 py-12">Keine Rezepte.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const cat = categories.find((c) => c.id === r.category_id);
            return (
              <article key={r.id} className="recipe-card overflow-hidden flex flex-col">
                <Link to={`/recipes/${r.id}`} className="block relative">
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.title} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center bg-gradient-to-br from-secondary to-surface">
                      <Star className="w-10 h-10 text-gold/40" />
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-white text-[#006400] shadow">
                    <Clock className="w-3 h-3" /> {formatTime(r.time_required)}
                  </span>
                </Link>
                <div className="p-4 flex-1 flex flex-col">
                  <Link to={`/recipes/${r.id}`} className="imperial-heading text-lg text-content-fg hover:text-gold transition-colors">{r.title}</Link>
                  {cat && <Badge variant="outline" className="self-start text-xs mt-1 mb-2 border-gold/40">{cat.name}</Badge>}
                  {(r.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(r.tags ?? []).slice(0, 4).map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded text-secondary-foreground">#{t}</span>)}
                    </div>
                  )}
                  <p className="text-sm text-content-fg/70 line-clamp-2 flex-1">{r.description}</p>
                  <Button variant="ghost" size="sm" onClick={() => toggleHide(r.id)} className="self-end mt-2 text-xs">
                    {hidden.has(r.id) ? <><Eye className="w-3 h-3 mr-1" />Einblenden</> : <><EyeOff className="w-3 h-3 mr-1" />Ausblenden</>}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
