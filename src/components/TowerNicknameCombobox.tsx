import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { filterNicknameOptions, type NicknameOption } from "@/lib/nickname";

export function TowerNicknameCombobox({
  value,
  onChange,
  players,
  label,
  disabled,
  loading,
  failed,
}: {
  value: string;
  onChange: (nickname: string) => void;
  players: readonly NicknameOption[];
  label: string;
  disabled: boolean;
  loading: boolean;
  failed: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const options = filterNicknameOptions(players, search);
  const expanded = open && !disabled;
  const choose = (nickname: string) => {
    onChange(nickname);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div
      className="relative min-w-0 flex-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={
          expanded && options[activeIndex] ? `${listId}-${activeIndex}` : undefined
        }
        autoComplete="off"
        value={value}
        disabled={disabled}
        onFocus={() => {
          setSearch("");
          setActiveIndex(-1);
          setOpen(true);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setSearch(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && expanded) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            const next =
              event.key === "ArrowDown"
                ? Math.min(activeIndex + 1, options.length - 1)
                : Math.max(activeIndex - 1, 0);
            setActiveIndex(next);
            document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" });
          }
          if (event.key === "Enter" && expanded) {
            event.preventDefault();
            if (options[activeIndex]) choose(options[activeIndex].nickname);
            else setOpen(false);
          }
        }}
        placeholder="Оберіть або введіть нік"
        className="w-full rounded-lg border border-border bg-input py-2 pl-3 pr-10 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      <button
        type="button"
        aria-label={`Показати список ніків: ${label}`}
        aria-expanded={expanded}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          inputRef.current?.focus();
          setSearch("");
          setActiveIndex(-1);
          setOpen(!expanded);
        }}
        className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent"
      >
        <ChevronDown aria-hidden="true" className="h-4 w-4" />
      </button>
      {expanded && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl">
          <div
            id={listId}
            role="listbox"
            aria-label={`Ніки гравців: ${label}`}
            className="max-h-48 overflow-y-auto overscroll-contain"
          >
            {options.map((player, index) => (
              <button
                key={player.id}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={player.nickname === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(player.nickname)}
                className={`block w-full break-words rounded px-3 py-2 text-left text-sm hover:bg-accent ${activeIndex === index ? "bg-accent" : ""}`}
              >
                {player.nickname}
              </button>
            ))}
          </div>
          {options.length === 0 && (
            <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
              {loading
                ? "Завантаження ніків…"
                : failed
                  ? "Не вдалося завантажити список. Можна ввести нік вручну."
                  : "Збігів немає. Можна залишити введений нік."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
