// SPDX-License-Identifier: GPL-2.0-or-later

// Hosts whichever layout is selected inside a ModalDialog - this is
// Shell's own built-in overlay + keyboard-grab mechanism, and the reason
// this extension doesn't need wlr-layer-shell at all: it's not a
// separate Wayland client asking Mutter for special treatment, it's
// Shell's own compositor process extending itself.

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ModalDialog} from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {listApps, search} from './appSearch.js';
import {LAYOUTS, DEFAULT_LAYOUT} from './layouts/registry.js';
import {loadTheme} from './theme.js';

export const LauncherDialog = GObject.registerClass(
class LauncherDialog extends ModalDialog {
    _init(settings) {
        super._init({styleClass: 'launcher-dialog', destroyOnClose: true});

        this._settings = settings;
        this._allApps = listApps();
        this._filtered = this._allApps;
        this._selectedIndex = 0;

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
        const updateDim = () => this._applyDimPreference();
        this._settings.connect('changed::dim-background', updateDim);

        const themePath = settings.get_string('theme-file-path') || '';
        const theme = loadTheme(themePath);
        // Attached here (not in theme.js itself) since these are user
        // preferences read from GSettings, not part of the Matugen color
        // pipeline theme.js otherwise handles - every layout already
        // receives this same theme object, so this.theme.scale is
        // immediately available everywhere without new plumbing.
        theme.scale = settings.get_double('icon-scale');
        theme.opacity = settings.get_double('background-opacity');
        theme.wallpaperPath = settings.get_string('wallpaper-path') || '';
        const layoutName = settings.get_string('layout') || DEFAULT_LAYOUT;
        const LayoutClass = LAYOUTS[layoutName] ?? LAYOUTS[DEFAULT_LAYOUT];
        this._layout = new LayoutClass(this, theme);

        this.contentLayout.add_child(this._layout.buildUI());
        this._rerender();

        // ModalDialog grabs the keyboard globally, but text input still
        // needs an explicit focus target - without this, typing into the
        // search entry did nothing at all.
        if (this._layout.entry) {
            this.setInitialKeyFocus(this._layout.entry);
            // Connecting directly to the entry's own key-press-event is
            // what actually needs to happen here - NOT global.stage's
            // captured-event (an earlier, broken attempt at this fix used
            // that, which intercepts every event on the entire desktop,
            // not just this dialog, and could leave input broken
            // system-wide if the cleanup ever failed to run). A handler
            // connected via plain .connect() on a GObject signal like
            // this one runs BEFORE the widget's own internal handling -
            // which is what normally consumes Return/Left/Right for
          // activate/cursor-movement - so returning Clutter.EVENT_STOP
            // here safely intercepts those keys for this entry only, with
            // zero effect on anything outside this dialog.
            this._layout.entry.clutter_text.connect(
                'key-press-event', (_actor, event) => this._onKeyPress(event)
            );
        }
    }

    // ModalDialog centers itself by default. Edge-anchored layouts set
    // `this._layout.position` so we move dialogLayout to the real edge
    // after open. ModalDialog also recenters on its own after layout, so
    // a single set_position is not enough — we hide until positioned,
    // then re-apply on idle/timeout so the user never sees the center→edge
    // jump.
    open(timestamp) {
        const edge = !!this._layout?.position;
        if (edge)
            this.dialogLayout.opacity = 0;

        super.open(timestamp);

        this._applyDimPreference();
        this._applyPosition();
        if (edge) {
            this._revealAfterPosition();
        } else {
            // Lightbox may re-show during open animation — re-assert preference
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._applyDimPreference();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    // Re-apply edge position after Shell finishes its own layout/recenter
    // passes, then fade the dialog in so the centered frame is never seen.
    // ModalDialog creates a Lightbox (_lightbox) that darkens the desktop.
    // Hide it when dim-background is false so only Blur My Shell (if any)
    // affects the backdrop.
    _applyDimPreference() {
        const dim = this._settings.get_boolean('dim-background');
        const lb = this._lightbox;
        if (!lb)
            return;
        if (dim) {
            lb.opacity = 255;
            lb.show();
            lb.visible = true;
        } else {
            lb.opacity = 0;
            lb.hide();
            lb.visible = false;
        }
    }

    _revealAfterPosition() {
        const reveal = () => {
            this._applyPosition();
            this._applyDimPreference();
            this.dialogLayout.opacity = 255;
            return GLib.SOURCE_REMOVE;
        };
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._applyPosition();
            this._applyDimPreference();
            // Second pass next frame — ModalDialog often recenters once more
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, reveal);
            return GLib.SOURCE_REMOVE;
        });
    }

    _applyPosition() {
        const posType = this._layout.position;
        if (!posType)
            return; // default centered behavior, nothing to do

        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;

        // Prefer layout.fixedWidth for horizontal centering when set —
        // avoids full-monitor transparent roots (Blur My Shell issue) and
        // is more stable than dialogLayout's preferred width on first pass.
        const [, naturalWidth] = this.dialogLayout.get_preferred_width(-1);
        const [, naturalHeight] = this.dialogLayout.get_preferred_height(-1);
        const margin = 32;
        const widthForCenter = this._layout.fixedWidth || naturalWidth;

        let x = monitor.x + Math.floor((monitor.width - widthForCenter) / 2);
        let y = monitor.y + Math.floor((monitor.height - naturalHeight) / 2);

        switch (posType) {
            case 'top':
                y = monitor.y + margin;
                break;
            case 'top-flush':
                y = monitor.y;
                break;
            case 'top-flush-fullwidth':
                // Root actor spans the full monitor width itself and
                // does its own internal centering (see krunner.js) - x is
                // just the monitor's left edge.
                x = monitor.x;
                y = monitor.y;
                break;
            case 'bottom':
                y = monitor.y + monitor.height - naturalHeight - margin;
                break;
            case 'bottom-fullwidth':
                // Root actor spans the full monitor width itself and
                // does its own internal centering (see dock.js) - x is
                // just the monitor's left edge, no centering-within-an-
                // ambiguous-parent-width calculation needed at all.
                x = monitor.x;
                y = monitor.y + monitor.height - naturalHeight - margin;
                break;
            case 'top-left':
                x = monitor.x + margin;
                y = monitor.y + margin;
                break;
            case 'left-edge':
                // Flush to the left edge; vertically center the strip if it
                // is shorter than the monitor, otherwise pin near the top.
                x = monitor.x;
                y = monitor.y + Math.max(0, Math.floor((monitor.height - naturalHeight) / 2));
                break;
            case 'fullscreen':
                x = monitor.x;
                y = monitor.y;
                break;
        }

        this.dialogLayout.set_position(x, y);
    }

    // -- called by layouts --------------------------------------------------

    // Cancels the previous in-flight search so a slow native search
    // result from an earlier keystroke can't land after a newer one and
    // overwrite it with stale results.
    async onQueryChanged(text) {
        if (this._searchCancellable)
            this._searchCancellable.cancel();
        const cancellable = new Gio.Cancellable();
        this._searchCancellable = cancellable;

        const results = await search(this._allApps, text, cancellable);
        if (cancellable.is_cancelled())
            return; // a newer keystroke superseded this search

        this._filtered = results;
        this._selectedIndex = 0;
        this._rerender();
    }

    moveSelection(delta) {
        if (this._filtered.length === 0)
            return;
        const count = this._filtered.length;
        this._selectedIndex = (this._selectedIndex + delta + count) % count;
        this._rerender();
    }

    launchSelected() {
        this.launchIndex(this._selectedIndex);
    }

    launchIndex(index) {
        const app = this._filtered[index];
        if (app) {
            app.open_new_window(-1);
            this.close();
        }
    }

    // Results changing can change the dialog's natural size (e.g. fewer
    // rows, or AdaptiveWidthLayout's width-follows-count design), so
    // position is recalculated after every render for layouts that care.
    //
    // The actual _applyPosition() call is deferred via GLib.idle_add
    // rather than called synchronously here. Reasoning: three consecutive
    // fixes targeting _applyPosition()'s own X calculation (caching,
    // then a hardcoded fixedWidth) failed to stop a reported horizontal
    // jump - and with fixedWidth in place, our X value is mathematically
    // constant between calls, proving the bug isn't in this method's own
    // math at all. The likely remaining explanation: ModalDialog (the
    // base class) has its own built-in recentering behavior that runs
    // when content size changes, independently of and possibly after our
    // override - silently overwriting whatever we set. Deferring to idle
    // makes our call run after whatever synchronous Shell-internal
    // relayout happens during the same render, so ours is applied last
    // rather than getting overwritten.
    _rerender() {
        this._layout.renderResults();
        // ModalDialog may recenter when content size changes — re-apply
        // edge position after that happens (idle + one frame later).
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._applyPosition();
            if (this._layout?.position) {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
                    this._applyPosition();
                    return GLib.SOURCE_REMOVE;
                });
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    // -- keyboard -------------------------------------------------------------

    // Connected directly to the search entry's key-press-event (see
    // _init() above) - scoped to this dialog only, unlike an earlier
    // broken attempt that used global.stage's captured-event.
    _onKeyPress(event) {
        const symbol = event.get_key_symbol();
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
        if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
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

        // HotkeyLayout implements onDigitKey(n) to launch row n directly.
        // Trade-off: since this intercepts digits globally for that
        // layout, you can't type a digit into its search field - fine
        // for launching by number, documented in the README.
        if (this._layout.onDigitKey) {
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
