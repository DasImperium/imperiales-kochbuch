import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { clampServings } from "@/lib/scaling";
import { Input } from "@/components/ui/input";

interface Props {
  value: number;
  defaultValue: number;
  unit?: string;
  onChange: (n: number) => void;
  className?: string;
}

export default function ServingsControl({ value, defaultValue, unit = "Personen", onChange, className }: Props) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const set = (n: number) => onChange(clampServings(n));

  const commit = () => {
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed)) {
      setText(String(defaultValue));
      onChange(defaultValue);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (n < 1 || n > 100) {
      setText(String(defaultValue));
      onChange(defaultValue);
      return;
    }
    onChange(n);
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
          onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-16 text-center bg-white text-black font-bold"
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
