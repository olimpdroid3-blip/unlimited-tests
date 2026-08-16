# Mob Player Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native player selects on both mob-level routes with one reusable, styled, scrollable Radix dropdown.

**Architecture:** A focused `PlayerSelectField` component owns the label, Radix trigger, portal content, player rows, and selected-row styling. Both routes keep their current navigation and dirty-state logic and only replace native select markup with this shared component.

**Tech Stack:** React 19, TypeScript, Radix Select, Tailwind CSS, TanStack Router, browser smoke testing.

## Global Constraints

- Apply the component to `/mob-levels` and `/mob-levels/edit`.
- Do not add player search or change player ordering.
- Preserve viewer filter reset and URL search-parameter behavior.
- Preserve the editor's unsaved-change confirmation.
- Keep loading, empty, and saving disabled states unchanged.
- Limit the open menu to approximately 280 pixels with vertical scrolling.

---

### Task 1: Create the shared styled player dropdown

**Files:**
- Create: `src/components/PlayerSelectField.tsx`

**Interfaces:**
- Consumes: `PlayerOption` from `src/lib/mob-levels.ts` and the existing primitives from `src/components/ui/select.tsx`.
- Produces: `PlayerSelectField({ id, value, players, disabled, onValueChange })`.

- [ ] **Step 1: Record the failing browser behavior**

Open `/mob-levels`, activate the player control, and inspect the rendered menu. The current failure is a browser-native `<select>` whose opened menu uses the operating system's gray surface and cannot use the project's selected-row, hover, radius, or shadow styles.

- [ ] **Step 2: Implement the reusable component**

```tsx
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
    <label className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Гравець
      </span>
      <Select value={value} disabled={disabled} onValueChange={onValueChange}>
        <SelectTrigger id={id} aria-labelledby={labelId} className="h-11 rounded-xl bg-background">
          <SelectValue placeholder="Оберіть нік" />
        </SelectTrigger>
        <SelectContent className="max-h-72 rounded-xl border-border bg-popover shadow-xl">
          {players.map((player) => (
            <SelectItem
              key={player.id}
              value={player.id}
              className="h-10 rounded-lg focus:bg-primary/10 data-[state=checked]:bg-primary/10 data-[state=checked]:font-semibold data-[state=checked]:text-primary"
            >
              {player.nickname}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
```

Add focus and open-state border/ring classes to the trigger while keeping colors expressed through the project's semantic tokens.

- [ ] **Step 3: Run focused lint**

Run: `./node_modules/.bin/eslint src/components/PlayerSelectField.tsx`

Expected: exit 0.

### Task 2: Replace both native player selects

**Files:**
- Modify: `src/routes/mob-levels.tsx`
- Modify: `src/routes/mob-levels_.edit.tsx`

**Interfaces:**
- Consumes: `PlayerSelectField`.
- Preserves: `navigate({ search: { playerId } })`, viewer `setFilter("")`, and editor `changePlayer(playerId)`.

- [ ] **Step 1: Replace the viewer select**

```tsx
<PlayerSelectField
  id="mob-level-player"
  value={selectedPlayerId}
  players={players}
  disabled={playersQuery.isLoading || players.length === 0}
  onValueChange={(nextPlayerId) => {
    setFilter("");
    void navigate({ search: { playerId: nextPlayerId } });
  }}
/>
```

- [ ] **Step 2: Replace the editor select**

```tsx
<PlayerSelectField
  id="mob-level-editor-player"
  value={selectedPlayerId}
  players={players}
  disabled={playersQuery.isLoading || players.length === 0 || isSaving}
  onValueChange={changePlayer}
/>
```

- [ ] **Step 3: Run unit tests and focused lint**

Run: `node --test src/lib/battle-power.test.ts src/lib/mob-levels.test.ts src/lib/test-player-data.test.ts`

Run: `./node_modules/.bin/eslint src/components/PlayerSelectField.tsx src/routes/mob-levels.tsx src/routes/mob-levels_.edit.tsx`

Expected: 26 tests pass and ESLint exits 0.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 5: Browser smoke test**

On `/mob-levels`, open the dropdown and verify a light rounded list, orange focused/selected row, check icon, and scrollable height. Select `Alex` and verify the URL and mob list update. Repeat on `/mob-levels/edit`, then create an unsaved level change and verify rejecting the confirmation keeps the current player selected.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/components/PlayerSelectField.tsx src/routes/mob-levels.tsx src/routes/mob-levels_.edit.tsx
git commit -m "feat: style mob player dropdowns"
```
