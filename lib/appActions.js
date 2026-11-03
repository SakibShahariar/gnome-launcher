// SPDX-License-Identifier: GPL-2.0-or-later

/** Return the localized desktop actions exposed by an installed Shell.App. */
export function listDesktopActions(app) {
    const appInfo = app?.get_app_info?.();
    if (!appInfo || typeof appInfo.list_actions !== 'function')
        return [];

    try {
        return (appInfo.list_actions() ?? []).map(name => ({
            name,
            label: appInfo.get_action_name?.(name) || name,
        }));
    } catch {
        return [];
    }
}

/** Activate a desktop action through Shell.App to preserve Shell launch context. */
export function activateDesktopAction(app, action, timestamp = 0) {
    if (!app || !action || typeof app.launch_action !== 'function')
        return false;

    app.launch_action(action, timestamp, -1);
    return true;
}
