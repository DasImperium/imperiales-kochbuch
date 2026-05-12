import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Tier = 1 | 2 | 3 | 4;
export const TIER_LABEL: Record<number, string> = { 2: "Admin", 3: "Superadmin", 4: "Imperator" };
export const TIER_COLOR: Record<number, string> = { 2: "#C0392B", 3: "#1565C0", 4: "#2E7D32" };

/** Soft-Delete: setzt deleted_at + deleted_by_tier. Rezept bleibt erhalten. */
export async function softDeleteRecipe(recipeId: string, userId: string, tier: number) {
  const { error } = await supabase.from("recipes")
    .update({ deleted_at: new Date().toISOString(), deleted_by_user: userId, deleted_by_tier: tier })
    .eq("id", recipeId);
  if (error) { toast.error(error.message); return false; }
  return true;
}

/** Wiederherstellen */
export async function restoreRecipe(recipeId: string) {
  const { error } = await supabase.from("recipes")
    .update({ deleted_at: null, deleted_by_user: null, deleted_by_tier: null })
    .eq("id", recipeId);
  if (error) { toast.error(error.message); return false; }
  return true;
}

/** Endgültig entfernen (Tier muss >= protection_tier) */
export async function purgeRecipe(recipeId: string) {
  const { error } = await supabase.from("recipes").delete().eq("id", recipeId);
  if (error) { toast.error(error.message); return false; }
  return true;
}

/** Protection setzen (0=keine, 2=admin, 3=superadmin, 4=imperator). */
export async function setProtection(recipeId: string, tier: number) {
  const { error } = await supabase.from("recipes").update({ protection_tier: tier }).eq("id", recipeId);
  if (error) { toast.error(error.message); return false; }
  return true;
}
