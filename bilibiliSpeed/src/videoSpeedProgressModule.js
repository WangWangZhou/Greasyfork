/**
 * 视频进度条模块
 * 功能：
 *   - 显示视频剩余时长
 *   - 提供可视化进度条
 *   - 自动更新剩余时长
 *   - 可配置样式和位置
 */

import logger from './loggerModule.js';

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
 * 进度条组件类
 */
export class Progress {
    constructor(options = {}) {
        this.options = {
            container: '.danmaku-wrap',
            position: 'top', // 'top' 或 'bottom'
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            progressColor: '#1E88E5',
            textColor: '#fff',
            textSize: '12px',
            updateInterval: 1000, // 毫秒
            ...options
        };
        
        this.container = null;
        this.progressBar = null;
        this.progressFill = null;
        this.timeText = null;
        this.updateTimer = null;
    }
    
    /**
     * 创建进度条元素
     */
    createProgressBar() {
        // 查找容器
        this.container = document.querySelector(this.options.container);
        if (!this.container) {
            logger.warn('progress', `未找到容器元素: ${this.options.container}`);
            return false;
        }
        
        // 检查是否已存在进度条
        if (document.querySelector('.bili-progress-container')) {
            return false;
        }
        
        // 创建进度条容器
        const progressContainer = document.createElement('div');
        progressContainer.className = 'bili-progress-container';
        progressContainer.style.cssText = `
            position: absolute;
            ${this.options.position}: 0;
            left: 0;
            right: 0;
            z-index: 999;
            pointer-events: none;
        `;
        
        // 创建进度条背景
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'bili-progress-bar';
        this.progressBar.style.cssText = `
            width: 100%;
            height: ${this.options.height};
            background-color: ${this.options.backgroundColor};
            border-radius: 2px;
            overflow: hidden;
        `;
        
        // 创建进度条填充
        this.progressFill = document.createElement('div');
        this.progressFill.className = 'bili-progress-fill';
        this.progressFill.style.cssText = `
            height: 100%;
            width: 0%;
            background-color: ${this.options.progressColor};
            transition: width 0.3s ease;
        `;
        
        // 创建时间文本
        this.timeText = document.createElement('div');
        this.timeText.className = 'bili-progress-time';
        this.timeText.style.cssText = `
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: ${this.options.textColor};
            font-size: ${this.options.textSize};
            font-family: system-ui, sans-serif;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;
        
        // 组装元素
        this.progressBar.appendChild(this.progressFill);
        progressContainer.appendChild(this.progressBar);
        progressContainer.appendChild(this.timeText);
        this.container.appendChild(progressContainer);
        
        logger.log('progress', '进度条已创建');
        return true;
    }
    
    /**
     * 更新进度条
     */
    update() {
        const remaining = getRemainingTime();
        const percentage = getProgressPercentage();
        
        if (this.progressFill) {
            this.progressFill.style.width = `${percentage}%`;
        }
        
        if (this.timeText) {
            this.timeText.textContent = `- ${formatTime(remaining)}`;
        }
    }
    
    /**
     * 启动自动更新
     */
    start() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        this.updateTimer = setInterval(() => {
            this.update();
        }, this.options.updateInterval);
        
        // 立即更新一次
        this.update();
        
        logger.log('progress', '进度条自动更新已启动');
    }
    
    /**
     * 停止自动更新
     */
    stop() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            logger.log('progress', '进度条自动更新已停止');
        }
    }
    
    /**
     * 销毁进度条
     */
    destroy() {
        this.stop();
        
        const container = document.querySelector('.bili-progress-container');
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
            logger.log('progress', '进度条已销毁');
        }
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