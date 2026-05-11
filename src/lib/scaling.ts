// Skaliert Zutatenmengen proportional. Erkennt Zahlen, Brüche (1/2), Kommazahlen.
// Lässt Zeilen ohne erkannte Menge unverändert.

const FRACTION_MAP: Record<string, number> = {
  "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125,
};

function fmt(n: number): string {
  if (!isFinite(n) || n <= 0) return "";
  // Nice rounding: max 2 decimals, strip trailing zeros
  const r = Math.round(n * 100) / 100;
  return r.toString().replace(".", ",");
}

export function scaleIngredientLine(line: string, factor: number): string {
  if (factor === 1) return line;
  // Match leading number(s): "200", "1,5", "1.5", "1/2", "1 1/2", or unicode fraction
  const re = /^(\s*)((?:\d+\s+\d+\/\d+)|(?:\d+\/\d+)|(?:\d+(?:[.,]\d+)?)|[½¼¾⅓⅔⅛])(\s*)/;
  const m = line.match(re);
  if (!m) return line;
  const [, lead, raw, sp] = m;
  let value = 0;
  if (FRACTION_MAP[raw]) value = FRACTION_MAP[raw];
  else if (/\s/.test(raw) && raw.includes("/")) {
    const [whole, frac] = raw.split(/\s+/);
    const [a, b] = frac.split("/").map(Number);
    value = parseInt(whole, 10) + a / b;
  } else if (raw.includes("/")) {
    const [a, b] = raw.split("/").map(Number);
    value = a / b;
  } else {
    value = parseFloat(raw.replace(",", "."));
  }
  if (!isFinite(value) || value <= 0) return line;
  const scaled = fmt(value * factor);
  return `${lead}${scaled}${sp}${line.slice(m[0].length)}`;
}

export function scaleIngredientsText(text: string | null | undefined, factor: number): string {
  if (!text) return "";
  if (factor === 1) return text;
  return text.split("\n").map((l) => scaleIngredientLine(l, factor)).join("\n");
}

export function clampServings(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(100, Math.round(n)));
}
