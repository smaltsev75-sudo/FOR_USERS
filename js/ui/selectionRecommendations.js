// js/ui/selectionRecommendations.js
//
// Thin facade for optimization recommendations. Section aggregation/rendering
// details live under js/ui/selectionRecommendations/*.

export {
    aggregateGeneralRecommendations,
    buildRecommendationsHtml
} from './selectionRecommendations/sections.js';
export {
    showRecommendationsFallback,
    renderRecommendations
} from './selectionRecommendations/render.js';
