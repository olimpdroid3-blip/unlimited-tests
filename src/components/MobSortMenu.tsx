import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MOB_SORT_LABELS, MOB_SORT_MODES, type MobSortMode } from "@/lib/mob-levels";

type MobSortMenuProps = {
  value: MobSortMode;
  onValueChange: (value: MobSortMode) => void;
};

export function MobSortMenu({ value, onValueChange }: MobSortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="shrink-0">
          <ArrowUpDown />
          {MOB_SORT_LABELS[value]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextValue) => {
            if (MOB_SORT_MODES.includes(nextValue as MobSortMode)) {
              onValueChange(nextValue as MobSortMode);
            }
          }}
        >
          {MOB_SORT_MODES.map((mode) => (
            <DropdownMenuRadioItem key={mode} value={mode}>
              {MOB_SORT_LABELS[mode]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
