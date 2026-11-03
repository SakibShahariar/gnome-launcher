// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {formatPickedColor} from './colorPickerUtils.js';

const PORTAL_NAME = 'org.freedesktop.portal.Desktop';
const PORTAL_PATH = '/org/freedesktop/portal/desktop';
const SCREENSHOT_INTERFACE = 'org.freedesktop.portal.Screenshot';
const REQUEST_INTERFACE = 'org.freedesktop.portal.Request';

function subscribeToResponse(connection, requestPath, onResponse) {
    return connection.signal_subscribe(
        PORTAL_NAME,
        REQUEST_INTERFACE,
        'Response',
        requestPath,
        null,
        Gio.DBusSignalFlags.NONE,
        (_connection, _sender, _path, _interface, _signal, parameters) => onResponse(parameters)
    );
}

/**
 * Ask the desktop screenshot portal to pick a pixel.
 *
 * Subscribe before sending the request to avoid losing a fast Response
 * signal. The predicted handle follows the XDG portal 0.9+ convention;
 * older portals are handled by resubscribing to the returned handle.
 */
export function pickScreenColor({onPicked = () => {}, onCancelled = () => {}, onError = () => {}} = {}) {
    const connection = Gio.DBus.session;
    if (!connection) {
        onError(new Error('The session D-Bus connection is unavailable.'));
        return false;
    }

    const uniqueName = connection.get_unique_name();
    if (!uniqueName) {
        onError(new Error('The session D-Bus unique name is unavailable.'));
        return false;
    }

    const token = `gnome_launcher_${GLib.uuid_string_random().replace(/-/g, '_')}`;
    const sender = uniqueName.replace(/^:/, '').replace(/\./g, '_');
    const expectedPath = `${PORTAL_PATH}/request/${sender}/${token}`;
    const options = {
        handle_token: new GLib.Variant('s', token),
    };

    let subscriptionId = 0;
    const handleResponse = parameters => {
        if (subscriptionId) {
            connection.signal_unsubscribe(subscriptionId);
            subscriptionId = 0;
        }

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
            const color = results.lookup_value('color', new GLib.VariantType('(ddd)'));
            const hex = color ? formatPickedColor(color.deep_unpack()) : null;
            if (!hex)
                throw new Error('The screenshot portal returned an invalid color.');
            onPicked(hex);
        } catch (error) {
            onError(error);
        }
    };

    try {
        subscriptionId = subscribeToResponse(connection, expectedPath, handleResponse);
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
                    if (subscriptionId) {
                        bus.signal_unsubscribe(subscriptionId);
                        subscriptionId = 0;
                    }
                    onError(error);
                    return;
                }

                if (requestPath !== expectedPath) {
                    if (subscriptionId)
                        bus.signal_unsubscribe(subscriptionId);
                    subscriptionId = subscribeToResponse(bus, requestPath, handleResponse);
                }
            }
        );
        return true;
    } catch (error) {
        if (subscriptionId)
            connection.signal_unsubscribe(subscriptionId);
        onError(error);
        return false;
    }
}
