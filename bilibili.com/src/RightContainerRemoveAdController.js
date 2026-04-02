/**
 * RightContainerRemoveAdController 类
 * 右侧面板2和视频信息显示
 */
import { globalVariables } from './global.js';
import domObserverManager from './utils/domObserverManager.js';
import { formatSeconds } from './utils/timeUtils.js';

class RightContainerRemoveAdController {
    constructor() {
        this.dropdownNameElement = null;
        this.infoPanel = null;
        this.unsubscribeSpeed = null;
        this.isPanelVisible = false;
        
        this.init = this.init.bind(this);
        this.hideAdElements = this.hideAdElements.bind(this);
        this.findDropdownNameElement = this.findDropdownNameElement.bind(this);
        this.handleDropdownNameClick = this.handleDropdownNameClick.bind(this);
        this.createInfoPanel = this.createInfoPanel.bind(this);
        this.updateInfoPanel = this.updateInfoPanel.bind(this);
        this.showInfoPanel = this.showInfoPanel.bind(this);
        this.hideInfoPanel = this.hideInfoPanel.bind(this);
        this.getPanelContent = this.getPanelContent.bind(this);
        
        this.init();
    }

    init() {
        this.hideAdElements();
        this.setupObserver();
        this.findDropdownNameElement();
        this.subscribeToGlobalVariables();
        
        console.log('RightContainerRemoveAdController 初始化完成');
    }

    hideAdElements() {
        const style = document.createElement('style');
        style.id = 'right-container-ad-hide-style';
        style.textContent = `
            .video-card-ad-small {
                display: none !important;
            }
            .ad-report {
                display: none !important;
            }
        `;
        
        if (!document.getElementById('right-container-ad-hide-style')) {
            document.head.appendChild(style);
        }
        
        console.log('已隐藏广告元素');
    }

    setupObserver() {
        domObserverManager.register('.bui-dropdown-name', () => {
            this.findDropdownNameElement();
        });
        
        domObserverManager.register('.video-card-ad-small', () => {
            this.hideAdElements();
        });
        
        domObserverManager.register('.ad-report', () => {
            this.hideAdElements();
        });
    }

    findDropdownNameElement() {
        const element = document.querySelector(".bui-dropdown-name");
        if (element && element !== this.dropdownNameElement) {
            this.dropdownNameElement = element;
            this.bindClickEvent();
        }
    }

    bindClickEvent() {
        if (!this.dropdownNameElement) return;
        
        this.dropdownNameElement.addEventListener('click', this.handleDropdownNameClick, true);
        console.log('已绑定 .bui-dropdown-name 点击事件');
    }

    handleDropdownNameClick(event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        if (this.isPanelVisible) {
            this.hideInfoPanel();
        } else {
            this.showInfoPanel();
        }
    }

    showInfoPanel() {
        if (!this.infoPanel) {
            this.createInfoPanel();
        }
        
        if (this.infoPanel) {
            this.infoPanel.style.display = 'block';
            this.isPanelVisible = true;
            this.updateInfoPanel();
            console.log('显示视频信息面板');
        }
    }

    hideInfoPanel() {
        if (this.infoPanel) {
            this.infoPanel.style.display = 'none';
            this.isPanelVisible = false;
            console.log('隐藏视频信息面板');
        }
    }

    createInfoPanel() {
        const adElement = document.querySelector('.video-card-ad-small');
        let targetElement = adElement;
        
        if (!targetElement) {
            const rightContainer = document.querySelector('.right-container-inner');
            if (rightContainer) {
                targetElement = rightContainer;
            } else {
                console.warn('未找到合适的位置创建信息面板');
                return;
            }
        }
        
        const panel = document.createElement('div');
        panel.className = 'video-info-panel';
        panel.style.cssText = `
            background-color: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 16px;
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            min-width: 200px;
        `;
        
        panel.innerHTML = this.getPanelContent();
        
        const parent = targetElement.parentNode;
        if (parent) {
            parent.insertBefore(panel, targetElement.nextSibling);
        }
        
        this.infoPanel = panel;
        
        document.addEventListener('click', this.handleClickOutside.bind(this));
    }

    getPanelContent() {
        const totalDuration = formatSeconds(globalVariables.totalDuration);
        const watchedDuration = formatSeconds(globalVariables.watchedDuration);
        const remainingDuration = formatSeconds(globalVariables.remainingDuration);
        const currentSpeed = globalVariables.currentPageSpeed.toFixed(2) + 'x';
        
        return `
            <div style="font-weight: bold; margin-bottom: 12px; font-size: 16px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">
                视频信息
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #aaa;">合集总时长:</span>
                    <span style="font-weight: 500;">${totalDuration}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #aaa;">已看时长:</span>
                    <span style="font-weight: 500;">${watchedDuration}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #aaa;">剩余时长:</span>
                    <span style="font-weight: 500;">${remainingDuration}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #aaa;">当前播放速度:</span>
                    <span id="current-speed-display" style="font-weight: 500; color: #00a1d6;">${currentSpeed}</span>
                </div>
            </div>
        `;
    }

    updateInfoPanel() {
        if (!this.infoPanel || !this.isPanelVisible) return;
        
        this.infoPanel.innerHTML = this.getPanelContent();
    }

    subscribeToGlobalVariables() {
        this.unsubscribeSpeed = globalVariables.subscribe('currentPageSpeed', () => {
            this.updateInfoPanel();
        });
    }

    handleClickOutside(event) {
        if (!this.infoPanel || !this.dropdownNameElement) return;
        
        if (!this.infoPanel.contains(event.target) && 
            !this.dropdownNameElement.contains(event.target)) {
            this.hideInfoPanel();
        }
    }

    destroy() {
        if (this.unsubscribeSpeed) {
            this.unsubscribeSpeed();
            this.unsubscribeSpeed = null;
        }
        
        if (this.dropdownNameElement) {
            this.dropdownNameElement.removeEventListener('click', this.handleDropdownNameClick, true);
        }
        
        document.removeEventListener('click', this.handleClickOutside.bind(this));
        
        if (this.infoPanel && this.infoPanel.parentNode) {
            this.infoPanel.parentNode.removeChild(this.infoPanel);
            this.infoPanel = null;
        }
        
        domObserverManager.unregister('.bui-dropdown-name');
        domObserverManager.unregister('.video-card-ad-small');
        domObserverManager.unregister('.ad-report');
        
        const style = document.getElementById('right-container-ad-hide-style');
        if (style && style.parentNode) {
            style.parentNode.removeChild(style);
        }
        
        console.log('RightContainerRemoveAdController 已销毁');
    }
}

export default RightContainerRemoveAdController;
