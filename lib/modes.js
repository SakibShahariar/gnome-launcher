// SPDX-License-Identifier: GPL-2.0-or-later

// Backing logic for the sidebar/split-tabs/hero-banner mode icons.
// Files, Power, Run, and Windows modes are implemented here; Clipboard
// mode lives in clipboardHistory.js since it needs persistent state
// across dialog open/close cycles.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {parseFindOutput} from './fileSearchResults.js';
import {buildSearchUrl} from './webSearch.js';
import {filterRecentFiles} from './recentFiles.js';

const MAX_FILE_RESULTS = 20;
const FIND_MAX_DEPTH = 6;

/**
 * Searches the home directory for files/folders matching query.
 * Uses `find` via Gio.Subprocess with an argument array (not a shell
 * string) so the query is never shell-interpreted - safe against
 * injection regardless of what characters the user types.
 */
export async function searchFiles(query, cancellable) {
    const trimmed = query.trim();
    if (!trimmed)
        return [];

    let proc;
    let cancelId = 0;
    try {
        const escaped = trimmed
            .replace(/\\/g, '\\\\')
            .replace(/\*/g, '\\*')
            .replace(/\?/g, '\\?')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]');
        proc = Gio.Subprocess.new(
            [
                'find', GLib.get_home_dir(),
                '-mindepth', '1',
                '-maxdepth', String(FIND_MAX_DEPTH),
                '-path', '*/.*', '-prune', '-o',
                '-iname', `*${escaped}*`, '-print0',
            ],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
        );
        if (cancellable) {
            cancelId = cancellable.connect(() => {
                try {
                    proc.force_exit();
                } catch {
                    // The subprocess may already have exited.
                }
            });
        }

        const [stdout] = await proc.communicate_utf8_async(null, cancellable);
        const paths = parseFindOutput(stdout, MAX_FILE_RESULTS);
        const results = await Promise.all(paths.map(path => new Promise(resolve => {
            const file = Gio.File.new_for_path(path);
            file.query_info_async(
                'standard::icon',
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT,
                cancellable,
                (source, result) => {
                    try {
                        resolve({
                            name: path.split('/').pop() || path,
                            path,
                            icon: source.query_info_finish(result).get_icon(),
                        });
                    } catch {
                        resolve({name: path.split('/').pop() || path, path, icon: null});
                    }
                }
            );
        })));
        return cancellable?.is_cancelled() ? [] : results;
    } catch (e) {
        if (!cancellable?.is_cancelled())
            log(`gnome-launcher: file search failed: ${e}`);
        return [];
    } finally {
        if (cancelId && cancellable) {
            try {
                cancellable.disconnect(cancelId);
            } catch {
                // The cancellable may already be disposing.
            }
        }
    }
}

/** Opens a file/folder with its default application. */
export function openFile(path) {
    try {
        const file = Gio.File.new_for_path(path);
        Gio.AppInfo.launch_default_for_uri(file.get_uri(), null);
    } catch (e) {
        log(`gnome-launcher: failed to open file ${path}: ${e}`);
    }
}

/** Opens a web search using a validated HTTP(S) URL template. */
export function openWebSearch(query, template) {
    const url = buildSearchUrl(query, template);
    if (!url)
        return false;
    try {
        Gio.AppInfo.launch_default_for_uri(url, null);
        return true;
    } catch (e) {
        log(`gnome-launcher: failed to open web search: ${e}`);
        return false;
    }
}

/** Reads the desktop's recent-items list on demand; nothing is stored by this extension. */
export function searchRecentFiles(query = '') {
    try {
        const manager = Gio.RecentManager.get_default();
        const items = manager.get_items().map(info => ({
            name: info.get_display_name() || info.get_uri(),
            uri: info.get_uri(),
            modified: info.get_modified(),
        }));
        return filterRecentFiles(items, query);
    } catch (e) {
        log(`gnome-launcher: failed to read recent files: ${e}`);
        return [];
    }
}

/** Opens a recent URI with its registered default handler. */
export function openRecentFile(uri) {
    if (typeof uri !== 'string' || !/^(?:https?|file):\/\//i.test(uri))
        return false;
    try {
        Gio.AppInfo.launch_default_for_uri(uri, null);
        return true;
    } catch (e) {
        log(`gnome-launcher: failed to open recent item: ${e}`);
        return false;
    }
}

// -- Power ------------------------------------------------------------

// Uses standard systemd/GNOME command-line tools rather than guessing at
// Shell's internal Main.systemActions method names - after several
// unrelated Shell-internal-API guesses turned out wrong this session,
// these are commands with a well-established, stable interface instead.
export const POWER_ACTIONS = [
    {id: 'lock', name: 'Lock Screen', icon: 'system-lock-screen-symbolic'},
    {id: 'suspend', name: 'Suspend', icon: 'weather-clear-night-symbolic'},
    {id: 'restart', name: 'Restart', icon: 'system-reboot-symbolic'},
    {id: 'poweroff', name: 'Power Off', icon: 'system-shutdown-symbolic'},
    {id: 'logout', name: 'Log Out', icon: 'system-log-out-symbolic'},
];

const POWER_COMMANDS = {
    lock: 'loginctl lock-session',
    suspend: 'systemctl suspend',
    restart: 'systemctl reboot',
    poweroff: 'systemctl poweroff',
    logout: 'gnome-session-quit --logout --no-prompt',
};

export function activatePowerAction(id) {
    const command = POWER_COMMANDS[id];
    if (!command)
        return;
    try {
        GLib.spawn_command_line_async(command);
    } catch (e) {
        log(`gnome-launcher: power action "${id}" failed: ${e}`);
    }
}

// -- Run ----------------------------------------------------------------

/**
 * Launches a command without invoking a shell. Ctrl+Enter can request a
 * terminal for interactive CLI/TUI programs; ordinary Enter keeps the
 * existing background launch behavior for GUI applications and commands.
 */
export function runCommand(commandLine, inTerminal = false) {
    if (typeof commandLine !== 'string')
        return false;

    const trimmed = commandLine.trim();
    if (!trimmed)
        return false;

    try {
        if (!inTerminal) {
            GLib.spawn_command_line_async(trimmed);
            return true;
        }

        const [success, commandArgv] = GLib.shell_parse_argv(trimmed);
        if (!success || commandArgv.length === 0)
            return false;

        // Prefer terminals common on GNOME desktops, but support popular
        // alternatives too. Use argv arrays throughout so user input is
        // never concatenated into a shell command.
        const terminals = [
            {program: 'ptyxis', prefix: ['--']},
            {program: 'kgx', prefix: ['--']},
            {program: 'gnome-terminal', prefix: ['--']},
            {program: 'konsole', prefix: ['-e']},
            {program: 'kitty', prefix: ['--']},
            {program: 'alacritty', prefix: ['-e']},
            {program: 'xterm', prefix: ['-e']},
        ];
        for (const terminal of terminals) {
            const executable = GLib.find_program_in_path(terminal.program);
            if (!executable)
                continue;
            Gio.Subprocess.new(
                [executable, ...terminal.prefix, ...commandArgv],
                Gio.SubprocessFlags.NONE
            );
            return true;
        }

        log('gnome-launcher: no supported terminal emulator was found');
        return false;
    } catch (e) {
        log(`gnome-launcher: failed to run "${trimmed}": ${e}`);
        return false;
    }
}

// -- Windows ------------------------------------------------------------

/**
 * Returns normal, visible windows on the current workspace (and sticky
 * ones), focused first. Each entry is {name, window, app}.
 */
export function listOpenWindows(allWorkspaces = false) {
    const tracker = Shell.WindowTracker.get_default();
    const workspace = global.workspace_manager.get_active_workspace();
    const actors = global.get_window_actors();
    const results = [];

    for (const actor of actors) {
        const win = actor.meta_window;
        if (!win)
            continue;
        if (win.get_window_type() !== Meta.WindowType.NORMAL)
            continue;
        if (win.is_skip_taskbar() || win.is_override_redirect())
            continue;
        // Include windows on the active workspace or sticky windows
        if (!allWorkspaces && !win.located_on_workspace(workspace) && !win.is_on_all_workspaces())
            continue;

        const app = tracker.get_window_app(win);
        const name = win.get_title() || (app ? app.get_name() : 'Window');
        results.push({name, window: win, app});
    }

    // Prefer the focused window first, then stable order
    results.sort((a, b) => {
        const aFocus = a.window.has_focus() ? 0 : 1;
        const bFocus = b.window.has_focus() ? 0 : 1;
        return aFocus - bFocus;
    });
    return results;
}

/** Activate (raise + focus) a Meta.Window. */
export function activateWindow(win) {
    if (!win)
        return;
    try {
        const time = global.get_current_time();
        if (win.minimized)
            win.unminimize();
        win.activate(time);
    } catch (e) {
        log(`gnome-launcher: failed to activate window: ${e}`);
    }
}
