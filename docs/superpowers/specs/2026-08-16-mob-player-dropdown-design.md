# Mob Player Dropdown Design

## Goal

Replace the browser-native player selects on the mob-level viewer and editor with a consistently styled dropdown that matches the site's light orange-accented interface.

## Scope

The change applies to:

- `/mob-levels`;
- `/mob-levels/edit`.

It does not add player search, change player ordering, or alter how player data is loaded and saved.

## Component choice

Use the existing Radix-based components from `src/components/ui/select.tsx`. This provides keyboard navigation, focus handling, selected-item state, and portal positioning without building another dropdown implementation.

## Visual behavior

The closed trigger uses the existing card/background colors, a rounded border, the selected nickname or `Оберіть нік`, and a chevron. Focus uses the project's orange primary color.

The opened list:

- matches the trigger width;
- has a light popover background, border, rounded corners, and shadow;
- has a maximum height of approximately 280 pixels;
- scrolls vertically when all players do not fit;
- highlights hovered and keyboard-focused rows with a soft orange background;
- marks the selected player with an orange accent and check icon.

## Interaction behavior

The viewer clears its mob filter and updates the `playerId` search parameter when a player is selected.

The editor continues to call its existing `changePlayer` function. If there are unsaved changes, the existing confirmation dialog remains in control. When the change is rejected, the dropdown continues to display the current player.

Loading, no-player, and saving states disable the trigger under the same conditions as the current native selects.

## Testing

Unit coverage verifies the pure player-selection transition used by the viewer. Existing unit tests remain green. A production build checks TypeScript and route compilation. Browser smoke tests verify opening, scrolling, selected-row styling, and selection on both routes.
