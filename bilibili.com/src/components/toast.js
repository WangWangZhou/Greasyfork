/**
 * Toast 组件
 * 用于显示播放速度变化提示
 */
class Toast {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.message - 提示信息
     * @param {number} options.duration - 显示时长（毫秒）
     * @param {string} options.position - 显示位置：center
     */
    constructor(options = {}) {
        this.message = options.message || '';
        this.duration = options.duration || 2000;
        this.position = options.position || 'center';
        this.element = null;
        this.timer = null;
    }

    /**
     * 创建 Toast 元素
     * @returns {HTMLElement} Toast 元素
     */
    create() {
        const toast = document.createElement('div');
        toast.className = `toast toast-${this.position}`;
        
        // 样式
        toast.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.6);
            color: rgba(255, 255, 255, 0.9);
            font-size: 48px;
            font-weight: bold;
            padding: 20px 40px;
            border-radius: 12px;
            z-index: 1000;
            animation: speedToastFadeIn 0.3s ease-out, speedToastFadeOut 0.3s ease-out 1.7s;
            pointer-events: none;
            backdrop-filter: blur(10px);
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        `;
        
        // 添加文本
        toast.textContent = this.message;
        
        // 添加动画样式
        this.addAnimationStyles();
        
        this.element = toast;
        return toast;
    }

    /**
     * 添加动画样式
     */
    addAnimationStyles() {
        // 检查是否已经添加了动画样式
        if (!document.getElementById('toast-animations')) {
            const style = document.createElement('style');
            style.id = 'toast-animations';
            style.textContent = `
                @keyframes speedToastFadeIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.8);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }
                @keyframes speedToastFadeOut {
                    from {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.8);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * 显示 Toast
     * @param {HTMLElement} container - 容器元素
     */
    show(container) {
        if (!container) return;
        
        if (!this.element) {
            this.create();
        }
        
        // 添加到容器
        container.appendChild(this.element);
        
        // 设置自动隐藏
        this.timer = setTimeout(() => {
            this.hide();
        }, this.duration);
        
        return this;
    }

    /**
     * 隐藏 Toast
     */
    hide() {
        if (!this.element) return;
        
        // 清除定时器
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        
        // 动画结束后移除元素
        setTimeout(() => {
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
                this.element = null;
            }
        }, 300);
    }

    /**
     * 静态方法：显示速度提示
     * @param {string} message - 提示信息
     * @param {Object} options - 配置选项
     * @returns {Toast} Toast 实例
     */
    static info(message, options = {}) {
        const toast = new Toast({ ...options, message });
        const container = toast.findVideoContainer();
        if (container) {
            toast.show(container);
        }
        return toast;
    }

    /**
     * 找到视频容器元素
     * @returns {HTMLElement|null} 视频容器元素
     */
    findVideoContainer() {
        // 优先查找正常视频容器
        const normalContainer = document.querySelector('.bpx-player-video-wrap');
        if (normalContainer) {
            return normalContainer;
        }
        
        // 查找小窗视频容器
        const miniContainer = document.querySelector('.bpx-player-mini-warp');
        if (miniContainer) {
            return miniContainer;
        }
        
        return null;
    }
}

export default Toast;
