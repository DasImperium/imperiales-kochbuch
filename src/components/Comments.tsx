import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Trash2, Edit3, Check, X } from "lucide-react";
import { toast } from "sonner";
import ImageUploader from "./ImageUploader";

interface Comment {
  id: string; recipe_id: string; author_id: string; content: string;
  image_url: string | null; created_at: string;
  author_name?: string;
}

export default function Comments({ recipeId }: { recipeId: string }) {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const load = async () => {
    const { data } = await supabase.from("comments")
      .select("*")
      .eq("recipe_id", recipeId)
      .order("created_at", { ascending: false });
    const ids = Array.from(new Set((data ?? []).map((c) => c.author_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id,display_name").in("id", ids)
      : { data: [] as any };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p.display_name]));
    setItems((data ?? []).map((c) => ({ ...c, author_name: map.get(c.author_id) || "Unbekannt" })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`comments-${recipeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `recipe_id=eq.${recipeId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [recipeId]);

  const post = async () => {
    if (!user || !text.trim()) return;
    const { error } = await supabase.from("comments").insert({
      recipe_id: recipeId, author_id: user.id, content: text.trim().slice(0, 2000), image_url: image,
    });
    if (error) toast.error(error.message);
    else { setText(""); setImage(null); }
  };

  const del = async (id: string) => {
    if (!confirm("Kommentar löschen?")) return;
    await supabase.from("comments").delete().eq("id", id);
  };

  const saveEdit = async (id: string) => {
    await supabase.from("comments").update({ content: editText.slice(0, 2000) }).eq("id", id);
    setEditing(null);
  };

  return (
    <Card className="mt-6 p-4 imperial-surface border-gold/30">
      <h3 className="imperial-heading text-gold mb-3">Kommentare ({items.length})</h3>

      {user && (
        <div className="space-y-2 mb-4">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Dein Kommentar…" maxLength={2000} className="bg-background/60" />
          <ImageUploader bucket="comment-images" value={image} onChange={setImage} label="Bild zum Kommentar" />
          <Button onClick={post} disabled={!text.trim()} className="bg-gold text-gold-foreground hover:bg-gold-soft">Senden</Button>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((c) => {
          const canEdit = user?.id === c.author_id || isAdmin;
          return (
            <li key={c.id} className="bg-background/40 rounded p-3">
              <div className="flex justify-between text-xs text-surface-foreground/70 mb-1">
                <span className="text-gold">{c.author_name}</span>
                <span>{new Date(c.created_at).toLocaleString("de-DE")}</span>
              </div>
              {editing === c.id ? (
                <div className="space-y-2">
                  <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="bg-background/60" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(c.id)}><Check className="w-3 h-3 mr-1" />Speichern</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}><X className="w-3 h-3 mr-1" />Abbrechen</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                  {c.image_url && <img src={c.image_url} alt="" className="mt-2 max-h-48 rounded border border-gold/30" />}
                  {canEdit && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(c.id); setEditText(c.content); }}>
                        <Edit3 className="w-3 h-3 mr-1" />Bearbeiten
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => del(c.id)} className="text-destructive">
                        <Trash2 className="w-3 h-3 mr-1" />Löschen
                      </Button>
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
        {items.length === 0 && <p className="text-sm text-surface-foreground/60">Noch keine Kommentare.</p>}
      </ul>
    </Card>
  );
}
