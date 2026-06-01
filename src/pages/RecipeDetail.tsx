import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star, Heart, FileDown, Edit3, Trash2, Copy, Plus, Clock, Users, Lock, ShoppingCart, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import Comments from "@/components/Comments";
import { formatTime } from "@/lib/timeFormat";
import { scaleIngredientsText } from "@/lib/scaling";
import ServingsControl from "@/components/ServingsControl";
import { CategoryRow, formatCategoryPath } from "@/lib/categories";
import { softDeleteRecipe, setProtection, TIER_COLOR, TIER_LABEL } from "@/lib/recipeAdmin";
import { parseIngredients } from "@/lib/ingredients";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const titleSchema = z.string().trim().min(2).max(140);

interface Recipe {
  id: string; title: string; description: string | null; ingredients: string | null;
  instructions: string | null; image_url: string | null; category_id: string | null;
  author_id: string; created_at: string; time_required: string; tags: string[];
  servings: number; servings_unit: string; protection_tier?: number; deleted_at?: string | null;
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isSuperadmin, isImperator, tier } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCooked, setConfirmCooked] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [author, setAuthor] = useState<string>("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [avg, setAvg] = useState<number>(0);
  const [myStars, setMyStars] = useState<number>(0);
  const [isFav, setIsFav] = useState(false);
  const [reason, setReason] = useState("");
  const [newTag, setNewTag] = useState("");
  const [servings, setServings] = useState(4);

  const load = async () => {
    if (!id) return;
    const { data: r } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
    if (!r) return;
    setRecipe(r as Recipe);
    setServings(r.servings ?? 4);
    const [{ data: prof }, { data: cs }, { data: ratings }, { data: fav }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", r.author_id).maybeSingle(),
      supabase.from("categories").select("*"),
      supabase.from("ratings").select("stars,user_id").eq("recipe_id", r.id),
      user ? supabase.from("favorites").select("recipe_id").eq("user_id", user.id).eq("recipe_id", r.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setAuthor(prof?.display_name ?? "Unbekannt");
    setCategories((cs ?? []) as CategoryRow[]);
    if (ratings && ratings.length) {
      setAvg(ratings.reduce((s: number, x: any) => s + x.stars, 0) / ratings.length);
      const mine = ratings.find((x: any) => x.user_id === user?.id);
      setMyStars(mine?.stars ?? 0);
    } else { setAvg(0); setMyStars(0); }
    setIsFav(!!fav);
  };

  useEffect(() => { load(); }, [id, user]);

  const factor = useMemo(() => recipe ? servings / Math.max(1, recipe.servings) : 1, [servings, recipe]);
  const scaledIngredients = useMemo(() => recipe ? scaleIngredientsText(recipe.ingredients, factor) : "", [recipe, factor]);
  const categoryPath = recipe ? formatCategoryPath(recipe.category_id, categories) : "";

  const rate = async (stars: number) => {
    if (!user || !recipe) return;
    await supabase.from("ratings").upsert({ user_id: user.id, recipe_id: recipe.id, stars });
    toast.success("Bewertung gespeichert"); load();
  };

  const toggleFav = async () => {
    if (!user || !recipe) return;
    if (isFav) await supabase.from("favorites").delete().eq("user_id", user.id).eq("recipe_id", recipe.id);
    else await supabase.from("favorites").insert({ user_id: user.id, recipe_id: recipe.id });
    setIsFav(!isFav);
  };

  const fork = async () => {
    if (!user || !recipe) return;
    const newTitle = prompt("Neuer einzigartiger Titel:", `${recipe.title} (Variante)`);
    if (!newTitle) return;
    try { titleSchema.parse(newTitle); } catch { toast.error("Ungültiger Titel"); return; }
    const { data, error } = await supabase.from("recipes").insert({
      title: newTitle.trim(), description: recipe.description, ingredients: recipe.ingredients,
      instructions: recipe.instructions, image_url: recipe.image_url, category_id: recipe.category_id,
      author_id: user.id, is_draft: true, parent_recipe_id: recipe.id,
      time_required: recipe.time_required, tags: recipe.tags,
      servings: recipe.servings, servings_unit: recipe.servings_unit,
    }).select().single();
    if (error) toast.error(error.code === "23505" ? "Titel existiert bereits" : error.message);
    else { toast.success("Abwandlung als Entwurf erstellt"); navigate(`/recipes/${data.id}/edit`); }
  };

  const requestDeletion = async () => {
    if (!user || !recipe) return;
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (!admins?.length) { toast.error("Kein Admin verfügbar"); return; }
    const { error: dErr } = await supabase.from("deletion_requests").insert({
      recipe_id: recipe.id, requester_id: user.id, reason,
    });
    if (dErr) { toast.error(dErr.message); return; }
    const link = `${window.location.origin}/recipes/${recipe.id}`;
    const content = `Löschantrag\nRezept: ${recipe.title}\nAutor: ${author}\nGrund: ${reason || "—"}\nLink: ${link}`;
    await Promise.all(admins.map((a) => supabase.from("chat_messages").insert({
      sender_id: user.id, recipient_id: a.user_id, content,
    })));
    toast.success("Löschantrag gesendet"); setReason("");
  };

  const doDelete = async () => {
    if (!recipe || !user) return;
    if ((recipe.protection_tier ?? 0) > tier) { toast.error("Geschütztes Rezept – höhere Stufe nötig"); return; }
    const ok = await softDeleteRecipe(recipe.id, user.id, tier);
    if (ok) { toast.success("Gelöscht"); navigate("/recipes"); }
  };

  const addToShopping = async () => {
    if (!user || !recipe) return;
    const items = parseIngredients(recipe.ingredients, factor);
    if (items.length === 0) { toast.error("Keine Zutaten erkannt"); return; }
    const rows = items.filter((it) => it.amount > 0 || it.name).map((it) => ({
      owner_id: user.id, name: it.name, amount: it.amount, unit: it.unit,
    }));
    const { error } = await supabase.from("shopping_items").insert(rows);
    if (error) toast.error(error.message); else toast.success(`${rows.length} Artikel zur Einkaufsliste hinzugefügt`);
  };

  const addMissingToShopping = async () => {
    if (!user || !recipe) return;
    const need = parseIngredients(recipe.ingredients, factor);
    const { data: inv } = await supabase.from("inventory_items").select("*").eq("owner_id", user.id);
    const rows: any[] = [];
    for (const it of need) {
      const have = (inv ?? []).find((x: any) => x.name.toLowerCase() === it.name.toLowerCase() && (x.unit ?? "").toLowerCase() === (it.unit ?? "").toLowerCase());
      const diff = it.amount - Number(have?.amount ?? 0);
      if (diff > 0) rows.push({ owner_id: user.id, name: it.name, amount: diff, unit: it.unit });
    }
    if (rows.length === 0) { toast.success("Alles vorhanden – nichts ergänzt"); return; }
    const { error } = await supabase.from("shopping_items").insert(rows);
    if (error) toast.error(error.message); else toast.success(`${rows.length} fehlende Artikel ergänzt`);
  };

  const subtractFromInventory = async () => {
    if (!user || !recipe) return;
    const need = parseIngredients(recipe.ingredients, factor);
    const { data: inv } = await supabase.from("inventory_items").select("*").eq("owner_id", user.id);
    for (const it of need) {
      const existing = (inv ?? []).find((x: any) => x.name.toLowerCase() === it.name.toLowerCase() && (x.unit ?? "").toLowerCase() === (it.unit ?? "").toLowerCase());
      if (existing) {
        const newAmt = Math.max(0, Number(existing.amount) - it.amount);
        await supabase.from("inventory_items").update({ amount: newAmt }).eq("id", existing.id);
      }
    }
    toast.success("Mengen vom Inventar abgezogen"); setConfirmCooked(false);
  };

  const addTag = async () => {
    if (!recipe || !newTag.trim()) return;
    const { error } = await supabase.rpc("add_recipe_tag", { _recipe_id: recipe.id, _tag: newTag });
    if (error) toast.error(error.message); else { setNewTag(""); load(); }
  };
  const removeTag = async (t: string) => {
    if (!recipe) return;
    await supabase.rpc("remove_recipe_tag", { _recipe_id: recipe.id, _tag: t }); load();
  };

  const exportPDF = async () => {
    if (!recipe) return;
    const win = window.open("", "_blank"); if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${recipe.title}</title>
<style>
  body { font-family: 'Roboto', sans-serif; background: #1A1A1A; color: #f5e7c4; padding: 40px; max-width: 800px; margin: auto; }
  h1 { font-family: 'Cinzel', serif; color: #FFD700; border-bottom: 2px solid #FFD700; padding-bottom: 8px; }
  .meta { color: #ccc; font-size: 14px; margin-bottom: 20px; }
  .tags span { display:inline-block; background:#fff; color:#006400; padding:2px 8px; margin:2px; border-radius:4px; font-size:12px; font-weight:bold;}
  h2 { color: #FFD700; font-family: 'Cinzel', serif; margin-top: 24px; }
  pre { white-space: pre-wrap; font-family: inherit; line-height: 1.6; }
  img { max-width: 100%; border: 2px solid #FFD700; border-radius: 6px; margin: 12px 0; }
  @media print { body { background: white; color: #222; } h1, h2 { color: #8b6914; } }
</style></head><body>
<h1>${esc(recipe.title)}</h1>
<div class="meta">Autor: ${esc(author)} · ${esc(categoryPath || "—")} · Zeit: ${esc(recipe.time_required)} · Für ${servings} ${esc(recipe.servings_unit)} · Bewertung: ${avg.toFixed(1)} ★</div>
<div class="tags">${(recipe.tags ?? []).map((t) => `<span>#${esc(t)}</span>`).join("")}</div>
${recipe.image_url ? `<img src="${recipe.image_url}" alt="">` : ""}
${recipe.description ? `<p>${esc(recipe.description)}</p>` : ""}
<h2>Zutaten (für ${servings} ${esc(recipe.servings_unit)})</h2><pre>${esc(scaledIngredients)}</pre>
<h2>Zubereitung</h2><pre>${esc(recipe.instructions || "")}</pre>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`);
    win.document.close();
  };

  if (!recipe) return <div className="p-8 text-center">Lade…</div>;
  const canEdit = user?.id === recipe.author_id || isAdmin;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <article className="recipe-card overflow-hidden">
        {recipe.image_url && <img src={recipe.image_url} alt={recipe.title} className="w-full h-64 object-cover" />}
        <div className="p-6">
          <h1 className="imperial-heading text-3xl mb-1 text-content-fg break-words whitespace-normal flex items-center gap-2 flex-wrap">
            {(recipe.protection_tier ?? 0) > 0 && isAdmin && (
              <span title={`${TIER_LABEL[recipe.protection_tier!]}-Schutz`} style={{ color: TIER_COLOR[recipe.protection_tier!] }}>
                <Lock className="w-6 h-6" />
              </span>
            )}
            <span className="break-words">{recipe.title}</span>
          </h1>

          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-black text-[#FFD700]">
              <Star className="w-3 h-3 fill-[#FFD700]" /> {avg.toFixed(1)}
            </span>
            {myStars > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-white text-[#006400] border border-[#006400]/30" title="Deine Bewertung">
                <Star className="w-3 h-3 fill-[#006400]" /> {myStars}
              </span>
            )}
            {categoryPath && <span className="text-xs px-2 py-0.5 rounded bg-white text-[#006400] font-bold border border-[#006400]/30">{categoryPath}</span>}
            <span className="text-sm text-content-fg/70">von <strong>{author}</strong></span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-white text-[#006400] font-bold">
              <Clock className="w-3 h-3" /> {formatTime(recipe.time_required)}
            </span>
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {(recipe.tags ?? []).map((t) => (
              <Badge key={t} variant="outline" className="bg-white text-[#006400] border-[#006400]/40 font-bold">
                #{t}
                <button onClick={() => removeTag(t)} className="ml-1 text-destructive" title="Tag entfernen">×</button>
              </Badge>
            ))}
            <div className="flex gap-1">
              <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="+ Tag" maxLength={40}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                className="h-7 w-28 text-xs bg-white text-black" />
              <Button size="sm" onClick={addTag} className="h-7 px-2"><Plus className="w-3 h-3" /></Button>
            </div>
          </div>

          <Card className="bg-white border border-[#006400]/30 p-3 mb-4 flex items-center gap-3 flex-wrap">
            <Users className="w-5 h-5 text-[#006400]" />
            <span className="font-bold text-content-fg">Für</span>
            <ServingsControl
              value={servings}
              defaultValue={recipe.servings}
              unit={recipe.servings_unit}
              onChange={setServings}
            />
            {servings !== recipe.servings && (
              <Button variant="outline" size="sm" onClick={() => setServings(recipe.servings)}>
                Standard ({recipe.servings})
              </Button>
            )}
          </Card>

          <div className="flex flex-wrap gap-2 mb-4">
            <Button onClick={toggleFav} variant={isFav ? "gold" : "outline"} size="sm">
              <Heart className={`w-4 h-4 mr-1 ${isFav ? "fill-current" : ""}`} /> Favorit
            </Button>
            <Button onClick={exportPDF} variant="outline" size="sm"><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
            <Button onClick={fork} variant="outline" size="sm"><Copy className="w-4 h-4 mr-1" /> Abwandeln</Button>
            {canEdit && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/recipes/${recipe.id}/edit`}><Edit3 className="w-4 h-4 mr-1" /> Bearbeiten</Link>
              </Button>
            )}
            {(canEdit || isAdmin) && (
              <Button onClick={() => setConfirmDelete(true)} variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-1" /> Löschen
              </Button>
            )}
            <Button onClick={addToShopping} variant="blue" size="sm">
              <ShoppingCart className="w-4 h-4 mr-1" />Zur Einkaufsliste
            </Button>
            <Button onClick={addMissingToShopping} variant="blue" size="sm">
              <ShoppingCart className="w-4 h-4 mr-1" />Fehlendes ergänzen
            </Button>
            <Button onClick={() => setConfirmCooked(true)} variant="gold" size="sm">
              <ChefHat className="w-4 h-4 mr-1" />Gekocht
            </Button>
            {/* Schutz setzen (nur Admin+) */}
            {isAdmin && (
              <Select value={String(recipe.protection_tier ?? 0)} onValueChange={async (v) => {
                const t = parseInt(v, 10);
                if (t > tier) { toast.error("Höhere Stufe als deine"); return; }
                const ok = await setProtection(recipe.id, t); if (ok) { toast.success("Schutz gesetzt"); load(); }
              }}>
                <SelectTrigger className="w-[180px] bg-white text-black h-9"><SelectValue placeholder="Schutz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Kein Schutz</SelectItem>
                  <SelectItem value="2" disabled={tier < 2}>Admin-Schutz (rot)</SelectItem>
                  <SelectItem value="3" disabled={tier < 3}>Superadmin-Schutz (blau)</SelectItem>
                  <SelectItem value="4" disabled={tier < 4}>Imperator-Schutz (grün)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {recipe.description && <p className="mb-4 text-content-fg/80 leading-relaxed break-words">{recipe.description}</p>}

          <h2 className="imperial-heading text-xl text-[#006400] mt-6 mb-2">Zutaten</h2>
          <div className="gold-divider mb-3" />
          <pre className="whitespace-pre-wrap font-sans leading-[1.6] text-content-fg">{scaledIngredients}</pre>

          <h2 className="imperial-heading text-xl text-[#006400] mt-6 mb-2">Zubereitung</h2>
          <div className="gold-divider mb-3" />
          <pre className="whitespace-pre-wrap font-sans leading-[1.6] text-content-fg">{recipe.instructions}</pre>

          <Card className="mt-6 p-4 bg-white border-gold/30">
            <h3 className="imperial-heading text-[#006400] mb-2">Deine Bewertung</h3>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => rate(n)} aria-label={`${n} Sterne`}>
                  <Star className={`w-7 h-7 transition ${n <= myStars ? "fill-[#006400] text-[#006400]" : "text-[#006400]/30 hover:text-[#006400]/70"}`} />
                </button>
              ))}
            </div>

            <h3 className="imperial-heading text-[#006400] mb-2">Löschung beantragen</h3>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Grund (optional)" maxLength={500} className="bg-white text-black mb-2" />
            <Button onClick={requestDeletion} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-1" /> Antrag senden
            </Button>
          </Card>

          <Comments recipeId={recipe.id} />
        </div>
      </article>

      {/* Lösch-Bestätigung */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wollen Sie „{recipe.title}" wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>Wird ausgeblendet, im Admin-Bereich wiederherstellbar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nein</AlertDialogCancel>
            <AlertDialogAction className="bg-[#C0392B] text-white hover:bg-[#A93226]" onClick={doDelete}>Ja, löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Gekocht-Bestätigung */}
      <AlertDialog open={confirmCooked} onOpenChange={setConfirmCooked}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{recipe.title} – als gekocht markieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Für {servings} {recipe.servings_unit} werden folgende Mengen vom Inventar abgezogen:
              <ul className="mt-2 max-h-48 overflow-y-auto text-xs space-y-0.5">
                {parseIngredients(recipe.ingredients, factor).slice(0, 30).map((it, i) => (
                  <li key={i}>• {it.amount > 0 ? `${it.amount.toFixed(1)} ${it.unit} ` : ""}{it.name}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nein</AlertDialogCancel>
            <AlertDialogAction className="bg-[#FFD700] text-black hover:bg-[#FFC700]" onClick={subtractFromInventory}>Ja, abziehen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
