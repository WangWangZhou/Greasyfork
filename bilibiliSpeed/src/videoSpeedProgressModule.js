/**
 * 视频进度条模块
 * 功能：
 *   - 显示视频剩余时长
 *   - 提供可视化进度条
 *   - 自动更新剩余时长
 *   - 可配置样式和位置
 */

import logger from './loggerModule.js';
import { ProgressUI } from './component/progressUI.js';

/**
 * 获取视频剩余时长（秒）
 * @returns {number} 剩余时长（秒），如果没有视频元素则返回 0
 */
export function getRemainingTime() {
    const video = document.querySelector('video');
    if (!video) return 0;
    
    const duration = video.duration || 0;
    const currentTime = video.currentTime || 0;
    const remaining = duration - currentTime;
    
    return Math.max(0, remaining);
}

/**
 * 格式化秒数为 mm:ss 或 hh:mm:ss 格式
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(seconds) {
    if (seconds <= 0) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours.toString()}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

/**
 * 计算进度百分比
 * @returns {number} 进度百分比（0-100）
 */
export function getProgressPercentage() {
    const video = document.querySelector('video');
    if (!video || !video.duration) return 0;
    
    const progress = (video.currentTime / video.duration) * 100;
    return Math.min(100, Math.max(0, progress));
}

/**
 * 进度条管理器（逻辑层）
 */
export class Progress {
    constructor(options = {}) {
        this.options = {
            container: '.danmaku-wrap',
            position: 'top',
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            progressColor: '#1E88E5',
            textColor: '#fff',
            textSize: '12px',
            updateInterval: 1000,
            ...options
        };
        
        this.ui = new ProgressUI(this.options);
    }
    
    createProgressBar() {
        return this.ui.createProgressBar();
    }
    
    update() {
        const remaining = getRemainingTime();
        const percentage = getProgressPercentage();
        this.ui.update(formatTime(remaining), percentage);
    }
    
    start() {
        this.ui.start(() => this.update());
    }
    
    stop() {
        this.ui.stop();
    }
    
    destroy() {
        this.ui.destroy();
    }
}

/**
 * 初始化进度条模块
 * @param {Object} options - 配置选项
 * @returns {Progress|null} Progress 实例或 null
 */
export function initProgress(options = {}) {
    const progress = new Progress(options);
    
    if (progress.createProgressBar()) {
        progress.start();
        return progress;
    }
    
    return null;
}

// 默认导出
export default {
    initProgress,
    getRemainingTime,
    formatTime,
    getProgressPercentage,
    Progress
};

// 导出UI组件供外部使用
export { ProgressUI };