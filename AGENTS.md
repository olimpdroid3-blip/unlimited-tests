<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Keep tower-start nickname enrichment separate from `resolveMemberNickname`, which enforces walkthrough membership rules, so opening tower forms never depends on Telegram role lookup success.
- Scouting RPCs use the existing external admin client only in server modules; clear-all prepares the legacy archive projection from the unchanged server snapshot and calls one atomic RPC before best-effort storage cleanup, preventing partial resets.
- Telegram scouting runs only after tower/walkthrough routing and gives active video forms precedence, preserving interactive input ownership.
