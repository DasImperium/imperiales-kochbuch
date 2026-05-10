import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Megaphone, Users } from "lucide-react";
import ImageUploader from "@/components/ImageUploader";
import { toast } from "sonner";

interface Msg {
  id: string; sender_id: string; recipient_id: string | null; content: string;
  image_url: string | null; read_at: string | null; created_at: string;
}
interface Profile { id: string; display_name: string | null; }

type ConvKey = string; // "user:<id>" or "broadcast"

export default function Chat() {
  const { user, isAdmin } = useAuth();
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [active, setActive] = useState<ConvKey>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [broadcast, setBroadcast] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // All users that registered, authored or rated
      const [{ data: profs }, { data: rs }, { data: rates }] = await Promise.all([
        supabase.from("profiles").select("id,display_name").neq("id", user.id),
        supabase.from("recipes").select("author_id"),
        supabase.from("ratings").select("user_id"),
      ]);
      const active = new Set<string>();
      (rs ?? []).forEach((r: any) => active.add(r.author_id));
      (rates ?? []).forEach((r: any) => active.add(r.user_id));
      // Show all profiles (already excluding self)
      setContacts(profs ?? []);
      if (!active && profs?.length) setActive(`user:${profs[0].id}`);
    })();
  }, [user]);

  // load messages for active conversation
  useEffect(() => {
    if (!user || !active) return;
    let cancelled = false;
    const load = async () => {
      let data: Msg[] | null = null;
      if (active === "broadcast") {
        const res = await supabase.from("chat_messages").select("*").is("recipient_id", null).order("created_at");
        data = (res.data ?? []) as Msg[];
      } else {
        const otherId = active.replace("user:", "");
        const res = await supabase.from("chat_messages").select("*")
          .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`)
          .order("created_at");
        data = (res.data ?? []) as Msg[];
        await supabase.from("chat_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("recipient_id", user.id).eq("sender_id", otherId).is("read_at", null);
      }
      if (!cancelled) setMessages(data ?? []);
    };
    load();
    const ch = supabase.channel(`chat-${active}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user, active]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!user || !text.trim() || !active) return;
    const payloadBase = { sender_id: user.id, content: text.trim().slice(0, 2000), image_url: image };
    if (active === "broadcast") {
      await supabase.from("chat_messages").insert({ ...payloadBase, recipient_id: null });
    } else {
      const otherId = active.replace("user:", "");
      await supabase.from("chat_messages").insert({ ...payloadBase, recipient_id: otherId });
    }
    setText(""); setImage(null);
  };

  const sendToSelected = async () => {
    if (!user || !text.trim()) return;
    if (broadcast) {
      if (!isAdmin) { toast.error("Nur Admins dürfen 'An alle' senden."); return; }
      await supabase.from("chat_messages").insert({
        sender_id: user.id, recipient_id: null, content: text.trim().slice(0, 2000), image_url: image,
      });
    } else {
      if (selected.size === 0) { toast.error("Empfänger auswählen"); return; }
      const rows = Array.from(selected).map((rid) => ({
        sender_id: user.id, recipient_id: rid, content: text.trim().slice(0, 2000), image_url: image,
      }));
      const { error } = await supabase.from("chat_messages").insert(rows);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Nachricht gesendet");
    setText(""); setImage(null); setSelected(new Set()); setBroadcast(false); setComposing(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="imperial-heading text-3xl text-gold">Nachrichten</h1>
        <Button variant="outline" className="border-gold/40" onClick={() => setComposing((v) => !v)}>
          <Users className="w-4 h-4 mr-1" /> Neue Nachricht
        </Button>
      </div>

      {composing && (
        <Card className="imperial-surface border-gold/30 p-4 mb-4 space-y-3">
          <h3 className="imperial-heading text-gold">Empfänger wählen</h3>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm text-surface-foreground">
              <Checkbox checked={broadcast} onCheckedChange={(v) => setBroadcast(!!v)} /> <Megaphone className="w-4 h-4" /> An alle Nutzer (Admin-Broadcast)
            </label>
          )}
          {!broadcast && (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-1 max-h-48 overflow-y-auto">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-surface-foreground bg-background/40 rounded px-2 py-1">
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => {
                    const s = new Set(selected); v ? s.add(c.id) : s.delete(c.id); setSelected(s);
                  }} />
                  {c.display_name || "Unbekannt"}
                </label>
              ))}
            </div>
          )}
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nachricht…" className="bg-background/60" maxLength={2000} />
          <ImageUploader bucket="chat-images" value={image} onChange={setImage} label="Bild anhängen" />
          <Button onClick={sendToSelected} className="bg-gold text-gold-foreground hover:bg-gold-soft">
            <Send className="w-4 h-4 mr-1" /> Senden
          </Button>
        </Card>
      )}

      <div className="grid md:grid-cols-[240px_1fr] gap-4 h-[60vh]">
        <Card className="imperial-surface border-gold/30 p-2 overflow-y-auto">
          <button onClick={() => setActive("broadcast")}
            className={`w-full text-left px-3 py-2 rounded transition flex items-center gap-2 ${active === "broadcast" ? "bg-gold/20 text-gold" : "hover:bg-secondary/60 text-surface-foreground"}`}>
            <Megaphone className="w-4 h-4" /> An alle (Broadcast)
          </button>
          <div className="border-t border-gold/20 my-2" />
          {contacts.length === 0 && <p className="text-sm text-surface-foreground/60 p-2">Keine Kontakte</p>}
          {contacts.map((c) => (
            <button key={c.id} onClick={() => setActive(`user:${c.id}`)}
              className={`w-full text-left px-3 py-2 rounded transition ${active === `user:${c.id}` ? "bg-gold/20 text-gold" : "hover:bg-secondary/60 text-surface-foreground"}`}>
              {c.display_name || "Unbekannt"}
            </button>
          ))}
        </Card>

        <Card className="imperial-surface border-gold/30 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {!active && <p className="text-surface-foreground/60">Wähle einen Kontakt</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-lg whitespace-pre-wrap text-sm ${m.sender_id === user?.id ? "bg-gold text-gold-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {m.content}
                  {m.image_url && <img src={m.image_url} alt="" className="mt-2 max-h-48 rounded" />}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {active && (active !== "broadcast" || isAdmin) && (
            <div className="p-3 border-t border-gold/20 space-y-2">
              <ImageUploader bucket="chat-images" value={image} onChange={setImage} label="Bild" />
              <div className="flex gap-2">
                <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Nachricht…" className="bg-background/60" maxLength={2000} />
                <Button onClick={send} className="bg-gold text-gold-foreground hover:bg-gold-soft"><Send className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
