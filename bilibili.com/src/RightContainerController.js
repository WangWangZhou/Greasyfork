/**
 * RightContainerController 类
 * 右侧面板1和视频信息显示
 */
import { globalVariables } from './global.js';
import domObserverManager from './utils/domObserverManager.js';
import Popover from './components/popover.js';
import { formatSeconds, calculateTotalDuration } from './utils/timeUtils.js';

class RightContainerController {
    /**
     * 构造函数
     */
    constructor() {
        // 弹出框实例
        this.popover = null;
        
        // 目标元素
        this.dropdownNameElement = null;
        
        // 取消订阅函数
        this.unsubscribeSpeed = null;
        
        // 绑定方法
        this.init = this.init.bind(this);
        this.findDropdownNameElement = this.findDropdownNameElement.bind(this);
        this.updateDropdownName = this.updateDropdownName.bind(this);
        this.createPopover = this.createPopover.bind(this);
        this.updatePopoverContent = this.updatePopoverContent.bind(this);
        this.calculateAndUpdateDuration = this.calculateAndUpdateDuration.bind(this);
        
        // 初始化
        this.init();
    }

    /**
     * 初始化控制器
     */
    init() {
        this.setupObserver();
        // <span class="bui-dropdown-name">弹幕列表</span>
        this.findDropdownNameElement();
        
        // 订阅全局变量变化
        this.subscribeToGlobalVariables();
        
        // 计算并更新总时长
        this.calculateAndUpdateDuration();
        
        console.log('RightContainerController 初始化完成');
    }

    /**
     * 订阅全局变量变化
     */
    subscribeToGlobalVariables() {
        // 订阅 currentPageSpeed 变化
        this.unsubscribeSpeed = globalVariables.subscribe('currentPageSpeed', () => {
            this.updatePopoverContent();
        });
    }

    /**
     * 设置观察器监听 DOM 变化
     */
    setupObserver() {
        // 立即查找目标元素 <span class="bui-dropdown-name">弹幕列表</span>
        this.findDropdownNameElement();
        
        // 使用 DOMObserverManager 注册观察器
        domObserverManager.register('.bui-dropdown-name', () => {
            // <span class="bui-dropdown-name">弹幕列表</span>
            this.findDropdownNameElement();
        });
        
        // 监听时长元素变化，重新计算总时长
        domObserverManager.register('.stat-item.duration', () => {
            this.calculateAndUpdateDuration();
        });
    }

    /**
     * 计算并更新总时长
     */
    calculateAndUpdateDuration() {
        const totalSeconds = calculateTotalDuration();
        if (totalSeconds > 0) {
            globalVariables.totalDuration = totalSeconds;
            this.updateDropdownName();
            this.updatePopoverContent();
        }
    }

    /**
     * 查找 .bui-dropdown-name 元素 
     * <span class="bui-dropdown-name">弹幕列表</span>
     */
    findDropdownNameElement() {
        const element = document.querySelector('.bui-dropdown-name');
        if (element && element !== this.dropdownNameElement) {
            this.dropdownNameElement = element;
            this.updateDropdownName();
            this.createPopover();
        }
    }

    /**
     * 更新 .bui-dropdown-name 元素内容为总时长
     */
    updateDropdownName() {
        if (!this.dropdownNameElement) return;
        
        const totalDurationText = formatSeconds(globalVariables.totalDuration);
        this.dropdownNameElement.textContent = totalDurationText;
        
        console.log('已更新 .bui-dropdown-name 为总时长:', totalDurationText);
    }

    /**
     * 创建弹出框
     */
    createPopover() {
        if (!this.dropdownNameElement) return;
        
        // 销毁已存在的弹出框
        if (this.popover) {
            this.popover.destroy();
        }
        
        // 创建新的弹出框
        this.popover = new Popover(this.dropdownNameElement, {
            content: this.getPopoverContent(),
            placement: 'bottom',
            offset: 8
        });
        
        console.log('已创建弹出框');
    }

    /**
     * 获取弹出框内容
     * @returns {string} 弹出框 HTML 内容
     */
    getPopoverContent() {
        const totalDuration = formatSeconds(globalVariables.totalDuration);
        const watchedDuration = formatSeconds(globalVariables.watchedDuration);
        const remainingDuration = formatSeconds(globalVariables.remainingDuration);
        const currentSpeed = globalVariables.currentPageSpeed.toFixed(2) + 'x';
        
        return `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="font-weight: bold; margin-bottom: 4px;">视频信息</div>
                <div style="display: flex; justify-content: space-between;">
                    <span>合集总时长:</span>
                    <span>${totalDuration}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>已看时长:</span>
                    <span>${watchedDuration}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>剩余时长:</span>
                    <span>${remainingDuration}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>当前播放速度:</span>
                    <span>${currentSpeed}</span>
                </div>
            </div>
        `;
    }

    /**
     * 更新弹出框内容
     */
    updatePopoverContent() {
        if (this.popover) {
            this.popover.updateContent(this.getPopoverContent());
        }
    }

    /**
     * 销毁控制器
     */
    destroy() {
        // 取消订阅
        if (this.unsubscribeSpeed) {
            this.unsubscribeSpeed();
            this.unsubscribeSpeed = null;
        }
        
        // 销毁弹出框
        if (this.popover) {
            this.popover.destroy();
            this.popover = null;
        }
        
        // 取消注册观察器
        domObserverManager.unregister('.bui-dropdown-name');
        domObserverManager.unregister('.stat-item.duration');
        
        console.log('RightContainerController 已销毁');
    }
}

export default RightContainerController;
