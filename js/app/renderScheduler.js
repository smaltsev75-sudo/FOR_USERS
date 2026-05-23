// @ts-check
// js/app/renderScheduler.js

/**
 * Batches render calls through requestAnimationFrame.
 *
 * App owns bootstrap/controller wiring; this coordinator owns only the render
 * queue state so batching can be tested without constructing the whole app.
 */
export class RenderScheduler {
    /**
     * @param {() => void} renderNow
     * @param {{ requestAnimationFrame?: (cb: FrameRequestCallback) => number, setTimeout?: typeof setTimeout }} [runtime]
     */
    constructor(renderNow, runtime = globalThis) {
        this._renderNow = renderNow;
        this._runtime = runtime;
        this._queued = false;
        this.requestRender = this.requestRender.bind(this);
    }

    get queued() {
        return this._queued;
    }

    requestRender() {
        if (this._queued) return;
        this._queued = true;
        const scheduleFrame = this._runtime.requestAnimationFrame
            || ((cb) => (this._runtime.setTimeout || setTimeout)(cb, 16));
        scheduleFrame(() => {
            this._queued = false;
            this._renderNow();
        });
    }
}
