import type { PlayerOption } from "@/lib/mob-levels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PlayerSelectFieldProps = {
  id: string;
  value?: string;
  players: readonly PlayerOption[];
  disabled?: boolean;
  onValueChange: (playerId: string) => void;
};

export function PlayerSelectField({
  id,
  value,
  players,
  disabled = false,
  onValueChange,
}: PlayerSelectFieldProps) {
  const labelId = `${id}-label`;

  return (
    <div className="flex flex-col gap-1.5">
      <span
        id={labelId}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Гравець
      </span>
      <Select value={value ?? ""} disabled={disabled} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          aria-labelledby={labelId}
          className="h-11 rounded-xl border-border bg-background px-3 shadow-sm transition-colors hover:border-primary/50 focus:ring-2 focus:ring-primary/20 data-[state=open]:border-primary/60 data-[state=open]:ring-2 data-[state=open]:ring-primary/10"
        >
          <SelectValue placeholder="Оберіть нік" />
        </SelectTrigger>
        <SelectContent
          sideOffset={6}
          className="max-h-72 rounded-xl border-border bg-popover shadow-xl"
        >
          {players.map((player) => (
            <SelectItem
              key={player.id}
              value={player.id}
              className="h-10 rounded-lg px-3 pr-9 text-sm focus:bg-primary/10 focus:text-foreground data-[state=checked]:bg-primary/10 data-[state=checked]:font-semibold data-[state=checked]:text-primary"
            >
              {player.nickname}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
