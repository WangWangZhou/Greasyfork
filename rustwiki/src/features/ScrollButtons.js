import { Button } from '../components/Button.js';

// 滚动按钮管理类
export class ScrollButtons {
    constructor(options = {}) {
        this.options = {
            topThreshold: 300,
            bottomThreshold: 200,
            ...options
        };
        this.topBtn = null;
        this.bottomBtn = null;
        this.scrollHandler = this.handleScroll.bind(this);
    }

    init(parentContainer) {
        // 创建返回顶部按钮
        this.topBtn = new Button({
            html: '↑',
            title: '返回顶部',
            parent: parentContainer,
            onClick: () => {
                this.scrollToTop();
            }
        });

        // 创建直到底部按钮
        this.bottomBtn = new Button({
            html: '↓',
            title: '直到底部',
            parent: parentContainer,
            onClick: () => {
                this.scrollToBottom();
            }
        });

        // 添加滚动事件监听
        window.addEventListener('scroll', this.scrollHandler);

        // 初始化按钮状态
        this.initButtonStates();
    }

    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    scrollToBottom() {
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    }

    handleScroll() {
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.body.scrollHeight;
        const scrollBottom = scrollTop + windowHeight;

        // 当滚动超过阈值时显示返回顶部按钮，否则隐藏
        if (scrollTop > this.options.topThreshold) {
            this.topBtn.show();
        } else {
            this.topBtn.hide();
        }

        // 当距离底部超过阈值时显示直到底部按钮，否则隐藏
        if (documentHeight - scrollBottom > this.options.bottomThreshold) {
            this.bottomBtn.show();
        } else {
            this.bottomBtn.hide();
        }
    }

    initButtonStates() {
        this.topBtn.hide();
        this.bottomBtn.show();
    }

    destroy() {
        window.removeEventListener('scroll', this.scrollHandler);
        
        if (this.topBtn && this.topBtn.element && this.topBtn.element.parentNode) {
            this.topBtn.element.parentNode.removeChild(this.topBtn.element);
        }
        
        if (this.bottomBtn && this.bottomBtn.element && this.bottomBtn.element.parentNode) {
            this.bottomBtn.element.parentNode.removeChild(this.bottomBtn.element);
        }
    }
}