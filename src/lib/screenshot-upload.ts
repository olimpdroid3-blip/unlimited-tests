// Shared client-side screenshot compression + upload helpers (GvG project storage).
import { supabase } from "@/lib/db";

export const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

export async function compressImage(file: File, maxSide = 1280, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadScreenshot(
  bucket: string,
  file: File,
  prefix: string,
): Promise<{ url: string | null; path: string }> {
  const compressed = await compressImage(file);
  const extMatch = compressed.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = (extMatch?.[1] ?? compressed.type.split("/")[1] ?? "bin")
    .toLowerCase()
    .replace("jpeg", "jpg");
  const path = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
    contentType: compressed.type || undefined,
    upsert: true,
  });
  if (error) throw error;
  const { data: signed, error: sErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (sErr) throw sErr;
  return { url: signed?.signedUrl ?? null, path };
}
