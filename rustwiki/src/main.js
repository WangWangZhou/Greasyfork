import { ScrollButtons } from './features/ScrollButtons.js';
import { DarkMode } from './features/DarkMode.js';
import { TableOfContents } from './features/TableOfContents.js';
import './styles.css';

class RustWikiTools {
    constructor() {
        this.toolsContainer = null;
        this.scrollButtons = null;
        this.darkMode = null;
        this.tableOfContents = null;
    }

    // 初始化所有功能
    init() {
        // 创建工具按钮容器，用于放置所有功能按钮
        this.createToolsContainer();
        // 初始化滚动按钮功能（返回顶部/直到底部）
        this.initScrollButtons();
        // 初始化暗黑模式功能
        this.initDarkMode();
        // 初始化目录导航功能
        this.initTableOfContents();
    }

    // 创建工具按钮容器
    createToolsContainer() {
        this.toolsContainer = document.createElement('div');
        this.toolsContainer.className = 'rustwiki-tools';
        document.body.appendChild(this.toolsContainer);
    }

    // 初始化滚动按钮
    initScrollButtons() {
        this.scrollButtons = new ScrollButtons();
        this.scrollButtons.init(this.toolsContainer);
    }

    // 初始化暗黑模式
    initDarkMode() {
        this.darkMode = new DarkMode();
        this.darkMode.init(this.toolsContainer);
    }

    // 初始化目录导航
    initTableOfContents() {
        this.tableOfContents = new TableOfContents();
        this.tableOfContents.init(this.toolsContainer);
    }

    // 销毁所有功能
    destroy() {
        if (this.scrollButtons) {
            this.scrollButtons.destroy();
        }
        if (this.darkMode) {
            this.darkMode.destroy();
        }
        if (this.tableOfContents) {
            this.tableOfContents.destroy();
        }
        if (this.toolsContainer && this.toolsContainer.parentNode) {
            this.toolsContainer.parentNode.removeChild(this.toolsContainer);
        }
    }
}

// 初始化工具
const rustWikiTools = new RustWikiTools();
rustWikiTools.init();