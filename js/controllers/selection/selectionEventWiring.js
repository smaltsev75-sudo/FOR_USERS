export function wireSelectionControllerEvents(controller) {
    const autoSelectBtn = document.getElementById('autoSelectBtn');
    if (autoSelectBtn) {
        autoSelectBtn.addEventListener('click', () => controller.runMultiSelection());
    }

    const modal = document.getElementById('selectionReportModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            const target = e.target.closest?.('button') || e.target;
            if (target.id === 'applyMatrixBtn') {
                controller.applyAlgorithm('matrix');
            } else if (target.id === 'applyValueDensityBtn') {
                controller.applyAlgorithm('value-density');
            } else if (target.id === 'applyHybridBtn') {
                controller.applyAlgorithm('hybrid');
            } else if (target.id === 'closeSelectionReportBtn' || target.id === 'closeSelectionReportModalBtn') {
                controller.closeReport();
            } else if (target.id === 'showRecommendationsBtn') {
                controller.showRecommendations();
            }
            // .accordion-header обрабатывается локальным listener'ом,
            // навешенным в renderSelectionReport — здесь делегация
            // больше не нужна (дублировала бы toggle при bubbling).
        });
    }
}
