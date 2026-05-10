import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search as SearchIcon, Star, Clock } from "lucide-react";
import { formatTime } from "@/lib/timeFormat";

export default function Search() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string>("");
  const [results, setResults] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("recipes").select("tags").eq("is_draft", false).then(({ data }) => {
      const s = new Set<string>();
      (data ?? []).forEach((r: any) => (r.tags ?? []).forEach((t: string) => s.add(t)));
      setAllTags(Array.from(s).sort());
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      // Support #tag inline syntax
      let activeTag = tag;
      let textQ = q.trim();
      const m = textQ.match(/#(\S+)/);
      if (m) { activeTag = activeTag || m[1].toLowerCase(); textQ = textQ.replace(m[0], "").trim(); }

      let query = supabase.from("recipes").select("*").eq("is_draft", false).limit(60);
      if (textQ) query = query.or(`title.ilike.%${textQ}%,description.ilike.%${textQ}%,ingredients.ilike.%${textQ}%`);
      if (activeTag) query = query.contains("tags", [activeTag]);
      if (!textQ && !activeTag) { setResults([]); return; }
      const { data } = await query;
      setResults(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, tag]);

  const tagSuggest = useMemo(() => {
    const m = q.match(/#(\S*)$/);
    const partial = m ? m[1].toLowerCase() : "";
    if (!partial) return [];
    return allTags.filter((t) => t.startsWith(partial)).slice(0, 5);
  }, [q, allTags]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="imperial-heading text-3xl text-gold mb-6">Suche</h1>

      <div className="grid md:grid-cols-[1fr_240px] gap-3 mb-2">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rezept, Zutat… oder #Tag" className="pl-10 bg-surface text-surface-foreground border-gold/30" />
          {tagSuggest.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-surface border border-gold/30 rounded shadow">
              {tagSuggest.map((t) => (
                <button key={t} onClick={() => setQ(q.replace(/#\S*$/, `#${t} `))}
                  className="block w-full text-left px-3 py-1.5 hover:bg-gold/20 text-surface-foreground">#{t}</button>
              ))}
            </div>
          )}
        </div>
        <Select value={tag || "__all"} onValueChange={(v) => setTag(v === "__all" ? "" : v)}>
          <SelectTrigger className="bg-surface text-surface-foreground border-gold/30"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Alle Tags</SelectItem>
            {allTags.map((t) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        {results.map((r) => (
          <Link key={r.id} to={`/recipes/${r.id}`} className="recipe-card overflow-hidden flex relative">
            {r.image_url ? <img src={r.image_url} alt="" className="w-24 h-24 object-cover" /> :
              <div className="w-24 h-24 flex items-center justify-center bg-secondary"><Star className="text-gold/40" /></div>}
            <span className="absolute top-1 left-1 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-[#006400]">
              <Clock className="w-2.5 h-2.5" /> {formatTime(r.time_required)}
            </span>
            <div className="p-3 flex-1">
              <div className="imperial-heading text-content-fg">{r.title}</div>
              <p className="text-xs text-content-fg/70 line-clamp-2">{r.description}</p>
              {(r.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {(r.tags ?? []).slice(0, 3).map((t: string) => <span key={t} className="text-[10px] px-1 bg-secondary rounded text-secondary-foreground">#{t}</span>)}
                </div>
              )}
            </div>
          </Link>
        ))}
        {(q || tag) && results.length === 0 && <p className="text-foreground/60">Keine Treffer.</p>}
      </div>
    </div>
  );
}
