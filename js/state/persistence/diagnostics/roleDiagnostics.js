import { parseRoleField } from '../../../domain/roleFieldContract.js';
import { isPlainRecord } from './shared.js';

export function addRoleIssues(issues, rawState) {
    if (!Array.isArray(rawState.roles)) return;

    rawState.roles.forEach((role, i) => {
        if (isPlainRecord(role)) {
            if (role.fte !== undefined && parseRoleField('fte', role.fte) === null) {
                issues.push(`roles[${i}].fte = ${JSON.stringify(role.fte)} отвергнуто (требуется целое ≥0); применён fallback`);
            }
            if (role.off !== undefined && parseRoleField('off', role.off) === null) {
                issues.push(`roles[${i}].off = ${JSON.stringify(role.off)} отвергнуто (требуется ≥0, точность 1 знак); применён fallback`);
            }
        } else if (role !== undefined) {
            issues.push(`roles[${i}] = ${JSON.stringify(role)} отвергнуто (требуется object); пропущено`);
        }
    });
}
