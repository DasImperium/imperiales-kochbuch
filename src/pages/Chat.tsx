import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Megaphone, Trash2, Bell, ArrowUp, ArrowDown, User, ArrowLeft } from "lucide-react";
import ImageUploader from "@/components/ImageUploader";
import { toast } from "sonner";

interface Msg {
  id: string; sender_id: string; recipient_id: string | null; content: string;
  image_url: string | null; read_at: string | null; created_at: string;
}
interface Profile { id: string; display_name: string | null; }

type ConvKey = string; // "user:<id>" | "broadcast" | "hinweise" | "self"

export const HINT_PREFIX = "[Hinweise] ";
// Eine Nachricht ist ein Hinweis, wenn sie den Präfix hat ODER im Hinweise-Kanal läuft
const isHint = (m: Msg) => m.content?.startsWith(HINT_PREFIX);
const hintBody = (c: string) => c.replace(HINT_PREFIX, "");

export default function Chat() {
  const { user, isSuperadmin, isImperator } = useAuth();
  const canDelete = isSuperadmin || isImperator;
  
  const currentUserId = user?.id || "00000000-0000-4000-a000-000000000000";

  const [contacts, setContacts] = useState<Profile[]>([]);
  const [active, setActive] = useState<ConvKey>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  
  const [localMessages, setLocalMessages] = useState<Msg[]>([
    {
      id: "welcome-hint",
      sender_id: currentUserId,
      recipient_id: currentUserId,
      content: `${HINT_PREFIX}Achtung: Mindestbestand für Karotten unterschritten – 1000 g der Einkaufsliste hinzugefügt.`,
      image_url: null,
      read_at: null,
      created_at: new Date().toISOString()
    }
  ]);

  const [unreadByConv, setUnreadByConv] = useState<Record<string, number>>({});
  const [hintUnread, setHintUnread] = useState(0);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  
  const topRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Kontakte laden
  useEffect(() => {
    if (!user) {
      setContacts([{ id: "dummy-friend", display_name: "Test Imperator (Lokaler Dummy)" }]);
      return;
    }
    (async () => {
      const { data: profs, error } = await supabase.from("profiles").select("id,display_name").neq("id", user.id);
      if (!error && profs) setContacts(profs);
    })();
  }, [user]);

  // Ungelesene Nachrichten auswerten
  const loadUnread = async () => {
    if (!user) {
      // Offline-Zähler-Berechnung basierend auf localMessages
      const map: Record<string, number> = {};
      let hints = 0;
      localMessages.forEach(m => {
        if (m.read_at) return; // Bereits gelesen? Ignorieren!
        
        if (isHint(m)) {
          hints++;
        } else if (m.sender_id !== currentUserId && m.recipient_id === currentUserId) {
          map[`user:${m.sender_id}`] = (map[`user:${m.sender_id}`] ?? 0) + 1;
        }
      });
      setUnreadByConv(map);
      setHintUnread(hints);
      return;
    }

    try {
      const { data } = await supabase.from("chat_messages")
        .select("sender_id,recipient_id,content")
        .eq("recipient_id", currentUserId)
        .is("read_at", null);
      
      const map: Record<string, number> = {};
      let hints = 0;

      (data ?? []).forEach((m: any) => {
        if (m.content?.startsWith(HINT_PREFIX)) { 
          hints++; 
        } else if (m.sender_id !== currentUserId) {
          map[`user:${m.sender_id}`] = (map[`user:${m.sender_id}`] ?? 0) + 1;
        }
      });
      setUnreadByConv(map);
      setHintUnread(hints);
    } catch (e) {
      console.log("Fehler beim Laden der ungelesenen Nachrichten");
    }
  };

  // Nachrichten als gelesen markieren
  const markAsRead = async (channelKey: ConvKey) => {
    const nowStr = new Date().toISOString();

    // 1. Lokal als gelesen markieren
    setLocalMessages(prev => prev.map(m => {
      if (channelKey === "hinweise" && isHint(m)) return { ...m, read_at: nowStr };
      if (channelKey === "self" && m.sender_id === currentUserId && m.recipient_id === currentUserId && !isHint(m)) return { ...m, read_at: nowStr };
      if (channelKey.startsWith("user:")) {
        const otherId = channelKey.replace("user:", "");
        if (m.sender_id === otherId && m.recipient_id === currentUserId) return { ...m, read_at: nowStr };
      }
      return m;
    }));

    // 2. Auf dem Server als gelesen markieren
    if (!user) return;
    try {
      if (channelKey === "hinweise") {
        await supabase.from("chat_messages").update({ read_at: nowStr }).eq("recipient_id", currentUserId).like("content", `${HINT_PREFIX}%`).is("read_at", null);
      } else if (channelKey === "self") {
        await supabase.from("chat_messages").update({ read_at: nowStr }).eq("sender_id", currentUserId).eq("recipient_id", currentUserId).not("content", "like", `${HINT_PREFIX}%`).is("read_at", null);
      } else if (channelKey.startsWith("user:")) {
        const otherId = channelKey.replace("user:", "");
        await supabase.from("chat_messages").update({ read_at: nowStr }).eq("sender_id", otherId).eq("recipient_id", currentUserId).is("read_at", null);
      }
    } catch (e) {
      console.error("Fehler beim Markieren als gelesen", e);
    }
  };

  useEffect(() => { loadUnread(); }, [user, messages, localMessages]);

  // Sobald ein Chat geöffnet wird, setze ihn auf gelesen
  useEffect(() => {
    if (active) {
      markAsRead(active).then(() => loadUnread());
    }
  }, [active]);

  // Nachrichten laden
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const load = async () => {
      if (!user) {
        let filtered = localMessages;
        if (active === "broadcast") {
          filtered = localMessages.filter(m => m.recipient_id === null);
        } else if (active === "hinweise") {
          filtered = localMessages.filter(m => isHint(m));
        } else if (active === "self") {
          filtered = localMessages.filter(m => m.sender_id === currentUserId && m.recipient_id === currentUserId && !isHint(m));
        } else {
          const otherId = active.replace("user:", "");
          filtered = localMessages.filter(m => (m.sender_id === currentUserId && m.recipient_id === otherId) || (m.sender_id === otherId && m.recipient_id === currentUserId));
        }
        if (!cancelled) setMessages(filtered);
        return;
      }

      let data: Msg[] | null = null;
      try {
        if (active === "broadcast") {
          const res = await supabase.from("chat_messages").select("*").is("recipient_id", null).order("created_at");
          data = (res.data ?? []) as Msg[];
        } else if (active === "hinweise") {
          const res = await supabase.from("chat_messages").select("*").eq("recipient_id", currentUserId).like("content", `${HINT_PREFIX}%`).order("created_at");
          data = (res.data ?? []) as Msg[];
        } else if (active === "self") {
          const res = await supabase.from("chat_messages").select("*").eq("sender_id", currentUserId).eq("recipient_id", currentUserId).not("content", "like", `${HINT_PREFIX}%`).order("created_at");
          data = (res.data ?? []) as Msg[];
        } else {
          const otherId = active.replace("user:", "");
          const res = await supabase.from("chat_messages").select("*")
            .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${currentUserId})`)
            .order("created_at");
          data = ((res.data ?? []) as Msg[]).filter((m) => !isHint(m));
        }
        if (!cancelled) setMessages(data ?? []);
      } catch (e) {
        if (!cancelled) setMessages(localMessages.filter(m => active === "self" ? (m.recipient_id === currentUserId && !isHint(m)) : true));
      }
    };

    load();
    
    if (user) {
      const ch = supabase.channel(`chat-${active}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => { load(); markAsRead(active).then(() => loadUnread()); })
        .subscribe();
      return () => { cancelled = true; supabase.removeChannel(ch); };
    }
  }, [user, active, localMessages]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendOne = async () => {
    if (!active) return;
    if (active === "hinweise") return; // Hinweise sind rein systemgeneriert
    if (!text.trim()) return;

    const newMsg: Msg = {
      id: "local-" + Math.random().toString(36).substr(2, 9),
      sender_id: currentUserId,
      recipient_id: active === "broadcast" ? null : (active === "self" ? currentUserId : active.replace("user:", "")),
      content: text.trim().slice(0, 2000),
      image_url: image,
      read_at: active === "self" ? new Date().toISOString() : null,
      created_at: new Date().toISOString()
    };

    setLocalMessages(prev => [...prev, newMsg]);

    if (user) {
      try {
        const payloadBase = { sender_id: currentUserId, content: newMsg.content, image_url: image };
        if (active === "broadcast") {
          await supabase.from("chat_messages").insert({ ...payloadBase, recipient_id: null });
        } else if (active === "self") {
          await supabase.from("chat_messages").insert({ ...payloadBase, recipient_id: currentUserId, read_at: new Date().toISOString() });
        } else {
          await supabase.from("chat_messages").insert({ ...payloadBase, recipient_id: active.replace("user:", "") });
        }
      } catch (e) {
        console.error("Senden fehlgeschlagen", e);
      }
    }

    setText(""); setImage(null);
  };

  const deleteMsg = (id: string) => {
    if (!confirm("Nachricht löschen?")) return;
    setLocalMessages(prev => prev.filter(m => m.id !== id));
    if (user) {
      supabase.from("chat_messages").delete().eq("id", id).then(() => loadUnread());
    }
  };

  const unreadDetail = useMemo(() => {
    const total = Object.values(unreadByConv).reduce((a, b) => a + b, 0) + hintUnread;
    const parts: string[] = [];
    Object.entries(unreadByConv).forEach(([k, n]) => {
      const id = k.replace("user:", "");
      const name = contacts.find((c) => c.id === id)?.display_name ?? "Unbekannt";
      parts.push(`${n} von ${name}`);
    });
    if (hintUnread > 0) parts.push(`${hintUnread} von Hinweise`);
    return { total, detail: parts.join(", ") };
  }, [unreadByConv, hintUnread, contacts]);

  const isHintsActive = active === "hinweise";
  const scrollToTop = () => topRef.current?.scrollIntoView({ behavior: "smooth" });
  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: "smooth" });

  const activeChatName = useMemo(() => {
    if (active === "broadcast") return "An alle (Broadcast)";
    if (active === "self") return "An mich selbst (Notizen)";
    if (active === "hinweise") return "Hinweise";
    if (active.startsWith("user:")) {
      const id = active.replace("user:", "");
      return contacts.find(c => c.id === id)?.display_name || "Direktnachricht";
    }
    return "";
  }, [active, contacts]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[75vh] bg-transparent text-foreground overflow-hidden px-2 sm:px-4">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2 shrink-0">
        <h1 className="imperial-heading text-2xl sm:text-3xl text-gold">Nachrichten</h1>
        {!user && <span className="text-[10px] bg-amber-500 text-black font-bold px-2 py-0.5 rounded animate-pulse">Offline-Modus</span>}
        {unreadDetail.total > 0 && (
          <span className="text-xs px-2 py-1 rounded bg-[#FFFF00] text-black font-bold">
            {unreadDetail.total} Ungelesen
          </span>
        )}
      </div>

      {/* HAUPTLAYOUT */}
      <div className="flex flex-1 flex-col md:flex-row gap-4 overflow-hidden relative">
        
        {/* KANÄLE */}
        {!active && (
          <Card className="imperial-surface border-gold/30 p-2 overflow-y-auto max-h-[40vh] md:max-h-none md:w-[240px] shrink-0 space-y-1 w-full">
            <button onClick={() => setActive("broadcast")}
              className="w-full text-left px-3 py-2 rounded transition flex items-center gap-2 hover:bg-secondary/60 text-surface-foreground">
              <Megaphone className="w-4 h-4" /> An alle (Broadcast)
            </button>
            
            <button onClick={() => setActive("self")}
              className="w-full text-left px-3 py-2 rounded transition flex items-center gap-2 hover:bg-secondary/60 text-surface-foreground">
              <User className="w-4 h-4" /> An mich selbst
            </button>

            <button onClick={() => setActive("hinweise")}
              className="w-full text-left px-3 py-2 rounded transition flex items-center justify-between gap-2 hover:bg-secondary/60 text-surface-foreground">
              <span className="flex items-center gap-2"><Bell className="w-4 h-4" /> <strong>Hinweise</strong></span>
              {hintUnread > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive text-white font-bold">{hintUnread}</span>}
            </button>
            
            <div className="border-t border-gold/20 my-2" />
            
            {contacts.map((c) => {
              const k = `user:${c.id}`;
              const unread = unreadByConv[k] ?? 0;
              return (
                <button key={c.id} onClick={() => setActive(k)}
                  className="w-full text-left px-3 py-2 rounded transition flex items-center justify-between gap-2 hover:bg-secondary/60 text-surface-foreground">
                  <span className="truncate">{c.display_name || "Unbekannt"}</span>
                  {unread > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive text-white font-bold">{unread}</span>}
                </button>
              );
            })}
          </Card>
        )}

        {/* VERLAUF */}
        <Card className="bg-white border-gold/30 flex flex-1 flex-col overflow-hidden min-h-0 relative w-full">
          
          {active && (
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 border-b border-gray-200 shrink-0">
              <Button type="button" variant="ghost" size="sm" onClick={() => setActive("")} className="text-black hover:bg-gray-200 flex items-center gap-1 text-xs h-8">
                <ArrowLeft className="w-3.5 h-3.5" /> Kontakte
              </Button>
              <span className="text-xs font-bold text-black truncate max-w-[60%]">{activeChatName}</span>
              <div className="w-12" />
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ direction: "ltr" }}>
            <div ref={topRef} className="h-0 w-0" />
            {!active && <p className="text-black/60 font-medium text-center py-8">Wähle einen Kanal, um Nachrichten zu lesen.</p>}
            
            {active && messages.map((m) => {
              const hint = isHint(m);
              const mine = m.sender_id === currentUserId && !hint;
              
              let senderLabel = hint ? "System" : mine ? "Ich" : (active === "self" ? "Notiz" : (contacts.find((c) => c.id === m.sender_id)?.display_name ?? "Unbekannt"));

              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} group`}>
                  <div className={`relative max-w-[80%] px-3 py-2 rounded-lg whitespace-pre-wrap text-sm border ${
                    hint ? "bg-[#FFF8DC] text-black border-[#B8860B]" : mine ? "bg-[#FFD700] text-black border-transparent" : "bg-gray-100 text-black border-gray-300"
                  }`}>
                    <div className="text-[11px] mb-0.5 opacity-80"><strong>{senderLabel}</strong></div>
                    <span className="block text-left">{hint ? hintBody(m.content) : m.content}</span>
                    {m.image_url && <img src={m.image_url} alt="" className="mt-2 max-h-48 rounded" />}
                    <button type="button" onClick={() => deleteMsg(m.id)} className="absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-[#C0392B] text-white shadow">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} className="h-0 w-0" />
          </div>

          {/* EINGABEFELD & CONTROLS */}
          <div className="p-3 bg-zinc-50 border-t border-gray-200 shrink-0">
            <div className="flex items-center gap-2 w-full mb-2">
              
              {/* Einziges, kombiniertes Uploadfeld */}
              <div className="flex gap-2 shrink-0">
                 <ImageUploader bucket="chat-images" value={image} onChange={setImage} label="Medien" />
              </div>
              
              <div className="flex flex-col gap-1 shrink-0 ml-auto">
                <Button type="button" size="icon" variant="secondary" onClick={scrollToTop} className="h-7 w-7 rounded bg-gray-200 text-black shadow-sm"><ArrowUp className="w-3.5 h-3.5" /></Button>
                <Button type="button" size="icon" variant="secondary" onClick={scrollToBottom} className="h-7 w-7 rounded bg-gray-200 text-black shadow-sm"><ArrowDown className="w-3.5 h-3.5" /></Button>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full">
              <Input
                value={text} 
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { sendOne(); } }}
                placeholder={isHintsActive ? "System-Hinweise können nicht beantwortet werden" : "Nachricht…"}
                className="bg-white text-black flex-1 min-h-[42px] border-gray-300" 
                maxLength={2000}
                disabled={isHintsActive || !active}
              />
              <Button onClick={sendOne} variant="gold" disabled={isHintsActive || !active} className="h-10 w-10 p-0 shrink-0 bg-amber-500 text-black"><Send className="w-4 h-4" /></Button>
            </div>
          </div>

        </Card>
      </div>
    </div>
  );
}