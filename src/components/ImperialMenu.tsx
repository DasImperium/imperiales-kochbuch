import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  BookOpen,
  Star,
  MessageCircle,
  Crown,
  User as UserIcon,
  LogOut,
  Search,
  Utensils,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Item {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  adminOnly?: boolean;
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
    { to: "/search", icon: Search, label: "Suche" },
    { to: "/chat", icon: MessageCircle, label: "Chats", badge: unread },
    { to: "/profile", icon: UserIcon, label: "Profil" },
    { to: "/admin", icon: Crown, label: "Admin", adminOnly: true },
  ];

  const visible = items.filter((i) => !i.adminOnly || isAdmin);

  const onNavClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setExpanded((v) => !v);
  };

  return (
    <nav
      ref={ref}
      onClick={onNavClick}
      aria-label="Hauptnavigation"
      className={cn(
        "fixed z-50 border-gold/40 shadow-[var(--shadow-imperial)]",
        // black background per spec
        "bg-black",
        "bottom-0 left-0 right-0 border-t",
        "md:top-0 md:right-auto md:bottom-0 md:w-16 md:border-t-0 md:border-r",
        expanded && "md:w-44"
      )}
    >
      <div
        onClick={onNavClick}
        className={cn(
          "flex md:flex-col items-center md:items-stretch gap-1 md:gap-2 p-2 md:p-3 h-full",
          "justify-around md:justify-start"
        )}
      >
        <div onClick={(e) => e.stopPropagation()} className="hidden md:flex items-center justify-center pb-3 mb-1 border-b border-gold/30">
          <Crown className="w-6 h-6 text-gold" />
          {expanded && <span className="ml-2 imperial-heading text-sm text-gold whitespace-nowrap">Imperial</span>}
        </div>

        {visible.map((it) => (
          <MenuItem key={it.to} item={it} expanded={expanded} />
        ))}

        <div className="hidden md:block flex-1" onClick={onNavClick} />

        <button
          onClick={(e) => { e.stopPropagation(); handleLogout(); }}
          className="group flex md:flex-row flex-col items-center justify-center gap-1 md:gap-3 p-2 rounded-md hover:bg-white/10 transition-colors"
          title="Abmelden"
          aria-label="Abmelden"
        >
          <LogOut className="w-7 h-7 md:w-6 md:h-6 text-white" />
          {expanded && <span className="hidden md:inline text-xs text-white whitespace-normal break-words leading-tight max-w-[100px]">Abmelden</span>}
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
          "group relative flex md:flex-row flex-col items-center justify-center md:justify-start gap-1 md:gap-3 p-2 md:px-2 md:py-2 rounded-md transition-colors",
          // default: white on black; active: black on imperial yellow
          isActive ? "bg-[#FFFF00]" : "hover:bg-white/10"
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative">
            <Icon className={cn("w-8 h-8 md:w-6 md:h-6 transition-colors", isActive ? "text-black" : "text-white")} />
            {item.badge && item.badge > 0 ? (
              <span className="absolute -top-1.5 -right-2 flex items-center gap-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] justify-center">
                <Star className="w-2.5 h-2.5 fill-current" />
                {item.badge}
              </span>
            ) : null}
          </div>
          {expanded && (
            <span className={cn("hidden md:inline text-xs whitespace-normal break-words leading-[1.2] max-w-[100px] font-medium", isActive ? "text-black" : "text-white")}>
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
