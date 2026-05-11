export interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  is_root: boolean;
  created_by?: string | null;
}

export const ROOT_CATEGORY_NAMES = ["Kochen", "Backen", "Salate", "Desserts", "Getränke"] as const;

export function getCategoryPath(id: string | null, all: CategoryRow[]): CategoryRow[] {
  const path: CategoryRow[] = [];
  let cur = all.find((c) => c.id === id);
  while (cur) {
    path.unshift(cur);
    cur = cur.parent_id ? all.find((c) => c.id === cur!.parent_id) : undefined;
  }
  return path;
}

export function formatCategoryPath(id: string | null, all: CategoryRow[]): string {
  return getCategoryPath(id, all).map((c) => c.name).join(" / ");
}

export function getDescendantIds(id: string, all: CategoryRow[]): Set<string> {
  const out = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of all) if (c.parent_id === cur && !out.has(c.id)) {
      out.add(c.id); stack.push(c.id);
    }
  }
  return out;
}

export function getRoots(all: CategoryRow[]): CategoryRow[] {
  return all.filter((c) => c.is_root).sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function getChildren(parentId: string, all: CategoryRow[]): CategoryRow[] {
  return all.filter((c) => c.parent_id === parentId).sort((a, b) => a.name.localeCompare(b.name, "de"));
}
