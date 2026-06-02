import ImperialMenu from "./ImperialMenu";
import DraftsPrompt from "./DraftsPrompt";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ImperialMenu />
      <DraftsPrompt />
      {/* Permanenter Linksabstand für die fixierte Menüleiste – nie Überlappung */}
      <main className="pl-14 sm:pl-16 min-h-screen">
        {children}
      </main>
    </div>
  );
}
