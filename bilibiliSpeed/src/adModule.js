/**
 * 简单的广告屏蔽模块
 * 用法：
 *   import { hideAds, initAdBlocker } from './adBlocker.js';
 *   hideAds();                     // 立即隐藏一次
 *   initAdBlocker();               // 启动监听，持续屏蔽
 */

// 默认需要屏蔽的广告选择器列表
const DEFAULT_SELECTORS = [
    '.video-card-ad-small',
    '.right-bottom-banner'
];

/**
 * 隐藏所有匹配选择器的广告元素
 * @param {string[]} selectors - 要屏蔽的 CSS 选择器数组，默认使用内置列表
 * @returns {number} 隐藏的元素数量
 */
export function hideAds(selectors = DEFAULT_SELECTORS) {
    let hiddenCount = 0;
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (el.style.display !== 'none') {
                el.style.display = 'none';
                hiddenCount++;
            }
        });
    }
    return hiddenCount;
}

/**
 * 持续屏蔽广告（使用 MutationObserver 监听 DOM 变化）
 * @param {string[]} selectors - 要屏蔽的 CSS 选择器数组，默认使用内置列表
 * @param {Object} options - 配置选项
 * @param {boolean} [options.immediate=true] - 是否立即执行一次隐藏
 * @param {Node} [options.targetNode=document.body] - 监听的根节点
 * @returns {MutationObserver} 返回 observer 实例，便于外部停止监听
 */
export function initAdBlocker(selectors = DEFAULT_SELECTORS, options = {}) {
    const {
        immediate = true,
        targetNode = document.body
    } = options;

    // 立即隐藏一次
    if (immediate) {
        hideAds(selectors);
    }

    // 创建观察器，监听子节点增加
    const observer = new MutationObserver((mutations) => {
        let needHide = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                needHide = true;
                break;
            }
        }
        if (needHide) {
            hideAds(selectors);
        }
    });

    observer.observe(targetNode, {
        childList: true,
        subtree: true
    });

    return observer;
}

// 默认导出（可选）
export default { hideAds, initAdBlocker };