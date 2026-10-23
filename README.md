# GNOME Launcher

A customizable GNOME Shell app launcher with **15 layouts**, keyboard-driven navigation, native GNOME app search, and Matugen-compatible theming.

Built with GNOME Shell's native `ModalDialog`, it works on stock GNOME under Wayland and X11.

## Screenshots

All 15 layouts:

| | | |
|---|---|---|
| ![Grid](screenshots/grid.png)<br>`grid` | ![List](screenshots/list.png)<br>`list` | ![Hotkey](screenshots/hotkey.png)<br>`hotkey` |
| ![Sidebar](screenshots/sidebar.png)<br>`sidebar` | ![Split preview](screenshots/splitPreview.png)<br>`split-preview` | ![Dock](screenshots/dock.png)<br>`dock` |
| ![Fullscreen](screenshots/fullscreen.png)<br>`fullscreen` | ![Top dropdown](screenshots/topDropdown.png)<br>`top-dropdown` | ![Corner](screenshots/corner.png)<br>`corner` |
| ![Full edge](screenshots/fullEdge.png)<br>`full-edge` | ![Adaptive width](screenshots/adaptiveWidth.png)<br>`adaptive-width` | ![KRunner](screenshots/krunner.png)<br>`krunner` |
| ![Split tabs](screenshots/splitTabs.png)<br>`split-tabs` | ![Hero banner](screenshots/heroBanner.png)<br>`hero-banner` | ![Notch](screenshots/notch.png)<br>`notch` |

## Features

- **15 layouts** to choose from, including grid, list, dock, fullscreen, sidebar, KRunner-style, and notch.
- **Keyboard-first workflow:** open with `Ctrl+Alt+Space`, type to search, navigate with arrow keys, press `Enter` to launch, or `Escape` to close. In Hotkey layout, use `Ctrl+1`–`Ctrl+9` (number row or numeric keypad) to launch the corresponding visible result; plain digits remain searchable.
- **Application search** using GNOME's app-search provider with fuzzy matching as a fallback.
- **Run and window modes** in Sidebar, Split Tabs, and Hero Banner. In Run mode, press `Enter` to launch normally or `Ctrl+Enter` to launch in an available terminal emulator for interactive CLI/TUI programs. Configure a terminal command template in Preferences using one standalone `{command}` placeholder (for example, `ptyxis -- {command}`), or leave it empty for automatic detection. Window mode respects the **Search all workspaces** preference. Run commands are parsed into arguments and launched directly without a shell; shell operators, pipes, redirects, globbing, and variable expansion are not interpreted. Quote arguments containing spaces as needed. Invalid quoting produces an error instead of launching.
- **Finder prefixes** in Sidebar, Split Tabs, and Hero Banner: `> command` for Run, `/ name` for files, `w name` for windows, `; text` for clipboard history, `= expression` for arithmetic and offline unit conversions, `? query` for web search, `recent query` for recent documents, and `emoji query` to search emoji.
- **Matugen-compatible theming** using Material 3 color roles from a CSS file.
- **Per-layout appearance overrides** for icon size and background opacity. Each layout can override either value independently; unset values inherit the global Appearance settings.
- **Custom wallpapers** for layouts that display a banner or split panel.
- **Optional clipboard history** with an explicit opt-in setting; collection is off by default. Search and re-copy recent text in Sidebar, Split Tabs, and Hero Banner clipboard mode. Each text entry also has an explicit **QR** action that copies a generated PNG image to the clipboard using the optional `qrencode` utility; if it is missing, the launcher explains how to enable the feature.
- **Native GNOME Shell overlay** using `ModalDialog`.

## Installation

Clone or download this repository, then run these commands from the project directory:

```bash
glib-compile-schemas schemas/

mkdir -p ~/.local/share/gnome-shell/extensions
ln -s "$(pwd)" ~/.local/share/gnome-shell/extensions/gnome-launcher@sakib.dev
```

Log out and back in so GNOME Shell detects the extension. Then enable it:

```bash
gnome-extensions enable gnome-launcher@sakib.dev
```

The default shortcut is **Ctrl+Alt+Space**. Open the preferences window to choose a layout:

```bash
gnome-extensions prefs gnome-launcher@sakib.dev
```

You can also select a layout from the terminal:

```bash
gsettings --schemadir schemas set org.gnome.shell.extensions.gnome-launcher layout "grid"
```

Available layouts: `list`, `grid`, `hotkey`, `sidebar`, `split-preview`, `dock`, `fullscreen`, `top-dropdown`, `corner`, `full-edge`, `adaptive-width`, `krunner`, `split-tabs`, `hero-banner`, and `notch`.

## Finder prefixes

Type normally to search applications. Prefix the query to use a finder: `> command` runs a command, `/ file` searches files, `; text` searches clipboard history, `= expression` calculates, `? query` searches the web, `recent query` searches recent documents, `emoji query` searches emoji, `w query` switches windows, and `s query` or `settings query` searches GNOME Settings panels. Settings panel availability depends on the installed GNOME Control Center version.

Recent applications on the empty-query rest card come from GNOME Shell's usage data; the extension does not maintain a separate app-usage history.

## Clipboard history

Clipboard history is **off by default**. To enable it, open the extension preferences and turn on **General → Privacy → Clipboard history**. While enabled, the extension listens for clipboard-owner changes and keeps up to 20 recent text and image entries **in memory only**; it does not write them to disk. Image entries support common PNG, JPEG, WebP, GIF, and BMP clipboard formats, show a small thumbnail in Sidebar, Split Tabs, and Hero Banner, and are limited to 8 MiB each. A one-second polling fallback is used only if change-signal setup is unavailable. Clipboard contents can include passwords, authentication codes, private messages, or sensitive images, so enable this only if you want the feature. Use **Clear clipboard history** in Preferences to remove retained entries without disabling collection. Turning the feature off immediately clears retained text and image data. Disabling the extension also stops tracking and clears the history.

## Theming

In the extension preferences, open **Theming → Theme CSS file** and select a CSS file containing Material 3 color roles, for example:

```css
--surface: #1b1b1f;
--primary: #d0bcff;
```

Or set the path directly:

```bash
gsettings --schemadir schemas set org.gnome.shell.extensions.gnome-launcher theme-file-path "/path/to/colors.css"
```

The file is read whenever the launcher opens. Leave the path empty to use the built-in purple theme.

Global icon size and background opacity are configured under **Appearance**. To customize a single layout without affecting the others, use **Layout-specific appearance** on the same page, select a layout, and adjust either override. Use **Reset layout overrides** to return both values to the global defaults for that layout.

Layouts with a banner or split panel can also use a custom wallpaper. Set **Wallpaper path** in preferences, or configure the `wallpaper-path` GSettings key. When left empty, the extension first uses GNOME's configured desktop wallpaper, then checks legacy fallback paths.

## Uninstallation

Disable the extension and remove its symlink:

```bash
gnome-extensions disable gnome-launcher@sakib.dev
rm ~/.local/share/gnome-shell/extensions/gnome-launcher@sakib.dev
dconf reset -f /org/gnome/shell/extensions/gnome-launcher/
```

## Development

See [Development notes](docs/development.md) for the project structure and instructions for adding a layout.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
