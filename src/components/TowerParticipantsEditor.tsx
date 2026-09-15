import type { TowerParticipant } from "@/lib/tower-participants";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { TowerNicknameCombobox } from "@/components/TowerNicknameCombobox";

export function TowerParticipantsEditor({
  value,
  onChange,
  disabled,
}: {
  value: TowerParticipant[];
  onChange: (value: TowerParticipant[]) => void;
  disabled: boolean;
}) {
  const playersQuery = useQuery({
    queryKey: ["nickname-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("battle_power")
        .select("id,nickname")
        .order("nickname");
      if (error) throw error;
      return data ?? [];
    },
  });
  const update = (index: number, patch: Partial<TowerParticipant>) =>
    onChange(value.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)));
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Ніки та коментарі
      </legend>
      {value.map((entry, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex gap-2">
            <TowerNicknameCombobox
              label={`Нік ${index + 1}`}
              value={entry.nickname}
              onChange={(nickname) => update(index, { nickname })}
              players={playersQuery.data ?? []}
              disabled={disabled}
              loading={playersQuery.isLoading}
              failed={playersQuery.isError}
            />
            <button
              type="button"
              aria-label={`Видалити нік ${entry.nickname || index + 1}`}
              onClick={() => onChange(value.filter((_, position) => position !== index))}
              className="rounded-lg border border-destructive/40 px-3 text-destructive hover:bg-destructive/10"
            >
              ×
            </button>
          </div>
          <textarea
            aria-label={`Коментар до ніку ${entry.nickname || index + 1}`}
            value={entry.comment}
            onChange={(event) => update(index, { comment: event.target.value })}
            rows={3}
            placeholder="Коментар цього гравця: стратегія, склад…"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { nickname: "", comment: "" }])}
        className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
      >
        + Додати нік
      </button>
      <p className="text-xs text-muted-foreground">
        Зміни зберігаються кнопкою «Зберегти» для всіх комірок цієї копії.
      </p>
    </fieldset>
  );
}
