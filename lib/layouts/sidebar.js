// SPDX-License-Identifier: GPL-2.0-or-later

// Sidebar categories layout - archetype #4. Vertical icon rail for
// mode-switching between apps/files/clipboard/power - all four modes
// are wired to real functionality (previously only "apps" worked, the
// other three icons were visual stubs).

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import {windowStart} from './windowing.js';
import {searchFiles, openFile, POWER_ACTIONS, activatePowerAction} from '../modes.js';
import * as ClipboardHistory from '../clipboardHistory.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';

// No fixed card height and no St.ScrollView here - two earlier fix
// attempts (a fixed height + resetScrollToTop) tried to make a *fixed*
// height reliably fit MAX_RESULTS rows, and got the exact pixel math
// wrong twice in a row. Removing the fixed height instead: the card
// grows naturally to fit exactly however many rows render.
const MAX_RESULTS = 8;

const MODES = [
    ['apps', 'view-grid-symbolic', 'Search apps'],
    ['files', 'folder-symbolic', 'Search files'],
    ['clipboard', 'edit-paste-symbolic', 'Clipboard history'],
    ['power', 'system-shutdown-symbolic', 'Power actions'],
];

export class SidebarLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.mode = 'apps';
        this._modeResults = [];
        this._modeSelectedIndex = 0;
        this._fileSearchCancellable = null;
    }

    buildUI() {
        const outer = new St.BoxLayout({
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 20px; ` +
                   `border: 1px solid ${this.theme.outline_variant};`,
        });
        outer.set_width(520);

        const rail = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${withOpacity(this.theme.surface_container, this.theme.opacity)}; ` +
                   'border-radius: 20px 0 0 20px; padding: 12px 8px; spacing: 6px;',
        });

        this._railIcons = [];
        for (const [modeId, iconName] of MODES) {
            const active = modeId === this.mode;
            const iconBox = new St.Bin({
                reactive: true,
                style: active
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px;`
                    : 'border-radius: 12px; padding: 8px;',
            });
            const icon = new St.Icon({
                icon_name: iconName,
                icon_size: Math.round(18 * this.theme.scale),
                style: `color: ${active ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant};`,
            });
            iconBox.set_child(icon);
            iconBox.connect('button-press-event', () => {
                this._switchMode(modeId);
                return Clutter.EVENT_STOP;
            });
            this._railIcons.push({modeId, iconBox, icon});
            rail.add_child(iconBox);
        }
        outer.add_child(rail);

        const main = new St.BoxLayout({vertical: true, x_expand: true});

        const searchRow = new St.BoxLayout({style: 'padding: 14px 18px;'});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px;`,
            hint_text: 'Search apps',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => this._onTextChanged());
        searchRow.add_child(this.entry);
        main.add_child(searchRow);

        this.resultsBox = new St.BoxLayout({vertical: true, style: 'padding: 0 10px 10px;'});
        main.add_child(this.resultsBox);
        outer.add_child(main);

        return outer;
    }

    _switchMode(modeId) {
        if (this.mode === modeId)
            return;
        this.mode = modeId;
        this._modeResults = [];
        this._modeSelectedIndex = 0;

        for (const {modeId: id, iconBox, icon} of this._railIcons) {
            const active = id === modeId;
            iconBox.style = active
                ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px;`
                : 'border-radius: 12px; padding: 8px;';
            icon.style = `color: ${active ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant};`;
        }

        const modeInfo = MODES.find(m => m[0] === modeId);
        this.entry.set_hint_text(modeInfo ? modeInfo[2] : 'Search');
        this.entry.set_text('');

        if (modeId === 'apps') {
            this.dialog.onQueryChanged('');
        } else if (modeId === 'clipboard') {
            this._modeResults = ClipboardHistory.getHistory().map(text => ({name: text, kind: 'clipboard'}));
            this.renderResults();
        } else if (modeId === 'power') {
            this._modeResults = POWER_ACTIONS.map(a => ({name: a.name, id: a.id, kind: 'power'}));
            this.renderResults();
        } else {
            this.renderResults();
        }
    }

    async _onTextChanged() {
        const text = this.entry.get_text();

        if (this.mode === 'apps') {
            this.dialog.onQueryChanged(text);
            return;
        }

        if (this.mode === 'files') {
            if (this._fileSearchCancellable)
                this._fileSearchCancellable.cancel();
            const cancellable = new Gio.Cancellable();
            this._fileSearchCancellable = cancellable;

            const results = await searchFiles(text, cancellable);
            if (cancellable.is_cancelled())
                return;

            this._modeResults = results.map(f => ({name: f.name, path: f.path, kind: 'file'}));
            this._modeSelectedIndex = 0;
            this.renderResults();
        }
        // clipboard/power: fixed lists, typing doesn't filter them.
    }

    // -- keyboard overrides for non-apps modes, see launcherDialog.js --

    onMoveSelection(delta) {
        if (this.mode === 'apps') {
            this.dialog.moveSelection(delta);
            return;
        }
        if (this._modeResults.length === 0)
            return;
        const count = this._modeResults.length;
        this._modeSelectedIndex = (this._modeSelectedIndex + delta + count) % count;
        this.renderResults();
    }

    onEnter() {
        if (this.mode === 'apps') {
            this.dialog.launchSelected();
            return;
        }
        this._activateModeItem(this._modeSelectedIndex);
    }

    _activateModeItem(index) {
        const item = this._modeResults[index];
        if (!item)
            return;
        if (item.kind === 'file') {
            openFile(item.path);
            this.dialog.close();
        } else if (item.kind === 'clipboard') {
            ClipboardHistory.copyToClipboard(item.name);
            this.dialog.close();
        } else if (item.kind === 'power') {
            activatePowerAction(item.id);
            this.dialog.close();
        }
    }

    renderResults() {
        if (this.mode === 'apps')
            this._renderApps();
        else
            this._renderModeResults();
    }

    _renderApps() {
        this.resultsBox.destroy_all_children();
        const total = this.dialog._filtered.length;
        if (total === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme));
            return;
        }
        this._windowStart = windowStart(this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + MAX_RESULTS);
        apps.forEach((app, localIndex) => {
            const index = start + localIndex;
            const selected = index === this.dialog._selectedIndex;
            const row = new St.BoxLayout({
                reactive: true,
                x_expand: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 14px; padding: 8px 12px;`
                    : 'border-radius: 14px; padding: 8px 12px;',
            });
            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;
            const icon = new St.Icon({
                gicon: app.get_icon(),
                icon_size: Math.round(18 * this.theme.scale),
                style: `margin-right: 10px; color: ${iconColor};`,
            });
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${iconColor}; font-size: 13px; font-weight: bold;`,
            });
            row.add_child(icon);
            row.add_child(label);
            row.connect('button-press-event', () => {
                this.dialog.launchIndex(index);
                return Clutter.EVENT_STOP;
            });
            this.resultsBox.add_child(row);
        });
    }

    _renderModeResults() {
        this.resultsBox.destroy_all_children();

        if (this._modeResults.length === 0) {
            const msg = this.mode === 'files' ? 'Type to search files'
                : this.mode === 'clipboard' ? 'Clipboard is empty'
                : this.mode === 'power' ? 'No power actions'
                : 'No matches';
            this.resultsBox.add_child(makeEmptyLabel(this.theme, msg));
            return;
        }

        this._modeResults.slice(0, MAX_RESULTS).forEach((item, index) => {
            const selected = index === this._modeSelectedIndex;
            const row = new St.BoxLayout({
                reactive: true,
                x_expand: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 14px; padding: 8px 12px;`
                    : 'border-radius: 14px; padding: 8px 12px;',
            });

            let iconName = 'text-x-generic-symbolic';
            if (item.kind === 'clipboard')
                iconName = 'edit-paste-symbolic';
            else if (item.kind === 'power')
                iconName = POWER_ACTIONS.find(a => a.id === item.id)?.icon ?? 'system-run-symbolic';

            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;
            const icon = new St.Icon({
                icon_name: iconName,
                icon_size: Math.round(18 * this.theme.scale),
                style: `margin-right: 10px; color: ${iconColor};`,
            });
            const label = new St.Label({
                text: item.name,
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${iconColor}; font-size: 13px; font-weight: bold;`,
            });
            label.set_width(360);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3); // Pango.EllipsizeMode.END

            row.add_child(icon);
            row.add_child(label);
            row.connect('button-press-event', () => {
                this._activateModeItem(index);
                return Clutter.EVENT_STOP;
            });
            this.resultsBox.add_child(row);
        });
    }
}