import { Storage } from '../utils/Storage.js';

// Card组件类
export class Card {
    constructor(options = {}) {
        this.options = {
            title: 'Card',
            content: '',
            footer: '',
            width: '250px',
            height: 'auto',
            top: '100px',
            left: '20px',
            shadow: true,
            storage: null,
            cardState: null,
            visible: true,
            ...options
        };
        this.element = null;
        this.header = null;
        this.body = null;
        this.footer = null;

        // 使用外部存储
        this.storage = this.options.storage;
        this.cardState = this.options.cardState;
        this.visible = this.options.visible;

        // 拖动状态
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.startLeft = 0;
        this.startTop = 0;

        this.create();
        this.initDrag();
        this.loadState();
    }

    create() {
        // 创建卡片容器
        this.element = document.createElement('div');
        this.element.className = 'rustwiki-card';
        this.element.style.position = 'fixed';
        this.element.style.width = this.options.width;
        this.element.style.height = this.options.height;
        this.element.style.zIndex = '9998';
        this.element.style.transition = 'opacity 0.3s ease, box-shadow 0.3s ease';
        this.element.style.borderRadius = '8px';
        this.element.style.overflow = 'hidden';
        if (this.options.shadow) {
            this.element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }

        // 设置初始位置
        this.element.style.top = this.options.top;
        this.element.style.left = this.options.left;

        // 创建头部
        this.header = document.createElement('div');
        this.header.className = 'rustwiki-card-header';
        this.header.style.padding = '12px 15px';
        this.header.style.backgroundColor = '#f3f4f6';
        this.header.style.borderBottom = '1px solid #e5e7eb';
        this.header.style.fontWeight = '600';
        this.header.style.fontSize = '16px';
        this.header.style.cursor = 'move';
        this.header.style.userSelect = 'none';
        this.header.textContent = this.options.title;
        this.element.appendChild(this.header);

        // 创建主体
        this.body = document.createElement('div');
        this.body.className = 'rustwiki-card-body';
        this.body.style.padding = '15px';
        this.body.style.maxHeight = '70vh';
        this.body.style.overflowY = 'auto';
        this.body.style.backgroundColor = 'white';
        this.body.innerHTML = this.options.content;
        this.element.appendChild(this.body);

        // 创建底部
        if (this.options.footer) {
            this.footer = document.createElement('div');
            this.footer.className = 'rustwiki-card-footer';
            this.footer.style.padding = '12px 15px';
            this.footer.style.backgroundColor = '#f9fafb';
            this.footer.style.borderTop = '1px solid #e5e7eb';
            this.footer.innerHTML = this.options.footer;
            this.element.appendChild(this.footer);
        }

        document.body.appendChild(this.element);

        // 设置初始可见性
        if (!this.visible) {
            this.hide();
        }
    }

    initDrag() {
        // 只在头部触发拖动
        this.header.addEventListener('mousedown', this.onMouseDown.bind(this));

        // 全局鼠标事件
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
    }

    onMouseDown(e) {
        this.isDragging = true;
        this.startX = e.clientX;
        this.startY = e.clientY;

        // 获取当前位置
        const rect = this.element.getBoundingClientRect();
        this.startLeft = rect.left;
        this.startTop = rect.top;

        // 提升层级
        this.element.style.zIndex = '9999';
        this.element.style.transition = 'none';

        e.preventDefault();
    }

    onMouseMove(e) {
        if (!this.isDragging) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        const newLeft = this.startLeft + dx;
        const newTop = this.startTop + dy;

        this.element.style.left = `${newLeft}px`;
        this.element.style.top = `${newTop}px`;
    }

    onMouseUp() {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.element.style.zIndex = '9998';
        this.element.style.transition = 'opacity 0.3s ease, box-shadow 0.3s ease';

        // 保存状态
        this.saveState();
    }

    loadState() {
        if (!this.storage || !this.cardState) return;

        const savedState = this.storage.get(this.cardState);
        if (savedState) {
            // 加载位置
            if (savedState.left && savedState.top) {
                this.element.style.left = savedState.left;
                this.element.style.top = savedState.top;
            }
            // 加载可见性
            if (savedState.visible) {
                this.show();
            } else {
                this.hide();
            }
        }
    }

    saveState() {
        if (!this.storage || !this.cardState) return;

        const rect = this.element.getBoundingClientRect();
        this.storage.set(this.cardState, {
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            visible: this.visible
        });
    }

    updateContent(content) {
        if (this.body) {
            this.body.innerHTML = content;
        }
    }

    show() {
        this.element.classList.remove('hidden');
        this.visible = true;
        this.saveState();
    }

    hide() {
        this.element.classList.add('hidden');
        this.visible = false;
        this.saveState();
    }

    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    destroy() {
        document.removeEventListener('mousemove', this.onMouseMove.bind(this));
        document.removeEventListener('mouseup', this.onMouseUp.bind(this));

        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
