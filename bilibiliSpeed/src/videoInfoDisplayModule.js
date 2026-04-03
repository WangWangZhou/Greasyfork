import { 
    formatTime, 
    calculateTotalDuration, 
    getRemainingTime
} from './utils/timeUtil.js';

class IconCard {
    constructor(options = {}) {
        this.options = {
            icon: '📊',
            size: '40px',
            backgroundColor: '#F9F9F9',
            ...options
        };
        
        this.element = null;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.position = { x: 100, y: 100 };
        this.onShowPanel = null;
        this.clickTimer = null;
        this.clickCount = 0;
        this.hasDragged = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
    }
    
    create() {
        const card = document.createElement('div');
        card.className = 'video-info-icon-card';
        card.style.cssText = `
            width: ${this.options.size};
            height: ${this.options.size};
            background-color: ${this.options.backgroundColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 1001;
            position: fixed;
            user-select: none;
            transition: transform 0.1s ease;
        `;
        
        card.textContent = this.options.icon;
        
        this.element = card;
        this.bindEvents();
        this.setPosition(this.position.x, this.position.y);
        
        return card;
    }
    
    bindEvents() {
        if (!this.element) return;
        
        this.element.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.hasDragged = false;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.dragOffsetX = e.clientX - this.position.x;
            this.dragOffsetY = e.clientY - this.position.y;
            this.element.style.transform = 'scale(0.95)';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            const moveX = Math.abs(e.clientX - this.dragStartX);
            const moveY = Math.abs(e.clientY - this.dragStartY);
            
            if (moveX > 5 || moveY > 5) {
                this.hasDragged = true;
            }
            
            const x = e.clientX - this.dragOffsetX;
            const y = e.clientY - this.dragOffsetY;
            this.setPosition(x, y);
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.element.style.transform = 'scale(1)';
            }
        });
        
        this.element.addEventListener('click', (e) => {
            if (this.hasDragged) return;
            
            this.clickCount++;
            
            if (this.clickCount === 1) {
                this.clickTimer = setTimeout(() => {
                    this.clickCount = 0;
                }, 300);
            } else if (this.clickCount === 2) {
                clearTimeout(this.clickTimer);
                this.clickCount = 0;
                if (this.onShowPanel) {
                    this.onShowPanel(this.position);
                }
            }
        });
    }
    
    setPosition(x, y) {
        this.position = { x, y };
        if (this.element) {
            this.element.style.left = `${x}px`;
            this.element.style.top = `${y}px`;
        }
    }
    
    show() {
        if (this.element) {
            this.element.style.display = 'flex';
        }
    }
    
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
    
    destroy() {
        if (this.clickTimer) {
            clearTimeout(this.clickTimer);
            this.clickTimer = null;
        }
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.onShowPanel = null;
    }
}

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
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.iconCard = null;
        this.isPanelVisible = true;
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
            justify-content: space-between;
            gap: 8px;
        `;
        
        header.innerHTML = `
            <div class="header-left">
                <span>📊</span>
                <span>视频信息</span>
            </div>
            <div class="header-center" style="flex: 1; cursor: move; min-height: 20px;"></div>
            <div class="header-right" style="cursor: pointer; user-select: none; font-size: 20px; padding: 4px 8px; border-radius: 4px; transition: background-color 0.2s;">
                <span style="display: inline-block; transform: rotate(180deg);">❮</span>
            </div>
        `;
        
        this.headerElement = header;
        this.bindHeaderEvents(header);
        return header;
    }
    
    bindHeaderEvents(header) {
        const right = header.querySelector('.header-right');
        
        if (this._headerEventHandlers) {
            document.removeEventListener('mousemove', this._headerEventHandlers.mousemove);
            document.removeEventListener('mouseup', this._headerEventHandlers.mouseup);
        }
        
        this._headerEventHandlers = {
            mousemove: (e) => {
                if (!this.isDragging) return;
                const x = e.clientX - this.dragOffsetX;
                const y = e.clientY - this.dragOffsetY;
                this.panelElement.style.left = `${x}px`;
                this.panelElement.style.top = `${y}px`;
            },
            mouseup: () => {
                this.isDragging = false;
            }
        };
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.header-right')) return;
            
            this.isDragging = true;
            const rect = this.panelElement.getBoundingClientRect();
            this.dragOffsetX = e.clientX - rect.left;
            this.dragOffsetY = e.clientY - rect.top;
            this.panelElement.style.position = 'fixed';
            this.panelElement.style.left = `${rect.left}px`;
            this.panelElement.style.top = `${rect.top}px`;
            e.preventDefault();
        });
        
        if (right) {
            right.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hidePanel();
            });
            
            right.addEventListener('mouseenter', () => {
                right.style.backgroundColor = 'rgba(0,0,0,0.1)';
            });
            
            right.addEventListener('mouseleave', () => {
                right.style.backgroundColor = 'transparent';
            });
        }
        
        document.addEventListener('mousemove', this._headerEventHandlers.mousemove);
        document.addEventListener('mouseup', this._headerEventHandlers.mouseup);
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
            .header-left {
                display: flex;
                align-items: center;
                gap: 8px;
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
    
    hidePanel() {
        if (this.panelElement) {
            const rect = this.panelElement.getBoundingClientRect();
            this.panelElement.style.display = 'none';
            
            if (this.iconCard) {
                this.iconCard.setPosition(rect.left, rect.top);
                this.iconCard.show();
            }
        }
        this.isPanelVisible = false;
    }
    
    showPanel(iconPosition) {
        if (this.panelElement) {
            this.panelElement.style.display = 'flex';
            this.panelElement.style.position = 'fixed';
            
            let x, y;
            const panelWidth = this.panelElement.offsetWidth || 411;
            const panelHeight = this.panelElement.offsetHeight || 200;
            
            if (iconPosition) {
                x = iconPosition.x;
                y = iconPosition.y;
                
                if (x + panelWidth > window.innerWidth) {
                    x = window.innerWidth - panelWidth - 10;
                }
                if (y + panelHeight > window.innerHeight) {
                    y = window.innerHeight - panelHeight - 20;
                }
                if (x < 10) x = 10;
                if (y < 10) y = 10;
            } else {
                x = 100;
                y = 100;
            }
            
            this.panelElement.style.left = `${x}px`;
            this.panelElement.style.top = `${y}px`;
        }
        this.isPanelVisible = true;
        if (this.iconCard) {
            this.iconCard.hide();
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
        
        this.iconCard = new IconCard();
        this.iconCard.onShowPanel = (pos) => {
            this.showPanel(pos);
        };
        document.body.appendChild(this.iconCard.create());
        this.iconCard.hide();
        this.isPanelVisible = true;
        
        return true;
    }
    
    destroy() {
        this.stopAutoUpdate();
        this.unbindVideoEvents();
        
        if (this._headerEventHandlers) {
            document.removeEventListener('mousemove', this._headerEventHandlers.mousemove);
            document.removeEventListener('mouseup', this._headerEventHandlers.mouseup);
            this._headerEventHandlers = null;
        }
        
        if (this.iconCard) {
            this.iconCard.destroy();
            this.iconCard = null;
        }
        
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
    ProgressBar,
    IconCard
};
