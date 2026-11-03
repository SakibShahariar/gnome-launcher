// SPDX-License-Identifier: GPL-2.0-or-later

// Hosts whichever layout is selected inside a ModalDialog - this is
// Shell's own built-in overlay + keyboard-grab mechanism, and the reason
// this extension doesn't need wlr-layer-shell at all: it's not a
// separate Wayland client asking Mutter for special treatment, it's
// Shell's own compositor process extending itself.

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import St from 'gi://St';

import Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {listDesktopActions, activateDesktopAction} from './appActions.js';

import {ModalDialog} from 'resource:///org/gnome/shell/ui/modalDialog.js';

import {listApps, search} from './appSearch.js';
import {LAYOUTS, DEFAULT_LAYOUT} from './layouts/registry.js';
import {loadTheme} from './theme.js';
import {resolveLayoutAppearance} from './layoutAppearance.js';
import {gridSelectionIndex} from './layouts/windowing.js';
import {resolveDefaultMode} from './defaultMode.js';
import {parseFinderPrefix} from './finderPrefix.js';
import {searchFinderResults} from './finderSearchRuntime.js';
import {getFinderResultWindow} from './finderSearch.js';
import {searchFiles, runCommand, runCommandInTerminal, POWER_ACTIONS, activatePowerAction} from './modes.js';
import * as ClipboardHistory from './clipboardHistory.js';
import {searchModeResults} from './modeSearch.js';
import {createModeSearchDependencies} from './modeSearchRuntime.js';
import {activateModeResultForDialog} from './modeActivationRuntime.js';

export const LauncherDialog = GObject.registerClass(
class LauncherDialog extends ModalDialog {
    _init(settings) {
        super._init({styleClass: 'launcher-dialog', destroyOnClose: true});

        this._settings = settings;
        this._allApps = listApps();
        this._filtered = this._allApps;
        this._selectedIndex = 0;
        this._finderMode = null;
        this._finderResults = [];
        this._finderSelectedIndex = 0;
        this._pendingFinderPowerAction = null;

        // Closing the dialog must cancel an outstanding native/file search.
        // Otherwise its promise may resolve after the UI has been destroyed
        // and attempt to render results into actors that no longer exist.
        this.connect('closed', () => {
            this.cancelPendingSearches();
            this._destroyAppActionsMenu();
        });

        // Belt-and-suspenders on top of stylesheet.css: ModalDialog wraps
        // our content in its own dialogLayout/contentLayout actors, which
        // carry their own default background/border from the Shell theme.
        // stylesheet.css targets these by CSS class name, but that name
        // can vary across Shell versions/themes - setting style directly
        // here is guaranteed to work regardless of what class name Shell
        // actually assigned internally.
        this.dialogLayout.set_style(
            'background-color: transparent; border: none; box-shadow: none; padding: 0;'
        );
        this.contentLayout.set_style('background-color: transparent; padding: 0; margin: 0;');
        // We never call setButtons(), but ModalDialog still allocates this
        // region with its own default background - visible as a flat
        // square strip under our rounded card if left alone.
        this.buttonLayout.hide();

        // ModalDialog dims via Lightbox (_lightbox), not _modalBackground.
        // Apply the user preference whenever the setting changes.
        const dimSettings = this._settings;
        const updateDim = () => this._applyDimPreference();
        this._dimSettingsSignalId = dimSettings.connect('changed::dim-background', updateDim);
        this.connect('destroy', () => {
            if (this._dimSettingsSignalId) {
                dimSettings.disconnect(this._dimSettingsSignalId);
                this._dimSettingsSignalId = 0;
            }
        });

        const themePath = settings.get_string('theme-file-path') || '';
        const theme = loadTheme(themePath);
        // Attached here (not in theme.js itself) since these are user
        // preferences read from GSettings, not part of the Matugen color
        // pipeline theme.js otherwise handles - every layout already
        // receives this same theme object, so this.theme.scale is
        // immediately available everywhere without new plumbing.
        const globalAppearance = {
            scale: settings.get_double('icon-scale'),
            opacity: settings.get_double('background-opacity'),
        };
        const layoutName = settings.get_string('layout') || DEFAULT_LAYOUT;
        const layoutAppearance = resolveLayoutAppearance(
            settings.get_string('layout-appearance-overrides'),
            layoutName,
            globalAppearance
        );
        theme.scale = layoutAppearance.scale;
        theme.opacity = layoutAppearance.opacity;
        theme.appIconPlates = settings.get_boolean('app-icon-plates');
        theme.wallpaperPath = settings.get_string('wallpaper-path') || '';
        const LayoutClass = LAYOUTS[layoutName] ?? LAYOUTS[DEFAULT_LAYOUT];
        this._layout = new LayoutClass(this, theme);

        this._layoutRoot = this._layout.buildUI();
        this.contentLayout.add_child(this._layoutRoot);

        // Only the three mode-based layouts expose a shared mode switcher.
        // Other layouts continue to open in their normal application-search view.
        if (typeof this._layout._switchMode === 'function') {
            const defaultMode = resolveDefaultMode(settings.get_string('default-mode'));
            if (defaultMode !== 'apps')
                this._layout._switchMode(defaultMode);
        }

        // Every layout renders a bounded result window, including layouts
        // with a ScrollView. Native scrolling can only move within that slice,
        // so route wheel input to selection navigation to reveal later matches.
        // Attach to the ScrollView itself when present so its default handler
        // cannot consume the event before the result window advances.
        const scrollTarget = this._layout.scrollView ?? this._layout.resultsBox ?? this._layoutRoot;
        scrollTarget.set_reactive(true);
        scrollTarget.connect('scroll-event', (_actor, event) => {
            const direction = event.get_scroll_direction();
            if (direction !== Clutter.ScrollDirection.UP &&
                direction !== Clutter.ScrollDirection.DOWN)
                return Clutter.EVENT_PROPAGATE;

            const step = this._layout.columns || 1;
            const delta = (direction === Clutter.ScrollDirection.UP ? -1 : 1) * step;
            if (this._layout.onMoveSelection)
                this._layout.onMoveSelection(delta);
            else
                this.moveSelection(delta);

            return Clutter.EVENT_STOP;
        });

        // Resolve the positioned modal box before the first render: rendering
        // applies layout positioning and edge-anchored layouts need this target.
        this._modalBox = this.contentLayout.get_parent();
        this._rerender();

        // ModalDialog grabs the keyboard globally, but text input still
        // needs an explicit focus target - without this, typing into the
        // search entry did nothing at all.
        if (this._layout.entry) {
            this.setInitialKeyFocus(this._layout.entry);
            // IMPORTANT: connect on entry.clutter_text, NOT on the St.Entry
            // itself. grab_key_focus() on an St.Entry actually redirects
            // real key focus to its internal ClutterText child - key
            // events go straight to whichever actor holds focus and are
            // not guaranteed to bubble back up to the St.Entry wrapper.
            // Connecting on the wrapper (the earlier, broken version of
            // this fix) meant the handler never fired at all, for any key.
            // Connecting here also runs BEFORE ClutterText's own internal
            // handling of Return (activate) and Left/Right (cursor
            // movement), so returning Clutter.EVENT_STOP below correctly
            // pre-empts that instead of racing it.
            this._layout.entry.clutter_text.connect('key-press-event', (_actor, event) => this._onKeyPress(event));
        }

    }

    // ModalDialog centers itself by default. Edge-anchored layouts set
    // `this._layout.position` so we pin the inner ".modal-dialog" box to
    // the real edge via its alignment properties (see _applyPosition).
    // Because that is alignment, not a manual position, the BinLayout
    // honors it on every relayout and the dialog opens already at the
    // edge - no center-then-jump, no need to hide until positioned.
    open(timestamp) {
        super.open(timestamp);

        this._applyDimPreference();
        this._applyPosition();
    }

    // ModalDialog creates a Lightbox (_lightbox) that darkens the desktop.
    // Hide it when dim-background is false so only Blur My Shell (if any)
    // affects the backdrop.
    _applyDimPreference() {
        const dim = this._settings.get_boolean('dim-background');
        const lb = this._lightbox;
        if (!lb)
            return;
        lb.visible = dim;
        lb.opacity = dim ? 255 : 0;
    }

    _applyPosition() {
        const posType = this._layout.position;
        if (!posType)
            return; // default centered behavior, nothing to do

        // Never position by set_position(): the actor we have to pivot is
        // the inner ".modal-dialog" box, and its allocation box is owned
        // by dialogLayout's BinLayout, which re-centers it on every layout
        // pass. Fighting that with set_position (even deferred to
        // idle/timeout) lets a centered frame be painted between the
        // relayout and the re-apply - the visible "shift" while typing.
        //
        // Instead, set the box's ALIGNMENT + EXPAND. BinLayout branches on
        // child.needs_expand: when expand is set it uses the actor's own
        // x_align/y_align to place the child within the monitor-sized
        // allocation, so the edge pin is declarative and the BinLayout
        // upholds it on every single relayout (including the ones typing
        // triggers). The margin is applied by clutter_actor_allocate(),
        // which insets the box within the parent-given allocation.
        const margin = 32;
        const def = {
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
            margin_top: 0,
            margin_bottom: 0,
            margin_left: 0,
            margin_right: 0,
        };
        switch (posType) {
            case 'top':
                def.y_align = Clutter.ActorAlign.START;
                def.margin_top = margin;
                def.margin_bottom = -margin;
                break;
            case 'top-flush':
                def.y_align = Clutter.ActorAlign.START;
                break;
            case 'top-flush-fullwidth':
                // Root actor spans the full monitor width itself and
                // does its own internal centering (see krunner.js).
                def.x_align = Clutter.ActorAlign.FILL;
                def.y_align = Clutter.ActorAlign.START;
                break;
            case 'bottom':
                def.y_align = Clutter.ActorAlign.END;
                def.margin_bottom = margin;
                break;
            case 'bottom-fullwidth':
                // Root actor spans the full monitor width itself (see
                // dock.js) - just pin the strip to the bottom edge.
                def.x_align = Clutter.ActorAlign.FILL;
                def.y_align = Clutter.ActorAlign.END;
                def.margin_bottom = margin;
                break;
            case 'top-left':
                def.x_align = Clutter.ActorAlign.START;
                def.y_align = Clutter.ActorAlign.START;
                def.margin_top = margin;
                def.margin_left = margin;
                def.margin_bottom = -margin;
                def.margin_right = -margin;
                break;
            case 'left-edge':
                // Flush to the left edge, vertically centered by alignment.
                def.x_align = Clutter.ActorAlign.START;
                def.y_align = Clutter.ActorAlign.CENTER;
                break;
            case 'fullscreen':
                def.x_align = Clutter.ActorAlign.FILL;
                def.y_align = Clutter.ActorAlign.FILL;
                break;
        }

        this._modalBox.set({
            x_align: def.x_align,
            y_align: def.y_align,
            x_expand: def.x_expand,
            y_expand: def.y_expand,
        });
        this._modalBox.set_style(
            `margin-top: ${def.margin_top}px; margin-bottom: ${def.margin_bottom}px; ` +
            `margin-left: ${def.margin_left}px; margin-right: ${def.margin_right}px;`
        );
    }

    // Cancel work synchronously when the extension is disabled, without
    // waiting for ModalDialog's close animation to emit its "closed" signal.
    cancelPendingSearches() {
        this._searchCancellable?.cancel();
        this._searchCancellable = null;

        // Some layouts own separate debounced file searches.
        this._layout?._cancelFileSearch?.();
    }

    // -- called by layouts --------------------------------------------------

    // Cancels the previous in-flight search so a slow native search
    // result from an earlier keystroke can't land after a newer one and
    // overwrite it with stale results.
    async onQueryChanged(text) {
        const prefix = parseFinderPrefix(text);
        if (prefix) {
            await this._searchFinder(prefix.mode, prefix.query);
            return;
        }

        this._finderMode = null;
        this._finderResults = [];
        this._pendingFinderPowerAction = null;
        this._searchCancellable?.cancel();
        const cancellable = new Gio.Cancellable();
        this._searchCancellable = cancellable;

        const results = await search(this._allApps, text, cancellable);
        if (cancellable.is_cancelled())
            return;

        this._filtered = results;
        this._selectedIndex = 0;
        this._rerender();
    }

    async _searchFinder(mode, query) {
        this._searchCancellable?.cancel();
        const cancellable = new Gio.Cancellable();
        this._searchCancellable = cancellable;
        this._finderMode = mode;
        this._finderResults = [];
        this._finderSelectedIndex = 0;
        this._pendingFinderPowerAction = null;
        this._rerender();

        const dependencies = {
            ...createModeSearchDependencies(this),
            searchFiles,
            clipboardEntries: ClipboardHistory.getEntries(),
            clipboardEnabled: this._settings.get_boolean('clipboard-history-enabled'),
            powerActions: POWER_ACTIONS,
            searchModeResults,
        };
        const results = await searchFinderResults(mode, query, dependencies, cancellable);
        if (cancellable.is_cancelled() || this._finderMode !== mode)
            return;
        this._finderResults = results;
        this._finderSelectedIndex = 0;
        this._rerender();
    }

    _activateFinderResult(index, {inTerminal = false} = {}) {
        const item = this._finderResults[index];
        if (!item)
            return false;

        if (item.kind === 'run') {
            const launched = inTerminal
                ? runCommandInTerminal(item.command, this._settings)
                : runCommand(item.command);
            if (launched)
                this.close();
            return launched;
        }

        if (item.kind === 'power') {
            const confirmationRequired = ['restart', 'poweroff', 'logout'].includes(item.id);
            if (confirmationRequired && this._pendingFinderPowerAction !== item.id) {
                this._pendingFinderPowerAction = item.id;
                this._rerender();
                return false;
            }
            activatePowerAction(item.id);
            this.close();
            return true;
        }

        return activateModeResultForDialog(this, item);
    }

    _renderFinderResults() {
        const target = this._layout.resultsBox ?? this._layout.gridBox ?? this._layout.tilesRow;
        if (!target)
            return;
        target.destroy_all_children();
        this._layout.preview?.destroy_all_children();
        target.show?.();

        if (this._finderResults.length === 0) {
            target.add_child(new St.Label({
                text: this._finderMode === 'run' ? 'Type a command to run' : 'No matching results',
                x_align: Clutter.ActorAlign.CENTER,
                style: `color: ${this._layout.theme.muted}; padding: 14px;`,
            }));
            return;
        }

        const iconNames = {
            file: 'text-x-generic-symbolic',
            clipboard: 'edit-paste-symbolic',
            'clipboard-image': 'image-x-generic-symbolic',
            calculator: 'accessories-calculator-symbolic',
            web: 'web-browser-symbolic',
            recent: 'document-open-recent-symbolic',
            emoji: 'face-smile-symbolic',
            window: 'view-list-symbolic',
            settings: 'preferences-system-symbolic',
            run: 'utilities-terminal-symbolic',
        };
        const {start, end} = getFinderResultWindow(
            this._finderResults.length, this._finderSelectedIndex, 12
        );
        const compactTiles = target === this._layout.tilesRow;
        this._finderResults.slice(start, end).forEach((item, localIndex) => {
            const index = start + localIndex;
            const selected = index === this._finderSelectedIndex;
            const color = selected
                ? this._layout.theme.on_primary
                : this._layout.theme.on_surface_variant;
            const row = new St.BoxLayout({
                orientation: compactTiles ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL,
                reactive: true,
                x_expand: !compactTiles,
                accessible_name: item.name,
                style_class: selected ? 'launcher-mode-result-row launcher-result-selected' : 'launcher-mode-result-row',
                style: selected
                    ? `background-color: ${this._layout.theme.primary}; border-radius: 10px; padding: 8px 12px;`
                    : 'border-radius: 10px; padding: 8px 12px;',
            });
            if (compactTiles)
                row.set_width(76);
            const icon = new St.Icon({
                icon_name: item.kind === 'power' ? item.icon : (iconNames[item.kind] || 'system-search-symbolic'),
                icon_size: 18,
                x_align: compactTiles ? Clutter.ActorAlign.CENTER : Clutter.ActorAlign.START,
                style: `color: ${color}; margin-right: 10px;`,
            });
            const label = new St.Label({
                text: this._pendingFinderPowerAction === item.id && item.kind === 'power'
                    ? `Confirm ${item.name}? Press Enter again`
                    : item.name,
                x_align: compactTiles ? Clutter.ActorAlign.CENTER : Clutter.ActorAlign.START,
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${color};`,
            });
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);
            if (compactTiles)
                label.set_width(68);
            else
                label.x_expand = true;
            row.add_child(icon);
            row.add_child(label);
            row.connect('button-press-event', (_actor, event) => {
                if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                    return Clutter.EVENT_STOP;
                this._finderSelectedIndex = index;
                this._activateFinderResult(index);
                return Clutter.EVENT_STOP;
            });
            target.add_child(row);
        });
    }

    moveSelection(delta) {
        if (this._finderMode) {
            if (this._finderResults.length === 0)
                return;
            const count = this._finderResults.length;
            this._finderSelectedIndex = (this._finderSelectedIndex + delta + count) % count;
            this._rerender();
            return;
        }
        if (this._filtered.length === 0)
            return;
        const count = this._filtered.length;
        const columns = this._layout.columns || 1;
        if (columns > 1 && Math.abs(delta) === columns) {
            this._selectedIndex = gridSelectionIndex(
                this._selectedIndex, Math.sign(delta), count, columns);
        } else {
            this._selectedIndex = (this._selectedIndex + delta + count) % count;
        }
        this._rerender();
    }

    launchSelected() {
        this.launchIndex(this._selectedIndex);
    }

    _onEnter() {
        if (this._layout.onEnter)
            this._layout.onEnter();
        else
            this.launchSelected();
    }

    launchIndex(index) {
        const app = this._filtered[index];
        if (app) {
            app.open_new_window(-1);
            this.close();
        }
    }

    openSelectedAppActions() {
        const app = this._filtered[this._selectedIndex];
        if (!app)
            return false;

        const actions = listDesktopActions(app);
        if (actions.length === 0) {
            this.launchSelected();
            return true;
        }

        const sourceActor = this._layout.entry;
        if (!sourceActor)
            return false;

        this._destroyAppActionsMenu();

        const menu = new PopupMenu.PopupMenu(sourceActor, 0.5, St.Side.TOP);
        this._appActionsMenu = menu;
        Main.uiGroup.add_child(menu.actor);
        menu.actor.hide();

        // The manager gives the popup normal Shell dismissal and keyboard
        // navigation behavior while keeping it anchored to the search entry.
        this._appActionsMenuManager = new PopupMenu.PopupMenuManager({
            actor: sourceActor,
        });
        this._appActionsMenuManager.addMenu(menu);

        for (const action of actions) {
            const item = new PopupMenu.PopupMenuItem(action.label);
            item.connect('activate', () => {
                this._destroyAppActionsMenu();
                try {
                    activateDesktopAction(app, action.name, global.get_current_time());
                } catch (e) {
                    log(`gnome-launcher: failed to launch desktop action ${action.name} for ${app.get_name()}: ${e}`);
                }
                this.close();
            });
            menu.addMenuItem(item);
        }

        menu.connect('open-state-changed', (_menu, isOpen) => {
            if (!isOpen && this._appActionsMenu === menu)
                this._destroyAppActionsMenu();
        });
        menu.open();
        return true;
    }

    _destroyAppActionsMenu() {
        const menu = this._appActionsMenu;
        this._appActionsMenu = null;
        this._appActionsMenuManager = null;
        if (menu)
            menu.destroy();
    }

    // Results changing can change the dialog's natural size (e.g. fewer
    // rows, or AdaptiveWidthLayout's width-follows-count design), but no
    // hook is needed to re-anchor: our position is expressed as
    // alignment + expand + margins on the .modal-dialog box (see
    // _applyPosition), and the dialog's BinLayout re-honors those on
    // EVERY relayout. So the edge pin is declarative and never drops -
    // there is no window in which the shell can paint a centered frame.
    //
    // We still call _applyPosition() here synchronously as a cheap,
    // idempotent assurance that the inline margins (set via set_style,
    // not CSS) survived any style reset. It is not what anchors us.
    //
    // For reference, this used to re-apply via GLib.idle_add + a 16ms
    // timeout. That is inherently lossy: between the shell relayout and
    // the idle callback the dialog is centered on screen, and if the
    // frame is painted in that window the whole dock visibly jumps.
    _rerender() {
        if (this._finderMode)
            this._renderFinderResults();
        else
            this._layout.renderResults();
        this._applyPosition();
    }

    // -- keyboard -------------------------------------------------------------

    // Connected directly to the search entry's key-press-event (see
    // _init() above) - scoped to this dialog only, unlike an earlier
    // broken attempt that used global.stage's captured-event.
    _onKeyPress(event) {
        const symbol = event.get_key_symbol();
        const RET = Clutter.KEY_Return;
        const KP = Clutter.KEY_KP_Enter;
        // Layouts with a `columns` property (e.g. GridLayout) need Down/Up
        // to jump a full row (skip `columns` items) rather than move to
        // the next item in list order - otherwise Down visually moves
        // right instead of down. List-style layouts leave `columns`
        // undefined, so this falls back to the old move-by-1 behavior.
        const columns = this._layout.columns || 1;

        if (symbol === Clutter.KEY_Escape) {
            this.close();
            return Clutter.EVENT_STOP;
        }
        if (this._finderMode && (symbol === RET || symbol === KP)) {
            const inTerminal = this._finderMode === 'run' &&
                Boolean(event.get_state() & Clutter.ModifierType.CONTROL_MASK);
            this._activateFinderResult(this._finderSelectedIndex, {inTerminal});
            return Clutter.EVENT_STOP;
        }
        if (this._finderMode && (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_Right)) {
            this.moveSelection(1);
            return Clutter.EVENT_STOP;
        }
        if (this._finderMode && (symbol === Clutter.KEY_Up || symbol === Clutter.KEY_Left)) {
            this.moveSelection(-1);
            return Clutter.EVENT_STOP;
        }
        // Alt+Enter opens the selected app's desktop actions. Keep this
        // separate from Ctrl+Enter, which is reserved for Run-mode terminal
        // execution in the mode-based layouts.
        if ((symbol === RET || symbol === KP) &&
            (event.get_state() & Clutter.ModifierType.MOD1_MASK) &&
            !(event.get_state() & Clutter.ModifierType.CONTROL_MASK) &&
            (!this._layout.mode || this._layout.mode === 'apps') &&
            this._layout.entry?.get_text().trim()) {
            if (this.openSelectedAppActions())
                return Clutter.EVENT_STOP;
        }

        if (symbol === RET || symbol === KP) {
            // Ctrl+Enter is an explicit opt-in to launch Run-mode commands
            // in a terminal, leaving ordinary Enter's behavior unchanged.
            if ((event.get_state() & Clutter.ModifierType.CONTROL_MASK) &&
                this._layout.onRunInTerminal &&
                this._layout.onRunInTerminal())
                return Clutter.EVENT_STOP;

            // Layouts with non-apps modes (files/clipboard/power in
            // sidebar.js, run/files in splitTabs.js/heroBanner.js) aren't
            // operating on dialog._filtered - onEnter() lets them handle
            // activation themselves when not in 'apps' mode. Layouts
            // that don't implement it (the other 11) get the unchanged
            // default behavior.
            if (this._layout.onEnter)
                this._layout.onEnter();
            else
                this.launchSelected();
            return Clutter.EVENT_STOP;
        }
        if (symbol === Clutter.KEY_Down) {
            if (this._layout.onMoveSelection)
                this._layout.onMoveSelection(columns);
            else
                this.moveSelection(columns);
            return Clutter.EVENT_STOP;
        }
        if (symbol === Clutter.KEY_Up) {
            if (this._layout.onMoveSelection)
                this._layout.onMoveSelection(-columns);
            else
                this.moveSelection(-columns);
            return Clutter.EVENT_STOP;
        }
        // Let Left/Right edit the query while the text cursor is inside
        // it (or a selection is active). At either boundary, keep the
        // existing result-navigation behavior.
        const textActor = this._layout.entry?.clutter_text;
        if (textActor && (symbol === Clutter.KEY_Left || symbol === Clutter.KEY_Right)) {
            const cursor = textActor.get_cursor_position();
            const selection = textActor.get_selection_bound();
            const textLength = textActor.text.length;
            const editingQuery = cursor !== selection ||
                (symbol === Clutter.KEY_Left && cursor > 0) ||
                (symbol === Clutter.KEY_Right && cursor < textLength);
            if (editingQuery)
                return Clutter.EVENT_PROPAGATE;
        }

        if (symbol === Clutter.KEY_Right) {
            if (this._layout.onMoveSelection)
                this._layout.onMoveSelection(1);
            else
                this.moveSelection(1);
            return Clutter.EVENT_STOP;
        }
        if (symbol === Clutter.KEY_Left) {
            if (this._layout.onMoveSelection)
                this._layout.onMoveSelection(-1);
            else
                this.moveSelection(-1);
            return Clutter.EVENT_STOP;
        }

        // Layouts with mode tabs/icons use Ctrl+1…4 to switch modes.
        // This is opt-in so HotkeyLayout can keep its existing Ctrl+digit launch behavior.
        if (this._layout.onSwitchModeByIndex &&
            (event.get_state() & Clutter.ModifierType.CONTROL_MASK)) {
            const modeIndex = DIGIT_KEYVALS.get(symbol);
            if (modeIndex !== undefined &&
                this._layout.onSwitchModeByIndex(modeIndex))
                return Clutter.EVENT_STOP;
        }

        // HotkeyLayout uses Ctrl+1…9 for direct launch so ordinary
        // digits remain available for searching app names and numbers.
        if (this._layout.onDigitKey &&
            (event.get_state() & Clutter.ModifierType.CONTROL_MASK)) {
            const digitMatch = DIGIT_KEYVALS.get(symbol);
            if (digitMatch !== undefined) {
                this._layout.onDigitKey(digitMatch);
                return Clutter.EVENT_STOP;
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }
});

const DIGIT_KEYVALS = new Map([
    [Clutter.KEY_1, 0], [Clutter.KEY_2, 1], [Clutter.KEY_3, 2],
    [Clutter.KEY_4, 3], [Clutter.KEY_5, 4], [Clutter.KEY_6, 5],
    [Clutter.KEY_7, 6], [Clutter.KEY_8, 7], [Clutter.KEY_9, 8],
    [Clutter.KEY_KP_1, 0], [Clutter.KEY_KP_2, 1], [Clutter.KEY_KP_3, 2],
    [Clutter.KEY_KP_4, 3], [Clutter.KEY_KP_5, 4], [Clutter.KEY_KP_6, 5],
    [Clutter.KEY_KP_7, 6], [Clutter.KEY_KP_8, 7], [Clutter.KEY_KP_9, 8],
]);
