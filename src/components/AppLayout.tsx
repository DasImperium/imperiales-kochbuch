import ImperialMenu from "./ImperialMenu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ImperialMenu />
      {/* leave space for menu: bottom on mobile, left on desktop */}
      <main className="pb-20 md:pb-0 md:pl-16 min-h-screen">
        {children}
      </main>
    </div>
  );
}
