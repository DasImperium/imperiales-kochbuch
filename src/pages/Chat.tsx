import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Megaphone, Users, Trash2 } from "lucide-react";
import ImageUploader from "@/components/ImageUploader";
import { toast } from "sonner";

interface Msg {
  id: string; sender_id: string; recipient_id: string | null; content: string;
  image_url: string | null; read_at: string | null; created_at: string;
}
interface Profile { id: string; display_name: string | null; }

type ConvKey = string; // "user:<id>" or "broadcast"

export default function Chat() {
  const { user, isAdmin, isSuperadmin, isImperator } = useAuth();
  const canDelete = isSuperadmin || isImperator;
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [active, setActive] = useState<ConvKey>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [unreadByConv, setUnreadByConv] = useState<Record<string, number>>({});
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [broadcast, setBroadcast] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profs } = await supabase.from("profiles").select("id,display_name").neq("id", user.id);
      setContacts(profs ?? []);
    })();
  }, [user]);

  // Ungelesen-Zähler pro Conversation
  const loadUnread = async () => {
    if (!user) return;
    const { data } = await supabase.from("chat_messages")
      .select("sender_id").eq("recipient_id", user.id).is("read_at", null);
    const map: Record<string, number> = {};
    (data ?? []).forEach((m: any) => { map[`user:${m.sender_id}`] = (map[`user:${m.sender_id}`] ?? 0) + 1; });
    setUnreadByConv(map);
  };
  useEffect(() => { loadUnread(); }, [user, messages.length]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => { load(); loadUnread(); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user, active]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendOne = async () => {
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
    setText(""); setImage(null); setSelected(new Set()); setBroadcast(false); setPickerOpen(false);
  };

  const deleteMsg = async (id: string) => {
    if (!confirm("Nachricht löschen?")) return;
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const unreadDetail = useMemo(() => {
    const total = Object.values(unreadByConv).reduce((a, b) => a + b, 0);
    const detail = Object.entries(unreadByConv).map(([k, n]) => {
      const id = k.replace("user:", "");
      const name = contacts.find((c) => c.id === id)?.display_name ?? "Unbekannt";
      return `${n} von ${name}`;
    }).join(", ");
    return { total, detail };
  }, [unreadByConv, contacts]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="imperial-heading text-3xl text-gold">Nachrichten</h1>
        {unreadDetail.total > 0 && (
          <span className="text-xs px-2 py-1 rounded bg-[#FFFF00] text-black font-bold">
            {unreadDetail.total} Ungelesen{unreadDetail.detail ? `: ${unreadDetail.detail}` : ""}
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-[240px_1fr] gap-4 md:h-[65vh]">
        <Card className="imperial-surface border-gold/30 p-2 overflow-y-auto max-h-[35vh] md:max-h-none">
          <button onClick={() => setActive("broadcast")}
            className={`w-full text-left px-3 py-2 rounded transition flex items-center gap-2 ${active === "broadcast" ? "bg-gold/20 text-gold" : "hover:bg-secondary/60 text-surface-foreground"}`}>
            <Megaphone className="w-4 h-4" /> An alle (Broadcast)
          </button>
          <div className="border-t border-gold/20 my-2" />
          {contacts.length === 0 && <p className="text-sm text-surface-foreground/60 p-2">Keine Kontakte</p>}
          {contacts.map((c) => {
            const k = `user:${c.id}`;
            const unread = unreadByConv[k] ?? 0;
            return (
              <button key={c.id} onClick={() => setActive(k)}
                className={`w-full text-left px-3 py-2 rounded transition flex items-center justify-between gap-2 ${active === k ? "bg-gold/20 text-gold" : "hover:bg-secondary/60 text-surface-foreground"}`}>
                <span className="truncate">{c.display_name || "Unbekannt"}</span>
                {unread > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive text-white font-bold">{unread}</span>}
              </button>
            );
          })}
        </Card>

        <Card className="bg-white border-gold/30 flex flex-col min-h-[40vh]">
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {!active && <p className="text-black/60">Wähle einen Kontakt oder verfasse eine neue Nachricht.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"} group`}>
                <div className={`relative max-w-[80%] px-3 py-2 rounded-lg whitespace-pre-wrap text-sm ${m.sender_id === user?.id ? "bg-[#FFD700] text-black" : "bg-gray-100 text-black border border-gray-300"}`}>
                  {m.content}
                  {m.image_url && <img src={m.image_url} alt="" className="mt-2 max-h-48 rounded" />}
                  {(canDelete || m.sender_id === user?.id) && (
                    <button onClick={() => deleteMsg(m.id)}
                      className="absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-[#C0392B] text-white shadow"
                      aria-label="Nachricht löschen" title="Nachricht löschen">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </Card>
      </div>

      {/* Fixiertes Eingabefeld – immer sichtbar, ersetzt "Neue Nachricht"-Button */}
      <div className="fixed left-0 right-0 bottom-16 md:bottom-0 md:left-16 z-40 bg-white border-t border-gold/30 p-2 shadow-[var(--shadow-imperial)]">
        <div className="container mx-auto max-w-5xl">
          {pickerOpen && (
            <div className="mb-2 max-h-40 overflow-y-auto border rounded p-2">
              {isAdmin && (
                <label className="flex items-center gap-2 text-sm text-black mb-1">
                  <Checkbox checked={broadcast} onCheckedChange={(v) => setBroadcast(!!v)} /> <Megaphone className="w-4 h-4" /> An alle (Broadcast)
                </label>
              )}
              {!broadcast && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {contacts.map((c) => {
                    const sel = selected.has(c.id);
                    return (
                      <label key={c.id}
                        className={`flex items-center gap-1 text-xs rounded px-2 py-1 cursor-pointer font-medium ${sel ? "bg-black text-[#00C853]" : "bg-[#FFFF00] text-black"}`}>
                        <Checkbox checked={sel} onCheckedChange={(v) => {
                          const s = new Set(selected); v ? s.add(c.id) : s.delete(c.id); setSelected(s);
                        }} />
                        <span className="truncate">{c.display_name || "Unbekannt"}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setPickerOpen((v) => !v)} title="Empfänger wählen">
              <Users className="w-4 h-4" />
            </Button>
            <ImageUploader bucket="chat-images" value={image} onChange={setImage} label="" />
            <Input
              value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { pickerOpen ? sendToSelected() : sendOne(); } }}
              placeholder="Nachricht…"
              className="bg-white text-black flex-1" maxLength={2000}
            />
            <Button onClick={() => pickerOpen ? sendToSelected() : sendOne()} variant="gold">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
