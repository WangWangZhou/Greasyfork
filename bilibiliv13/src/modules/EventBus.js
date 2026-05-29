/**
 * EventBus - 事件总线模块
 * 提供发布/订阅模式的事件通信机制
 */
const EventBus = (() => {
    const listeners = new Map();

    return {
        on(event, callback) {
            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }
            listeners.get(event).add(callback);
            return () => listeners.get(event)?.delete(callback);
        },

        once(event, callback) {
            const wrapper = (...args) => {
                callback(...args);
                this.off(event, wrapper);
            };
            this.on(event, wrapper);
        },

        off(event, callback) {
            listeners.get(event)?.delete(callback);
        },

        emit(event, ...args) {
            const cbs = listeners.get(event);
            if (cbs) {
                cbs.forEach(cb => {
                    try {
                        cb(...args);
                    } catch (err) {
                        console.error(`[EventBus] 事件 "${event}" 处理器异常:`, err);
                    }
                });
            }
        },

        clear() {
            listeners.clear();
        }
    };
})();