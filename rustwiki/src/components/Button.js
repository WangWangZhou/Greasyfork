// 按钮类
export class Button {
    constructor(options = {}) {
        this.options = {
            className: 'rustwiki-tool-btn',
            html: '',
            title: '',
            onClick: null,
            parent: null,
            ...options
        };
        this.element = null;
        this.create();
    }

    create() {
        this.element = document.createElement('button');
        this.element.className = this.options.className;
        this.element.innerHTML = this.options.html;
        this.element.title = this.options.title;

        if (this.options.onClick) {
            this.element.addEventListener('click', this.options.onClick);
        }

        if (this.options.parent) {
            this.options.parent.appendChild(this.element);
        }

        return this.element;
    }

    show() {
        this.element.style.display = 'flex';
    }

    hide() {
        this.element.style.display = 'none';
    }

    setHtml(html) {
        this.element.innerHTML = html;
    }
}