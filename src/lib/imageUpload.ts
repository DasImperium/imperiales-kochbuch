import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_DIM = 1920;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function compressImage(file: File): Promise<Blob> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Nur JPEG, PNG oder WEBP erlaubt");
  }
  if (file.size <= MAX_BYTES && file.type !== "image/png") return file;

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });

  let { width, height } = img;
  if (width > MAX_DIM || height > MAX_DIM) {
    const r = Math.min(MAX_DIM / width, MAX_DIM / height);
    width = Math.round(width * r);
    height = Math.round(height * r);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.85;
  let blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", quality));
  while (blob.size > MAX_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", quality));
  }
  return blob;
}

export async function uploadImage(bucket: "recipe-images" | "comment-images" | "chat-images", file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  const blob = await compressImage(file);
  const ext = blob.type === "image/jpeg" ? "jpg" : blob.type.split("/")[1];
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
