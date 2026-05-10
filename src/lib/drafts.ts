// Local-only recipe drafts (offline support)
export interface LocalDraft {
  id: string;
  title: string;
  description?: string;
  ingredients?: string;
  instructions?: string;
  time_required?: string;
  category_id?: string;
  tags?: string[];
  image_url?: string;
  created_at: string;
}

const KEY = "imperial.drafts.v1";

export function listDrafts(): LocalDraft[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveDraft(d: LocalDraft) {
  const all = listDrafts().filter((x) => x.id !== d.id);
  all.push(d);
  localStorage.setItem(KEY, JSON.stringify(all));
}
export function removeDraft(id: string) {
  localStorage.setItem(KEY, JSON.stringify(listDrafts().filter((d) => d.id !== id)));
}
export function clearDrafts() {
  localStorage.removeItem(KEY);
}
