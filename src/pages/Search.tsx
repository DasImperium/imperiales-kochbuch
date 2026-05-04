import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Star } from "lucide-react";

export default function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      const { data } = await supabase.from("recipes")
        .select("id,title,description,image_url")
        .or(`title.ilike.%${q}%,description.ilike.%${q}%,ingredients.ilike.%${q}%`)
        .eq("is_draft", false)
        .limit(40);
      setResults(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="imperial-heading text-3xl text-gold mb-6">Suche</h1>
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rezept, Zutat, Beschreibung…" className="pl-10 bg-surface text-surface-foreground border-gold/30" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {results.map((r) => (
          <Link key={r.id} to={`/recipes/${r.id}`} className="recipe-card overflow-hidden flex">
            {r.image_url ? <img src={r.image_url} alt="" className="w-24 h-24 object-cover" /> :
              <div className="w-24 h-24 flex items-center justify-center bg-secondary"><Star className="text-gold/40" /></div>}
            <div className="p-3 flex-1">
              <div className="imperial-heading text-content-fg">{r.title}</div>
              <p className="text-xs text-content-fg/70 line-clamp-2">{r.description}</p>
            </div>
          </Link>
        ))}
        {q && results.length === 0 && <p className="text-foreground/60">Keine Treffer.</p>}
      </div>
    </div>
  );
}
