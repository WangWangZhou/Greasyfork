import { 
    formatTime, 
    calculateTotalDuration, 
    getRemainingTime
} from './utils/timeUtil.js';

class ProgressBar {
    constructor(options = {}) {
        this.options = {
            height: '4px',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            progressColor: '#1E88E5',
            borderRadius: '2px',
            ...options
        };
        
        this.container = null;
        this.progressFill = null;
        this.progressText = null;
    }
    
    create() {
        const container = document.createElement('div');
        container.className = 'video-progress-container';
        container.style.cssText = `
            width: 100%;
            height: ${this.options.height};
            background-color: ${this.options.backgroundColor};
            border-radius: ${this.options.borderRadius};
            overflow: hidden;
            position: relative;
        `;
        
        this.progressFill = document.createElement('div');
        this.progressFill.className = 'video-progress-fill';
        this.progressFill.style.cssText = `
            height: 100%;
            width: 0%;
            background-color: ${this.options.progressColor};
            transition: width 0.3s ease;
        `;
        
        this.progressText = document.createElement('div');
        this.progressText.className = 'video-progress-text';
        this.progressText.style.cssText = `
            display: none;
        `;
        
        container.appendChild(this.progressFill);
        container.appendChild(this.progressText);
        this.container = container;
        
        return container;
    }
    
    update(percentage, text) {
        if (this.progressFill) {
            this.progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        }
        if (this.progressText) {
            this.progressText.textContent = text || '';
        }
    }
    
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.progressFill = null;
        this.progressText = null;
    }
}

class VideoInfoPanel {
    constructor(options = {}) {
        this.options = {
            containerSelector: '#danmukuBox',
            ...options
        };
        
        this.container = null;
        this.panelElement = null;
        this.headerElement = null;
        this.bodyElement = null;
        this.footElement = null;
        this.progressBar = null;
        this.videoElement = null;
        this.updateInterval = null;
        this.styles = {
            width: '411px',
            backgroundColor: '#F9F9F9',
            fontSize: '16px',
            fontFamily: 'system-ui, sans-serif'
        };
    }
    
    getStylesFromDanmakuBox() {
        const danmakuBox = document.querySelector(this.options.containerSelector);
        if (danmakuBox) {
            const computedStyle = getComputedStyle(danmakuBox);
            this.styles = {
                width: computedStyle.width || '411px',
                backgroundColor: '#F9F9F9',
                fontSize: computedStyle.fontSize || '16px',
                fontFamily: computedStyle.fontFamily || 'system-ui, sans-serif'
            };
        }
    }
    
    createPanel() {
        const panel = document.createElement('div');
        panel.className = 'video-info-display-panel';
        panel.style.cssText = `
            width: ${this.styles.width};
            background-color: ${this.styles.backgroundColor};
            border-radius: 8px;
            padding: 12px;
            font-family: ${this.styles.fontFamily};
            font-size: ${this.styles.fontSize};
            color: #000000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: ${this.styles.zIndex || '1000'};
            position: ${this.styles.position || 'relative'};
            top: ${this.styles.top || 'auto'};
            left: ${this.styles.left || 'auto'};
        `;
        
        this.panelElement = panel;
        return panel;
    }
    
    createHeader() {
        const header = document.createElement('div');
        header.className = 'video-info-header';
        header.style.cssText = `
            font-weight: bold;
            font-size: 18px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(0,0,0,0.1);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        header.innerHTML = `
            <span>📊</span>
            <span>视频信息</span>
        `;
        
        this.headerElement = header;
        return header;
    }
    
    createBody() {
        const body = document.createElement('div');
        body.className = 'video-info-body';
        body.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
        `;
        
        body.innerHTML = `
            <div class="info-row info-labels">
                <span class="info-label">⏳ 剩余时长</span>
                <span class="info-label">📅 总时长</span>
                <span class="info-label">⚡ 倍速</span>
            </div>
            <div class="info-row info-values">
                <span class="info-value" id="remainingTime">--:--</span>
                <span class="info-value" id="totalTime">--:--</span>
                <span class="info-value" id="playbackSpeed">1.00x</span>
            </div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            .info-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .info-labels {
                opacity: 0.7;
                font-size: 14px;
            }
            .info-values {
                font-weight: 500;
                font-family: monospace;
                font-size: 16px;
            }
            .info-row > span {
                flex: 1;
                text-align: center;
            }
        `;
        body.appendChild(style);
        
        this.bodyElement = body;
        return body;
    }
    
    createFoot() {
        const foot = document.createElement('div');
        foot.className = 'video-info-foot';
        foot.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
        `;
        
        const progressBar = new ProgressBar({
            height: '6px',
            backgroundColor: 'rgba(0,0,0,0.1)',
            progressColor: '#1E88E5'
        });
        this.progressBar = progressBar;
        
        foot.appendChild(progressBar.create());
        this.footElement = foot;
        return foot;
    }
    
    getVideoElement() {
        return document.querySelector('video');
    }
    
    getTotalDuration() {
        return calculateTotalDuration();
    }
    
    updateRemainingTime() {
        if (!this.bodyElement) return;
        const remaining = getRemainingTime() || 0;
        const remainingSpan = this.bodyElement.querySelector('#remainingTime');
        if (remainingSpan) {
            remainingSpan.textContent = formatTime(remaining);
        }
    }
    
    updateTotalTime() {
        if (!this.bodyElement) return;
        const total = this.getTotalDuration();
        const totalSpan = this.bodyElement.querySelector('#totalTime');
        if (totalSpan) {
            totalSpan.textContent = formatTime(total);
        }
    }
    
    updatePlaybackSpeed() {
        if (!this.videoElement || !this.bodyElement) return;
        const speed = this.videoElement.playbackRate || 1;
        const speedSpan = this.bodyElement.querySelector('#playbackSpeed');
        if (speedSpan) {
            speedSpan.textContent = `${speed.toFixed(2)}x`;
        }
    }
    
    updateProgress() {
        if (!this.videoElement || !this.progressBar) return;
        const duration = this.videoElement.duration || 0;
        const currentTime = this.videoElement.currentTime || 0;
        
        if (duration > 0) {
            const percentage = (currentTime / duration) * 100;
            const remaining = getRemainingTime();
            const text = `${Math.floor(percentage)}% (-${formatTime(remaining)})`;
            this.progressBar.update(percentage, text);
        }
    }
    
    updateAll() {
        this.updateRemainingTime();
        this.updateTotalTime();
        this.updatePlaybackSpeed();
        this.updateProgress();
    }
    
    bindVideoEvents() {
        if (!this.videoElement) return;
        
        const handler = {
            timeupdate: () => {
                this.updateRemainingTime();
                this.updateProgress();
            },
            ratechange: () => {
                this.updatePlaybackSpeed();
            },
            loadedmetadata: () => {
                this.updateTotalTime();
                this.updateAll();
            }
        };
        
        this._eventHandlers = handler;
        
        this.videoElement.addEventListener('timeupdate', handler.timeupdate);
        this.videoElement.addEventListener('ratechange', handler.ratechange);
        this.videoElement.addEventListener('loadedmetadata', handler.loadedmetadata);
    }
    
    unbindVideoEvents() {
        if (!this.videoElement || !this._eventHandlers) return;
        
        this.videoElement.removeEventListener('timeupdate', this._eventHandlers.timeupdate);
        this.videoElement.removeEventListener('ratechange', this._eventHandlers.ratechange);
        this.videoElement.removeEventListener('loadedmetadata', this._eventHandlers.loadedmetadata);
        this._eventHandlers = null;
    }
    
    startAutoUpdate() {
        this.stopAutoUpdate();
        
        this.updateInterval = setInterval(() => {
            const currentVideo = this.getVideoElement();
            if (currentVideo !== this.videoElement) {
                this.unbindVideoEvents();
                this.videoElement = currentVideo;
                if (this.videoElement) {
                    this.bindVideoEvents();
                }
            }
            this.updateAll();
        }, 500);
    }
    
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    initialize(container) {
        if (!container) {
            console.warn('[视频信息面板] 容器元素不存在');
            return false;
        }
        
        this.getStylesFromDanmakuBox();
        
        const danmakuWrap = document.querySelector('.danmaku-wrap');
        if (danmakuWrap) {
            const wrapRect = danmakuWrap.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            const relativeTop = wrapRect.top - containerRect.top;
            const relativeLeft = wrapRect.left - containerRect.left;
            
            this.styles.width = `${wrapRect.width}px`;
            this.styles.position = 'absolute';
            this.styles.top = `${relativeTop}px`;
            this.styles.left = `${relativeLeft}px`;
            this.styles.zIndex = '1000';
        }
        
        this.container = container;
        
        const panel = this.createPanel();
        panel.appendChild(this.createHeader());
        panel.appendChild(this.createBody());
        panel.appendChild(this.createFoot());
        
        this.videoElement = this.getVideoElement();
        
        if (this.videoElement) {
            this.bindVideoEvents();
            this.updateAll();
        }
        
        this.startAutoUpdate();
        
        container.appendChild(panel);
        
        return true;
    }
    
    destroy() {
        this.stopAutoUpdate();
        this.unbindVideoEvents();
        
        if (this.progressBar) {
            this.progressBar.destroy();
            this.progressBar = null;
        }
        
        if (this.panelElement && this.panelElement.parentNode) {
            this.panelElement.parentNode.removeChild(this.panelElement);
        }
        
        this.container = null;
        this.panelElement = null;
        this.headerElement = null;
        this.bodyElement = null;
        this.footElement = null;
        this.videoElement = null;
    }
}

export function initVideoInfoDisplay(options = {}) {
    let panel = null;
    let observer = null;
    let currentContainer = null;
    
    function createPanel(container) {
        if (!container) return null;
        
        if (currentContainer === container && panel) {
            return panel;
        }
        
        if (panel) {
            panel.destroy();
        }
        
        const newPanel = new VideoInfoPanel(options);
        const success = newPanel.initialize(container);
        
        if (success) {
            //console.log('[视频信息显示] 面板已创建');
            currentContainer = container;
            return newPanel;
        }
        return null;
    }
    
    function init() {
        const container = document.querySelector('#danmukuBox');
        if (container) {
            panel = createPanel(container);
        } else {
            if (currentContainer) {
                if (panel) {
                    panel.destroy();
                    panel = null;
                }
                currentContainer = null;
            }
        }
    }
    
    function startObserver() {
        if (observer) observer.disconnect();
        observer = new MutationObserver(() => {
            init();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    
    init();
    startObserver();
    
    window.addEventListener('popstate', () => {
        setTimeout(init, 200);
    });
    
    return panel;
}

export default {
    initVideoInfoDisplay,
    VideoInfoPanel,
    ProgressBar
};
