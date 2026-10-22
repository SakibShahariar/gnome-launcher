# Development Guide

This document covers the GNOME Launcher codebase and how to add a layout. The main README is intended for users; keep implementation details here.

## Project structure

The project is a GNOME Shell extension. The main pieces are:

- `extension.js` — extension lifecycle and entry point.
- `prefs.js` — extension preferences UI.
- `schemas/` — GSettings schema and defaults.
- `lib/` — launcher dialog, search, clipboard history, and supporting behavior.
- `lib/layouts/` — individual launcher layout implementations.
- `stylesheet.css` — shared styling.
- `metadata.json` — GNOME Shell extension metadata.

Names can change as the project evolves; use the current tree as the source of truth.

## Development setup

From the repository root, compile the settings schema:

```bash
glib-compile-schemas schemas/
```

For a local user installation, create a symlink into the GNOME Shell extensions directory:

```bash
mkdir -p ~/.local/share/gnome-shell/extensions
ln -s "$(pwd)" ~/.local/share/gnome-shell/extensions/gnome-launcher@sakib.dev
```

Enable the extension and open its preferences:

```bash
gnome-extensions enable gnome-launcher@sakib.dev
gnome-extensions prefs gnome-launcher@sakib.dev
```

After changing extension code, restart the GNOME Shell session as appropriate for your GNOME version and session type. On Wayland, logging out and back in is the reliable way to reload the shell extension.

## Adding a layout

1. Inspect an existing layout with similar positioning and interaction. Reuse its conventions rather than duplicating shared behavior.
2. Implement the layout in the `layouts/` directory, following the project's existing layout interface and lifecycle.
3. Register the layout in the same places as the existing layouts, including the layout selector/settings if required.
4. Reuse shared launcher behavior for search, keyboard navigation, app launching, and dismissal.
5. Prefer shared rules in `stylesheet.css` for reusable styling. Layout-specific inline styles are currently common in this codebase, so avoid broad style migrations unless they can be verified visually.
6. Add a screenshot and update the README's layout gallery if the new layout is intended for users.
7. Compile schemas if settings changed, then test opening, searching, navigating, launching an app, and closing the launcher.

## Keyboard behavior

- All layouts support typing to filter apps, arrow-key navigation, `Enter` to launch the selected result, and `Escape` to close.
- In Hotkey layout, `Ctrl+1` through `Ctrl+9` launch the corresponding visible result. The number row and numeric keypad are both supported; ordinary digits without `Ctrl` remain available for searching.
- Layouts with mode controls use `Ctrl+1` through `Ctrl+4` to switch modes. This mode shortcut takes precedence over Hotkey layout's direct-launch shortcut only in layouts that expose mode switching.
- Sidebar, Split Tabs, and Hero Banner expose Run, Window, and Clipboard modes. Window mode honors the `windows-all-workspaces` preference and filters titles as you type. Clipboard mode only tracks clipboard changes when the opt-in `clipboard-history-enabled` setting is enabled; it keeps up to 20 text entries in memory, typing filters them, and activating one copies it back to the clipboard.
- Those layouts also route `> ` (Run), `/` (Files), `w ` (Window), `;` (Clipboard), `= ` (Calculator), `? ` (Web search), `recent ` (Recent documents), and `emoji ` (Emoji) prefixes into the matching finder. Calculator expressions use a pure arithmetic parser with offline unit conversions, and web search uses the configurable HTTP(S) URL template in Preferences. `lib/finderPrefix.js` contains the shared parser and its behavior is covered by Node unit tests. Prefix routing is not yet available in layouts without mode controls.
- In Run mode, `Ctrl+Enter` requests a terminal launch for interactive commands. Preferences can provide a terminal command template with exactly one standalone `{command}` argument (for example, `ptyxis -- {command}`); that placeholder expands to the command's argument vector, not a shell string. An empty template uses the built-in terminal detection list. Normal `Enter` continues to use the existing non-terminal launch path. Commands are not evaluated by a shell, so shell operators and variable expansion do not work.
- Mode-switching layouts expose their modes through `Ctrl+1` onward in the order shown by the UI; layouts with fewer modes simply ignore unavailable indices.

## Search behavior

The launcher integrates with GNOME Shell's application-search facilities and uses a fuzzy-matching fallback where needed. Keep the search implementation compatible with the GNOME Shell version targeted by the project, and handle provider failures gracefully. Avoid documenting internal implementation details in the user-facing README unless users need them to configure or troubleshoot the feature.

For debugging, inspect GNOME Shell logs after reproducing an issue:

```bash
journalctl --user -b /usr/bin/gnome-shell
```

Depending on the system, this may be more useful:

```bash
journalctl --user -b | grep -i 'gnome-shell\|gnome-launcher'
```

## Contribution notes

- Keep user-facing documentation concise and focused on installation, features, configuration, and troubleshooting.
- Put architecture notes and contributor instructions in this file.
- Test changes in a real GNOME Shell session before describing behavior as verified.
- Use focused commit messages, for example `docs: simplify README` or `feat: add compact layout`.
