/**
 * 进度条UI组件
 * 功能：
 *   - 创建和管理进度条UI
 *   - 提供进度条的可视化展示
 *   - 支持自定义样式和位置
 */

import logger from '../loggerModule.js';

/**
 * 进度条UI组件类
 */
export class ProgressUI {
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
        
        this.container = null;
        this.progressBar = null;
        this.progressFill = null;
        this.timeText = null;
        this.updateTimer = null;
    }
    
    createProgressBar() {
        this.container = document.querySelector(this.options.container);
        if (!this.container) {
            logger.warn('progress', `未找到容器元素: ${this.options.container}`);
            return false;
        }
        
        if (document.querySelector('.bili-progress-container')) {
            return false;
        }
        
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
        
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'bili-progress-bar';
        this.progressBar.style.cssText = `
            width: 100%;
            height: ${this.options.height};
            background-color: ${this.options.backgroundColor};
            border-radius: 2px;
            overflow: hidden;
        `;
        
        this.progressFill = document.createElement('div');
        this.progressFill.className = 'bili-progress-fill';
        this.progressFill.style.cssText = `
            height: 100%;
            width: 0%;
            background-color: ${this.options.progressColor};
            transition: width 0.3s ease;
        `;
        
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
        
        this.progressBar.appendChild(this.progressFill);
        progressContainer.appendChild(this.progressBar);
        progressContainer.appendChild(this.timeText);
        this.container.appendChild(progressContainer);
        
        logger.log('progress', '进度条已创建');
        return true;
    }
    
    update(remaining, percentage) {
        if (this.progressFill) {
            this.progressFill.style.width = `${percentage}%`;
        }
        
        if (this.timeText) {
            this.timeText.textContent = `- ${remaining}`;
        }
    }
    
    start(updateCallback) {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        this.updateTimer = setInterval(() => {
            if (updateCallback) {
                updateCallback();
            }
        }, this.options.updateInterval);
        
        if (updateCallback) {
            updateCallback();
        }
        
        logger.log('progress', '进度条自动更新已启动');
    }
    
    stop() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            logger.log('progress', '进度条自动更新已停止');
        }
    }
    
    destroy() {
        this.stop();
        
        const container = document.querySelector('.bili-progress-container');
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
            logger.log('progress', '进度条已销毁');
        }
    }
}

export default ProgressUI;