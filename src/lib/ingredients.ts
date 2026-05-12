/**
 * Parsed Zutatenzeile in Mengen + Einheit + Name.
 * Beispiele: "200 g Mehl", "1/2 TL Salz", "2 Eier"
 */
export interface ParsedIngredient { name: string; amount: number; unit: string; raw: string; }

const NUM_RE = /^\s*([\d]+(?:[.,]\d+)?|\d+\/\d+)\s*([a-zA-ZäöüÄÖÜ]+)?\s+(.+)$/;
const FRAC = (s: string) => { const [a, b] = s.split("/").map(Number); return b ? a / b : Number(s); };

export function parseIngredients(text: string | null | undefined, factor = 1): ParsedIngredient[] {
  if (!text) return [];
  return text.split(/\r?\n/).map((line) => {
    const raw = line.trim();
    if (!raw) return null;
    const m = raw.match(NUM_RE);
    if (m) {
      const amount = FRAC(m[1].replace(",", ".")) * factor;
      const unit = (m[2] ?? "").trim();
      const name = m[3].trim();
      return { raw, amount, unit, name };
    }
    return { raw, amount: 0, unit: "", name: raw };
  }).filter(Boolean) as ParsedIngredient[];
}

export function nameKey(name: string, unit: string) {
  return `${name.toLowerCase().trim()}::${unit.toLowerCase().trim()}`;
}
