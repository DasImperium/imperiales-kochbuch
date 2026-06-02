import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home, BookOpen, Star, MessageCircle, Crown, User as UserIcon, LogOut,
  Search, Utensils, Package, ShoppingCart,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Item {
  to: string; icon: React.ElementType; label: string; badge?: number; adminOnly?: boolean;
}

export default function ImperialMenu() {
  const [expanded, setExpanded] = useState(false);
  const { isAdmin } = useAuth();
  const unread = useUnreadCount();
  const ref = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setExpanded(false), [location.pathname]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    navigate("/auth");
  };

  const items: Item[] = [
    { to: "/", icon: Home, label: "Start" },
    { to: "/recipes", icon: BookOpen, label: "Rezepte" },
    { to: "/menus", icon: Utensils, label: "Menüs" },
    { to: "/favorites", icon: Star, label: "Favoriten" },
    { to: "/inventory", icon: Package, label: "Inventar" },
    { to: "/shopping", icon: ShoppingCart, label: "Einkauf" },
    { to: "/search", icon: Search, label: "Suche" },
    { to: "/chat", icon: MessageCircle, label: "Chats", badge: unread },
    { to: "/profile", icon: UserIcon, label: "Profil" },
    { to: "/admin", icon: Crown, label: "Admin", adminOnly: true },
  ];

  const visible = items.filter((i) => !i.adminOnly || isAdmin);

  const onEmptyClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setExpanded((v) => !v);
  };

  return (
    <nav
      ref={ref}
      onClick={onEmptyClick}
      aria-label="Hauptnavigation"
      className={cn(
        // Immer links fixiert, vollhoch, scrollbar – nie Überlappung mit Inhalten
        "fixed z-50 top-0 bottom-0 left-0 border-r border-gold/40 shadow-[var(--shadow-imperial)] bg-black overflow-y-auto",
        expanded ? "w-44" : "w-14 sm:w-16"
      )}
    >
      <div
        onClick={onEmptyClick}
        className="flex flex-col items-stretch gap-2 p-2 sm:p-3 min-h-full"
      >
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center pb-3 mb-1 border-b border-gold/30">
          <Crown className="w-6 h-6 text-gold flex-shrink-0" />
          {expanded && <span className="ml-2 imperial-heading text-sm text-gold whitespace-nowrap">Imperial</span>}
        </div>

        {visible.map((it) => (
          <MenuItem key={it.to} item={it} expanded={expanded} />
        ))}

        <div className="flex-1" onClick={onEmptyClick} />

        <button
          onClick={(e) => { e.stopPropagation(); handleLogout(); }}
          className="group flex flex-row items-center justify-center gap-3 p-2 rounded-md hover:bg-white/10 transition-colors"
          title="Abmelden"
          aria-label="Abmelden"
        >
          <LogOut className="w-6 h-6 text-white flex-shrink-0" />
          {expanded && <span className="text-xs text-white whitespace-normal break-words leading-tight max-w-[100px]">Abmelden</span>}
        </button>
      </div>
    </nav>
  );
}

function MenuItem({ item, expanded }: { item: Item; expanded: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={(e) => e.stopPropagation()}
      className={({ isActive }) =>
        cn(
          "group relative flex flex-row items-center justify-center gap-3 p-2 rounded-md transition-colors",
          isActive ? "bg-[#FFFF00]" : "hover:bg-white/10"
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative flex-shrink-0">
            <Icon className={cn("w-6 h-6 transition-colors", isActive ? "text-black" : "text-white")} />
            {item.badge && item.badge > 0 ? (
              <span className="absolute -top-1.5 -right-2 flex items-center gap-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] justify-center">
                <Star className="w-2.5 h-2.5 fill-current" />
                {item.badge}
              </span>
            ) : null}
          </div>
          {expanded && (
            <span className={cn("text-xs whitespace-normal break-words leading-[1.2] max-w-[100px] font-medium", isActive ? "text-black" : "text-white")}>
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
