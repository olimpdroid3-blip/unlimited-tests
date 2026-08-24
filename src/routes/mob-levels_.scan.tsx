import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { analyzeGroupScreenshot, type RecognizedMob } from "@/lib/mob-recognition.functions";
import { loadMobLevelPlayers, mobLevelsRepository } from "@/lib/mob-levels-ui";

type ScanSearch = { playerId?: string };

export const Route = createFileRoute("/mob-levels_/scan")({
  validateSearch: (search: Record<string, unknown>): ScanSearch => ({
    playerId: typeof search.playerId === "string" ? search.playerId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Розпізнавання скріншота мобів — NoNameClan" },
      {
        name: "description",
        content: "Завантажте скріншот групи мобів — система визначить їх рівні автоматично.",
      },
      { property: "og:title", content: "Розпізнавання скріншота мобів — NoNameClan" },
      {
        property: "og:description",
        content: "Автоматичне визначення рівнів мобів зі скріншота.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MobScanPage,
});

async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не вдалося обробити зображення");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function MobScanPage() {
  const { playerId } = Route.useSearch();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<RecognizedMob[]>([]);

  const playersQuery = useQuery({ queryKey: ["mob-level-players"], queryFn: loadMobLevelPlayers });
  const player = useMemo(
    () => (playersQuery.data ?? []).find((p) => p.id === playerId),
    [playersQuery.data, playerId],
  );

  async function handleFile(file: File) {
    setResults([]);
    setIsAnalyzing(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      const { mobs } = await analyzeGroupScreenshot({ data: { screenshot: dataUrl } });
      setResults(mobs);
      toast[mobs.length ? "success" : "error"](
        mobs.length ? `Розпізнано мобів: ${mobs.length}` : "Не вдалося розпізнати жодного моба",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Помилка розпізнавання");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!playerId || results.length === 0) return;
    setIsSaving(true);
    try {
      await mobLevelsRepository.upsertMany(
        results.map((r) => ({ playerId, mobId: r.monster_id, level: r.detected_level })),
      );
      await queryClient.invalidateQueries({ queryKey: ["mob-levels", playerId] });
      toast.success("Рівні збережено");
      setResults([]);
      setPreview(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не вдалося зберегти");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <Toaster />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-6">
        <Link
          to="/mob-levels"
          search={{ playerId }}
          className="inline-flex rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition hover:bg-accent"
        >
          ← Рівні мобів
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">📷 Завантажити скріншот</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Гравець: <span className="font-medium text-foreground">{player?.nickname ?? "—"}</span>
        </p>

        {!playerId && (
          <p className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Спочатку оберіть гравця на сторінці «Рівні мобів».
          </p>
        )}

        {playerId && (
          <>
            <section className="mt-5 rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleFile(file);
                }}
              />
              <Button
                type="button"
                disabled={isAnalyzing}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Обрати скріншот
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Скріншот групи мобів з видимими рівнями (Ур. X)
              </p>

              {preview && (
                <img
                  src={preview}
                  alt="Завантажений скріншот"
                  className="mx-auto mt-4 max-h-64 rounded-xl border border-border object-contain"
                />
              )}
            </section>

            {isAnalyzing && (
              <div className="mt-5 flex items-center justify-center gap-3 rounded-2xl border border-border bg-card/60 p-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Аналізуємо скріншот, це може зайняти до хвилини…
                </span>
              </div>
            )}

            {results.length > 0 && (
              <section className="mt-5 space-y-2">
                {results.map((mob, index) => (
                  <article
                    key={mob.monster_id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold">{mob.name}</h2>
                      <p className="text-xs text-muted-foreground">{mob.monster_id}</p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={mob.detected_level}
                      className="w-20"
                      onChange={(event) => {
                        const level = Number(event.target.value);
                        setResults((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, detected_level: level } : item,
                          ),
                        );
                      }}
                    />
                  </article>
                ))}

                <Button
                  type="button"
                  className="w-full"
                  disabled={isSaving}
                  onClick={() => void handleSave()}
                >
                  {isSaving ? "Збереження…" : "✅ Підтвердити та внести в базу"}
                </Button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
