/**
 * 按钮类组件
 * 用于创建按钮元素
 */
class Button {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.text - 按钮文本
     * @param {Function} options.onClick - 点击事件回调
     * @param {string} options.type - 按钮类型：primary, secondary, danger
     * @param {string} options.className - 自定义类名
     */
    constructor(options = {}) {
        this.text = options.text || '按钮';
        this.onClick = options.onClick || null;
        this.type = options.type || 'primary';
        this.className = options.className || '';
    }

    /**
     * 创建按钮元素
     * @returns {HTMLElement} 按钮元素
     */
    create() {
        const button = document.createElement('button');
        button.textContent = this.text;
        button.className = `button ${this.type} ${this.className}`;

        // 设置样式
        const styles = {
            primary: {
                backgroundColor: '#00aeec',
                color: 'white',
                border: 'none'
            },
            secondary: {
                backgroundColor: '#f1f2f3',
                color: '#18191c',
                border: '1px solid #e5e6eb'
            },
            danger: {
                backgroundColor: '#f25d50',
                color: 'white',
                border: 'none'
            }
        };

        const style = styles[this.type] || styles.primary;
        button.style.cssText = `
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
            ${Object.entries(style).map(([prop, value]) => `${prop}: ${value};`).join(' ')}
        `;

        // 添加点击事件
        if (this.onClick) {
            button.addEventListener('click', this.onClick);
        }

        // 添加悬停效果
        button.addEventListener('mouseenter', () => {
            button.style.opacity = '0.8';
        });

        button.addEventListener('mouseleave', () => {
            button.style.opacity = '1';
        });

        return button;
    }
}

export default Button;