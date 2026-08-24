import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export type RecognizedMob = {
  monster_id: string;
  name: string;
  detected_level: number;
};

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function mimeFromUrl(url: string): string {
  const m = url.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i);
  const ext = (m?.[1] ?? "png").toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return `image/${ext}`;
}

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]!);
  return btoa(binary);
}

export const analyzeGroupScreenshot = createServerFn({ method: "POST" })
  .inputValidator((input: { screenshot: string }) => {
    if (!input?.screenshot?.startsWith("data:image/")) {
      throw new Error("Потрібен скріншот у форматі data:image/...");
    }
    return input;
  })
  .handler(async ({ data }): Promise<{ mobs: RecognizedMob[] }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Сервіс розпізнавання недоступний");

    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: mobs, error } = await supabaseAdmin
      .from("mobs")
      .select("id,name,image_url")
      .order("id");
    if (error) throw new Error(error.message);

    const origin = new URL(getRequest().url).origin;

    const referenceBlocks: ContentBlock[] = [];
    for (const mob of mobs ?? []) {
      if (!mob.image_url) continue;
      try {
        const url = mob.image_url.startsWith("http") ? mob.image_url : `${origin}${mob.image_url}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 400_000) continue;
        referenceBlocks.push({ type: "text", text: `id=${mob.id} | name=${mob.name}` });
        referenceBlocks.push({
          type: "image_url",
          image_url: { url: `data:${mimeFromUrl(mob.image_url)};base64,${toBase64(buf)}` },
        });
      } catch {
        // пропускаємо недоступне зображення
      }
    }

    const prompt = [
      "Перед тобой скриншот игровых карточек персонажей (мобов) и справочник официальных мобов:",
      "каждый моб задан строкой 'id=... | name=...' и следующим за ней изображением.",
      "Сравни внешность персонажей со скриншота с изображениями справочника, чтобы определить их id и name.",
      "Для каждого распознанного персонажа найди уровень, написанный текстом в самом низу его карточки (например 'Ур. 2', 'Ур. 7', 'Lv. 12').",
      'Верни строго JSON: {"mobs": [{"monster_id": "id_из_справочника", "name": "имя_из_справочника", "detected_level": число}]}.',
      "Не выдумывай мобов, которых нет в справочнике. Каждый моб — не более одного раза.",
    ].join(" ");

    const content: ContentBlock[] = [
      { type: "text", text: prompt },
      { type: "text", text: "СКРИНШОТ ИГРОКА:" },
      { type: "image_url", image_url: { url: data.screenshot } },
      { type: "text", text: "СПРАВОЧНИК МОБОВ:" },
      ...referenceBlocks,
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Ты распознаёшь игровые карточки мобов. Отвечай строго валидным JSON.",
          },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("analyze-group gateway error", res.status, text);
      if (res.status === 429) throw new Error("Забагато запитів. Спробуйте за хвилину.");
      if (res.status === 402) throw new Error("Вичерпано ліміт AI-кредитів робочого простору.");
      throw new Error("Не вдалося розпізнати скріншот");
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    let parsed: { mobs?: unknown } = {};
    try {
      parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}") as { mobs?: unknown };
    } catch {
      throw new Error("Некоректна відповідь розпізнавання");
    }

    const known = new Map((mobs ?? []).map((m) => [m.id, m.name]));
    const seen = new Set<string>();
    const result: RecognizedMob[] = [];

    for (const raw of Array.isArray(parsed.mobs) ? parsed.mobs : []) {
      const item = raw as { monster_id?: unknown; detected_level?: unknown };
      const id = typeof item.monster_id === "string" ? item.monster_id.trim() : "";
      if (!known.has(id) || seen.has(id)) continue;
      const level = Math.round(Number(item.detected_level));
      if (!Number.isFinite(level)) continue;
      seen.add(id);
      result.push({
        monster_id: id,
        name: known.get(id)!,
        detected_level: Math.min(30, Math.max(1, level)),
      });
    }

    return { mobs: result };
  });
