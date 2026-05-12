import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { clampServings } from "@/lib/scaling";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  defaultValue: number;
  unit?: string;
  onChange: (n: number) => void;
  className?: string;
}

export default function ServingsControl({ value, defaultValue, unit = "Personen", onChange, className }: Props) {
  const [text, setText] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setText(String(value)); setInvalid(false); }, [value]);

  const set = (n: number) => { setInvalid(false); onChange(clampServings(n)); };

  const commit = () => {
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed)) {
      setInvalid(true);
      toast.error("Ungültige Eingabe – Standardwert wird verwendet");
      setText(String(defaultValue)); onChange(defaultValue); setTimeout(() => setInvalid(false), 1500);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (n < 1 || n > 100) {
      setInvalid(true);
      toast.error("Bitte 1–100 als ganze Zahl eingeben");
      setText(String(defaultValue)); onChange(defaultValue); setTimeout(() => setInvalid(false), 1500);
      return;
    }
    setInvalid(false); onChange(n);
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <button
        type="button" aria-label="weniger" onClick={() => set(value - 1)}
        className="w-8 h-8 rounded-md bg-[#C0392B] text-white flex items-center justify-center hover:bg-[#A93226]"
      ><Minus className="w-4 h-4" /></button>
      <div className="flex items-center gap-1">
        <Input
          inputMode="numeric"
          value={text}
          onChange={(e) => { setText(e.target.value.replace(/[^\d]/g, "")); setInvalid(false); }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className={cn(
            "w-16 text-center bg-white text-black font-bold transition-colors",
            invalid && "border-2 border-[#C0392B] ring-2 ring-[#C0392B]/40"
          )}
        />
        <span className="text-sm text-content-fg/80 whitespace-nowrap">{unit}</span>
      </div>
      <button
        type="button" aria-label="mehr" onClick={() => set(value + 1)}
        className="w-8 h-8 rounded-md bg-[#C0392B] text-white flex items-center justify-center hover:bg-[#A93226]"
      ><Plus className="w-4 h-4" /></button>
    </div>
  );
}
