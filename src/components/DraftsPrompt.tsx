import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listDrafts, removeDraft, type LocalDraft } from "@/lib/drafts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SHOWN_KEY = "imperial.draftsPrompt.shown";

export default function DraftsPrompt() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(SHOWN_KEY)) return;
    const d = listDrafts();
    if (d.length > 0) {
      setDrafts(d);
      setOpen(true);
      sessionStorage.setItem(SHOWN_KEY, "1");
    }
  }, [user]);

  const publishAll = async () => {
    if (!user) return;
    let ok = 0;
    for (const d of drafts) {
      const { error } = await supabase.from("recipes").insert({
        title: d.title,
        description: d.description ?? null,
        ingredients: d.ingredients ?? null,
        instructions: d.instructions ?? null,
        time_required: d.time_required ?? "30 min",
        category_id: d.category_id ?? null,
        image_url: d.image_url ?? null,
        tags: d.tags ?? [],
        author_id: user.id,
        is_draft: false,
      });
      if (!error) { removeDraft(d.id); ok++; }
    }
    toast.success(`${ok} Entwürfe veröffentlicht`);
    setOpen(false);
  };

  const deleteAll = () => {
    drafts.forEach((d) => removeDraft(d.id));
    toast.success("Lokale Entwürfe gelöscht");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-surface text-surface-foreground border-gold/40">
        <DialogHeader>
          <DialogTitle className="imperial-heading text-gold">Nicht veröffentlichte Rezepte</DialogTitle>
          <DialogDescription>
            Sie haben {drafts.length} nicht veröffentlichte Rezepte (lokal gespeichert). Möchten Sie diese jetzt veröffentlichen?
          </DialogDescription>
        </DialogHeader>
        <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
          {drafts.map((d) => <li key={d.id}>• {d.title || "(ohne Titel)"}</li>)}
        </ul>
        <div className="flex gap-2 justify-end flex-wrap">
          <Button variant="outline" onClick={() => setOpen(false)} className="border-gold/40">Später</Button>
          <Button variant="destructive" onClick={deleteAll}>Löschen</Button>
          <Button onClick={publishAll} className="bg-gold text-gold-foreground hover:bg-gold-soft">Veröffentlichen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
