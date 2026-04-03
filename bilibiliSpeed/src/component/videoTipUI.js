/**
 * 视频倍速提示UI组件
 * 功能：
 *   - 在播放器中央显示当前倍速提示
 *   - 支持自定义显示时长
 *   - 自动消失
 */

/**
 * 倍速提示UI组件类
 */
export class VideoTipUI {
    constructor(options = {}) {
        this.options = {
            containerSelector: '.bpx-player-video-wrap, .bpx-player-mini-wrap',
            className: 'bili-custom-speed-tip',
            tipDuration: 500,
            ...options
        };
        
        this.currentTip = null;
        this.hideTimer = null;
    }
    
    /**
     * 查找容器元素
     * @returns {HTMLElement|null}
     */
    findContainer() {
        const selectors = this.options.containerSelector.split(',');
        for (const selector of selectors) {
            const container = document.querySelector(selector.trim());
            if (container) return container;
        }
        return null;
    }
    
    /**
     * 移除已存在的提示
     */
    removeExistingTip() {
        const existingTip = document.querySelector(`.${this.options.className}`);
        if (existingTip) {
            existingTip.remove();
        }
        if (this.currentTip) {
            this.currentTip = null;
        }
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }
    
    /**
     * 创建提示元素
     * @param {number} rate - 当前倍速值
     * @returns {HTMLElement|null}
     */
    createTipElement(rate) {
        const container = this.findContainer();
        if (!container) return null;
        
        this.removeExistingTip();
        
        const tip = document.createElement('div');
        tip.className = this.options.className;
        tip.textContent = `${rate.toFixed(2)}x`;
        
        Object.assign(tip.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            fontSize: '2rem',
            fontWeight: 'bold',
            padding: '12px 24px',
            borderRadius: '8px',
            fontFamily: 'system-ui, sans-serif',
            zIndex: '9999',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        });
        
        container.style.position = 'relative';
        container.appendChild(tip);
        this.currentTip = tip;
        
        return tip;
    }
    
    /**
     * 显示倍速提示
     * @param {number} rate - 当前倍速值
     * @param {number} [duration] - 显示时长（毫秒），可选，默认使用配置值
     * @returns {boolean} 是否成功显示
     */
    show(rate, duration) {
        const tipDuration = duration || this.options.tipDuration;
        
        const tip = this.createTipElement(rate);
        if (!tip) return false;
        
        this.hideTimer = setTimeout(() => {
            this.hide();
        }, tipDuration);
        
        return true;
    }
    
    /**
     * 隐藏提示
     */
    hide() {
        if (this.currentTip && this.currentTip.parentNode) {
            this.currentTip.remove();
        }
        this.currentTip = null;
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }
    
    /**
     * 销毁组件
     */
    destroy() {
        this.hide();
    }
}

/**
 * 创建倍速提示UI实例
 * @param {Object} options - 配置选项
 * @returns {VideoTipUI} VideoTipUI 实例
 */
export function createVideoTipUI(options = {}) {
    return new VideoTipUI(options);
}

export default VideoTipUI;
