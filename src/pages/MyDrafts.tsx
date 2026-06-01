import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit3, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Draft { id: string; title: string; description: string | null; updated_at: string; }

export default function MyDrafts() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("recipes")
      .select("id,title,description,updated_at")
      .eq("author_id", user.id).eq("is_draft", true)
      .order("updated_at", { ascending: false });
    setDrafts((data ?? []) as Draft[]);
  };
  useEffect(() => { load(); }, [user]);

  const remove = async (id: string, title: string) => {
    if (!confirm(`Entwurf „${title}" löschen?`)) return;
    await supabase.from("recipes").delete().eq("id", id);
    toast.success("Entwurf gelöscht"); load();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="imperial-heading text-3xl text-gold mb-6 flex items-center gap-2 break-words">
        <FileText className="w-7 h-7" /> Meine Entwürfe
      </h1>
      {drafts.length === 0 ? (
        <p className="text-foreground/60">Keine Entwürfe vorhanden.</p>
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => (
            <Card key={d.id} className="bg-white text-black border-gold/30 p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="imperial-heading text-lg break-words">{d.title}</div>
                {d.description && <p className="text-sm text-gray-700 line-clamp-2 break-words">{d.description}</p>}
                <p className="text-xs text-gray-500">Zuletzt: {new Date(d.updated_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link to={`/recipes/${d.id}/edit`}><Edit3 className="w-3 h-3 mr-1" />Bearbeiten</Link>
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove(d.id, d.title)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
