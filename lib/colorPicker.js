// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {formatPickedColor} from './colorPickerUtils.js';

const PORTAL_NAME = 'org.freedesktop.portal.Desktop';
const PORTAL_PATH = '/org/freedesktop/portal/desktop';
const SCREENSHOT_INTERFACE = 'org.freedesktop.portal.Screenshot';
const REQUEST_INTERFACE = 'org.freedesktop.portal.Request';

/**
 * Ask the desktop screenshot portal to pick a pixel.
 *
 * This is the compositor-owned path used by GNOME on Wayland; it avoids
 * direct screen reads, X11-only capture APIs, and external picker binaries.
 */
export function pickScreenColor({onPicked = () => {}, onCancelled = () => {}, onError = () => {}} = {}) {
    const connection = Gio.DBus.session;
    if (!connection) {
        onError(new Error('The session D-Bus connection is unavailable.'));
        return false;
    }

    const token = `gnome_launcher_${GLib.uuid_string_random().replace(/-/g, '_')}`;
    const options = {
        handle_token: new GLib.Variant('s', token),
    };

    try {
        connection.call(
            PORTAL_NAME,
            PORTAL_PATH,
            SCREENSHOT_INTERFACE,
            'PickColor',
            new GLib.Variant('(sa{sv})', ['', options]),
            new GLib.VariantType('(o)'),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (bus, result) => {
                let requestPath;
                try {
                    [requestPath] = bus.call_finish(result).deep_unpack();
                } catch (error) {
                    onError(error);
                    return;
                }

                let subscriptionId = 0;
                try {
                    subscriptionId = bus.signal_subscribe(
                        PORTAL_NAME,
                        REQUEST_INTERFACE,
                        'Response',
                        requestPath,
                        null,
                        Gio.DBusSignalFlags.NONE,
                        (_connection, _sender, _path, _interface, _signal, parameters) => {
                            if (subscriptionId)
                                bus.signal_unsubscribe(subscriptionId);

                            const response = parameters.get_child_value(0).get_uint32();
                            if (response === 1) {
                                onCancelled();
                                return;
                            }
                            if (response !== 0) {
                                onError(new Error('The desktop screenshot portal could not pick a color.'));
                                return;
                            }

                            try {
                                const results = parameters.get_child_value(1);
                                const color = results.lookup_value(
                                    'color',
                                    new GLib.VariantType('(ddd)')
                                );
                                const hex = color ? formatPickedColor(color.deep_unpack()) : null;
                                if (!hex)
                                    throw new Error('The screenshot portal returned an invalid color.');
                                onPicked(hex);
                            } catch (error) {
                                onError(error);
                            }
                        }
                    );
                } catch (error) {
                    onError(error);
                }
            }
        );
        return true;
    } catch (error) {
        onError(error);
        return false;
    }
}
