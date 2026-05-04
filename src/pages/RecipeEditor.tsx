import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(800).optional().or(z.literal("")),
  ingredients: z.string().trim().max(4000).optional().or(z.literal("")),
  instructions: z.string().trim().max(8000).optional().or(z.literal("")),
  image_url: z.string().trim().max(500).optional().or(z.literal("")),
});

interface Category { id: string; name: string; is_root: boolean; }

export default function RecipeEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const editing = !!id;
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", ingredients: "", instructions: "", image_url: "", category_id: "", is_draft: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("categories").select("*").order("is_root", { ascending: false }).order("name")
      .then(({ data }) => setCategories(data ?? []));
    if (id) {
      supabase.from("recipes").select("*").eq("id", id).maybeSingle().then(({ data }) => {
        if (data) setForm({
          title: data.title,
          description: data.description ?? "",
          ingredients: data.ingredients ?? "",
          instructions: data.instructions ?? "",
          image_url: data.image_url ?? "",
          category_id: data.category_id ?? "",
          is_draft: data.is_draft,
        });
      });
    }
  }, [id]);

  const save = async () => {
    if (!user) return;
    let parsed;
    try { parsed = schema.parse(form); } catch (e: any) { toast.error(e.errors?.[0]?.message ?? "Ungültig"); return; }
    setLoading(true);
    const payload = {
      title: parsed.title,
      description: parsed.description || null,
      ingredients: parsed.ingredients || null,
      instructions: parsed.instructions || null,
      image_url: parsed.image_url || null,
      category_id: form.category_id || null,
      is_draft: form.is_draft,
      author_id: user.id,
    };
    const res = id
      ? await supabase.from("recipes").update(payload).eq("id", id).select().single()
      : await supabase.from("recipes").insert(payload).select().single();
    setLoading(false);
    if (res.error) {
      toast.error(res.error.code === "23505" ? "Ein Rezept mit diesem Titel existiert bereits" : res.error.message);
      return;
    }
    toast.success("Gespeichert");
    navigate(`/recipes/${res.data.id}`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="imperial-heading text-3xl text-gold mb-6">{editing ? "Rezept bearbeiten" : "Neues Rezept"}</h1>
      <Card className="imperial-surface border-gold/30 p-6 space-y-4">
        <div>
          <Label>Titel (einzigartig)</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} className="bg-background/60" />
        </div>
        <div>
          <Label>Kurzbeschreibung</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={800} className="bg-background/60" />
        </div>
        <div>
          <Label>Bild-URL (optional)</Label>
          <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} maxLength={500} className="bg-background/60" />
        </div>
        <div>
          <Label>Kategorie</Label>
          <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
            <SelectTrigger className="bg-background/60"><SelectValue placeholder="Wählen…" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.is_root ? `★ ${c.name}` : `— ${c.name}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Zutaten</Label>
          <Textarea rows={6} value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} maxLength={4000} className="bg-background/60 font-mono" />
        </div>
        <div>
          <Label>Zubereitung</Label>
          <Textarea rows={10} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} maxLength={8000} className="bg-background/60" />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.is_draft} onCheckedChange={(v) => setForm({ ...form, is_draft: v })} />
          <Label>Als Entwurf speichern</Label>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => navigate(-1)}>Abbrechen</Button>
          <Button onClick={save} disabled={loading} className="bg-gold text-gold-foreground hover:bg-gold-soft">Speichern</Button>
        </div>
      </Card>
    </div>
  );
}
