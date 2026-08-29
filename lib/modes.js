// SPDX-License-Identifier: GPL-2.0-or-later

// Backing logic for the sidebar/split-tabs/hero-banner mode icons.
// Files, Power, Run, and Windows modes are implemented here; Clipboard
// mode lives in clipboardHistory.js since it needs persistent state
// across dialog open/close cycles.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

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

    try {
        const proc = Gio.Subprocess.new(
            [
                'find', GLib.get_home_dir(),
                '-iname', `*${trimmed}*`,
                '-not', '-path', '*/.*',
                '-maxdepth', String(FIND_MAX_DEPTH),
            ],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
        );
        const [stdout] = await proc.communicate_utf8_async(null, cancellable);
        return stdout
            .split('\n')
            .filter(line => line.trim().length > 0)
            .slice(0, MAX_FILE_RESULTS)
            .map(path => ({name: path.split('/').pop() || path, path}));
    } catch (e) {
        log(`gnome-launcher: file search failed: ${e}`);
        return [];
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
 * Runs an arbitrary shell command line, same trust model as a terminal -
 * the user is directly supplying the command they want run, so shell
 * interpretation here is intentional (unlike searchFiles above, where
 * the query is untrusted-relative-to-shell-syntax input embedded in a
 * larger command).
 */
export function runCommand(commandLine) {
    const trimmed = commandLine.trim();
    if (!trimmed)
        return;
    try {
        GLib.spawn_command_line_async(trimmed);
    } catch (e) {
        log(`gnome-launcher: failed to run "${trimmed}": ${e}`);
    }
}

// -- Windows ------------------------------------------------------------

/**
 * Returns normal, visible windows on the current workspace (and sticky
 * ones), focused first. Each entry is {name, window, app}.
 */
export function listOpenWindows() {
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
        if (!win.located_on_workspace(workspace) && !win.is_on_all_workspaces())
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
