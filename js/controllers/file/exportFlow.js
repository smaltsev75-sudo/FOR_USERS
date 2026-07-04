import { messageService } from '../../services/message.js';
import { storageService } from '../../services/storage.js';
import { serializeStateForStorage } from '../../state/persistence.js';
import { buildSprintPlanFilename } from '../../utils/fileName.js';

export async function saveSprintPlanToFile({
    store,
    nfs,
    showProgress = () => {},
    hideProgress = () => {}
}) {
    showProgress('Сохранение...');
    try {
        await new Promise(resolve => setTimeout(resolve, 100));
        const state = store.getState();
        const data = serializeStateForStorage(
            state,
            state.criteria || [],
            nfs.decimalSeparator
        );
        const filename = buildSprintPlanFilename(state.config?.product);
        storageService.saveFile(data, filename);
    } catch (error) {
        messageService.showMessage('Не удалось сохранить файл: ' + error.message);
    } finally {
        hideProgress();
    }
}
