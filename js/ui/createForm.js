// js/ui/createForm.js
export function updateCreateFormTotal(nfs) {
    const uiux = nfs.parseNumber(document.getElementById('h_uiux')?.value) || 0;
    const ca = nfs.parseNumber(document.getElementById('h_ca')?.value) || 0;
    const fe = nfs.parseNumber(document.getElementById('h_fe')?.value) || 0;
    const be = nfs.parseNumber(document.getElementById('h_be')?.value) || 0;
    const qa = nfs.parseNumber(document.getElementById('h_qa')?.value) || 0;
    const totalEl = document.getElementById('h_total');
    if (totalEl) totalEl.textContent = nfs.formatNumber(uiux + ca + fe + be + qa);
}