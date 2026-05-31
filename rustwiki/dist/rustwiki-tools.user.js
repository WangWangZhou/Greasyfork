// ==UserScript==
// @name         Rust Wiki 阅读小助手
// @namespace    http://tampermonkey.net/
// @version      v0.0.2
// @author       小明
// @description  添加返回顶部、直到底部、暗黑模式按钮和目录导航等功能
// @license      MIT
// @icon         chrome://favicon/https://rustwiki.org.cn
// @match        https://www.rustwiki.org.cn/zh-CN/*
// @match        https://www.rustwiki.org.cn/en/*
// @match        https://rustwiki.org/zh-CN/*
// @match        https://rustwiki.org/en/*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  const d=new Set;const importCSS = async e=>{d.has(e)||(d.add(e),(t=>{typeof GM_addStyle=="function"?GM_addStyle(t):(document.head||document.documentElement).appendChild(document.createElement("style")).append(t);})(e));};

  class Button {
    constructor(options = {}) {
      this.options = {
        className: "rustwiki-tool-btn",
        html: "",
        title: "",
        onClick: null,
        parent: null,
        ...options
      };
      this.element = null;
      this.create();
    }
    create() {
      this.element = document.createElement("button");
      this.element.className = this.options.className;
      this.element.innerHTML = this.options.html;
      this.element.title = this.options.title;
      if (this.options.onClick) {
        this.element.addEventListener("click", this.options.onClick);
      }
      if (this.options.parent) {
        this.options.parent.appendChild(this.element);
      }
      return this.element;
    }
    show() {
      this.element.style.display = "flex";
    }
    hide() {
      this.element.style.display = "none";
    }
    setHtml(html) {
      this.element.innerHTML = html;
    }
  }
  class ScrollButtons {
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
      this.topBtn = new Button({
        html: "↑",
        title: "返回顶部",
        parent: parentContainer,
        onClick: () => {
          this.scrollToTop();
        }
      });
      this.bottomBtn = new Button({
        html: "↓",
        title: "直到底部",
        parent: parentContainer,
        onClick: () => {
          this.scrollToBottom();
        }
      });
      window.addEventListener("scroll", this.scrollHandler);
      this.initButtonStates();
    }
    scrollToTop() {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
    scrollToBottom() {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
      });
    }
    handleScroll() {
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.body.scrollHeight;
      const scrollBottom = scrollTop + windowHeight;
      if (scrollTop > this.options.topThreshold) {
        this.topBtn.show();
      } else {
        this.topBtn.hide();
      }
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
      window.removeEventListener("scroll", this.scrollHandler);
      if (this.topBtn && this.topBtn.element && this.topBtn.element.parentNode) {
        this.topBtn.element.parentNode.removeChild(this.topBtn.element);
      }
      if (this.bottomBtn && this.bottomBtn.element && this.bottomBtn.element.parentNode) {
        this.bottomBtn.element.parentNode.removeChild(this.bottomBtn.element);
      }
    }
  }
  class Storage {
    constructor(prefix = "rustwiki-") {
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
      Object.keys(localStorage).filter((key) => key.startsWith(this.prefix)).forEach((key) => localStorage.removeItem(key));
    }
  }
  class DarkMode {
    constructor(options = {}) {
      this.options = {
        storage: new Storage(),
        ...options
      };
      this.darkModeBtn = null;
      this.isDarkMode = false;
    }
    init(parentContainer) {
      this.isDarkMode = this.options.storage.get("dark-mode", false);
      if (this.isDarkMode) {
        document.body.classList.add("dark-mode");
      }
      this.darkModeBtn = new Button({
        html: this.isDarkMode ? "☀️" : "🌙",
        title: "切换暗黑模式",
        parent: parentContainer,
        onClick: () => {
          this.toggle();
        }
      });
    }
    toggle() {
      this.isDarkMode = document.body.classList.toggle("dark-mode");
      this.options.storage.set("dark-mode", this.isDarkMode);
      this.darkModeBtn.setHtml(this.isDarkMode ? "☀️" : "🌙");
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
  class Card {
    constructor(options = {}) {
      this.options = {
        title: "Card",
        content: "",
        footer: "",
        width: "250px",
        height: "auto",
        top: "100px",
        left: "20px",
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
      this.storage = this.options.storage;
      this.cardState = this.options.cardState;
      this.visible = this.options.visible;
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
      this.element = document.createElement("div");
      this.element.className = "rustwiki-card";
      this.element.style.position = "fixed";
      this.element.style.width = this.options.width;
      this.element.style.height = this.options.height;
      this.element.style.zIndex = "9998";
      this.element.style.transition = "opacity 0.3s ease, box-shadow 0.3s ease";
      this.element.style.borderRadius = "8px";
      this.element.style.overflow = "hidden";
      if (this.options.shadow) {
        this.element.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
      }
      this.element.style.top = this.options.top;
      this.element.style.left = this.options.left;
      this.header = document.createElement("div");
      this.header.className = "rustwiki-card-header";
      this.header.style.padding = "12px 15px";
      this.header.style.backgroundColor = "#f3f4f6";
      this.header.style.borderBottom = "1px solid #e5e7eb";
      this.header.style.fontWeight = "600";
      this.header.style.fontSize = "16px";
      this.header.style.cursor = "move";
      this.header.style.userSelect = "none";
      this.header.textContent = this.options.title;
      this.element.appendChild(this.header);
      this.body = document.createElement("div");
      this.body.className = "rustwiki-card-body";
      this.body.style.padding = "15px";
      this.body.style.maxHeight = "70vh";
      this.body.style.overflowY = "auto";
      this.body.style.backgroundColor = "white";
      this.body.innerHTML = this.options.content;
      this.element.appendChild(this.body);
      if (this.options.footer) {
        this.footer = document.createElement("div");
        this.footer.className = "rustwiki-card-footer";
        this.footer.style.padding = "12px 15px";
        this.footer.style.backgroundColor = "#f9fafb";
        this.footer.style.borderTop = "1px solid #e5e7eb";
        this.footer.innerHTML = this.options.footer;
        this.element.appendChild(this.footer);
      }
      document.body.appendChild(this.element);
      if (!this.visible) {
        this.hide();
      }
    }
    initDrag() {
      this.header.addEventListener("mousedown", this.onMouseDown.bind(this));
      document.addEventListener("mousemove", this.onMouseMove.bind(this));
      document.addEventListener("mouseup", this.onMouseUp.bind(this));
    }
    onMouseDown(e) {
      this.isDragging = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      const rect = this.element.getBoundingClientRect();
      this.startLeft = rect.left;
      this.startTop = rect.top;
      this.element.style.zIndex = "9999";
      this.element.style.transition = "none";
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
      this.element.style.zIndex = "9998";
      this.element.style.transition = "opacity 0.3s ease, box-shadow 0.3s ease";
      this.saveState();
    }
    loadState() {
      if (!this.storage || !this.cardState) return;
      const savedState = this.storage.get(this.cardState);
      if (savedState) {
        if (savedState.left && savedState.top) {
          this.element.style.left = savedState.left;
          this.element.style.top = savedState.top;
        }
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
      this.element.classList.remove("hidden");
      this.visible = true;
      this.saveState();
    }
    hide() {
      this.element.classList.add("hidden");
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
      document.removeEventListener("mousemove", this.onMouseMove.bind(this));
      document.removeEventListener("mouseup", this.onMouseUp.bind(this));
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  }
  class TableOfContents {
    constructor(options = {}) {
      this.options = {
        width: "250px",
        top: "120px",
        left: "80px",
        shadow: true,
        ...options
      };
      this.storage = new Storage();
      this.tocCard = null;
      this.tocBtn = null;
    }
    init(parentContainer) {
      this.calculatePosition();
      this.tocCard = new Card({
        title: "文章目录",
        content: "",
        width: this.options.width,
        top: this.options.top,
        left: this.options.left,
        shadow: this.options.shadow,
        storage: this.storage,
        cardState: "toc-card"
      });
      this.generateToc();
      this.tocBtn = new Button({
        html: "📑",
        title: "显示/隐藏目录",
        parent: parentContainer,
        onClick: () => {
          this.toggle();
        }
      });
    }
    calculatePosition() {
      const sidebarDiv = document.querySelector(".sidebar-scrollbox");
      if (sidebarDiv) {
        const sidebarWidth = sidebarDiv.offsetWidth;
        this.options.left = `${sidebarWidth + 20}px`;
      }
    }
    generateToc() {
      const mainContent = document.querySelector("main") || document.querySelector(".book-body") || document.body;
      if (!mainContent) return;
      const headings = mainContent.querySelectorAll("h1, h2, h3");
      if (headings.length === 0) return;
      const tocList = document.createElement("ul");
      headings.forEach((heading, index) => {
        if (!heading.id) {
          heading.id = `heading-${index}`;
        }
        const listItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = `#${heading.id}`;
        link.textContent = heading.textContent;
        link.addEventListener("click", (e) => {
          e.preventDefault();
          this.scrollToHeading(heading.id);
        });
        if (heading.tagName === "H3") {
          link.classList.add("toc-h3");
        }
        listItem.appendChild(link);
        tocList.appendChild(listItem);
      });
      this.tocCard.updateContent(tocList.outerHTML);
    }
    scrollToHeading(headingId) {
      const targetElement = document.getElementById(headingId);
      if (targetElement) {
        const menuBar = document.getElementById("menu-bar");
        const menuBarHeight = menuBar ? menuBar.offsetHeight : 80;
        const elementTop = targetElement.getBoundingClientRect().top;
        const scrollPosition = window.pageYOffset + elementTop - menuBarHeight - 20;
        window.scrollTo({
          top: scrollPosition,
          behavior: "smooth"
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
  const stylesCss = ".rustwiki-tools{position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px}.rustwiki-tool-btn{width:40px;height:40px;border-radius:50%;border:none;background:#4b5563;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .3s ease;box-shadow:0 2px 5px #0003}.rustwiki-tool-btn:hover{background:#1f2937;transform:translateY(-2px)}.rustwiki-tool-btn:active{transform:translateY(0)}body.dark-mode{background-color:#1a1a1a;color:#e5e7eb}body.dark-mode .book{background-color:#1a1a1a}body.dark-mode .book-header{background-color:#2d2d2d}body.dark-mode .book-body{background-color:#1a1a1a}body.dark-mode .page{background-color:#1a1a1a;color:#e5e7eb}body.dark-mode a{color:#93c5fd}body.dark-mode code{background-color:#2d2d2d;color:#fbbf24}.rustwiki-card{background:#fff}body.dark-mode .rustwiki-card{background:#2d2d2d;color:#e5e7eb}body.dark-mode .rustwiki-card-header{background-color:#374151;border-bottom:1px solid #4b5563}body.dark-mode .rustwiki-card-body{background-color:#2d2d2d}body.dark-mode .rustwiki-card-footer{background-color:#374151;border-top:1px solid #4b5563}.rustwiki-card ul{list-style:none;padding-left:0;margin:0}.rustwiki-card li{margin-bottom:5px}.rustwiki-card a{text-decoration:none;color:#374151;font-size:14px;display:block;padding:4px 8px;border-radius:4px;transition:all .2s ease}body.dark-mode .rustwiki-card a{color:#e5e7eb}.rustwiki-card a:hover{background:#f3f4f6}body.dark-mode .rustwiki-card a:hover{background:#4b5563}.rustwiki-card .toc-h3{padding-left:20px;font-size:13px}.rustwiki-card.hidden{left:-300px!important;opacity:0}";
  importCSS(stylesCss);
  class RustWikiTools {
    constructor() {
      this.toolsContainer = null;
      this.scrollButtons = null;
      this.darkMode = null;
      this.tableOfContents = null;
    }
init() {
      this.createToolsContainer();
      this.initScrollButtons();
      this.initDarkMode();
      this.initTableOfContents();
    }
createToolsContainer() {
      this.toolsContainer = document.createElement("div");
      this.toolsContainer.className = "rustwiki-tools";
      document.body.appendChild(this.toolsContainer);
    }
initScrollButtons() {
      this.scrollButtons = new ScrollButtons();
      this.scrollButtons.init(this.toolsContainer);
    }
initDarkMode() {
      this.darkMode = new DarkMode();
      this.darkMode.init(this.toolsContainer);
    }
initTableOfContents() {
      this.tableOfContents = new TableOfContents();
      this.tableOfContents.init(this.toolsContainer);
    }
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
  const rustWikiTools = new RustWikiTools();
  rustWikiTools.init();

})();