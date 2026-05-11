import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Copy, RotateCcw, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import ServingsControl from "@/components/ServingsControl";
import { scaleIngredientsText, clampServings } from "@/lib/scaling";

interface Menu { id: string; owner_id: string; name: string; description: string | null; tags: string[]; }
interface MenuItem { id: string; menu_id: string; recipe_id: string; default_servings: number; position: number; }
interface Recipe { id: string; title: string; ingredients: string | null; servings: number; servings_unit: string; }
interface Scaling { id: string; menu_id: string; user_id: string; name: string; servings_map: Record<string, number>; }

export default function MenuDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [servings, setServings] = useState<Record<string, number>>({});
  const [scalings, setScalings] = useState<Scaling[]>([]);
  const [scalingName, setScalingName] = useState("");
  const [activeScaling, setActiveScaling] = useState<string>("__default");

  const load = async () => {
    if (!id) return;
    const { data: m } = await (supabase.from("menus" as any).select("*").eq("id", id).maybeSingle() as any);
    if (!m) return;
    setMenu(m as Menu);
    const { data: its } = await (supabase.from("menu_items" as any).select("*").eq("menu_id", id).order("position") as any);
    setItems((its ?? []) as MenuItem[]);
    const ids = (its ?? []).map((it: any) => it.recipe_id);
    if (ids.length) {
      const { data: rs } = await supabase.from("recipes").select("id,title,ingredients,servings,servings_unit").in("id", ids);
      setRecipes((rs ?? []) as Recipe[]);
    }
    if (user) {
      const { data: sc } = await (supabase.from("menu_scalings" as any).select("*").eq("menu_id", id).eq("user_id", user.id).order("created_at", { ascending: false }) as any);
      setScalings((sc ?? []) as Scaling[]);
    }
    // Reset to defaults
    const map: Record<string, number> = {};
    (its ?? []).forEach((it: any) => { map[it.recipe_id] = it.default_servings; });
    setServings(map);
    setActiveScaling("__default");
  };
  useEffect(() => { load(); }, [id, user]);

  const setOne = (rid: string, n: number) => setServings((s) => ({ ...s, [rid]: clampServings(n) }));

  const scaleAll = (delta: number) => {
    const next: Record<string, number> = {};
    items.forEach((it) => {
      const cur = servings[it.recipe_id] ?? it.default_servings;
      next[it.recipe_id] = clampServings(cur + delta);
    });
    setServings(next);
  };
  const setAllTo = (target: number) => {
    const next: Record<string, number> = {};
    items.forEach((it) => {
      const factor = target / Math.max(1, it.default_servings);
      next[it.recipe_id] = clampServings(it.default_servings * factor);
    });
    setServings(next);
  };

  const resetDefaults = () => {
    const map: Record<string, number> = {};
    items.forEach((it) => { map[it.recipe_id] = it.default_servings; });
    setServings(map); setActiveScaling("__default");
  };

  const saveScaling = async () => {
    if (!user || !menu || !scalingName.trim()) { toast.error("Name fehlt"); return; }
    const { error } = await (supabase.from("menu_scalings" as any).insert({
      user_id: user.id, menu_id: menu.id, name: scalingName.trim(), servings_map: servings,
    }) as any);
    if (error) toast.error(error.message);
    else { toast.success("Umrechnung gespeichert"); setScalingName(""); load(); }
  };

  const loadScaling = (sid: string) => {
    setActiveScaling(sid);
    if (sid === "__default") { resetDefaults(); return; }
    const sc = scalings.find((x) => x.id === sid);
    if (!sc) return;
    const next: Record<string, number> = {};
    items.forEach((it) => { next[it.recipe_id] = sc.servings_map[it.recipe_id] ?? it.default_servings; });
    setServings(next);
  };

  const deleteScaling = async (sid: string) => {
    if (!confirm("Umrechnung löschen?")) return;
    const { error } = await (supabase.from("menu_scalings" as any).delete().eq("id", sid) as any);
    if (error) toast.error(error.message); else { toast.success("Gelöscht"); load(); }
  };

  const copyMenu = async () => {
    if (!user || !menu) return;
    const newName = prompt("Name der Kopie:", `${menu.name} (Kopie)`);
    if (!newName) return;
    const { data: nm, error } = await (supabase.from("menus" as any).insert({
      owner_id: user.id, name: newName.trim(), description: menu.description, tags: menu.tags,
    }).select().single() as any);
    if (error || !nm) { toast.error(error?.message ?? "Fehler"); return; }
    const rows = items.map((it) => ({
      menu_id: nm.id, recipe_id: it.recipe_id, position: it.position,
      default_servings: servings[it.recipe_id] ?? it.default_servings,
    }));
    await (supabase.from("menu_items" as any).insert(rows) as any);
    toast.success("Kopie erstellt"); navigate(`/menus/${nm.id}`);
  };

  const recipeOf = (rid: string) => recipes.find((r) => r.id === rid);
  const canEdit = !!menu && (menu.owner_id === user?.id || isAdmin);

  const totalDefault = useMemo(() => items.reduce((s, it) => s + it.default_servings, 0), [items]);
  const totalCurrent = useMemo(() => Object.values(servings).reduce((s, n) => s + n, 0), [servings]);

  if (!menu) return <div className="p-8 text-center">Lade…</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-4">
        <Link to="/menus" className="text-sm text-gold underline">← zurück zu Menüs</Link>
      </div>
      <Card className="bg-white text-black border-gold/30 p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="imperial-heading text-3xl text-content-fg">{menu.name}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyMenu}><Copy className="w-4 h-4 mr-1" />Kopie mit Anpassung</Button>
            <Button variant="outline" onClick={resetDefaults}><RotateCcw className="w-4 h-4 mr-1" />Zurücksetzen</Button>
          </div>
        </div>
        {menu.description && <p className="text-content-fg/80">{menu.description}</p>}
        <div className="flex flex-wrap gap-1">
          {(menu.tags ?? []).map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 bg-white text-[#006400] font-bold rounded border border-[#006400]/30">#{t}</span>
          ))}
        </div>

        {/* Gruppenskalierung */}
        <Card className="bg-[#FFFDF0] border border-[#006400]/30 p-3 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Users className="w-5 h-5 text-[#006400]" />
            <span className="font-bold">Alle Gerichte gleichzeitig skalieren</span>
            <Button size="sm" variant="destructive" onClick={() => scaleAll(-1)}>−1 (alle)</Button>
            <Button size="sm" variant="destructive" onClick={() => scaleAll(+1)}>+1 (alle)</Button>
            <div className="flex items-center gap-1">
              <span className="text-sm">Auf Personenanzahl:</span>
              <Input type="number" min={1} max={100} className="w-20 bg-white text-black"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = parseInt((e.target as HTMLInputElement).value, 10);
                    if (Number.isFinite(v) && v >= 1 && v <= 100) setAllTo(v);
                    else toast.error("1–100, ganze Zahl");
                  }
                }} placeholder="z. B. 6" />
            </div>
          </div>
          <div className="text-xs text-content-fg/60">Aktuell gesamt: {totalCurrent} (Standard {totalDefault})</div>

          {/* Gespeicherte Umrechnungen */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#006400]/20">
            <Select value={activeScaling} onValueChange={loadScaling}>
              <SelectTrigger className="bg-white text-black w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__default">Standardmengen</SelectItem>
                {scalings.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {activeScaling !== "__default" && (
              <Button size="sm" variant="destructive" onClick={() => deleteScaling(activeScaling)}>
                <Trash2 className="w-3 h-3 mr-1" />Diese löschen
              </Button>
            )}
            <Input value={scalingName} onChange={(e) => setScalingName(e.target.value)} placeholder="Name der Umrechnung" className="bg-white text-black w-56" maxLength={80} />
            <Button size="sm" variant="gold" onClick={saveScaling}><Save className="w-3 h-3 mr-1" />Speichern</Button>
          </div>
        </Card>

        {/* Einzelgerichte */}
        <div className="space-y-3">
          {items.map((it) => {
            const r = recipeOf(it.recipe_id);
            const cur = servings[it.recipe_id] ?? it.default_servings;
            const factor = cur / Math.max(1, it.default_servings);
            return (
              <Card key={it.id} className="border border-[#006400]/20 p-3 bg-white">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Link to={`/recipes/${it.recipe_id}`} className="imperial-heading text-lg text-content-fg hover:text-[#006400]">
                    {r?.title ?? "…"}
                  </Link>
                  <ServingsControl
                    value={cur}
                    defaultValue={it.default_servings}
                    unit={r?.servings_unit ?? "Personen"}
                    onChange={(n) => setOne(it.recipe_id, n)}
                  />
                </div>
                {r?.ingredients && (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-content-fg/80 mt-2 bg-gray-50 rounded p-2">
                    {scaleIngredientsText(r.ingredients, factor)}
                  </pre>
                )}
              </Card>
            );
          })}
        </div>

        {canEdit && (
          <p className="text-xs text-content-fg/60">Tipp: Zum Bearbeiten der Rezeptauswahl ein neues Menü anlegen oder dieses kopieren.</p>
        )}
      </Card>
    </div>
  );
}
