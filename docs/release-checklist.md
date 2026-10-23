# Release checklist

Use this checklist before a release that changes launcher behavior, layout code, keyboard handling, or shared styling. Test on a real GNOME Shell session and record the GNOME Shell version, session type (Wayland or X11), display scale, and commit tested. Mark only checks actually performed.

## Common interaction matrix

For **each of the 15 layouts**, select it in Preferences, open the launcher, type a query, navigate results with the arrow keys, activate a result with `Enter`, and close the launcher with `Escape`.

- [ ] `list`
- [ ] `grid`
- [ ] `hotkey`
- [ ] `sidebar`
- [ ] `split-preview`
- [ ] `dock`
- [ ] `fullscreen`
- [ ] `top-dropdown`
- [ ] `corner`
- [ ] `full-edge`
- [ ] `adaptive-width`
- [ ] `krunner`
- [ ] `split-tabs`
- [ ] `hero-banner`
- [ ] `notch`

For every layout, also check that an empty query and a query with no matching results leave the launcher usable, and that repeated open/type/close cycles do not leave stale UI behind.

## Layout positioning and visual behavior

- [ ] For each non-centered or edge/corner-positioned layout, type and clear queries of different lengths and with different result counts; confirm the launcher stays anchored to its intended position instead of drifting. Include Dock, Top Dropdown, Corner, Full Edge, Notch, Sidebar, and Adaptive Width where applicable. See [issue #7](https://github.com/SakibShahariar/gnome-launcher/issues/7).
- [ ] Check that resizing result content, changing selection, and showing an empty state do not cause unexpected clipping or overlap.
- [ ] Check scrolling and the last visible result in layouts that scroll.
- [ ] Check layout-specific transitions and open/close animation for visible jumps or stale actors.

## Modes and finder prefixes

Sidebar, Split Tabs, and Hero Banner have mode controls and shared finder-prefix behavior. Exercise the following on each of these layouts:

- [ ] Switch through each mode shown by the UI using the mode shortcuts; confirm the active mode is clear and keyboard navigation still works.
- [ ] Run: try a harmless GUI command and a terminal command using `Ctrl+Enter`; verify invalid quoting reports an error rather than launching.
- [ ] Windows: search for a visible window and confirm activation works; check the all-workspaces preference if relevant.
- [ ] Clipboard: with clipboard history disabled, confirm no history is collected; enable it explicitly, copy sample text, search for it, and activate the result.
- [ ] Files (`/ `): search for an existing file and confirm activation opens the expected target.
- [ ] Calculator (`= `): check arithmetic, an offline unit conversion, invalid input, and Enter-to-copy behavior.
- [ ] Web search (`? `): confirm the configured URL template is used and malformed/unavailable results fail gracefully.
- [ ] Recent documents (`recent `): search for an existing recent document and verify activation.
- [ ] Emoji (`emoji `): search for an emoji and verify the result can be selected and activated.
- [ ] Confirm changing prefixes or closing the launcher does not allow stale results from a previous query to replace current results.

## Keyboard and preferences

- [ ] Open the launcher using the configured shortcut, then complete a search and activation without a pointer.
- [ ] Confirm `Escape` closes the launcher from the search field and from mode results.
- [ ] In Hotkey layout, verify `Ctrl+1` through `Ctrl+9` launch the expected visible result; ordinary digits remain searchable.
- [ ] Confirm the selected layout and relevant preferences persist after reopening Preferences or restarting the session as appropriate.
- [ ] Check focus visibility, icon-only control names, and keyboard navigation on List and the mode layouts.
- [ ] Check clipboard privacy controls, clear-history behavior, and disable/re-enable cleanup when clipboard history is in scope.

## Automated checks and verification boundary

- [ ] Run the repository's GitHub Actions **Validate** workflow and confirm lint, JavaScript syntax, unit tests, metadata JSON, GSettings schema, and metadata/schema-reference checks pass.
- [ ] Review any failed, cancelled, skipped, or pending checks; do not treat a queued or partially completed workflow as passing.
- [ ] Record any manual checks that could not be completed, with the reason and affected layouts.

CI can validate JavaScript syntax, pure helper tests, metadata, and settings schemas. It **cannot** establish correct Clutter rendering, actual keyboard/focus behavior, screen-reader behavior, visual positioning, frame pacing, or the absence of jank in a live GNOME Shell session. Do not mark those checks complete based on CI alone.
