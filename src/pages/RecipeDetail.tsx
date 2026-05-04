import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Heart, FileDown, Edit3, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const titleSchema = z.string().trim().min(2).max(140);

interface Recipe {
  id: string; title: string; description: string | null; ingredients: string | null;
  instructions: string | null; image_url: string | null; category_id: string | null;
  author_id: string; created_at: string;
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [author, setAuthor] = useState<string>("");
  const [categoryName, setCategoryName] = useState<string>("");
  const [avg, setAvg] = useState<number>(0);
  const [myStars, setMyStars] = useState<number>(0);
  const [isFav, setIsFav] = useState(false);
  const [reason, setReason] = useState("");

  const load = async () => {
    if (!id) return;
    const { data: r } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
    if (!r) return;
    setRecipe(r);
    const [{ data: prof }, { data: cat }, { data: ratings }, { data: fav }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", r.author_id).maybeSingle(),
      r.category_id ? supabase.from("categories").select("name").eq("id", r.category_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("ratings").select("stars,user_id").eq("recipe_id", r.id),
      user ? supabase.from("favorites").select("recipe_id").eq("user_id", user.id).eq("recipe_id", r.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setAuthor(prof?.display_name ?? "Unbekannt");
    setCategoryName((cat as any)?.name ?? "");
    if (ratings && ratings.length) {
      setAvg(ratings.reduce((s: number, x: any) => s + x.stars, 0) / ratings.length);
      const mine = ratings.find((x: any) => x.user_id === user?.id);
      setMyStars(mine?.stars ?? 0);
    } else { setAvg(0); setMyStars(0); }
    setIsFav(!!fav);
  };

  useEffect(() => { load(); }, [id, user]);

  const rate = async (stars: number) => {
    if (!user || !recipe) return;
    await supabase.from("ratings").upsert({ user_id: user.id, recipe_id: recipe.id, stars });
    toast.success("Bewertung gespeichert");
    load();
  };

  const toggleFav = async () => {
    if (!user || !recipe) return;
    if (isFav) await supabase.from("favorites").delete().eq("user_id", user.id).eq("recipe_id", recipe.id);
    else await supabase.from("favorites").insert({ user_id: user.id, recipe_id: recipe.id });
    setIsFav(!isFav);
  };

  const fork = async () => {
    if (!user || !recipe) return;
    const newTitle = prompt("Neuer einzigartiger Titel für die Abwandlung:", `${recipe.title} (Variante)`);
    if (!newTitle) return;
    try { titleSchema.parse(newTitle); } catch { toast.error("Ungültiger Titel"); return; }
    const { data, error } = await supabase.from("recipes").insert({
      title: newTitle.trim(),
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image_url: recipe.image_url,
      category_id: recipe.category_id,
      author_id: user.id,
      is_draft: true,
      parent_recipe_id: recipe.id,
    }).select().single();
    if (error) toast.error(error.code === "23505" ? "Titel existiert bereits" : error.message);
    else { toast.success("Abwandlung als Entwurf erstellt"); navigate(`/recipes/${data.id}/edit`); }
  };

  const requestDeletion = async () => {
    if (!user || !recipe) return;
    // find an admin
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
    toast.success("Löschantrag gesendet");
    setReason("");
  };

  const adminDelete = async () => {
    if (!recipe) return;
    if (!confirm("Rezept endgültig löschen?")) return;
    await supabase.from("recipes").delete().eq("id", recipe.id);
    toast.success("Gelöscht");
    navigate("/recipes");
  };

  const exportPDF = async () => {
    if (!recipe) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${recipe.title}</title>
<style>
  body { font-family: 'Roboto', sans-serif; background: #1A1A1A; color: #f5e7c4; padding: 40px; max-width: 800px; margin: auto; }
  h1 { font-family: 'Cinzel', serif; color: #FFD700; border-bottom: 2px solid #FFD700; padding-bottom: 8px; }
  .meta { color: #ccc; font-size: 14px; margin-bottom: 20px; }
  h2 { color: #FFD700; font-family: 'Cinzel', serif; margin-top: 24px; }
  pre { white-space: pre-wrap; font-family: inherit; line-height: 1.6; }
  img { max-width: 100%; border: 2px solid #FFD700; border-radius: 6px; margin: 12px 0; }
  @media print { body { background: white; color: #222; } h1, h2 { color: #8b6914; } }
</style>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Roboto&display=swap" rel="stylesheet">
</head><body>
<h1>${escapeHtml(recipe.title)}</h1>
<div class="meta">Autor: ${escapeHtml(author)} · Kategorie: ${escapeHtml(categoryName || "—")} · Bewertung: ${avg.toFixed(1)} ★</div>
${recipe.image_url ? `<img src="${recipe.image_url}" alt="">` : ""}
${recipe.description ? `<p>${escapeHtml(recipe.description)}</p>` : ""}
<h2>Zutaten</h2><pre>${escapeHtml(recipe.ingredients || "")}</pre>
<h2>Zubereitung</h2><pre>${escapeHtml(recipe.instructions || "")}</pre>
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
          <h1 className="imperial-heading text-3xl mb-1">{recipe.title}</h1>
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`w-4 h-4 ${n <= Math.round(avg) ? "fill-gold text-gold" : "text-gold/30"}`} />
            ))}
            <span className="text-sm text-content-fg/70 ml-2">{avg.toFixed(1)} · {categoryName || "—"} · von {author}</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <Button onClick={toggleFav} variant={isFav ? "default" : "outline"} size="sm" className={isFav ? "bg-gold text-gold-foreground" : "border-gold/40"}>
              <Heart className={`w-4 h-4 mr-1 ${isFav ? "fill-current" : ""}`} /> Favorit
            </Button>
            <Button onClick={exportPDF} variant="outline" size="sm" className="border-gold/40">
              <FileDown className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button onClick={fork} variant="outline" size="sm" className="border-gold/40">
              <Copy className="w-4 h-4 mr-1" /> Abwandeln
            </Button>
            {canEdit && (
              <Button asChild variant="outline" size="sm" className="border-gold/40">
                <Link to={`/recipes/${recipe.id}/edit`}><Edit3 className="w-4 h-4 mr-1" /> Bearbeiten</Link>
              </Button>
            )}
            {isAdmin && (
              <Button onClick={adminDelete} variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-1" /> Löschen
              </Button>
            )}
          </div>

          {recipe.description && <p className="mb-4 text-content-fg/80 leading-relaxed">{recipe.description}</p>}

          <h2 className="imperial-heading text-xl text-gold mt-6 mb-2">Zutaten</h2>
          <div className="gold-divider mb-3" />
          <pre className="whitespace-pre-wrap font-sans leading-[1.6]">{recipe.ingredients}</pre>

          <h2 className="imperial-heading text-xl text-gold mt-6 mb-2">Zubereitung</h2>
          <div className="gold-divider mb-3" />
          <pre className="whitespace-pre-wrap font-sans leading-[1.6]">{recipe.instructions}</pre>

          <Card className="mt-6 p-4 imperial-surface border-gold/30">
            <h3 className="imperial-heading text-gold mb-2">Deine Bewertung</h3>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => rate(n)} aria-label={`${n} Sterne`}>
                  <Star className={`w-7 h-7 transition ${n <= myStars ? "fill-gold text-gold" : "text-gold/30 hover:text-gold/70"}`} />
                </button>
              ))}
            </div>

            <h3 className="imperial-heading text-gold mb-2">Löschung beantragen</h3>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Grund (optional)" maxLength={500} className="bg-background/60 mb-2" />
            <Button onClick={requestDeletion} variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
              <Trash2 className="w-4 h-4 mr-1" /> Antrag senden
            </Button>
          </Card>
        </div>
      </article>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
