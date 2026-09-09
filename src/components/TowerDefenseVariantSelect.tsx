import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/db";

export function TowerDefenseVariantSelect({
  towerId,
  value,
  onChanged,
}: {
  towerId: string;
  value: number | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const saveVariant = async (variant: number | null) => {
    setBusy(true);
    try {
      const { error } =
        variant === null
          ? await supabase.from("tower_defense_variants").delete().eq("tower_id", towerId)
          : await supabase.from("tower_defense_variants").upsert({ tower_id: towerId, variant });
      if (error) throw error;
      onChanged();
      toast.success(variant === null ? "Позначку знято" : `Позначку К${variant} збережено`);
    } catch {
      toast.error("Не вдалося зберегти позначку");
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Варіант дефу
      </span>
      <select
        aria-label="Варіант дефу"
        aria-describedby="defense-variant-hint"
        value={value ?? ""}
        onChange={(event) =>
          void saveVariant(event.target.value === "" ? null : Number(event.target.value))
        }
        disabled={busy}
        className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
      >
        <option value="">Без позначки</option>
        {Array.from({ length: 25 }, (_, index) => index + 1).map((variant) => (
          <option key={variant} value={variant}>
            К{variant}
          </option>
        ))}
      </select>
      <span id="defense-variant-hint" className="text-xs text-muted-foreground">
        Однаковим дефам — однаковий номер. Позначка зберігається одразу, навіть для порожньої вежі.
      </span>
    </label>
  );
}
