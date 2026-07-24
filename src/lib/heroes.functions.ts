import { createServerFn } from "@tanstack/react-start";

type ParsedHero = { name_en: string; source_icon_url: string };

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // ~10 years

function decodeHtml(s: string): string {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extFromUrl(u: string): string {
  const m = u.match(/\.(webp|png|jpg|jpeg|gif)(?:\?|$)/i);
  return m ? m[1].toLowerCase() : "webp";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "hero";
}

async function parseHeroesFromFastidious(): Promise<ParsedHero[]> {
  const res = await fetch("https://fastidious.gg/heroes", {
    headers: { "user-agent": "Mozilla/5.0 (compatible; LovableBot/1.0)" },
  });
  const html = await res.text();
  const m = html.match(/<div id="app" data-page="([^"]+)"/);
  if (!m) return [];
  const raw = decodeHtml(m[1]);
  let data: {
    props?: {
      storageUrl?: string;
      storageVersion?: string;
      heroes?: Array<{ name?: string; image_card?: string }>;
    };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const storage = data.props?.storageUrl ?? "https://fastidious.gg/storage/";
  const version = data.props?.storageVersion;
  const heroes = data.props?.heroes ?? [];
  const seen = new Set<string>();
  const out: ParsedHero[] = [];
  for (const h of heroes) {
    const name = (h.name ?? "").trim();
    const img = h.image_card ?? "";
    if (!name || !img || seen.has(name)) continue;
    seen.add(name);
    const url = `${storage}heroes/${img}${version ? `?v=${version}` : ""}`;
    out.push({ name_en: name, source_icon_url: url });
  }
  return out;
}

async function translateBatch(names: string[]): Promise<Record<string, string>> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key || names.length === 0) {
    return Object.fromEntries(names.map((n) => [n, n]));
  }
  const prompt = `Translate these Watcher of Realms hero names from English to Russian. Use commonly accepted Russian localization if known, otherwise transliterate. Return JSON only: {"map": {"English": "Русский", ...}}. Names:\n${names.map((n) => `- ${n}`).join("\n")}`;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You translate game hero names to Russian. Respond with strict JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as { map?: Record<string, string> };
    const map = parsed.map ?? {};
    const result: Record<string, string> = {};
    for (const n of names) result[n] = map[n] || n;
    return result;
  } catch (e) {
    console.error("translate error", e);
    return Object.fromEntries(names.map((n) => [n, n]));
  }
}

export const syncHeroes = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const parsed = await parseHeroesFromFastidious();
  if (parsed.length === 0) {
    return { added: 0, skipped: 0, total: 0, message: "Не вдалося отримати список" };
  }

  const { data: existing, error: exErr } = await supabaseAdmin
    .from("heroes")
    .select("name_en");
  if (exErr) throw exErr;
  const have = new Set((existing ?? []).map((h) => h.name_en));
  const toAdd = parsed.filter((h) => !have.has(h.name_en));

  if (toAdd.length === 0) {
    return { added: 0, skipped: parsed.length, total: parsed.length };
  }

  const translations = await translateBatch(toAdd.map((h) => h.name_en));
  let added = 0;

  for (const hero of toAdd) {
    try {
      const imgRes = await fetch(hero.source_icon_url);
      if (!imgRes.ok) continue;
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      const ext = extFromUrl(hero.source_icon_url);
      const path = `${slugify(hero.name_en)}-${Date.now()}.${ext}`;
      const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : `image/${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("hero-icons")
        .upload(path, buf, { contentType, upsert: true });
      if (upErr) {
        console.error("upload err", hero.name_en, upErr);
        continue;
      }
      const { data: signed } = await supabaseAdmin.storage
        .from("hero-icons")
        .createSignedUrl(path, SIGNED_URL_TTL);
      const icon_url = signed?.signedUrl ?? null;

      const { error: insErr } = await supabaseAdmin.from("heroes").insert({
        name_en: hero.name_en,
        name_ru: translations[hero.name_en] || hero.name_en,
        icon_url,
        source_icon_url: hero.source_icon_url,
      });
      if (insErr) {
        console.error("insert err", hero.name_en, insErr);
        continue;
      }
      added++;
    } catch (e) {
      console.error("hero err", hero.name_en, e);
    }
  }

  return { added, skipped: parsed.length - toAdd.length, total: parsed.length };
});

export const uploadHeroIcon = createServerFn({ method: "POST" })
  .inputValidator((input: { name_en: string; dataUrl: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const match = data.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data");
    const contentType = match[1];
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    const ext = contentType.split("/")[1].replace("+xml", "").replace("jpeg", "jpg");
    const path = `${slugify(data.name_en)}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("hero-icons")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw upErr;
    const { data: signed } = await supabaseAdmin.storage
      .from("hero-icons")
      .createSignedUrl(path, SIGNED_URL_TTL);
    return { icon_url: signed?.signedUrl ?? null };
  });

export const uploadDefenseScreenshot = createServerFn({ method: "POST" })
  .inputValidator((input: { dataUrl: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const match = data.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data");
    const contentType = match[1];
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    const ext = contentType.split("/")[1].replace("+xml", "").replace("jpeg", "jpg");
    const path = `def-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("defense-screenshots")
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) throw upErr;
    const { data: signed } = await supabaseAdmin.storage
      .from("defense-screenshots")
      .createSignedUrl(path, SIGNED_URL_TTL);
    return { screenshot_url: signed?.signedUrl ?? null };
  });
