// ==UserScript==
// @name         Rust Wiki 工具按钮
// @namespace    http://tampermonkey.net/
// @version      v0.0.1
// @description  添加返回顶部、直到底部、暗黑模式按钮和目录导航
// @description:zh-cn  添加返回顶部、直到底部、暗黑模式按钮和目录导航
// @author       小明
// @license MIT
// @match        https://www.rustwiki.org.cn/zh-CN/*
// @match        https://www.rustwiki.org.cn/en/*
// @match        https://rustwiki.org/zh-CN/*
// @match        https://rustwiki.org/en/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rustwiki.org.cn
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Card组件类
    class Card {
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
                ...options
            };
            this.element = null;
            this.header = null;
            this.body = null;
            this.footer = null;
            this.isDragging = false;
            this.startX = 0;
            this.startY = 0;
            this.startLeft = 0;
            this.startTop = 0;
            this.create();
            this.initDrag();
        }

        create() {
            // 创建卡片容器
            this.element = document.createElement('div');
            this.element.className = 'rustwiki-card';
            this.element.style.position = 'fixed';
            this.element.style.width = this.options.width;
            this.element.style.height = this.options.height;
            this.element.style.top = this.options.top;
            this.element.style.left = this.options.left;
            this.element.style.zIndex = '9998';
            this.element.style.transition = 'all 0.3s ease';
            this.element.style.borderRadius = '8px';
            this.element.style.overflow = 'hidden';
            if (this.options.shadow) {
                this.element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }

            // 创建头部
            this.header = document.createElement('div');
            this.header.className = 'rustwiki-card-header';
            this.header.style.padding = '12px 15px';
            this.header.style.backgroundColor = '#f3f4f6';
            this.header.style.borderBottom = '1px solid #e5e7eb';
            this.header.style.fontWeight = '600';
            this.header.style.fontSize = '16px';
            this.header.style.cursor = 'move';
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
        }

        // 节流函数
        throttle(func, limit) {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            }
        }

        initDrag() {
            const draggableElements = [this.header, this.body];
            
            draggableElements.forEach(element => {
                element.addEventListener('mousedown', (e) => {
                    this.startDrag(e);
                });
            });

            // 使用节流函数优化mousemove事件处理
            const throttledDrag = this.throttle((e) => {
                this.drag(e);
            }, 20); // 约60fps

            document.addEventListener('mousemove', throttledDrag);

            document.addEventListener('mouseup', () => {
                this.stopDrag();
            });

            // 处理鼠标离开窗口的情况
            document.addEventListener('mouseleave', () => {
                this.stopDrag();
            });
        }

        startDrag(e) {
            this.isDragging = true;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.startLeft = parseInt(this.element.style.left) || 0;
            this.startTop = parseInt(this.element.style.top) || 0;
            this.element.style.zIndex = '9999';
            // 禁用文本选择
            document.body.style.userSelect = 'none';
        }

        drag(e) {
            if (!this.isDragging) return;
            
            // 使用requestAnimationFrame优化动画
            requestAnimationFrame(() => {
                const dx = e.clientX - this.startX;
                const dy = e.clientY - this.startY;
                this.element.style.left = `${this.startLeft + dx}px`;
                this.element.style.top = `${this.startTop + dy}px`;
            });
        }

        stopDrag() {
            this.isDragging = false;
            this.element.style.zIndex = '9998';
            // 恢复文本选择
            document.body.style.userSelect = '';
        }

        updateContent(content) {
            if (this.body) {
                this.body.innerHTML = content;
            }
        }

        show() {
            this.element.classList.remove('hidden');
        }

        hide() {
            this.element.classList.add('hidden');
        }

        toggle() {
            this.element.classList.toggle('hidden');
        }
    }

    // 存储类
    class Storage {
        constructor(prefix = 'rustwiki-') {
            this.prefix = prefix;
        }

        get(key, defaultValue = null) {
            const value = localStorage.getItem(this.prefix + key);
            if (value === null) return defaultValue;
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }

        set(key, value) {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
        }

        remove(key) {
            localStorage.removeItem(this.prefix + key);
        }

        clear() {
            Object.keys(localStorage)
                .filter(key => key.startsWith(this.prefix))
                .forEach(key => localStorage.removeItem(key));
        }
    }

    // 按钮类
    class Button {
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

    class RustWikiTools {
        constructor() {
            this.toolsContainer = null;
            this.topBtn = null;
            this.bottomBtn = null;
            this.darkModeBtn = null;
            this.tocBtn = null;
            this.tocCard = null;
            this.tocVisible = true;
            this.storage = new Storage();
        }

        // 初始化所有功能
        init() {
            this.addStyles();
            this.createToolsContainer();
            this.createScrollButtons();
            this.createDarkModeButton();
            this.createToc();
            this.addEventListeners();
            this.initButtonStates();
        }

        // 添加CSS样式
        addStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .rustwiki-tools {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .rustwiki-tool-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: none;
                    background: #4b5563;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }
                .rustwiki-tool-btn:hover {
                    background: #1f2937;
                    transform: translateY(-2px);
                }
                .rustwiki-tool-btn:active {
                    transform: translateY(0);
                }
                body.dark-mode {
                    background-color: #1a1a1a;
                    color: #e5e7eb;
                }
                body.dark-mode .book {
                    background-color: #1a1a1a;
                }
                body.dark-mode .book-header {
                    background-color: #2d2d2d;
                }
                body.dark-mode .book-body {
                    background-color: #1a1a1a;
                }
                body.dark-mode .page {
                    background-color: #1a1a1a;
                    color: #e5e7eb;
                }
                body.dark-mode a {
                    color: #93c5fd;
                }
                body.dark-mode code {
                    background-color: #2d2d2d;
                    color: #fbbf24;
                }
                .rustwiki-card {
                    background: white;
                }
                body.dark-mode .rustwiki-card {
                    background: #2d2d2d;
                    color: #e5e7eb;
                }
                body.dark-mode .rustwiki-card-header {
                    background-color: #374151;
                    border-bottom: 1px solid #4b5563;
                }
                body.dark-mode .rustwiki-card-body {
                    background-color: #2d2d2d;
                }
                body.dark-mode .rustwiki-card-footer {
                    background-color: #374151;
                    border-top: 1px solid #4b5563;
                }
                .rustwiki-card ul {
                    list-style: none;
                    padding-left: 0;
                    margin: 0;
                }
                .rustwiki-card li {
                    margin-bottom: 5px;
                }
                .rustwiki-card a {
                    text-decoration: none;
                    color: #374151;
                    font-size: 14px;
                    display: block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: all 0.2s ease;
                }
                body.dark-mode .rustwiki-card a {
                    color: #e5e7eb;
                }
                .rustwiki-card a:hover {
                    background: #f3f4f6;
                }
                body.dark-mode .rustwiki-card a:hover {
                    background: #4b5563;
                }
                .rustwiki-card .toc-h3 {
                    padding-left: 20px;
                    font-size: 13px;
                }
                .rustwiki-card.hidden {
                    left: -300px !important;
                    opacity: 0;
                }
            `;
            document.head.appendChild(style);
        }

        // 创建工具按钮容器
        createToolsContainer() {
            this.toolsContainer = document.createElement('div');
            this.toolsContainer.className = 'rustwiki-tools';
            document.body.appendChild(this.toolsContainer);
        }

        // 创建返回顶部和直到底部按钮
        createScrollButtons() {
            // 创建返回顶部按钮
            this.topBtn = new Button({
                html: '↑',
                title: '返回顶部',
                parent: this.toolsContainer,
                onClick: () => {
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }
            });

            // 创建直到底部按钮
            this.bottomBtn = new Button({
                html: '↓',
                title: '直到底部',
                parent: this.toolsContainer,
                onClick: () => {
                    window.scrollTo({
                        top: document.body.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            });
        }

        // 创建暗黑模式按钮
        createDarkModeButton() {
            // 使用Storage类检查暗黑模式状态，默认为false
            const isDarkMode = this.storage.get('dark-mode', false);
            if (isDarkMode) {
                document.body.classList.add('dark-mode');
            }

            this.darkModeBtn = new Button({
                html: isDarkMode ? '☀️' : '🌙',
                title: '切换暗黑模式',
                parent: this.toolsContainer,
                onClick: () => {
                    const isDark = document.body.classList.toggle('dark-mode');
                    this.storage.set('dark-mode', isDark);
                    this.darkModeBtn.setHtml(isDark ? '☀️' : '🌙');
                }
            });
        }

        // 创建目录导航
        createToc() {
            // 计算卡片位置，放在div右边
            let leftPosition = '80px';
            const sidebarDiv = document.querySelector('.sidebar-scrollbox');
            if (sidebarDiv) {
                const sidebarWidth = sidebarDiv.offsetWidth;
                leftPosition = `${sidebarWidth + 20}px`; // 20px的间距
            }

            // 创建目录卡片
            this.tocCard = new Card({
                title: '目录',
                content: '',
                width: '250px',
                top: '120px',
                left: leftPosition,
                shadow: true
            });

            // 生成目录
            this.generateToc();

            // 从storage加载目录显示状态，默认为true
            this.tocVisible = this.storage.get('toc-visible', true);
            
            // 根据加载的状态设置目录显示
            if (this.tocVisible) {
                this.tocCard.show();
            } else {
                this.tocCard.hide();
            }

            // 创建目录显示/隐藏按钮
            this.tocBtn = new Button({
                html: '📑',
                title: '显示/隐藏目录',
                parent: this.toolsContainer,
                onClick: () => {
                    this.tocVisible = !this.tocVisible;
                    // 保存状态到storage
                    this.storage.set('toc-visible', this.tocVisible);
                    if (this.tocVisible) {
                        this.tocCard.show();
                    } else {
                        this.tocCard.hide();
                    }
                }
            });
        }

        // 生成目录内容
        generateToc() {
            const mainContent = document.querySelector('main') || document.querySelector('.book-body') || document.body;
            if (!mainContent) return;
            
            const headings = mainContent.querySelectorAll('h1,h2, h3');
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
                    const targetElement = document.getElementById(heading.id);
                    if (targetElement) {
                        // 获取顶部菜单栏的高度
                        const menuBar = document.getElementById('menu-bar');
                        const menuBarHeight = menuBar ? menuBar.offsetHeight : 80; // 默认80px作为 fallback
                        
                        // 计算滚动位置
                        const elementTop = targetElement.getBoundingClientRect().top;
                        const scrollPosition = window.pageYOffset + elementTop - menuBarHeight - 20; // 额外20px的间距
                        
                        // 平滑滚动到指定位置
                        window.scrollTo({
                            top: scrollPosition,
                            behavior: 'smooth'
                        });
                    }
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

        // 添加事件监听器
        addEventListeners() {
            // 滚动时显示/隐藏按钮
            window.addEventListener('scroll', () => {
                this.handleScroll();
            });
        }

        // 处理滚动事件
        handleScroll() {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.body.scrollHeight;
            const scrollBottom = scrollTop + windowHeight;
            const bottomThreshold = 200; // 距离底部的阈值

            // 当滚动超过300px时显示返回顶部按钮，否则隐藏
            if (scrollTop > 300) {
                this.topBtn.show();
            } else {
                this.topBtn.hide();
            }

            // 当距离底部超过200px时显示直到底部按钮，否则隐藏
            if (documentHeight - scrollBottom > bottomThreshold) {
                this.bottomBtn.show();
            } else {
                this.bottomBtn.hide();
            }

            // 暗黑模式按钮和目录按钮始终显示
            this.darkModeBtn.show();
            this.tocBtn.show();
        }

        // 初始化按钮状态
        initButtonStates() {
            // 初始状态：隐藏返回顶部按钮，显示直到底部按钮和暗黑模式按钮
            this.topBtn.hide();
            this.bottomBtn.show();
            this.darkModeBtn.show();
            this.tocBtn.show();
        }
    }

    // 初始化工具
    const rustWikiTools = new RustWikiTools();
    rustWikiTools.init();

})();