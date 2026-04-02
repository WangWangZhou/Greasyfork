// 导入 Storage 类和 EventBus 类
import Storage from './utils/storage.js';
import EventBus from './utils/eventBus.js';

// 默认配置
const DEFAULT_CONFIG = {
    speedStep: 0.05,
    speedEnabled: true,
    timeEnabled: true,
    currentPageSpeed: 1.0,
    speedButtons: {
        'z': { type: 'set', value: 1.0 },
        'x': { type: 'decrease', value: 0.05 },
        'c': { type: 'increase', value: 0.05 }
    }
};

// 全局变量
// 倍速步长，用于调整播放速度的增量
let speedStep = DEFAULT_CONFIG.speedStep;
// 倍速功能开关，控制是否启用倍速调节功能
let speedEnabled = DEFAULT_CONFIG.speedEnabled;
// 时间信息功能开关，控制是否显示视频时长信息
let timeEnabled = DEFAULT_CONFIG.timeEnabled;
// 当前页面视频的播放速度
let currentPageSpeed = DEFAULT_CONFIG.currentPageSpeed;
// 倍速按钮配置，定义不同按键对应的速度调节行为
let speedButtons = DEFAULT_CONFIG.speedButtons;
// 合集总时长（秒）
let totalDuration = 0;
// 已看时长（秒）
let watchedDuration = 0;
// 剩余时长（秒），计算方式：totalDuration - watchedDuration
let remainingDuration = 0;

// 创建事件总线实例
const eventBus = new EventBus();

// 初始化全局变量
function initGlobalVariables() {
    // 尝试从 GM_getValue 获取值，如果没有则使用默认值
    try {
        if (typeof GM_getValue !== 'undefined') {
            speedStep = GM_getValue("speedStep", DEFAULT_CONFIG.speedStep);
            speedEnabled = GM_getValue("speedEnabled", DEFAULT_CONFIG.speedEnabled);
            timeEnabled = GM_getValue("timeEnabled", DEFAULT_CONFIG.timeEnabled);
            currentPageSpeed = GM_getValue("currentPageSpeed", DEFAULT_CONFIG.currentPageSpeed);
            speedButtons = GM_getValue("speedButtons", DEFAULT_CONFIG.speedButtons);
        } else {
            // 如果 GM_getValue 不存在，尝试从 localStorage 获取
            const storage = new Storage('bilibili_');
            speedStep = storage.get('speedStep', DEFAULT_CONFIG.speedStep);
            speedEnabled = storage.get('speedEnabled', DEFAULT_CONFIG.speedEnabled);
            timeEnabled = storage.get('timeEnabled', DEFAULT_CONFIG.timeEnabled);
            currentPageSpeed = storage.get('currentPageSpeed', DEFAULT_CONFIG.currentPageSpeed);
            speedButtons = storage.get('speedButtons', DEFAULT_CONFIG.speedButtons);
        }
    } catch (error) {
        console.error('获取全局变量失败:', error);
        // 发生错误时使用默认值
        speedStep = DEFAULT_CONFIG.speedStep;
        speedEnabled = DEFAULT_CONFIG.speedEnabled;
        timeEnabled = DEFAULT_CONFIG.timeEnabled;
        currentPageSpeed = DEFAULT_CONFIG.currentPageSpeed;
        speedButtons = DEFAULT_CONFIG.speedButtons;
    }

    // 注册菜单项
    registerMenuCommands();
}

// 注册菜单项
function registerMenuCommands() {
    try {
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand("设置倍速步长", showSpeedStepCard);
            GM_registerMenuCommand("启用/禁用倍速视频功能", toggleSpeedEnabled);
            GM_registerMenuCommand("启用/禁用展示时间信息功能", toggleTimeEnabled);
        }
    } catch (error) {
        console.error('注册菜单项失败:', error);
    }
}

// 显示倍速步长选择卡片
function showSpeedStepCard() {
    // 导入 Card 组件
    import('./components/card.js').then(({ default: Card }) => {
        import('./components/button.js').then(({ default: Button }) => {
            const speedOptions = [0.05, 0.1, 0.2, 0.5];
            
            // 构建选项内容
            let content = '<div style="margin-bottom: 15px;"><strong>选择倍速步长：</strong></div>';
            speedOptions.forEach(option => {
                const isSelected = speedStep === option;
                content += `
                    <div style="margin-bottom: 10px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="speedStep" value="${option}" ${isSelected ? 'checked' : ''} style="margin-right: 8px;">
                            <span>${option}</span>
                        </label>
                    </div>
                `;
            });
            
            // 创建卡片
            const card = new Card({
                title: '设置倍速步长',
                content: content,
                buttons: [
                    {
                        text: '取消',
                        type: 'secondary',
                        onClick: () => card.hide()
                    },
                    {
                        text: '确定',
                        type: 'primary',
                        onClick: () => {
                            const selectedOption = document.querySelector('input[name="speedStep"]:checked');
                            if (selectedOption) {
                                const newSpeedStep = parseFloat(selectedOption.value);
                                speedStep = newSpeedStep;
                                // 通知订阅者
                                eventBus.publish('speedStep', newSpeedStep);
                                // 保存到 GM_setValue
                                try {
                                    if (typeof GM_setValue !== 'undefined') {
                                        GM_setValue("speedStep", speedStep);
                                    }
                                    // 保存到 localStorage
                                    const storage = new Storage('bilibili_');
                                    storage.set('speedStep', speedStep);
                                } catch (error) {
                                    console.error('保存倍速步长失败:', error);
                                }
                                card.hide();
                            }
                        }
                    }
                ]
            });
            
            card.show();
        });
    });
}

// 切换倍速功能状态
function toggleSpeedEnabled() {
    speedEnabled = !speedEnabled;
    // 通知订阅者
    eventBus.publish('speedEnabled', speedEnabled);
    // 保存到 GM_setValue
    try {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue("speedEnabled", speedEnabled);
        }
        // 保存到 localStorage
        const storage = new Storage('bilibili_');
        storage.set('speedEnabled', speedEnabled);
    } catch (error) {
        console.error('保存倍速功能状态失败:', error);
    }
    // 显示状态
    showToast(speedEnabled ? '倍速功能已启用' : '倍速功能已禁用');
}

// 切换时间信息功能状态
function toggleTimeEnabled() {
    timeEnabled = !timeEnabled;
    // 通知订阅者
    eventBus.publish('timeEnabled', timeEnabled);
    // 保存到 GM_setValue
    try {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue("timeEnabled", timeEnabled);
        }
        // 保存到 localStorage
        const storage = new Storage('bilibili_');
        storage.set('timeEnabled', timeEnabled);
    } catch (error) {
        console.error('保存时间信息功能状态失败:', error);
    }
    // 显示状态
    showToast(timeEnabled ? '时间信息功能已启用' : '时间信息功能已禁用');
}

// 显示提示信息
function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        z-index: 10000;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 300);
    }, 2000);
}

// 更新当前页面速度
function updateCurrentPageSpeed(speed) {
    currentPageSpeed = speed;
    // 通知订阅者
    eventBus.publish('currentPageSpeed', speed);
    // 保存到 GM_setValue
    try {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue("currentPageSpeed", currentPageSpeed);
        }
        // 保存到 localStorage
        const storage = new Storage('bilibili_');
        storage.set('currentPageSpeed', currentPageSpeed);
    } catch (error) {
        console.error('保存当前页面速度失败:', error);
    }
}

// 更新总时长
function updateTotalDuration(seconds) {
    totalDuration = seconds;
    // 更新剩余时长
    remainingDuration = totalDuration - watchedDuration;
    // 通知订阅者
    eventBus.publish('totalDuration', totalDuration);
    eventBus.publish('remainingDuration', remainingDuration);
}

// 更新已看时长
function updateWatchedDuration(seconds) {
    watchedDuration = seconds;
    // 更新剩余时长
    remainingDuration = totalDuration - watchedDuration;
    // 通知订阅者
    eventBus.publish('watchedDuration', watchedDuration);
    eventBus.publish('remainingDuration', remainingDuration);
}

// 导出
const globalVariables = {
    get speedStep() {
        return speedStep;
    },
    get speedEnabled() {
        return speedEnabled;
    },
    get timeEnabled() {
        return timeEnabled;
    },
    get currentPageSpeed() {
        return currentPageSpeed;
    },
    set currentPageSpeed(value) {
        updateCurrentPageSpeed(value);
    },
    get speedButtons() {
        return speedButtons;
    },
    set speedButtons(value) {
        speedButtons = value;
        // 通知订阅者
        eventBus.publish('speedButtons', value);
        // 保存到存储
        try {
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue("speedButtons", speedButtons);
            }
            // 保存到 localStorage
            const storage = new Storage('bilibili_');
            storage.set('speedButtons', speedButtons);
        } catch (error) {
            console.error('保存按钮配置失败:', error);
        }
    },
    // 时长相关 getter 和 setter
    get totalDuration() {
        return totalDuration;
    },
    set totalDuration(value) {
        updateTotalDuration(value);
    },
    get watchedDuration() {
        return watchedDuration;
    },
    set watchedDuration(value) {
        updateWatchedDuration(value);
    },
    get remainingDuration() {
        return remainingDuration;
    },
    initGlobalVariables,
    showSpeedStepCard,
    toggleSpeedEnabled,
    toggleTimeEnabled,
    updateCurrentPageSpeed,
    updateTotalDuration,
    updateWatchedDuration,
    subscribe: (event, callback) => eventBus.subscribe(event, callback),
    publish: (event, data) => eventBus.publish(event, data)
};

export { globalVariables };
export default globalVariables;
