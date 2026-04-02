/**
 * DOM Observer Manager
 * 统一管理 MutationObserver，减少多个控制器独立创建观察器造成的性能开销
 */
class DOMObserverManager {
    constructor() {
        this.observer = null;
        this.callbacks = new Map();
        this.isObserving = false;
    }

    /**
     * 开始观察 DOM 变化
     */
    observe() {
        if (this.observer) return;

        this.observer = new MutationObserver((mutations) => {
            // 批量处理回调
            this.callbacks.forEach((callback, selector) => {
                try {
                    // 检查相关的 DOM 变化
                    const relevantMutations = this.filterRelevantMutations(mutations, selector);
                    if (relevantMutations.length > 0) {
                        callback(relevantMutations);
                    }
                } catch (error) {
                    console.error(`DOM Observer error for ${selector}:`, error);
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.isObserving = true;
        console.log('DOM Observer Manager 初始化完成');
    }

    /**
     * 筛选相关的 DOM 变化
     * @param {MutationRecord[]} mutations - DOM 变化记录
     * @param {string} selector - CSS 选择器（支持逗号分隔的多个选择器）
     * @returns {MutationRecord[]} 相关的变化记录
     */
    filterRelevantMutations(mutations, selector) {
        // 将逗号分隔的选择器拆分为数组
        const selectors = selector.split(',').map(s => s.trim());
        
        return mutations.filter(mutation => {
            // 检查添加的节点是否匹配任一选择器
            if (mutation.addedNodes.length > 0) {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType === 1) { // ELEMENT_NODE
                        // 检查节点本身是否匹配任一选择器
                        const matchesSelf = selectors.some(sel => node.matches && node.matches(sel));
                        if (matchesSelf) return true;
                        
                        // 检查节点内部是否包含匹配任一选择器的元素
                        const hasMatchingChild = selectors.some(sel => node.querySelector && node.querySelector(sel));
                        if (hasMatchingChild) return true;
                    }
                    return false;
                });
            }
            return false;
        });
    }

    /**
     * 注册观察器
     * @param {string} selector - CSS 选择器
     * @param {Function} callback - 回调函数
     */
    register(selector, callback) {
        // 如果还没有开始观察，先开始观察
        if (!this.isObserving) {
            this.observe();
        }
        
        this.callbacks.set(selector, callback);
        console.log(`注册观察器: ${selector}`);
    }

    /**
     * 取消注册观察器
     * @param {string} selector - CSS 选择器
     */
    unregister(selector) {
        this.callbacks.delete(selector);
        console.log(`取消注册观察器: ${selector}`);
        
        // 如果没有回调了，停止观察
        if (this.callbacks.size === 0) {
            this.disconnect();
        }
    }

    /**
     * 停止观察
     */
    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.callbacks.clear();
        this.isObserving = false;
        console.log('DOM Observer Manager 已停止');
    }
}

// 导出单例实例
export default new DOMObserverManager();
