/**
 * 卡片类组件
 * 用于显示信息和选项
 */
class Card {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.title - 卡片标题
     * @param {string} options.content - 卡片内容
     * @param {Array} options.buttons - 按钮配置数组
     * @param {string} options.className - 自定义类名
     */
    constructor(options = {}) {
        this.title = options.title || '';
        this.content = options.content || '';
        this.buttons = options.buttons || [];
        this.className = options.className || '';
        this.element = null;
    }

    /**
     * 创建卡片元素
     * @returns {HTMLElement} 卡片元素
     */
    create() {
        const card = document.createElement('div');
        card.className = `card ${this.className}`;
        card.style.cssText = `
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            padding: 20px;
            max-width: 400px;
            margin: 0 auto;
            position: relative;
        `;

        // 添加标题
        if (this.title) {
            const titleElement = document.createElement('h3');
            titleElement.textContent = this.title;
            titleElement.style.cssText = `
                margin-top: 0;
                margin-bottom: 15px;
                color: #18191c;
                font-size: 16px;
                font-weight: bold;
            `;
            card.appendChild(titleElement);
        }

        // 添加内容
        if (this.content) {
            const contentElement = document.createElement('div');
            contentElement.innerHTML = this.content;
            contentElement.style.cssText = `
                margin-bottom: 20px;
                color: #61666d;
                font-size: 14px;
                line-height: 1.5;
            `;
            card.appendChild(contentElement);
        }

        // 添加按钮
        if (this.buttons.length > 0) {
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            `;

            this.buttons.forEach(buttonConfig => {
                const button = new Button(buttonConfig).create();
                buttonContainer.appendChild(button);
            });

            card.appendChild(buttonContainer);
        }

        this.element = card;
        return card;
    }

    /**
     * 显示卡片
     * @param {HTMLElement} container - 容器元素，默认为 document.body
     */
    show(container = document.body) {
        if (!this.element) {
            this.create();
        }

        // 添加遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'card-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;

        // 点击遮罩层关闭卡片
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hide();
            }
        });

        overlay.appendChild(this.element);
        container.appendChild(overlay);

        this.overlay = overlay;
    }

    /**
     * 隐藏卡片
     */
    hide() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
            this.overlay = null;
        }
    }
}

// 导入 Button 类
import Button from './button.js';

export default Card;