/**
 * Bilibili 自定义倍速模块（可配置版）
 * 功能：
 *   - 支持自定义快捷键（默认 Z=1x, X=+步进, C=-步进）
 *   - 支持自定义步进值、最小/最大倍速
 *   - 支持设置初始倍速
 *   - 自动区分输入模式（不干扰打字/评论）
 *   - 播放器中央显示当前倍速提示（可配置时长）
 *   - 显示合集总时长（非直播页面）
 *   - 直播页面自动禁用
 *
 * 使用方法：
 *   import biliSpeedCtrl from './biliSpeedCtrl.js';
 *   biliSpeedCtrl.init({
 *       step: 0.1,
 *       minSpeed: 0.5,
 *       maxSpeed: 4,
 *       initialSpeed: 1.5,
 *       keys: { reset: 'z', inc: 'x', dec: 'c' },
 *       tipDuration: 800
 *   });
 */

import logger from './loggerModule.js';
import { initProgress } from './videoSpeedProgressModule.js';
import { init as initVideoInfoPanel } from './videoInfoDisplayPanelModule.js';
import { formatTime } from './timeUtil.js';
import { VideoTipUI } from './component/videoTipUI.js';

// 默认配置
const DEFAULT_CONFIG = {
    // 步进值（每次增加/减少的倍数）
    step: 0.05,
    // 最小倍速
    minSpeed: 0.125,
    // 最大倍速
    maxSpeed: 16,
    // 初始倍速（0 表示不自动设置，使用视频原始倍速）
    initialSpeed: 0,
    // 按键映射（使用小写字母）
    keys: {
        reset: 'z',   // 恢复1倍速
        inc: 'x',     // 增加步进
        dec: 'c'      // 减少步进
    },
    // 提示显示时长（毫秒）
    tipDuration: 500,
    // 是否显示倍速提示
    showTip: true,
    // 是否在控制台输出日志
    debug: false
};

var totalSec = 0;

/**
 * 判断是否为直播页面
 * @returns {boolean}
 */
function isLivePage() {
    if (location.pathname.includes('/live/')) return true;
    const liveEl = document.querySelector('.live-player, .bpx-player-live');
    if (liveEl) return true;
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.videoData) {
        return window.__INITIAL_STATE__.videoData.is_live === true;
    }
    return false;
}

/**
 * 获取当前播放的 video 元素
 * @returns {HTMLVideoElement|null}
 */
function getVideoElement() {
    return document.querySelector('video');
}

// 倍速提示UI实例
let tipUI = null;

/**
 * 显示倍速提示（在播放器中央浮动，自动消失）
 * @param {number} rate - 当前倍速值
 * @param {Object} config - 配置对象（需要 tipDuration, showTip）
 */
function showSpeedTip(rate, config) {
    if (!config.showTip) return;

    if (!tipUI) {
        tipUI = new VideoTipUI({
            tipDuration: config.tipDuration
        });
    }

    tipUI.show(rate, config.tipDuration);
}

/**
 * 设置播放速度
 * @param {number} rate - 目标倍速
 * @param {Object} config - 配置对象（含 minSpeed, maxSpeed, showTip, tipDuration）
 * @param {boolean} fromUser - 是否由用户操作触发（用于显示提示）
 * @returns {number} 实际设置的倍速
 */
function setPlaybackRate(rate, config, fromUser = true) {
    const video = getVideoElement();
    if (!video) return video ? video.playbackRate : 1;

    let newRate = rate;
    if (newRate < config.minSpeed) newRate = config.minSpeed;
    if (newRate > config.maxSpeed) newRate = config.maxSpeed;
    newRate = Math.round(newRate * 100) / 100;

    if (video.playbackRate !== newRate) {
        video.playbackRate = newRate;
        if (fromUser && config.showTip) {
            showSpeedTip(newRate, config);
        }
    } else if (fromUser && config.showTip) {
        // 相同倍率时也显示一下当前倍率（方便确认）
        showSpeedTip(newRate, config);
    }
    return newRate;
}

/**
 * 创建键盘事件处理器
 * @param {Object} config - 配置对象
 * @returns {Function} 事件处理函数
 */
function createKeydownHandler(config) {
    const { keys, step, minSpeed, maxSpeed } = config;

    return function onKeyDown(e) {
        // 如果当前焦点在可输入元素上，不处理快捷键
        const activeEl = document.activeElement;
        const isInputActive = activeEl &&
            (activeEl.tagName === 'INPUT' ||
             activeEl.tagName === 'TEXTAREA' ||
             activeEl.isContentEditable);
        if (isInputActive) return;

        const key = e.key.toLowerCase();
        let video = getVideoElement();
        if (!video) return;

        let currentRate = video.playbackRate;
        let targetRate = null;

        if (key === keys.reset) {
            targetRate = 1.0;
        } else if (key === keys.inc) {
            targetRate = currentRate + step;
        } else if (key === keys.dec) {
            targetRate = currentRate - step;
        } else {
            return;
        }

        // 边界裁剪（由 setPlaybackRate 完成）
        setPlaybackRate(targetRate, config, true);
        e.preventDefault();
        e.stopPropagation();
    };
}

/**
 * 计算合集总时长（秒）
 * @returns {number}
 */
function calculateTotalDuration() {
    let totalDuration = 0;
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.videoData) {
        const pages = window.__INITIAL_STATE__.videoData.pages;
        if (Array.isArray(pages)) {
            pages.forEach(page => {
                if (page && typeof page.duration === 'number') {
                    totalDuration += page.duration;
                }
            });
        }
    }
    return totalDuration;
}

/**
 * 在界面上显示消息
 * 查找 .bui-dropdown-name 元素并设置文本
 */
function displayMessage() {
    const target = document.querySelector('.bui-dropdown-name');
    if (!target) return;
    totalSec = calculateTotalDuration();
    if (totalSec === 0) return;
    const formatted = formatTime(totalSec);
    target.textContent = formatted;
}

//剩余时长
function getRemainingTime(){
let remainingTime = 0;
// 获取页面中的第一个 video 元素
const video = document.querySelector('video');

if (video) {
  // 计算剩余时间（单位：秒）
  remainingTime = video.duration - video.currentTime;
  
  //console.log(`剩余时长: ${remainingTime.toFixed(2)} 秒`);
  //console.log(`格式化剩余时间: ${formatTime(remainingTime)}`);
} else {
  //console.log('未找到 video 元素');
}

return remainingTime;
}

/**
 * 等待视频元素出现并设置初始倍速
 * @param {Object} config
 */
function applyInitialSpeed(config) {
    if (!config.initialSpeed || config.initialSpeed <= 0) return;

    const checkVideo = () => {
        const video = getVideoElement();
        if (video) {
            // 避免覆盖用户手动设置的倍速（如果已经有倍速且不是默认1，则不覆盖）
            // 但为了体验，如果 initialSpeed 有效，就设置
            setPlaybackRate(config.initialSpeed, config, false);
            if (config.debug) logger.debug('speed', `初始倍速已设置为 ${config.initialSpeed}x`);
        } else {
            setTimeout(checkVideo, 200);
        }
    };
    checkVideo();
}

/**
 * 初始化模块
 * @param {Object} userConfig - 用户自定义配置（与默认配置合并）
 * @returns {Object} 包含控制方法的对象（便于外部调用）
 */
export function init(userConfig = {}) {
    // 合并配置
    const config = { ...DEFAULT_CONFIG, ...userConfig };
    if (userConfig.keys) {
        config.keys = { ...DEFAULT_CONFIG.keys, ...userConfig.keys };
    }

    if (isLivePage()) {
        if (config.debug) logger.debug('speed', '检测到直播页面，已自动禁用');
        return { active: false, reason: 'live_page' };
    }

    // 注册键盘事件
    const keydownHandler = createKeydownHandler(config);
    window.addEventListener('keydown', keydownHandler, true);

    // 显示合集总时长（元素可能动态加载）
    const tryDisplayDuration = () => {
        if (document.querySelector('.bui-dropdown-name')) {
                displayMessage();
                // 初始化视频进度条
                //initProgress();
                // 初始化视频信息面板
                initVideoInfoPanel();
        } else {
            setTimeout(tryDisplayDuration, 500);
        }
    };
    tryDisplayDuration();



    // 设置初始倍速
    applyInitialSpeed(config);

    if (config.debug) {
        logger.debug('speed', '已启用，配置：', {
            step: config.step,
            minSpeed: config.minSpeed,
            maxSpeed: config.maxSpeed,
            initialSpeed: config.initialSpeed || '未设置',
            keys: config.keys,
            tipDuration: config.tipDuration
        });
    }

    // 返回控制函数，便于外部调用
    return {
        active: true,
        setSpeed: (rate, showTip = true) => setPlaybackRate(rate, config, showTip),
        getSpeed: () => {
            const v = getVideoElement();
            return v ? v.playbackRate : 1;
        },
        destroy: () => {
            window.removeEventListener('keydown', keydownHandler, true);
            if (tipUI) {
                tipUI.destroy();
                tipUI = null;
            }
            if (config.debug) logger.debug('speed', '已销毁');
        }
    };
}

// 默认导出
export default { init };