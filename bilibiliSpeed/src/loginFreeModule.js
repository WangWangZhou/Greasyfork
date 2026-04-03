/**
 * B站免登录辅助模块
 * 功能：
 *   - 自动关闭页面上的登录弹窗（通过点击关闭图标）
 *   - 自动移除页面上的限制遮罩层（#limit-mask）
 * 用法：
 *   import { closeLoginModal, keepLoginModalClosed, removeLimitMask } from './loginFreeModule.js';
 *   closeLoginModal();                // 立即关闭登录弹窗并移除限制遮罩层
 *   keepLoginModalClosed();           // 启动持续监听，新出现的弹窗和遮罩层都会被处理
 *   removeLimitMask();                // 单独移除限制遮罩层
 */

import logger from './utils/loggerModule.js';

// 登录弹窗关闭按钮的选择器（基于B站实际DOM结构）
const CLOSE_SELECTOR = '.bili-mini-close-icon';
// 限制遮罩层选择器
const LIMIT_MASK_SELECTOR = '#limit-mask';

/**
 * 移除限制遮罩层元素
 * @returns {number} 成功移除的元素数量
 */
export function removeLimitMask() {
    const limitMasks = document.querySelectorAll(LIMIT_MASK_SELECTOR);
    let removedCount = 0;
    limitMasks.forEach(mask => {
        if (mask && mask.parentNode) {
            mask.remove();
            removedCount++;
        }
    });
    if (removedCount > 0) {
        logger.log('login', `已移除 ${removedCount} 个限制遮罩层`);
    }
    return removedCount;
}

/**
 * 立即关闭当前页面上所有匹配的登录弹窗
 * @returns {number} 成功点击关闭的数量
 */
export function closeLoginModal() {
    const closeButtons = document.querySelectorAll(CLOSE_SELECTOR);
    let clickedCount = 0;
    closeButtons.forEach(btn => {
        if (btn && typeof btn.click === 'function') {
            btn.click();
            clickedCount++;
        }
    });
    if (clickedCount > 0) {
        logger.log('login', `已关闭 ${clickedCount} 个登录弹窗`);
    }
    // 同时移除限制遮罩层
    removeLimitMask();
    return clickedCount;
}

/**
 * 持续监听DOM变化，自动关闭新出现的登录弹窗
 * @param {Object} options - 配置项
 * @param {boolean} [options.immediate=true] - 是否立即执行一次关闭
 * @param {Node} [options.targetNode=document.body] - 监听的根节点
 * @returns {MutationObserver} observer实例，可用于停止监听
 */
export function keepLoginModalClosed(options = {}) {
    const {
        immediate = true,
        targetNode = document.body
    } = options;

    if (immediate) {
        closeLoginModal();
    }

    const observer = new MutationObserver((mutations) => {
        // 只要有节点新增，就尝试关闭弹窗
        let hasAddedNodes = mutations.some(mutation => mutation.addedNodes.length > 0);
        if (hasAddedNodes) {
            closeLoginModal();
        }
    });

    observer.observe(targetNode, {
        childList: true,
        subtree: true
    });

    logger.log('login', '已启动监听，将自动关闭登录弹窗');
    return observer;
}

// 默认导出（可选）
export default { closeLoginModal, keepLoginModalClosed, removeLimitMask };