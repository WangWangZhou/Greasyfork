/**
 * LeftContainerController
 * 用于在视频播放速度变化时显示速度提示
 */
import globalVariables from './global.js';
import Toast from './components/toast.js';

class LeftContainerController {
    /**
     * 构造函数
     */
    constructor() {
        this.unsubscribeSpeed = null;
        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.subscribeToGlobalVariables();
    }

    /**
     * 订阅全局变量变化
     */
    subscribeToGlobalVariables() {
        // 订阅 currentPageSpeed 变化
        this.unsubscribeSpeed = globalVariables.subscribe('currentPageSpeed', (speed) => {
            Toast.info(`${speed.toFixed(2)}x`, {
                duration: 2000,
                position: 'center'
            });
        });
    }

    /**
     * 销毁
     */
    destroy() {
        // 取消订阅
        if (this.unsubscribeSpeed) {
            this.unsubscribeSpeed();
        }
    }
}

export default LeftContainerController;
