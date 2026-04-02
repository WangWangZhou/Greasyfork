/**
 * Popover 组件
 * 用于显示弹出信息框
 * 支持四种触发方式：hover（默认）、click、focus、manual
 */
class Popover {
    /**
     * 构造函数
     * @param {HTMLElement} triggerElement - 触发元素
     * @param {Object} options - 配置选项
     */
    constructor(triggerElement, options = {}) {
        this.triggerElement = triggerElement;
        this.options = {
            content: '',
            placement: 'top',
            offset: 10,
            trigger: 'hover', // 触发方式：'hover' | 'click' | 'focus' | 'manual'
            ...options
        };
        
        this.popoverElement = null;
        this.isVisible = false;
        
        // 绑定方法
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.toggle = this.toggle.bind(this);
        this.handleMouseEnter = this.handleMouseEnter.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        
        this.init();
    }
    
    /**
     * 初始化
     */
    init() {
        if (!this.triggerElement) return;
        
        // 创建弹出框元素
        this.createPopover();
        
        // 根据触发方式添加事件监听器
        this.bindEvents();
    }
    
    /**
     * 根据触发方式绑定事件
     */
    bindEvents() {
        const { trigger } = this.options;
        
        switch (trigger) {
            case 'hover':
                this.triggerElement.addEventListener('mouseenter', this.handleMouseEnter);
                this.triggerElement.addEventListener('mouseleave', this.handleMouseLeave);
                break;
            case 'click':
                this.triggerElement.addEventListener('click', this.handleClick);
                break;
            case 'focus':
                this.triggerElement.addEventListener('focus', this.handleFocus);
                this.triggerElement.addEventListener('blur', this.handleBlur);
                break;
            case 'manual':
                // 手动模式不绑定任何事件
                break;
            default:
                // 默认使用 hover
                this.triggerElement.addEventListener('mouseenter', this.handleMouseEnter);
                this.triggerElement.addEventListener('mouseleave', this.handleMouseLeave);
        }
    }
    
    /**
     * 解绑所有事件
     */
    unbindEvents() {
        if (!this.triggerElement) return;
        
        this.triggerElement.removeEventListener('mouseenter', this.handleMouseEnter);
        this.triggerElement.removeEventListener('mouseleave', this.handleMouseLeave);
        this.triggerElement.removeEventListener('click', this.handleClick);
        this.triggerElement.removeEventListener('focus', this.handleFocus);
        this.triggerElement.removeEventListener('blur', this.handleBlur);
    }
    
    /**
     * 创建弹出框元素
     */
    createPopover() {
        // 清理已存在的弹出框
        this.destroyPopover();
        
        // 创建弹出框容器
        const popover = document.createElement('div');
        popover.className = 'video-info-popover';
        popover.style.position = 'fixed';
        popover.style.zIndex = '9999';
        popover.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        popover.style.color = '#fff';
        popover.style.padding = '12px';
        popover.style.borderRadius = '6px';
        popover.style.fontSize = '14px';
        popover.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        popover.style.pointerEvents = 'none';
        popover.style.opacity = '0';
        popover.style.transition = 'opacity 0.2s ease';
        popover.style.minWidth = '200px';
        
        // 设置内容
        popover.innerHTML = this.options.content;
        
        // 添加到文档
        document.body.appendChild(popover);
        
        this.popoverElement = popover;
    }
    
    /**
     * 更新弹出框内容
     * @param {string} content - 新的内容
     */
    updateContent(content) {
        this.options.content = content;
        if (this.popoverElement) {
            this.popoverElement.innerHTML = content;
        }
    }
    
    /**
     * 切换弹出框显示/隐藏
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    /**
     * 显示弹出框
     */
    show() {
        if (!this.popoverElement || this.isVisible) return;
        
        // 计算位置
        this.positionPopover();
        
        // 显示弹出框
        this.popoverElement.style.opacity = '1';
        this.isVisible = true;
        
        // 对于 click 触发方式，添加点击外部关闭事件
        if (this.options.trigger === 'click') {
            setTimeout(() => {
                document.addEventListener('click', this.handleClickOutside);
            }, 100);
        }
    }
    
    /**
     * 隐藏弹出框
     */
    hide() {
        if (!this.popoverElement || !this.isVisible) return;
        
        this.popoverElement.style.opacity = '0';
        this.isVisible = false;
        
        // 移除点击外部关闭事件
        document.removeEventListener('click', this.handleClickOutside);
    }
    
    /**
     * 计算并设置弹出框位置
     */
    positionPopover() {
        if (!this.popoverElement || !this.triggerElement) return;
        
        // 查找 .bui-collapse-header 元素作为定位基准
        const collapseHeader = this.triggerElement.closest('.bui-collapse-header');
        const baseElement = collapseHeader || this.triggerElement;
        const baseRect = baseElement.getBoundingClientRect();
        const popoverRect = this.popoverElement.getBoundingClientRect();
        
        let top, left;
        
        // 使用 .bui-collapse-header 的 left 和 bottom 作为弹出框位置
        left = baseRect.left;
        top = baseRect.bottom + this.options.offset;
        
        // 调整位置，确保在视口内
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (left < 0) left = 10;
        if (left + popoverRect.width > viewportWidth) {
            left = viewportWidth - popoverRect.width - 10;
        }
        if (top < 0) top = 10;
        if (top + popoverRect.height > viewportHeight) {
            top = viewportHeight - popoverRect.height - 10;
        }
        
        this.popoverElement.style.top = `${top}px`;
        this.popoverElement.style.left = `${left}px`;
    }
    
    /**
     * 鼠标进入触发元素
     */
    handleMouseEnter() {
        this.show();
    }
    
    /**
     * 鼠标离开触发元素
     */
    handleMouseLeave() {
        this.hide();
    }
    
    /**
     * 点击触发元素
     * @param {Event} event - 点击事件
     */
    handleClick(event) {
        event.stopPropagation();
        this.toggle();
    }
    
    /**
     * 获得焦点
     */
    handleFocus() {
        this.show();
    }
    
    /**
     * 失去焦点
     */
    handleBlur() {
        this.hide();
    }
    
    /**
     * 点击外部关闭弹出框
     * @param {Event} event - 点击事件
     */
    handleClickOutside(event) {
        if (!this.triggerElement.contains(event.target) && 
            this.popoverElement && !this.popoverElement.contains(event.target)) {
            this.hide();
        }
    }
    
    /**
     * 销毁弹出框
     */
    destroyPopover() {
        if (this.popoverElement && document.body.contains(this.popoverElement)) {
            document.body.removeChild(this.popoverElement);
            this.popoverElement = null;
        }
    }
    
    /**
     * 销毁组件
     */
    destroy() {
        // 解绑事件监听器
        this.unbindEvents();
        
        // 销毁弹出框
        this.destroyPopover();
        
        // 移除点击外部关闭事件
        document.removeEventListener('click', this.handleClickOutside);
    }
}

export default Popover;