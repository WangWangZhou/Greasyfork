/**
 * EventBus 类
 * 实现发布-订阅模式，用于管理事件订阅和通知
 */
class EventBus {
    /**
     * 构造函数
     */
    constructor() {
        this.subscribers = {};
    }

    /**
     * 订阅事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    subscribe(event, callback) {
        if (!this.subscribers[event]) {
            this.subscribers[event] = new Set();
        }
        
        this.subscribers[event].add(callback);
        
        // 返回取消订阅函数
        return () => {
            this.unsubscribe(event, callback);
        };
    }

    /**
     * 取消订阅
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    unsubscribe(event, callback) {
        if (this.subscribers[event]) {
            this.subscribers[event].delete(callback);
        }
    }

    /**
     * 发布事件（通知订阅者）
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    publish(event, data) {
        if (this.subscribers[event]) {
            this.subscribers[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`通知订阅者失败 [${event}]:`, error);
                }
            });
        }
    }

    /**
     * 清除所有订阅者
     */
    clear() {
        this.subscribers = {};
    }

    /**
     * 清除指定事件的所有订阅者
     * @param {string} event - 事件名称
     */
    clearEvent(event) {
        if (this.subscribers[event]) {
            this.subscribers[event].clear();
        }
    }

    /**
     * 获取指定事件的订阅者数量
     * @param {string} event - 事件名称
     * @returns {number} 订阅者数量
     */
    getSubscriberCount(event) {
        return this.subscribers[event] ? this.subscribers[event].size : 0;
    }
}

export default EventBus;
