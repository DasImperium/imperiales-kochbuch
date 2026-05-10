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
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import ImageUploader from "@/components/ImageUploader";
import { TIME_REGEX } from "@/lib/timeFormat";
import { saveDraft, removeDraft } from "@/lib/drafts";

const schema = z.object({
  title: z.string().trim().min(2).max(140),
  time_required: z.string().trim().regex(TIME_REGEX, 'Format z. B. "30 min" oder "1,5 h"'),
  description: z.string().trim().max(800).optional().or(z.literal("")),
  ingredients: z.string().trim().max(4000).optional().or(z.literal("")),
  instructions: z.string().trim().max(8000).optional().or(z.literal("")),
});

interface Category { id: string; name: string; is_root: boolean; parent_id: string | null; }

export default function RecipeEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editing = !!id;
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: "", time_required: "30 min", description: "", ingredients: "",
    instructions: "", image_url: "", category_id: "", is_draft: false,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [newRoot, setNewRoot] = useState("");

  useEffect(() => {
    supabase.from("categories").select("*").order("is_root", { ascending: false }).order("name")
      .then(({ data }) => setCategories(data ?? []));
    if (id) {
      supabase.from("recipes").select("*").eq("id", id).maybeSingle().then(({ data }) => {
        if (data) {
          setForm({
            title: data.title,
            time_required: data.time_required ?? "30 min",
            description: data.description ?? "",
            ingredients: data.ingredients ?? "",
            instructions: data.instructions ?? "",
            image_url: data.image_url ?? "",
            category_id: data.category_id ?? "",
            is_draft: data.is_draft,
          });
          setTags(data.tags ?? []);
        }
      });
    }
  }, [id]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t) || t.length > 40) return;
    setTags([...tags, t]);
    setTagInput("");
  };

  const addRootCategory = async () => {
    if (!user || !newRoot.trim()) return;
    const { data, error } = await supabase.from("categories").insert({
      name: newRoot.trim(), is_root: true, parent_id: null, created_by: user.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setCategories([...categories, data]);
    setForm({ ...form, category_id: data.id });
    setNewRoot("");
    toast.success("Hauptkategorie erstellt");
  };

  const save = async () => {
    if (!user) return;
    let parsed;
    try { parsed = schema.parse(form); } catch (e: any) { toast.error(e.errors?.[0]?.message ?? "Ungültig"); return; }
    setLoading(true);
    const payload = {
      title: parsed.title,
      time_required: parsed.time_required,
      description: parsed.description || null,
      ingredients: parsed.ingredients || null,
      instructions: parsed.instructions || null,
      image_url: form.image_url || null,
      category_id: form.category_id || null,
      tags,
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

  const saveLocal = () => {
    saveDraft({
      id: id ?? crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...form, tags,
    });
    toast.success("Lokal als Entwurf gespeichert");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="imperial-heading text-3xl text-gold mb-6">{editing ? "Rezept bearbeiten" : "Neues Rezept"}</h1>
      <Card className="imperial-surface border-gold/30 p-6 space-y-4">
        <div>
          <Label>Titel (einzigartig) *</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} className="bg-background/60" />
        </div>

        <div>
          <Label>Zeitaufwand * (z. B. „30 min" oder „1,5 h")</Label>
          <Input value={form.time_required} onChange={(e) => setForm({ ...form, time_required: e.target.value })} placeholder="30 min" className="bg-background/60" />
        </div>

        <div>
          <Label>Kurzbeschreibung</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={800} className="bg-background/60" />
        </div>

        <div>
          <Label>Bild</Label>
          <ImageUploader bucket="recipe-images" value={form.image_url || null} onChange={(url) => setForm({ ...form, image_url: url ?? "" })} />
        </div>

        <div>
          <Label>Kategorie</Label>
          <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
            <SelectTrigger className="bg-background/60"><SelectValue placeholder="Wählen…" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.is_root ? `★ ${c.name}` : `— ${c.name}`}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2 mt-2">
            <Input placeholder="Neue Hauptkategorie…" value={newRoot} onChange={(e) => setNewRoot(e.target.value)} className="bg-background/60" />
            <Button type="button" size="sm" variant="outline" onClick={addRootCategory} className="border-gold/40">+ Hauptkategorie</Button>
          </div>
        </div>

        <div>
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="border-gold/40">
                {t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="ml-1"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="z. B. Soße, Kuchen" maxLength={40} className="bg-background/60" />
            <Button type="button" size="sm" onClick={addTag} variant="outline" className="border-gold/40"><Plus className="w-4 h-4" /></Button>
          </div>
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

        <div className="flex gap-2 justify-end flex-wrap">
          <Button variant="outline" onClick={() => navigate(-1)}>Abbrechen</Button>
          <Button variant="outline" onClick={saveLocal} className="border-gold/40"><Save className="w-4 h-4 mr-1" /> Lokal sichern</Button>
          <Button onClick={save} disabled={loading} className="bg-gold text-gold-foreground hover:bg-gold-soft">Speichern</Button>
        </div>
      </Card>
    </div>
  );
}
