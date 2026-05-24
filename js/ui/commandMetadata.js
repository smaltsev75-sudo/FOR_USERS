import { COMMANDS } from '../config/commands.js';

export function applyCommandMetadata(root = document) {
    for (const command of Object.values(COMMANDS)) {
        if (!command.buttonId) continue;
        const button = root.getElementById(command.buttonId);
        if (!button) continue;

        if (command.title) {
            button.title = command.title;
        }
        if (command.ariaLabel) {
            button.setAttribute('aria-label', command.ariaLabel);
        }
    }
}
