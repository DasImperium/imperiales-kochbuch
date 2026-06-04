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
import { saveDraft } from "@/lib/drafts";
import CategoryPicker from "@/components/CategoryPicker";
import { CategoryRow } from "@/lib/categories";
import { clampServings } from "@/lib/scaling";

const schema = z.object({
  title: z.string().trim().min(2).max(140),
  time_required: z.string().trim().regex(TIME_REGEX, 'Format z. B. "30 min" oder "1,5 h"'),
  description: z.string().trim().max(800).optional().or(z.literal("")),
  ingredients: z.string().trim().max(4000).optional().or(z.literal("")),
  instructions: z.string().trim().max(8000).optional().or(z.literal("")),
});

interface Profile { id: string; display_name: string | null; }

export default function RecipeEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const editing = !!id;
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [originalAuthor, setOriginalAuthor] = useState<string>("");
  const [form, setForm] = useState({
    title: "", time_required: "30 min", description: "", ingredients: "",
    instructions: "", image_url: "", category_id: "" as string, is_draft: false,
    servings: 4, servings_unit: "Personen", author_id: "" as string,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("categories").select("*").order("is_root", { ascending: false }).order("name")
      .then(({ data }) => setCategories((data ?? []) as CategoryRow[]));
    if (isAdmin) {
      supabase.from("profiles").select("id,display_name").order("display_name")
        .then(({ data }) => setProfiles((data ?? []) as Profile[]));
    }
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
            servings: data.servings ?? 4,
            servings_unit: data.servings_unit ?? "Personen",
            author_id: data.author_id,
          });
          setOriginalAuthor(data.author_id);
          setTags(data.tags ?? []);
        }
      });
    } else if (user) {
      setForm((f) => ({ ...f, author_id: user.id }));
      setOriginalAuthor(user.id);
    }
  }, [id, user, isAdmin]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t) || t.length > 40) return;
    setTags([...tags, t]); setTagInput("");
  };

  const save = async () => {
    if (!user) return;
    if (!form.category_id) { toast.error("Bitte eine Hauptkategorie wählen"); return; }
    let parsed;
    try { parsed = schema.parse(form); } catch (e: any) { toast.error(e.errors?.[0]?.message ?? "Ungültig"); return; }
    setLoading(true);
    // Author: nur Admin darf ändern, sonst eigene/originale beibehalten
    const author_id = isAdmin ? (form.author_id || originalAuthor || user.id) : (originalAuthor || user.id);
    const payload = {
      title: parsed.title,
      time_required: parsed.time_required,
      description: parsed.description || null,
      ingredients: parsed.ingredients || null,
      instructions: parsed.instructions || null,
      image_url: form.image_url || null,
      category_id: form.category_id,
      tags,
      is_draft: form.is_draft,
      servings: clampServings(form.servings),
      servings_unit: form.servings_unit.trim() || "Personen",
      author_id,
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
    saveDraft({ id: id ?? crypto.randomUUID(), created_at: new Date().toISOString(), ...form, tags });
    toast.success("Lokal als Entwurf gespeichert");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="imperial-heading text-3xl text-gold mb-6">{editing ? "Rezept bearbeiten" : "Neues Rezept"}</h1>
      <Card className="bg-white text-black border-gold/30 p-6 space-y-4">
        <div>
          <Label>Titel (einzigartig) *</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} className="bg-white text-black" />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Zeitaufwand * (z. B. „30 min" oder „1,5 h")</Label>
            <Input value={form.time_required} onChange={(e) => setForm({ ...form, time_required: e.target.value })} className="bg-white text-black" />
          </div>
          <div>
            <Label>Für (1–100)</Label>
            <div className="flex gap-2">
              <Input type="number" min={1} max={100} value={form.servings}
                onChange={(e) => setForm({ ...form, servings: clampServings(parseInt(e.target.value || "0", 10)) })}
                className="bg-white text-black w-24" />
              <Select value={form.servings_unit} onValueChange={(v) => setForm({ ...form, servings_unit: v })}>
                <SelectTrigger className="bg-white text-black"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Personen">Personen</SelectItem>
                  <SelectItem value="Stück">Stück</SelectItem>
                  <SelectItem value="Portionen">Portionen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div>
          <Label>Kurzbeschreibung</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={800} className="bg-white text-black" />
        </div>

        <div>
          <Label>Bild</Label>
          <ImageUploader bucket="recipe-images" value={form.image_url || null} onChange={(url) => setForm({ ...form, image_url: url ?? "" })} />
        </div>

        <div>
          <Label>Kategorie *</Label>
          <CategoryPicker
            categories={categories}
            value={form.category_id || null}
            onChange={(v) => setForm({ ...form, category_id: v ?? "" })}
            onCategoriesChanged={setCategories}
            userId={user?.id}
          />
        </div>

        {isAdmin && profiles.length > 0 && (
          <div className="rounded-md border border-[#006400]/40 bg-[#006400]/5 p-3 space-y-2">
            <Label className="text-[#006400] font-bold">Admin: Ersteller-Zuordnung</Label>
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={form.author_id} onValueChange={(v) => setForm({ ...form, author_id: v })}>
                <SelectTrigger className="bg-white text-black w-[260px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || p.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {originalAuthor && form.author_id !== originalAuthor && (
                <Button type="button" variant="outline" onClick={() => setForm({ ...form, author_id: originalAuthor })}>
                  Ursprünglichen Ersteller wiederherstellen
                </Button>
              )}
            </div>
          </div>
        )}

        <div>
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="bg-white text-[#006400] border-[#006400]/40 font-bold">
                #{t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="ml-1"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="z. B. Soße, Kuchen" maxLength={40} className="bg-white text-black" />
            <Button type="button" size="sm" onClick={addTag}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>

        <div>
          <Label>Zutaten (eine Zutat pro Zeile)</Label>
          <Textarea rows={6} value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} maxLength={4000} className="bg-white text-black font-mono" />
        </div>

        <div>
          <Label>Zubereitung</Label>
          <Textarea rows={10} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} maxLength={8000} className="bg-white text-black" />
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={form.is_draft} onCheckedChange={(v) => setForm({ ...form, is_draft: v })} />
          <Label>Als Entwurf speichern</Label>
        </div>

        <div className="flex gap-2 justify-end flex-wrap">
          <Button variant="outline" onClick={() => navigate(-1)}>Abbrechen</Button>
          <Button variant="outline" onClick={saveLocal}><Save className="w-4 h-4 mr-1" /> Lokal sichern</Button>
          <Button onClick={save} disabled={loading} variant="gold">Speichern</Button>
        </div>
      </Card>
    </div>
  );
}
