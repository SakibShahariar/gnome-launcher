# gnome-launcher (Shell extension)

A GNOME Shell extension version of the app launcher, replacing the earlier
standalone GTK4 prototype. This exists because **Mutter does not implement
`wlr-layer-shell`** - that prototype's overlay/keyboard-grab behavior could
never work on stock GNOME regardless of code correctness. This extension
uses Shell's own `ModalDialog` instead, which is the actual native
mechanism GNOME provides for this kind of overlay UI.

## Status

Written and syntax-checked (`node --check` on every file, XML/JSON
validated) in a headless container with no running GNOME Shell, so it has
**not** been loaded into a real Shell session yet. Expect some real
debugging on first load - GJS/Shell API mistakes often only surface at
runtime, not at parse time.

## Install

```bash
# 1. Compile the settings schema
glib-compile-schemas schemas/

# 2. Symlink (not copy) into Shell's extensions directory, using the UUID
#    from metadata.json as the folder name - Shell requires this exact match
mkdir -p ~/.local/share/gnome-shell/extensions
ln -s "$(pwd)" ~/.local/share/gnome-shell/extensions/gnome-launcher@sakib.dev

# 3. Reload Shell so it notices the new extension
#    On Wayland this means logging out and back in - there's no in-session
#    reload command like X11's Alt+F2 r had.
```

After logging back in:

```bash
gnome-extensions enable gnome-launcher@sakib.dev
```

Toggle with **Ctrl+Alt+Space** (the default keybinding - chosen to avoid
colliding with GNOME's own Super+Space input-source switcher). Switch
between all 14 layouts via:

```bash
gnome-extensions prefs gnome-launcher@sakib.dev
```

Or set directly:

```bash
gsettings --schemadir schemas set org.gnome.shell.extensions.gnome-launcher layout "grid"
```

Available layout names: `list`, `grid`, `hotkey`, `sidebar`,
`split-preview`, `dock`, `fullscreen`, `top-dropdown`, `corner`,
`full-edge`, `adaptive-width`, `krunner`, `split-tabs`, `hero-banner` -
matching archetypes #1-14 in `launcher-layout-ideas.md`.

Escape closes the launcher. Enter launches the selected app. Arrow keys
move selection (grid-style layouts jump a full row on Up/Down instead of
one item, via each layout's `columns` property). The hotkey layout also
accepts 1-9 directly.

## Debugging

Extension errors show up in the systemd journal, not a normal terminal
(the code runs inside the `gnome-shell` process itself):

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

Watch that in one terminal while triggering the keybinding in another.

## Theming

`lib/theme.js` reads directly from `/home/sakib/.zen/ke09ovgb.myuser/chrome/colors.css`
(Zen Browser's live Matugen-generated chrome theming file), pulling every
color role out of that file's CSS custom properties (`--role_name: #hex;`).
No intermediate `colors.json`, no separate template - whatever's in that
file at the moment the launcher opens is what renders. (An earlier version
of this pointed at `matugen-colors.toml`, which turned out to be a static
snapshot rather than something that actually regenerates per wallpaper -
this file is confirmed live.)

The launcher re-reads this file fresh every time the dialog opens, so
whatever regenerates it - your existing Matugen pipeline - is picked up
automatically the next time you press the keybinding.

**This exact path is hardcoded to the original author's machine.** If
you're not Sakib, edit `THEME_FILE_PATH` at the top of `lib/theme.js` to
point at wherever your own color pipeline writes CSS custom properties
using Material 3 role names (`--surface`, `--primary`,
`--primary_container`, etc. - see the file for the full list `theme.js`
looks for).

If the configured path is missing or unparseable, `theme.js` falls back
to a hardcoded M3 baseline purple scheme rather than crashing.

## Architecture

```
extension.js              entry point: registers keybinding, toggles LauncherDialog
lib/
  appSearch.js              Shell.AppSystem enumeration + fuzzy search
  theme.js                   Live Matugen color loader (see Theming above)
  launcherDialog.js           ModalDialog subclass: hosts the active layout,
                               key handling, edge-anchor positioning (see below)
  layouts/
    registry.js                maps the 'layout' setting to layout classes
    list.js                     #2  minimal list
    grid.js                      #1  icon grid
    hotkey.js                     #3  numbered hotkeys
    sidebar.js                     #4  category rail + list
    splitPreview.js                 #5  list + detail pane
    dock.js                          #6  bottom-anchored dock
    fullscreen.js                     #7  fullscreen takeover
    topDropdown.js                     #8  top-edge dropdown shade
    corner.js                           #9  corner-anchored panel
    fullEdge.js                          #10 full-height edge strip
    adaptiveWidth.js                      #11 width follows result count
    krunner.js                             #12 dense flush top bar
    splitTabs.js                            #13 split panel + mode tabs
    heroBanner.js                            #14 gradient banner + mode icons
prefs.js                  Adw.PreferencesWindow: layout dropdown
schemas/                  GSettings schema (keybinding + layout selection)
```

All fourteen archetypes from `launcher-layout-ideas.md` are now implemented.

### Edge-anchor positioning

Six layouts (`dock`, `fullscreen`, `top-dropdown`, `corner`, `full-edge`,
`krunner`) set a `this.position` property in their constructor -
`launcherDialog.js`'s `_applyPosition()` reads that and repositions
`dialogLayout` against real monitor geometry (`Main.layoutManager.
primaryMonitor`) instead of `ModalDialog`'s default centered placement.
Layouts that don't set `position` keep the default centered behavior.

**This positioning code has not been verified against a live Shell
session** - written using standard Clutter APIs (`get_preferred_width/
height`, `set_position`) that are used elsewhere in Shell's own source,
but the exact pixel results should be checked on first real run. If a
layout appears in the wrong spot, that's the first place to look.

### Adding a new layout beyond these 14

1. Create `lib/layouts/<name>.js` exporting a class with:
   - `constructor(dialog, theme)` - stash both, you'll need `theme.<role>`
     hex strings for `style:` properties and `dialog._filtered`/`dialog._selectedIndex`
     for state. Optionally set `this.position` (`'top'`, `'top-flush'`,
     `'bottom'`, `'top-left'`, `'left-edge'`, or `'fullscreen'`) to anchor
     to a screen edge instead of the default centered placement, and/or
     `this.columns` if arrow-key Up/Down should jump a full row.
   - `buildUI()` - returns the root `St.Widget` (typically an `St.BoxLayout`),
     built once when the dialog opens.
   - `renderResults()` - called every time the query or selection changes;
     rebuild the results portion of the tree from `dialog._filtered`.
2. Register it in `lib/layouts/registry.js`'s `LAYOUTS` object.
3. Add its name to `LAYOUT_NAMES` in `prefs.js` so it shows up in the
   preferences dropdown.

## Known issues found during real testing

- **Pink/colored frame around the dialog**: `ModalDialog` applies its own
  default `.modal-dialog` background/border from your active Shell theme -
  unrelated to Matugen, since we only style the inner card, not the
  dialog's own outer box. Fixed by `stylesheet.css`, which GNOME Shell
  loads automatically from the extension root and which strips that
  default chrome for dialogs carrying our `launcher-dialog` style class.
  Requires a Shell reload (log out/in) to pick up if you already had the
  extension enabled without this file.

## Known differences from the GTK4 prototype

- **No CLI `--layout` flag** - extensions don't run as an invoked process,
  they load into the `gnome-shell` process and stay resident. Layout is a
  persistent setting instead (`gnome-extensions prefs`), not a per-invocation
  argument.
- **St's CSS is more limited than GTK4's** - no custom properties/variables,
  so `theme.js` colors are interpolated directly into `style:` strings per
  widget rather than defined once and referenced. More repetitive, but
  functionally equivalent.
- **Edge-anchoring, fullscreen, and dock-style layouts (archetypes #6-#14)
  are straightforward here** - Shell's `Main.layoutManager` gives real
  monitor geometry and `ModalDialog`/custom `St.Widget` positioning isn't
  blocked by any missing protocol, unlike the GTK4 version. These are good
  candidates for the next porting batch since they're actually easier here
  than they were in the GTK4 prototype.
- **App launch uses `Shell.App.open_new_window(-1)`** instead of
  `Gio.AppInfo.launch()` - GNOME's own preferred method, matches what the
  Activities overview itself does.

## License

GPL-2.0-or-later. See `LICENSE`.
