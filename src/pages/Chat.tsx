import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface Msg {
  id: string; sender_id: string; recipient_id: string; content: string;
  read_at: string | null; created_at: string;
}
interface Profile { id: string; display_name: string | null; }

export default function Chat() {
  const { user, isAdmin } = useAuth();
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Build contact list: admins + anyone you have chatted with
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = (roles ?? []).map((r: any) => r.user_id).filter((id: string) => id !== user.id);

      const { data: chats } = await supabase
        .from("chat_messages")
        .select("sender_id,recipient_id")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`);
      const ids = new Set<string>(adminIds);
      (chats ?? []).forEach((m: any) => {
        const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        if (other !== user.id) ids.add(other);
      });

      if (ids.size === 0) { setContacts([]); return; }
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", Array.from(ids));
      setContacts(profs ?? []);
      if (!active && profs && profs.length) setActive(profs[0]);
    })();
  }, [user]);

  // Load + subscribe messages for active conversation
  useEffect(() => {
    if (!user || !active) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${active.id}),and(sender_id.eq.${active.id},recipient_id.eq.${user.id})`)
        .order("created_at");
      if (cancelled) return;
      setMessages(data ?? []);
      // mark as read
      await supabase.from("chat_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", user.id).eq("sender_id", active.id).is("read_at", null);
    };
    load();
    const ch = supabase
      .channel(`chat-${active.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user, active]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!user || !active || !text.trim()) return;
    await supabase.from("chat_messages").insert({
      sender_id: user.id, recipient_id: active.id, content: text.trim().slice(0, 2000),
    });
    setText("");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="imperial-heading text-3xl text-gold mb-6">Nachrichten</h1>
      <div className="grid md:grid-cols-[240px_1fr] gap-4 h-[70vh]">
        <Card className="imperial-surface border-gold/30 p-2 overflow-y-auto">
          {contacts.length === 0 && <p className="text-sm text-surface-foreground/60 p-2">Keine Kontakte</p>}
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c)}
              className={`w-full text-left px-3 py-2 rounded transition ${active?.id === c.id ? "bg-gold/20 text-gold" : "hover:bg-secondary/60 text-surface-foreground"}`}
            >
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
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {active && (
            <div className="p-3 border-t border-gold/20 flex gap-2">
              <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Nachricht…" className="bg-background/60" maxLength={2000} />
              <Button onClick={send} className="bg-gold text-gold-foreground hover:bg-gold-soft"><Send className="w-4 h-4" /></Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
