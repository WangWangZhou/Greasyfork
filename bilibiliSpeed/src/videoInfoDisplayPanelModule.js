/**
 * 视频信息显示面板模块
 * 功能：在弹幕区域显示剩余时长、合集总时长、实时播放速度
 * 位置：插入到 .danmaku-wrap 容器内（若不存在则等待或创建备用容器）
 * 实时更新：基于 video 元素的 timeupdate 和 ratechange 事件
 *
 * 使用方法：
 *   import videoInfoPanel from './videoInfoDisplayPanelModule.js';
 *   const panel = videoInfoPanel.init();
 *   // 如果需要销毁：
 *   // panel.destroy();
 */

import { formatTime } from './timeUtil.js';

// 默认配置
const DEFAULT_OPTIONS = {
    // 刷新间隔（毫秒），用于主动轮询（兜底），实际推荐使用事件驱动
    updateInterval: 250,
    // 是否显示面板标题
    showTitle: true,
    // 面板样式可自定义
    style: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: '#fff',
        fontSize: '14px',
        fontFamily: 'system-ui, sans-serif',
        padding: '8px 12px',
        borderRadius: '8px',
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: '1000',
        backdropFilter: 'blur(4px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
    }
};

/**
 * 获取合集总时长（秒）
 * @returns {number}
 */
function getTotalDuration() {
    let total = 0;
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.videoData) {
        const pages = window.__INITIAL_STATE__.videoData.pages;
        if (Array.isArray(pages)) {
            pages.forEach(page => {
                if (page && typeof page.duration === 'number') {
                    total += page.duration;
                }
            });
        }
    }
    return total;
}

/**
 * 创建面板 DOM 元素
 * @param {Object} options - 配置
 * @returns {HTMLElement}
 */
function createPanelElement(options) {
    const panel = document.createElement('div');
    panel.className = 'video-info-panel';
    const styles = options.style;
    Object.assign(panel.style, styles);
    panel.style.position = styles.position || 'absolute'; // 确保绝对定位

    // 内部结构
    let html = '';
    if (options.showTitle) {
        html += '<div style="font-weight:bold; margin-bottom:4px;">📊 视频信息</div>';
    }
    html += `
        <div>⏱️ 剩余: <span class="video-remaining">--:--</span></div>
        <div>📅 总长: <span class="video-total">--:--</span></div>
        <div>⚡ 速度: <span class="video-speed">1.00</span>x</div>
    `;
    panel.innerHTML = html;
    return panel;
}

/**
 * 更新面板上的剩余时间
 * @param {HTMLElement} panel
 * @param {HTMLVideoElement} video
 */
function updateRemainingTime(panel, video) {
    if (!video || !panel) return;
    const remaining = video.duration - video.currentTime;
    const remainingFormatted = formatTime(remaining > 0 ? remaining : 0);
    const remainingSpan = panel.querySelector('.video-remaining');
    if (remainingSpan) remainingSpan.textContent = remainingFormatted;
}

/**
 * 更新面板上的总时长（合集总时长）
 * @param {HTMLElement} panel
 */
function updateTotalDuration(panel) {
    const total = getTotalDuration();
    const totalFormatted = formatTime(total);
    const totalSpan = panel.querySelector('.video-total');
    if (totalSpan) totalSpan.textContent = totalFormatted;
}

/**
 * 更新面板上的播放速度
 * @param {HTMLElement} panel
 * @param {HTMLVideoElement} video
 */
function updatePlaybackRate(panel, video) {
    if (!video || !panel) return;
    const rate = video.playbackRate;
    const speedSpan = panel.querySelector('.video-speed');
    if (speedSpan) speedSpan.textContent = rate.toFixed(2);
}

/**
 * 等待指定元素出现（基于 MutationObserver）
 * @param {string} selector
 * @param {number} timeout
 * @returns {Promise<Element>}
 */
function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(selector);
        if (existing) return resolve(existing);

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`等待元素 ${selector} 超时`));
        }, timeout);
    });
}

/**
 * 初始化视频信息面板
 * @param {Object} userOptions - 可选配置，覆盖 DEFAULT_OPTIONS
 * @returns {{ destroy: Function, update: Function }} 控制对象
 */
export async function init(userOptions = {}) {
    const options = { ...DEFAULT_OPTIONS, ...userOptions };
    if (userOptions.style) {
        options.style = { ...DEFAULT_OPTIONS.style, ...userOptions.style };
    }

    // 等待弹幕容器出现
    let danmakuContainer;
    try {
        danmakuContainer = await waitForElement('.danmaku-wrap', 15000);
    } catch (err) {
        console.warn('[视频信息面板] 未找到 .danmaku-wrap，无法显示面板');
        return { destroy: () => {}, update: () => {} };
    }

    // 确保容器有相对定位，以便绝对定位面板相对于它
    if (getComputedStyle(danmakuContainer).position === 'static') {
        danmakuContainer.style.position = 'relative';
    }

    // 创建面板并插入
    const panel = createPanelElement(options);
    danmakuContainer.appendChild(panel);

    // 获取 video 元素（可能尚未加载，等待）
    let video = document.querySelector('video');
    if (!video) {
        try {
            video = await waitForElement('video', 10000);
        } catch (err) {
            console.warn('[视频信息面板] 未找到 video 元素，面板将无数据');
            panel.remove();
            return { destroy: () => {}, update: () => {} };
        }
    }

    // 更新一次总时长（合集时长可能已存在）
    updateTotalDuration(panel);

    // 定义事件处理函数
    const onTimeUpdate = () => updateRemainingTime(panel, video);
    const onRateChange = () => updatePlaybackRate(panel, video);
    const onLoadedMetadata = () => {
        updateTotalDuration(panel);
        updateRemainingTime(panel, video);
        updatePlaybackRate(panel, video);
    };

    // 绑定事件
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ratechange', onRateChange);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    // 立即执行一次刷新
    onLoadedMetadata();

    // 可选：轮询兜底（如果某些事件未触发，比如duration变化）
    let intervalId = setInterval(() => {
        if (video && video.duration && !isNaN(video.duration)) {
            updateRemainingTime(panel, video);
            updatePlaybackRate(panel, video);
        }
    }, options.updateInterval);

    // 监听 video 元素被替换的情况（SPA 切换视频时）
    const videoObserver = new MutationObserver(() => {
        const newVideo = document.querySelector('video');
        if (newVideo && newVideo !== video) {
            // 解绑旧事件
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('ratechange', onRateChange);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video = newVideo;
            // 绑定新事件
            video.addEventListener('timeupdate', onTimeUpdate);
            video.addEventListener('ratechange', onRateChange);
            video.addEventListener('loadedmetadata', onLoadedMetadata);
            onLoadedMetadata(); // 立即更新
        }
    });
    videoObserver.observe(document.body, { childList: true, subtree: true });

    // 返回控制接口
    const destroy = () => {
        clearInterval(intervalId);
        videoObserver.disconnect();
        if (video) {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('ratechange', onRateChange);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
        }
        if (panel && panel.parentNode) panel.remove();
    };

    const update = () => {
        if (video) {
            updateRemainingTime(panel, video);
            updateTotalDuration(panel);
            updatePlaybackRate(panel, video);
        }
    };

    return { destroy, update };
}

// 默认导出
export default { init };