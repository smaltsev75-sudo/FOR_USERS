import { messageService } from '../../services/message.js';

export function setupHelpTocLinks(contentEl, {
    onMissingAnchor = (targetId) => messageService.showMessage(`Якорь #${targetId} не найден`),
    setTimeoutFn = setTimeout
} = {}) {
    if (!contentEl) return;

    const links = contentEl.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const rawTargetId = link.getAttribute('href').substring(1);
            const targetId = decodeURIComponent(rawTargetId);
            const target = contentEl.querySelector(`#${targetId}`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                target.classList.add('toc-highlight');
                setTimeoutFn(() => target.classList.remove('toc-highlight'), 1000);
            } else {
                onMissingAnchor(targetId);
            }
        });
    });
}
