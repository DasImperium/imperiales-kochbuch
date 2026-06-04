import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (window.location.hostname === 'localhost') {
    // Ignoriere die Supabase-Session-Prüfung und überspringe das Laden
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-gold imperial-heading">
        Lade…
      </div>
    );
  }
  
  if (!user) return <Navigate to="/auth" replace />;
  
  return <>{children}</>;
}