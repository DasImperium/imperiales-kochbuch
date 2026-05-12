import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Star, EyeOff, Eye, Clock, RotateCcw, Users, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/lib/timeFormat";
import { CategoryRow, formatCategoryPath, getDescendantIds, getRoots, getChildren } from "@/lib/categories";
import { softDeleteRecipe, TIER_COLOR } from "@/lib/recipeAdmin";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Recipe {
  id: string; title: string; description: string | null; image_url: string | null;
  category_id: string | null; author_id: string; forced_visible: boolean; is_draft: boolean;
  time_required: string; tags: string[]; servings: number; servings_unit: string;
  protection_tier?: number;
}
interface Profile { id: string; display_name: string | null; }

export default function Recipes() {
  const { user, isAdmin, tier } = useAuth();
  const [toDelete, setToDelete] = useState<Recipe | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [rootFilter, setRootFilter] = useState<string>("all");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [newSubcatName, setNewSubcatName] = useState("");
  const [newSubcatParent, setNewSubcatParent] = useState<string>("");
  const [ratings, setRatings] = useState<Record<string, { avg: number; mine: number }>>({});

  const load = async () => {
    const [{ data: rs }, { data: cs }, { data: hs }, { data: rats }] = await Promise.all([
      supabase.from("recipes").select("*").eq("is_draft", false).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("is_root", { ascending: false }).order("name"),
      user ? supabase.from("hidden_recipes").select("recipe_id").eq("user_id", user.id) : Promise.resolve({ data: [] as any }),
      supabase.from("ratings").select("recipe_id,user_id,stars"),
    ]);
    setRecipes((rs ?? []) as Recipe[]);
    setCategories((cs ?? []) as CategoryRow[]);
    setHidden(new Set((hs ?? []).map((h: any) => h.recipe_id)));

    const map: Record<string, { sum: number; count: number; mine: number }> = {};
    (rats ?? []).forEach((r: any) => {
      const m = (map[r.recipe_id] ??= { sum: 0, count: 0, mine: 0 });
      m.sum += r.stars; m.count += 1;
      if (user && r.user_id === user.id) m.mine = r.stars;
    });
    const out: Record<string, { avg: number; mine: number }> = {};
    Object.entries(map).forEach(([k, v]) => { out[k] = { avg: v.sum / v.count, mine: v.mine }; });
    setRatings(out);

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
    setRootFilter("all"); setSubFilter("all"); setAuthorFilter("all"); setTagFilter(""); setSearch(""); setShowHidden(false);
  };

  const roots = getRoots(categories);
  const subsOfSelectedRoot = rootFilter !== "all" ? getChildren(rootFilter, categories) : [];

  const filterIds = useMemo(() => {
    if (subFilter !== "all") return getDescendantIds(subFilter, categories);
    if (rootFilter !== "all") return getDescendantIds(rootFilter, categories);
    return null;
  }, [rootFilter, subFilter, categories]);

  const filtered = recipes.filter((r) => {
    if (!showHidden && hidden.has(r.id)) return false;
    if (showHidden && !hidden.has(r.id)) return false;
    if (filterIds && (!r.category_id || !filterIds.has(r.category_id))) return false;
    if (authorFilter !== "all" && r.author_id !== authorFilter) return false;
    if (tagFilter && !(r.tags ?? []).includes(tagFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      const inTags = (r.tags ?? []).some((t) => t.includes(q));
      if (!r.title.toLowerCase().includes(q) && !inTags) return false;
    }
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="imperial-heading text-3xl text-gold">Rezeptsammlung</h1>
        <Button asChild variant="gold">
          <Link to="/recipes/new"><Plus className="w-4 h-4 mr-1" /> Neues Rezept</Link>
        </Button>
      </div>

      <Card className="imperial-surface border-gold/30 p-4 mb-6 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wide text-[#00C853]">Filter</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Suche (Titel, Tags)…" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white text-black placeholder:text-gray-500" />
          <Select value={rootFilter} onValueChange={(v) => { setRootFilter(v); setSubFilter("all"); }}>
            <SelectTrigger className="bg-white text-black"><SelectValue placeholder="Hauptkategorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Hauptkategorien</SelectItem>
              {roots.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subFilter} onValueChange={setSubFilter} disabled={rootFilter === "all"}>
            <SelectTrigger className="bg-white text-black"><SelectValue placeholder="Unterkategorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Unterkategorien</SelectItem>
              {subsOfSelectedRoot.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Select value={authorFilter} onValueChange={setAuthorFilter}>
            <SelectTrigger className="bg-white text-black"><SelectValue placeholder="Ersteller" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Ersteller</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name ?? "Unbekannt"}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tagFilter || "__none"} onValueChange={(v) => setTagFilter(v === "__none" ? "" : v)}>
            <SelectTrigger className="bg-white text-black"><SelectValue placeholder="Tag wählen…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Alle Tags</SelectItem>
              {allTags.map((t) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowHidden((v) => !v)} className="flex-1">
              {showHidden ? <><Eye className="w-4 h-4 mr-1" />Sichtbare</> : <><EyeOff className="w-4 h-4 mr-1" />Ausgeblendete</>}
            </Button>
            <Button variant="outline" onClick={resetFilters}><RotateCcw className="w-4 h-4 mr-1" /> Reset</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-gold/20">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-bold text-[#00C853]">Neue Unterkategorie</label>
            <Input value={newSubcatName} onChange={(e) => setNewSubcatName(e.target.value)} placeholder="z. B. Suppen" className="bg-white text-black" />
          </div>
          <Select value={newSubcatParent} onValueChange={setNewSubcatParent}>
            <SelectTrigger className="w-[200px] bg-white text-black"><SelectValue placeholder="Übergeordnet" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{formatCategoryPath(c.id, categories)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={addSubcategory} variant="gold">Hinzufügen</Button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <p className="text-center text-foreground/60 py-12">Keine Rezepte.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const path = formatCategoryPath(r.category_id, categories);
            const author = profiles.find((p) => p.id === r.author_id)?.display_name ?? "Unbekannt";
            const rt = ratings[r.id] ?? { avg: 0, mine: 0 };
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
                  <span className="absolute top-2 left-2 inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded bg-white text-[#006400] shadow">
                    <Star className="w-3 h-3 fill-[#006400]" /> {rt.mine > 0 ? rt.mine : "–"}
                  </span>
                  <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded bg-black text-[#FFD700] shadow">
                    <Star className="w-3 h-3 fill-[#FFD700]" /> {rt.avg > 0 ? rt.avg.toFixed(1) : "–"}
                  </span>
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-white text-[#006400] shadow">
                    <Clock className="w-3 h-3" /> {formatTime(r.time_required)}
                  </span>
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-white text-[#006400] shadow">
                    <Users className="w-3 h-3" /> {r.servings} {r.servings_unit?.slice(0, 4) ?? ""}
                  </span>
                  {/* Schutz-Schloss (nur für Admin+) */}
                  {isAdmin && (r.protection_tier ?? 0) > 0 && (
                    <span title={`Geschützt (Stufe ${r.protection_tier})`}
                      className="absolute top-2 left-1/2 -translate-x-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white shadow"
                      style={{ color: TIER_COLOR[r.protection_tier!] }}>
                      <Lock className="w-4 h-4" />
                    </span>
                  )}
                </Link>
                <div className="p-4 flex-1 flex flex-col">
                  <Link to={`/recipes/${r.id}`} className="imperial-heading text-lg text-content-fg hover:text-[#006400] transition-colors break-words whitespace-normal">{r.title}</Link>
                  {path && (
                    <span className="self-start text-xs mt-1 mb-1 px-2 py-0.5 rounded bg-white text-[#006400] font-bold border border-[#006400]/30 break-words">{path}</span>
                  )}
                  <span className="text-xs text-content-fg/70 mb-2 break-words">von <strong className="text-content-fg">{author}</strong></span>
                  {(r.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(r.tags ?? []).slice(0, 4).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 bg-white text-[#006400] font-bold rounded border border-[#006400]/30">#{t}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-content-fg/70 line-clamp-2 flex-1 break-words">{r.description}</p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    {(r.author_id === user?.id || isAdmin) && (
                      <Button variant="destructive" size="sm" onClick={() => setToDelete(r)} className="text-xs">
                        <Trash2 className="w-3 h-3 mr-1" />Löschen
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => toggleHide(r.id)} className="text-xs ml-auto">
                      {hidden.has(r.id) ? <><Eye className="w-3 h-3 mr-1" />Einblenden</> : <><EyeOff className="w-3 h-3 mr-1" />Ausblenden</>}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wollen Sie „{toDelete?.title}" wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Rezept wird ausgeblendet und bleibt im Admin-Bereich wiederherstellbar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nein</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#C0392B] text-white hover:bg-[#A93226]"
              onClick={async () => {
                if (!toDelete || !user) return;
                if ((toDelete.protection_tier ?? 0) > tier) { toast.error("Geschütztes Rezept – höhere Stufe nötig"); setToDelete(null); return; }
                const ok = await softDeleteRecipe(toDelete.id, user.id, tier);
                if (ok) { toast.success("Gelöscht"); setToDelete(null); load(); }
              }}
            >Ja, löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
