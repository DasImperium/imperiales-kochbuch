/**
 * Einheiten-Normalisierung & Summierung für Inventar/Einkaufsliste.
 * Konvertiert g↔kg und ml↔l auf die "passende" Anzeige-Einheit.
 */
export type Norm = { amount: number; unit: string };

const WEIGHT = new Set(["g", "kg"]);
const VOLUME = new Set(["ml", "l"]);

const lower = (u: string) => (u ?? "").trim().toLowerCase();

/** Auf Basiseinheit (g bzw. ml) bringen. */
export function toBase(amount: number, unit: string): Norm {
  const u = lower(unit);
  if (u === "kg") return { amount: amount * 1000, unit: "g" };
  if (u === "l") return { amount: amount * 1000, unit: "ml" };
  return { amount, unit: u };
}

/** Anzeige-Einheit wählen: < 1 kg → g, ≥ 1 kg → kg; analog ml/l. */
export function prettyUnit(amount: number, baseUnit: string): Norm {
  const u = lower(baseUnit);
  if (u === "g" && amount >= 1000) return { amount: round(amount / 1000), unit: "kg" };
  if (u === "ml" && amount >= 1000) return { amount: round(amount / 1000), unit: "l" };
  // < 1: in Basis bleiben
  return { amount: round(amount), unit: u };
}

/** Hauptkonvertierung: nimmt rohe Menge/Einheit und liefert sinnvolle Anzeige. */
export function normalize(amount: number, unit: string): Norm {
  const u = lower(unit);
  if (WEIGHT.has(u) || VOLUME.has(u)) {
    const base = toBase(amount, u);
    return prettyUnit(base.amount, base.unit);
  }
  return { amount: round(amount), unit: u };
}

/** Summieren: gleiche Einheit (in derselben Familie) zusammenfassen. */
export function sumSameUnit(a: Norm, b: Norm): Norm | null {
  const ua = lower(a.unit); const ub = lower(b.unit);
  if (ua === ub) return normalize(a.amount + b.amount, ua);
  if (WEIGHT.has(ua) && WEIGHT.has(ub)) {
    const ba = toBase(a.amount, ua); const bb = toBase(b.amount, ub);
    return normalize(ba.amount + bb.amount, "g");
  }
  if (VOLUME.has(ua) && VOLUME.has(ub)) {
    const ba = toBase(a.amount, ua); const bb = toBase(b.amount, ub);
    return normalize(ba.amount + bb.amount, "ml");
  }
  return null; // verschiedene Einheiten – Anrufer entscheidet
}

function round(n: number) { return Math.round(n * 1000) / 1000; }

/** Format "Menge | Einheit | Zutat" */
export function formatTriple(amount: number, unit: string, name: string) {
  return `${amount} | ${unit || "—"} | ${name}`;
}
