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
        this._held = false;
        this._pendingWhileHeld = false;
        this.requestRender = this.requestRender.bind(this);
        this.setHold = this.setHold.bind(this);
    }

    get queued() {
        return this._queued;
    }

    /**
     * W37 (owner): на время активного drag рендер откладывается — re-render
     * (replaceChildren в renderTaskList) уничтожает перетаскиваемую карточку
     * и рвёт drag (например, сброс lastAddedTaskId через 5s после создания).
     * setHold(true) на dragstart, setHold(false) на dragend/mouseup; release
     * выполняет один отложенный рендер, если запросы приходили во время hold.
     * @param {boolean} held
     */
    setHold(held) {
        if (this._held === Boolean(held)) return;
        this._held = Boolean(held);
        if (!this._held && this._pendingWhileHeld) {
            this._pendingWhileHeld = false;
            this.requestRender();
        }
    }

    requestRender() {
        if (this._held) {
            this._pendingWhileHeld = true;
            return;
        }
        if (this._queued) return;
        this._queued = true;
        const scheduleFrame = this._runtime.requestAnimationFrame
            || ((cb) => (this._runtime.setTimeout || setTimeout)(cb, 16));
        scheduleFrame(() => {
            this._queued = false;
            // Hold мог включиться МЕЖДУ requestRender и кадром (drag начался
            // до rAF) — откладываем до release, не рендерим под drag'ом.
            if (this._held) {
                this._pendingWhileHeld = true;
                return;
            }
            this._renderNow();
        });
    }
}
