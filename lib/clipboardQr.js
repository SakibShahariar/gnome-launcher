// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Main from 'resource:///org/gnome/shell/ui/main.js';

import {qrencodeArguments} from './qrCodeCommand.js';

const SUBPROCESS_FLAGS = Gio.SubprocessFlags.STDIN_PIPE |
    Gio.SubprocessFlags.STDOUT_PIPE |
    Gio.SubprocessFlags.STDERR_PIPE;

export function copyTextAsQr(text) {
    if (typeof text !== 'string' || text.length === 0) {
        Main.notify('QR code not created', 'Select a non-empty clipboard text entry.');
        return false;
    }

    let process;
    try {
        process = Gio.Subprocess.new(qrencodeArguments(), SUBPROCESS_FLAGS);
    } catch {
        Main.notify('QR code unavailable', 'Install qrencode to copy text as a QR image.');
        return false;
    }

    try {
        process.communicate_async(
            GLib.Bytes.new(new TextEncoder().encode(text)),
            null,
            (source, result) => {
                try {
                    const [ok, pngBytes] = source.communicate_finish(result);
                    if (!ok || !source.get_successful() || !pngBytes || pngBytes.get_size() === 0) {
                        Main.notify('QR code failed', 'qrencode could not create an image for this text.');
                        return;
                    }
                    const clipboard = St.Clipboard.get_default();
                    if (!clipboard) {
                        Main.notify('QR code failed', 'The clipboard is not available.');
                        return;
                    }
                    clipboard.set_content(St.ClipboardType.CLIPBOARD, 'image/png', pngBytes);
                    Main.notify('QR code copied', 'Paste the QR image into a message or image editor.');
                } catch {
                    Main.notify('QR code failed', 'Could not copy the generated QR image.');
                }
            }
        );
        return true;
    } catch {
        Main.notify('QR code failed', 'Could not start qrencode.');
        return false;
    }
}
