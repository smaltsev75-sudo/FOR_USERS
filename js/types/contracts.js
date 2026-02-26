// js/types/contracts.js

/**
 * @typedef {'us'|'bug'|'tech'} TaskType
 */

/**
 * @typedef {Object} TaskEstimates
 * @property {number} uiux
 * @property {number} ca
 * @property {number} fe
 * @property {number} be
 * @property {number} qa
 */

/**
 * @typedef {Object} CriteriaEvaluation
 * @property {number} score
 * @property {number} value
 */

/**
 * @typedef {Object<string, CriteriaEvaluation>} CriteriaEvaluationMap
 */

/**
 * @typedef {Object} Task
 * @property {number} id
 * @property {string} title
 * @property {string} jira
 * @property {TaskType} type
 * @property {string} comment
 * @property {0|1|boolean} excluded
 * @property {TaskEstimates} est
 * @property {string} exclusionReason
 * @property {CriteriaEvaluationMap} criteriaEvaluations
 * @property {number} [priorityScore]
 */

/**
 * @typedef {Object} Role
 * @property {string} id
 * @property {string} name
 * @property {number} fte
 * @property {number} off
 */

/**
 * @typedef {Object} SprintConfig
 * @property {string} product
 * @property {number} days
 * @property {string} startDate
 * @property {string} endDate
 * @property {number} availCoef
 * @property {number} alert
 */

/**
 * @typedef {Object} Criterion
 * @property {number} id
 * @property {string} name
 * @property {string} abbreviation
 * @property {number} weight
 * @property {string} rationale
 * @property {Object<string, string>} scale
 */

/**
 * @typedef {Object} NumberFormatSettings
 * @property {','|'.'} decimalSeparator
 */

/**
 * @typedef {Object} TaskFilter
 * @property {string} search
 * @property {''|'us'|'bug'|'tech'} type
 */

/**
 * @typedef {Object} TaskSort
 * @property {string} by
 * @property {'asc'|'desc'} order
 */

/**
 * @typedef {Object} AppState
 * @property {SprintConfig} config
 * @property {Role[]} roles
 * @property {Task[]} tasks
 * @property {Criterion[]} criteria
 * @property {NumberFormatSettings} numberFormatSettings
 * @property {'planning'|'criteria'} activeTab
 * @property {TaskFilter} taskFilter
 * @property {TaskSort} taskSort
 * @property {number|null} [lastAddedTaskId]
 */

/**
 * @typedef {Object} SelectionResult
 * @property {Task[]} selectedTasks
 * @property {Task[]} excludedTasks
 * @property {Object} loadByRole
 * @property {Object} stats
 * @property {string} algorithm
 * @property {Object} [quadrants]
 * @property {Object} [medians]
 */

/**
 * @typedef {Object} Recommendation
 * @property {string} type
 * @property {string} message
 * @property {string} [suggestion]
 * @property {'high'|'medium'|'low'|'info'} severity
 */

/**
 * @typedef {Object} LruCacheEntry
 * @property {string} key
 * @property {*} value
 */

export const CONTRACTS = {};
