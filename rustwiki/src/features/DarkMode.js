import { Button } from '../components/Button.js';
import { Storage } from '../utils/Storage.js';

// 暗黑模式管理类
export class DarkMode {
    constructor(options = {}) {
        this.options = {
            storage: new Storage(),
            ...options
        };
        this.darkModeBtn = null;
        this.isDarkMode = false;
    }

    init(parentContainer) {
        // 检查暗黑模式状态
        this.isDarkMode = this.options.storage.get('dark-mode', false);
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
        }

        // 创建暗黑模式按钮
        this.darkModeBtn = new Button({
            html: this.isDarkMode ? '☀️' : '🌙',
            title: '切换暗黑模式',
            parent: parentContainer,
            onClick: () => {
                this.toggle();
            }
        });
    }

    toggle() {
        this.isDarkMode = document.body.classList.toggle('dark-mode');
        this.options.storage.set('dark-mode', this.isDarkMode);
        this.darkModeBtn.setHtml(this.isDarkMode ? '☀️' : '🌙');
    }

    show() {
        if (this.darkModeBtn) {
            this.darkModeBtn.show();
        }
    }

    hide() {
        if (this.darkModeBtn) {
            this.darkModeBtn.hide();
        }
    }

    destroy() {
        if (this.darkModeBtn && this.darkModeBtn.element && this.darkModeBtn.element.parentNode) {
            this.darkModeBtn.element.parentNode.removeChild(this.darkModeBtn.element);
        }
    }
}