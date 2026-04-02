// 导入全局变量
import { globalVariables } from './global.js';
import domObserverManager from './utils/domObserverManager.js';
import { calculateTotalDuration } from './utils/timeUtils.js';

class VideoSpeedController {
    constructor(options = {}) {
        // 默认配置
        this.config = {
            speedStep: globalVariables.speedStep,
            minSpeed: 0.2,
            maxSpeed: 4.0,
            defaultSpeed: 1.0,
            ...options
        };

        // 状态
        this.video = null;
        this.isInitialized = false;
        this.unsubscribeSpeedButtons = null;
        
        // 绑定方法
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleVideoChange = this.handleVideoChange.bind(this);
        this.handleSpeedButtonsChange = this.handleSpeedButtonsChange.bind(this);
        
        // 初始化
        this.init();
    }

    /**
     * 处理按钮配置变化
     * @param {Object} buttons - 新的按钮配置
     */
    handleSpeedButtonsChange(buttons) {
        this.speedOperations = buttons;
        console.log('按钮配置已更新:', buttons);
    }

    // 初始化控制器
    init() {
        if (this.isInitialized) return;
        
        // 初始化速度操作映射
        this.speedOperations = globalVariables.speedButtons;
        
        // 订阅按钮配置变化
        this.unsubscribeSpeedButtons = globalVariables.subscribe('speedButtons', this.handleSpeedButtonsChange);
        
        this.setupVideoObserver();
        this.setupKeyboardListener();
        this.isInitialized = true;
        
        console.log('VideoSpeedController 初始化完成');
    }

    // 设置视频元素观察器（处理动态加载的视频）
    setupVideoObserver() {
        // 立即查找视频
        this.findVideo();
        
        // 如果已经找到视频，不需要注册观察器
        if (this.video) {
            return;
        }
        
        // 使用 DOMObserverManager 注册视频元素观察器
        domObserverManager.register('video', () => {
            this.findVideo();
            // 找到视频后取消注册
            if (this.video) {
                domObserverManager.unregister('video');
            }
        });
    }

    // 查找视频元素
    findVideo() {
        const video = document.querySelector('video');
        if (video && video !== this.video) {
            this.video = video;
            this.handleVideoChange();
        }
    }

    // 视频元素变化时的处理
    handleVideoChange() {
        if (this.video) {
            // 从全局变量获取初始速度
            const initialSpeed = globalVariables.currentPageSpeed;
            this.video.playbackRate = initialSpeed;
            console.log('找到视频元素，设置初始速度:', initialSpeed);
        }
    }

    // 设置键盘监听器
    setupKeyboardListener() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    // 键盘事件处理
    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        
        // 检查是否是可编辑元素
        if (this.isEditableElement(document.activeElement)) {
            return;
        }
        
        // 检查是否是速度控制按键
        if (key in this.speedOperations) {
            event.preventDefault();
            event.stopPropagation();
            this.adjustSpeed(this.speedOperations[key]);
        }
    }

    // 判断是否为可编辑元素
    isEditableElement(element) {
        if (!element) return false;
        
        const tagName = element.tagName.toLowerCase();
        // 输入框、文本域
        if (tagName === 'input' || tagName === 'textarea') {
            return true;
        }
        
        // 富文本编辑器（contenteditable）
        if (element.isContentEditable) {
            return true;
        }
        
        // B站某些特殊输入框可能有 role="textbox" 等属性
        if (element.getAttribute('role') === 'textbox') {
            return true;
        }
        
        return false;
    }

    // 调整播放速度
    adjustSpeed(operation) {
        if (!this.video) {
            console.warn('未找到视频元素');
            return;
        }
        
        let newRate = this.video.playbackRate;
        
        switch (operation.type) {
            case 'set':
                newRate = operation.value;
                break;
            case 'increase':
                newRate += operation.value;
                break;
            case 'decrease':
                newRate -= operation.value;
                break;
        }
        
        // 限制速度范围
        newRate = Math.max(this.config.minSpeed, Math.min(this.config.maxSpeed, newRate));
        
        // 保留两位小数
        newRate = Math.round(newRate * 100) / 100;
        
        // 应用新速度
        this.video.playbackRate = newRate;
        
        // 更新全局变量
        globalVariables.currentPageSpeed = newRate;
        
        return newRate;
    }



    // 设置播放速度（直接设置）
    setSpeed(speed) {
        return this.adjustSpeed({ type: 'set', value: speed });
    }

    // 增加播放速度
    increaseSpeed(step = this.config.speedStep) {
        return this.adjustSpeed({ type: 'increase', value: step });
    }

    // 减少播放速度
    decreaseSpeed(step = this.config.speedStep) {
        return this.adjustSpeed({ type: 'decrease', value: step });
    }

    // 重置播放速度
    resetSpeed() {
        return this.setSpeed(this.config.defaultSpeed);
    }

    // 获取当前播放速度
    getCurrentSpeed() {
        return this.video ? this.video.playbackRate : null;
    }

    // 获取合集总时长（秒）
    getTotalDuration() {
        return calculateTotalDuration();
    }

    // 添加自定义快捷键
    addShortcut(key, operation) {
        this.speedOperations[key.toLowerCase()] = operation;
    }

    // 移除快捷键
    removeShortcut(key) {
        delete this.speedOperations[key.toLowerCase()];
    }

    // 销毁控制器
    destroy() {
        // 取消注册观察器
        domObserverManager.unregister('video');
        
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // 取消订阅
        if (this.unsubscribeSpeedButtons) {
            this.unsubscribeSpeedButtons();
        }
        
        this.isInitialized = false;
        console.log('VideoSpeedController 已销毁');
    }
}

// 导出 VideoSpeedController 类
export default VideoSpeedController;
