import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const fetchCount = async () => {
      const { count: c } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      if (active) setCount(c ?? 0);
    };
    fetchCount();

    const channel = supabase
      .channel("chat-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        fetchCount();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return count;
}
