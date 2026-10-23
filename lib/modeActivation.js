// SPDX-License-Identifier: GPL-2.0-or-later

/** Activate one shared mode result; layout-specific power flows stay separate. */
export function activateModeResult(item, actions) {
    if (!item)
        return false;

    switch (item.kind) {
    case 'file':
        actions.openFile(item.path);
        actions.close();
        return true;
    case 'clipboard':
    case 'clipboard-image':
        actions.restoreClipboard(item);
        actions.close();
        return true;
    case 'calculator':
        if (!item.copyable || item.value === null)
            return false;
        actions.copyText(item.value);
        actions.close();
        return true;
    case 'web':
        if (!actions.openWebSearch(item.query))
            return false;
        actions.close();
        return true;
    case 'recent':
        if (!actions.openRecentFile(item.uri))
            return false;
        actions.close();
        return true;
    case 'emoji':
        actions.copyText(item.emoji);
        actions.close();
        return true;
    case 'window':
        actions.activateWindow(item.window);
        actions.close();
        return true;
    case 'settings':
        if (!actions.openSettingsPanel(item.id))
            return false;
        actions.close();
        return true;
    default:
        return false;
    }
}
