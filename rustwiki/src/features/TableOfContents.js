import { Card } from '../components/Card.js';
import { Button } from '../components/Button.js';
import { Storage } from '../utils/Storage.js';

// 目录导航管理类
export class TableOfContents {
    constructor(options = {}) {
        this.options = {
            width: '250px',
            top: '120px',
            left: '80px',
            shadow: true,
            ...options
        };
        this.storage = new Storage();
        this.tocCard = null;
        this.tocBtn = null;
    }

    init(parentContainer) {
        // 计算卡片位置
        this.calculatePosition();

        // 创建目录卡片
        this.tocCard = new Card({
            title: '文章目录',
            content: '',
            width: this.options.width,
            top: this.options.top,
            left: this.options.left,
            shadow: this.options.shadow,
            storage: this.storage,
            cardState: 'toc-card'
        });

        // 生成目录
        this.generateToc();

        // 创建目录显示/隐藏按钮
        this.tocBtn = new Button({
            html: '📑',
            title: '显示/隐藏目录',
            parent: parentContainer,
            onClick: () => {
                this.toggle();
            }
        });
    }

    calculatePosition() {
        const sidebarDiv = document.querySelector('.sidebar-scrollbox');
        if (sidebarDiv) {
            const sidebarWidth = sidebarDiv.offsetWidth;
            this.options.left = `${sidebarWidth + 20}px`;
        }
    }

    generateToc() {
        const mainContent = document.querySelector('main') || document.querySelector('.book-body') || document.body;
        if (!mainContent) return;
        
        const headings = mainContent.querySelectorAll('h1, h2, h3');
        if (headings.length === 0) return;
        
        const tocList = document.createElement('ul');
        
        headings.forEach((heading, index) => {
            // 为每个标题添加ID
            if (!heading.id) {
                heading.id = `heading-${index}`;
            }
            
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.href = `#${heading.id}`;
            link.textContent = heading.textContent;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.scrollToHeading(heading.id);
            });
            
            if (heading.tagName === 'H3') {
                link.classList.add('toc-h3');
            }
            
            listItem.appendChild(link);
            tocList.appendChild(listItem);
        });
        
        // 更新卡片内容
        this.tocCard.updateContent(tocList.outerHTML);
    }

    scrollToHeading(headingId) {
        const targetElement = document.getElementById(headingId);
        if (targetElement) {
            const menuBar = document.getElementById('menu-bar');
            const menuBarHeight = menuBar ? menuBar.offsetHeight : 80;
            
            const elementTop = targetElement.getBoundingClientRect().top;
            const scrollPosition = window.pageYOffset + elementTop - menuBarHeight - 20;
            
            window.scrollTo({
                top: scrollPosition,
                behavior: 'smooth'
            });
        }
    }

    toggle() {
        this.tocCard.toggle();
    }

    show() {
        if (this.tocBtn) {
            this.tocBtn.show();
        }
    }

    hide() {
        if (this.tocBtn) {
            this.tocBtn.hide();
        }
    }

    destroy() {
        if (this.tocCard) {
            this.tocCard.destroy();
        }
        
        if (this.tocBtn && this.tocBtn.element && this.tocBtn.element.parentNode) {
            this.tocBtn.element.parentNode.removeChild(this.tocBtn.element);
        }
    }
}
