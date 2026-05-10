import ImperialMenu from "./ImperialMenu";
import DraftsPrompt from "./DraftsPrompt";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ImperialMenu />
      <DraftsPrompt />
      <main className="pb-20 md:pb-0 md:pl-16 min-h-screen">
        {children}
      </main>
    </div>
  );
}
