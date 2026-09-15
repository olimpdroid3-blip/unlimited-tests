import { useId, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/db";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TowerDefenseVariantSelect({
  towerId,
  value,
  onChanged,
  disabled = false,
}: {
  towerId: string;
  value: number | null;
  onChanged: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const hintId = `${fieldId}-hint`;

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
    <div className="flex flex-col gap-1.5">
      <span
        id={labelId}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Варіант дефу
      </span>
      <Select
        value={value === null ? "none" : String(value)}
        onValueChange={(nextValue) =>
          void saveVariant(nextValue === "none" ? null : Number(nextValue))
        }
        disabled={busy || disabled}
      >
        <SelectTrigger
          aria-labelledby={labelId}
          aria-describedby={hintId}
          className="h-11 rounded-lg border-border bg-input text-base text-foreground focus:border-primary focus:ring-primary"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          position="popper"
          sideOffset={4}
          // Keep portaled menu gestures out of the dialog's document scroll lock.
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          className="z-[60] max-h-[min(18rem,var(--radix-select-content-available-height))] [&_[data-radix-select-viewport]]:overscroll-contain"
        >
          <SelectItem value="none" className="min-h-11 text-base">
            Без позначки
          </SelectItem>
          {Array.from({ length: 25 }, (_, index) => index + 1).map((variant) => (
            <SelectItem key={variant} value={String(variant)} className="min-h-11 text-base">
              К{variant}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span id={hintId} className="text-xs text-muted-foreground">
        Однаковим дефам — однаковий номер. Позначка зберігається одразу, навіть для порожньої вежі.
      </span>
    </div>
  );
}
