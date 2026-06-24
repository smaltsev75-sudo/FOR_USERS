// js/ui/utils.js
import { NumberFormatService } from '../services/numberFormat.js';

export function getNFS(nfs) {
    return nfs || new NumberFormatService();
}
