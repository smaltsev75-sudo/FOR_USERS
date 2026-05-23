import { checkIntegerField } from '../primitiveNormalizers.js';
import {
    addArrayShapeIssue,
    addPlainObjectShapeIssues,
    isPlainRecord,
    valueSample
} from './shared.js';

export function addConfigIssues(issues, rawState) {
    if (rawState.config !== undefined && !isPlainRecord(rawState.config)) {
        issues.push(`config = ${valueSample(rawState.config)} отвергнуто (требуется plain object); применены defaults`);
    }

    const cfg = rawState.config;
    if (!isPlainRecord(cfg)) return;

    checkIntegerField(issues, 'config.days', cfg.days, 1, Number.MAX_SAFE_INTEGER);
    checkIntegerField(issues, 'config.holidays', cfg.holidays, 0, Number.MAX_SAFE_INTEGER);
    checkIntegerField(issues, 'config.alert', cfg.alert, 0, Number.MAX_SAFE_INTEGER);
    if (cfg.availCoef !== undefined && cfg.availCoef !== null) {
        const n = Number(cfg.availCoef);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
            issues.push(`config.availCoef = ${JSON.stringify(cfg.availCoef)} отвергнуто (требуется число 0..100); применён fallback`);
        }
    }
}

export function addTopLevelShapeIssues(issues, rawState) {
    addArrayShapeIssue(issues, rawState, 'roles', 'применены defaults');
    addArrayShapeIssue(issues, rawState, 'tasks', 'пустой список');
    addArrayShapeIssue(issues, rawState, 'criteria', 'пустой список');
}

export function addNestedPlainShapeIssues(issues, rawState) {
    addPlainObjectShapeIssues(
        issues,
        rawState,
        ['taskFilter', 'taskSort', 'ui', 'numberFormatSettings'],
        'применены defaults'
    );
}
