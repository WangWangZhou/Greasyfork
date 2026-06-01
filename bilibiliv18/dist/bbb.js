// ==UserScript==
// @name         B站自定义倍速油猴脚本简洁版
// @namespace    http://tampermonkey.net/
// @version      v2.0
// @description  可以自定义bilibili 播放倍速，方便学习网课，x,c,z分别对减速、加速、恢复（模块化重构版）
// @author       小明
// @license MIT
// @icon         chrome://favicon/http://www.bilibili.com/
// @match        *://www.bilibili.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // 模块引入（按依赖顺序）
    /**
 * EventBus - 事件总线模块
 * 提供发布/订阅模式的事件通信机制
 */
const EventBus = (() => {
    const listeners = new Map();

    return {
        on(event, callback) {
            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }
            listeners.get(event).add(callback);
            return () => listeners.get(event)?.delete(callback);
        },

        once(event, callback) {
            const wrapper = (...args) => {
                try {
                    callback(...args);
                } catch (err) {
                    console.error(`[EventBus] once("${event}") 回调执行异常:`, err);
                } finally {
                    this.off(event, wrapper);
                }
            };
            this.on(event, wrapper);
        },

        off(event, callback) {
            listeners.get(event)?.delete(callback);
        },

        emit(event, ...args) {
            const cbs = listeners.get(event);
            if (cbs) {
                cbs.forEach(cb => {
                    try {
                        cb(...args);
                    } catch (err) {
                        console.error(`[EventBus] 事件 "${event}" 处理器异常:`, err);
                    }
                });
            }
        },

        clear() {
            listeners.clear();
        }
    };
})();

/**
 * Logger - 日志模块
 * 统一的调试日志输出
 */
const Logger = (() => {
    const DEBUG = false;
    const PREFIX = '[BiliSpeed]';

    return {
        info(msg) {
            if (DEBUG) console.log(`${PREFIX} ${msg}`);
        },

        warn(msg) {
            if (DEBUG) console.warn(`${PREFIX} ${msg}`);
        },

        error(msg) {
            console.error(`${PREFIX} ${msg}`);
        }
    };
})();

/**
 * Utils - 工具函数模块
 */
const Utils = (() => ({
    round2(num) {
        return Math.round(num * 100) / 100;
    },

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    throttle(fn, delay) {
        let last = 0;
        return function (...args) {
            const now = Date.now();
            if (now - last >= delay) {
                last = now;
                fn.apply(this, args);
            }
        };
    },

    parseTimeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const timeParts = timeStr.split(':').map(part => parseInt(part, 10));
        if (timeParts.length === 2) {
            const [minutes, seconds] = timeParts;
            return minutes * 60 + seconds;
        } else if (timeParts.length === 3) {
            const [hours, minutes, seconds] = timeParts;
            return hours * 3600 + minutes * 60 + seconds;
        }
        return 0;
    },

    isCollection() {
        const domCount = document.querySelectorAll('.simple-base-item').length;
        if (domCount > 1) return true;
        try {
            const state = window.__INITIAL_STATE__;
            return state?.videoData?.videos > 1;
        } catch {
            return false;
        }
    },

    getCollectionCount() {
        const domCount = document.querySelectorAll('.simple-base-item').length;
        if (domCount > 0) return domCount;
        try {
            return window.__INITIAL_STATE__?.videoData?.videos || 1;
        } catch {
            return 1;
        }
    },

    getCollectionDuration() {
        const timeElements = document.querySelectorAll('.simple-base-item .duration');
        let totalSeconds = 0;
        timeElements.forEach(el => {
            totalSeconds += Utils.parseTimeToSeconds(el.innerText.trim());
        });
        if (totalSeconds > 0) return totalSeconds;
        try {
            const pages = window.__INITIAL_STATE__?.videoData?.pages;
            return pages?.reduce((sum, p) => sum + (p.duration || 0), 0) || 0;
        } catch {
            return 0;
        }
    },

    multiClick(element, times, callback, timeout = 800) {
        if (!element) {
            console.warn('multiClick: element is null');
            return () => {};
        }
        
        let clickCount = 0;
        let clickTimer = null;

        const handler = () => {
            clickCount++;
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                clickCount = 0;
            }, timeout);

            if (clickCount >= times) {
                clickCount = 0;
                callback();
            }
        };

        element.addEventListener('click', handler);

        return () => {
            element.removeEventListener('click', handler);
            if (clickTimer) clearTimeout(clickTimer);
        };
    }
}))();

/**
 * Config - 配置管理模块
 * 响应式持久化配置
 */
const Config = (() => {
    const DEFAULTS = {
        step: 0.05,
        minRate: 0.5,
        maxRate: 2.0,
        defaultRate: 1.0,
        cardVisible: true,
        panelVisible: false,
        cardPosition: null,
        panelPosition: null,
        keyReset: 'z',
        keyUp: 'c',
        keyDown: 'x',
        theme: 'light',
        favoritesPanelVisible: false,
        favoritesPanelPosition: null,
        notesPanelVisible: false,
        notesPanelPosition: null,
        editorPanelPosition: null,
        quillEditorPanelSize: null,
        vditorEditorPanelSize: null,
        defaultEditor: 'quill',
        quillEditorWidth: '520px',
        quillEditorHeight: '500px',
        quillEditorMinWidth: '400px',
        quillEditorMinHeight: '350px',
        vditorEditorMode: 'ir',
        vditorWidth_wysiwyg: '560px',
        vditorHeight_wysiwyg: '550px',
        vditorWidth_ir: '560px',
        vditorHeight_ir: '550px',
        vditorWidth_sv: '640px',
        vditorHeight_sv: '600px',
        vditorEditorMinWidth_wysiwyg: '400px',
        vditorEditorMinHeight_wysiwyg: '400px',
        vditorEditorMinWidth_ir: '400px',
        vditorEditorMinHeight_ir: '400px',
        vditorEditorMinWidth_sv: '640px',
        vditorEditorMinHeight_sv: '400px',
        quillCdnJs: 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.min.js',
        quillCdnCss: 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css',
        vditorCdnJs: 'https://cdn.jsdelivr.net/npm/vditor/dist/index.min.js',
        vditorCdnCss: 'https://cdn.jsdelivr.net/npm/vditor/dist/index.css'
    };

    const proxy = new Proxy({}, {
        get(_, key) {
            if (!(key in DEFAULTS)) {
                Logger.warn(`配置项 "${key}" 不存在`);
                return undefined;
            }
            const value = GM_getValue(key);
            return value !== undefined ? value : DEFAULTS[key];
        },
        set(_, key, value) {
            if (!(key in DEFAULTS)) {
                Logger.warn(`无法设置不存在的配置项 "${key}"`);
                return false;
            }
            GM_setValue(key, value);
            return true;
        }
    });

    return {
        data: proxy,
        DEFAULTS,
        reset() {
            Object.keys(DEFAULTS).forEach(key => GM_setValue(key, DEFAULTS[key]));
            EventBus.emit('config:reset');
        },
        batchUpdate(updates) {
            Object.entries(updates).forEach(([key, value]) => {
                proxy[key] = value;
            });
        }
    };
})();


/**
 * PageGuard - 页面守卫模块
 * 判断脚本是否应在当前页面运行
 */
const PageGuard = (() => ({
    isNotAllowedPage() {
        const url = window.location.href;
        const path = window.location.pathname;
        return url.includes('/live/') ||
               path === '/' ||
               url.includes('space.bilibili.com') ||
               url.includes('member.bilibili.com');
    },

    isInputFocused() {
        const active = document.activeElement;
        return active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.contentEditable === 'true'
        );
    }
}))();

/**
 * Draggable - 拖拽行为模块
 * UI行为模块 - 负责为元素添加拖拽交互功能
 */
const Draggable = (() => {
    return {
        make(el, saveKey, headerSelector) {
            let isDragging = false;
            let startX, startY, startLeft, startTop;
            const cleanupFns = new Set();

            const header = headerSelector ? el.querySelector(headerSelector) : el;
            if (!header) return () => {};

            const onMouseDown = (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
                if (e.target.classList.contains('bili-speed-drag-text')) return;
                if (e.target.closest('[class*="-actions"]')) return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = el.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                
                el.style.left = startLeft + 'px';
                el.style.top = startTop + 'px';
                el.style.right = 'auto';
                el.style.bottom = 'auto';
                el.style.transform = 'none';
                
                el.style.cursor = 'grabbing';
                e.preventDefault();
            };

            const onMouseMove = (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + dx));
                const newTop = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + dy));
                el.style.left = newLeft + 'px';
                el.style.top = newTop + 'px';
                el.style.right = 'auto';
                el.style.bottom = 'auto';
            };

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    el.style.cursor = '';
                    Config.data[saveKey] = { left: el.style.left, top: el.style.top };
                }
            };

            header.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            const cleanup = () => {
                header.removeEventListener('mousedown', onMouseDown);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                cleanupFns.clear();
            };

            cleanupFns.add(cleanup);
            return cleanup;
        },

        cleanupAll() {
            Logger.warn('Draggable.cleanupAll() 已弃用');
        }
    };
})();

/**
 * Resizable - 拖拽调整大小行为模块
 * UI行为模块 - 负责为面板元素提供拖拽调整大小的功能
 */
const Resizable = (() => {
    return {
        /**
         * 为元素添加拖拽调整大小功能
         * @param {HTMLElement} el - 目标元素
         * @param {Object} options - 配置选项
         * @param {number} [options.minWidth=400] - 最小宽度
         * @param {number} [options.minHeight=300] - 最小高度
         * @param {number} [options.maxWidth] - 最大宽度（可选）
         * @param {number} [options.maxHeight] - 最大高度（可选）
         * @param {Function} [options.onResize] - 调整大小时的回调函数
         * @param {string} [options.saveKey] - 保存到 Config 的键名（可选）
         * @returns {Function} 清理函数
         */
        make(el, options = {}) {
            const {
                minWidth = 400,
                minHeight = 300,
                maxWidth = window.innerWidth - 50,
                maxHeight = window.innerHeight - 50,
                onResize,
                saveKey
            } = options;

            let isResizing = false;
            let startX, startY, startWidth, startHeight;
            let rafId = null;
            let handleEl = null;

            // 创建拖拽手柄
            handleEl = document.createElement('div');
            handleEl.className = 'bili-speed-resize-handle';
            handleEl.style.cssText = `
                position: absolute;
                right: 0;
                bottom: 0;
                width: 16px;
                height: 16px;
                cursor: nwse-resize;
                z-index: 10001;
                pointer-events: auto;
            `;

            // 添加视觉指示器（小三角）
            handleEl.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 12 12" style="position: absolute; right: 2px; bottom: 2px; pointer-events: none;">
                    <path d="M10 2 L10 10 L2 10" stroke="#999" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                </svg>
            `;

            // 确保父元素有相对定位
            if (getComputedStyle(el).position === 'static') {
                el.style.position = 'relative';
            }

            el.appendChild(handleEl);

            const onMouseDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = el.getBoundingClientRect();
                startWidth = rect.width;
                startHeight = rect.height;
                el.style.cursor = 'nwse-resize';
                el.style.userSelect = 'none';
            };

            const onMouseMove = (e) => {
                if (!isResizing) return;

                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + dx));
                const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + dy));

                el.style.width = newWidth + 'px';
                el.style.height = newHeight + 'px';

                if (onResize && !rafId) {
                    const latestWidth = newWidth;
                    const latestHeight = newHeight;
                    rafId = requestAnimationFrame(() => {
                        rafId = null;
                        onResize(latestWidth, latestHeight);
                    });
                }
            };

            const onMouseUp = () => {
                if (isResizing) {
                    isResizing = false;
                    el.style.cursor = '';
                    el.style.userSelect = '';

                    if (rafId) {
                        cancelAnimationFrame(rafId);
                        rafId = null;
                    }

                    if (saveKey) {
                        const rect = el.getBoundingClientRect();
                        Config.data[saveKey] = {
                            width: rect.width + 'px',
                            height: rect.height + 'px'
                        };
                    }
                }
            };

            handleEl.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            // 返回清理函数
            return () => {
                handleEl.removeEventListener('mousedown', onMouseDown);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                if (handleEl && handleEl.parentNode) {
                    handleEl.remove();
                }
                handleEl = null;
            };
        }
    };
})();


/**
 * Toast - 消息提示组件
 * UI组件模块 - 负责渲染临时消息提示
 */
const Toast = (() => {
    let toastEl = null;
    let toastTimer = null;

    return {
        create() {
            toastEl = document.createElement('div');
            toastEl.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.7);
                color: #fff;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 24px;
                font-weight: bold;
                opacity: 0;
                transition: opacity 0.3s;
                z-index: 9999;
                pointer-events: none;
            `;
            const container = document.querySelector('.bpx-player-video-wrap') ||
                             document.querySelector('.bilibili-player-video-wrap') ||
                             document.body;
            container.appendChild(toastEl);
        },

        show(text) {
            if (!toastEl) return;
            toastEl.textContent = text;
            toastEl.style.opacity = '1';
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(() => {
                toastEl.style.opacity = '0';
            }, 1500);
        },

        destroy() {
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = null;
            if (toastEl) toastEl.remove();
            toastEl = null;
        }
    };
})();

/**
 * Card - 通用卡片组件
 * UI基础组件 - 提供可复用的卡片结构（header/body/footer）
 *
 * @module UI/Components
 *
 * @example
 * const card = Card.create({
 *   className: 'my-card',
 *   header: { visible: true, draggable: true },
 *   footer: { visible: true },
 *   onHeaderReady: (headerEl) => { /* 添加header内容 *\/ },
 *   onBodyReady: (bodyEl) => { /* 添加body内容 *\/ },
 *   onFooterReady: (footerEl) => { /* 添加footer内容 *\/ },
 *   onReady: (cardEl) => { /* 卡片就绪 *\/ }
 * });
 *
 * card.show();
 * card.hide();
 * card.destroy();
 */
const Card = (() => {
    let instanceCounter = 0;

    return {
        /**
         * 创建卡片实例
         * @param {Object} options - 配置选项
         * @param {string} [options.className='bili-speed-card'] - 自定义类名
         * @param {Object} [options.header={visible:true}] - header配置
         * @param {boolean} [options.header.visible=true] - 是否显示header
         * @param {boolean} [options.header.draggable=false] - header是否可拖拽
         * @param {string} [options.header.title='Card'] - header标题
         * @param {Object} [options.footer={visible:false}] - footer配置
         * @param {boolean} [options.footer.visible=false] - 是否显示footer
         * @param {Object} [options.styles={}] - 自定义样式
         * @param {Function} [options.onHeaderReady] - header就绪回调
         * @param {Function} [options.onBodyReady] - body就绪回调
         * @param {Function} [options.onFooterReady] - footer就绪回调
         * @param {Function} [options.onReady] - 整个卡片就绪回调
         * @returns {Object} 卡片实例
         */
        create(options = {}) {
            const {
                className = 'bili-speed-card',
                header = { visible: true, draggable: false, title: 'Card' },
                footer = { visible: false },
                styles = {},
                onHeaderReady,
                onBodyReady,
                onFooterReady,
                onReady
            } = options;

            const instanceId = ++instanceCounter;
            const cardId = `${className}-instance-${instanceId}`;

            let cardEl = null;
            let headerEl = null;
            let bodyEl = null;
            let footerEl = null;
            let isVisible = true;

            function render() {
                if (cardEl) cardEl.remove();

                cardEl = document.createElement('div');
                cardEl.id = cardId;
                cardEl.className = className;

                const baseStyles = {
                    position: 'fixed',
                    background: '#F0F1F2',
                    color: '#000',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    zIndex: styles.zIndex || 9998
                };

                Object.assign(cardEl.style, baseStyles, styles);

                if (header.visible) {
                    headerEl = document.createElement('div');
                    headerEl.className = `${className}-header`;
                    headerEl.style.cssText = `
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 12px 12px 8px 12px;
                        ${header.draggable ? 'cursor: move;' : ''}
                    `;

                    const titleEl = document.createElement('div');
                    const baseClassName = className.split(' ')[0];
                    titleEl.className = `${baseClassName}-drag-text`;
                    titleEl.style.cssText = 'font-weight: bold; cursor: default;';
                    titleEl.innerHTML = header.title;

                    const actionsEl = document.createElement('div');
                    actionsEl.className = `${baseClassName}-actions`;
                    actionsEl.style.cssText = 'visibility: visible; gap: 4px; display: flex;';

                    headerEl.appendChild(titleEl);
                    headerEl.appendChild(actionsEl);
                    cardEl.appendChild(headerEl);
                }

                bodyEl = document.createElement('div');
                bodyEl.className = `${className}-body`;
                bodyEl.style.cssText = 'padding: 0 12px 8px 12px;';
                cardEl.appendChild(bodyEl);

                if (footer.visible) {
                    footerEl = document.createElement('div');
                    footerEl.className = `${className}-footer`;
                    footerEl.style.cssText = 'padding: 0 12px 12px 12px; position: relative;';
                    cardEl.appendChild(footerEl);
                }

                document.body.appendChild(cardEl);

                if (onHeaderReady && headerEl) {
                    onHeaderReady(headerEl);
                }
                if (onBodyReady && bodyEl) {
                    onBodyReady(bodyEl);
                }
                if (onFooterReady && footerEl) {
                    onFooterReady(footerEl);
                }
                if (onReady) {
                    onReady(cardEl);
                }

                setupAutoHideActions();
            }

            function setupAutoHideActions() {
                if (!cardEl) return;
                
                const baseClassName = className.split(' ')[0];
                const actionsEl = cardEl.querySelector(`.${baseClassName}-actions`);
                if (!actionsEl) return;
                
                // 让按钮始终可见
                actionsEl.style.visibility = 'visible';
            }

            render();

            return {
                id: cardId,
                element: cardEl,

                getHeader() {
                    return headerEl;
                },

                getBody() {
                    return bodyEl;
                },

                getFooter() {
                    return footerEl;
                },

                getActions() {
                    const baseClassName = className.split(' ')[0];
                    return cardEl.querySelector(`.${baseClassName}-actions`);
                },

                show() {
                    if (cardEl) {
                        cardEl.style.display = 'block';
                        isVisible = true;
                    }
                    return this;
                },

                hide() {
                    if (cardEl) {
                        cardEl.style.display = 'none';
                        isVisible = false;
                    }
                    return this;
                },

                toggle() {
                    if (isVisible) {
                        this.hide();
                    } else {
                        this.show();
                    }
                    return this;
                },

                isVisible() {
                    return isVisible;
                },

                setPosition(left, top) {
                    if (cardEl) {
                        cardEl.style.left = left;
                        cardEl.style.top = top;
                        cardEl.style.right = 'auto';
                        cardEl.style.bottom = 'auto';
                    }
                    return this;
                },

                setStyles(newStyles) {
                    if (cardEl) {
                        Object.assign(cardEl.style, newStyles);
                    }
                    return this;
                },

                setBodyContent(html) {
                    if (bodyEl) {
                        bodyEl.innerHTML = html;
                    }
                    return this;
                },

                destroy() {
                    if (cardEl) {
                        cardEl.remove();
                        cardEl = null;
                        headerEl = null;
                        bodyEl = null;
                        footerEl = null;
                    }
                }
            };
        }
    };
})();

/**
 * Progress - 进度条组件
 * UI组件 - 提供可复用的进度条功能
 *
 * @module UI/Components
 *
 * @example
 * const progress = Progress.create({
 *   container: document.body,
 *   className: 'bili-speed-progress',
 *   formatTime: Utils.formatTime,
 *   onSeek: (time) => { video.currentTime = time; }
 * });
 *
 * progress.setProgress(50);
 * progress.setDuration(120);
 * progress.destroy();
 */
const Progress = (() => {
    let instanceCounter = 0;

    return {
        /**
         * 创建进度条实例
         * @param {Object} options - 配置选项
         * @param {HTMLElement} options.container - 父容器元素
         * @param {string} [options.className='bili-speed-progress'] - 自定义类名前缀
         * @param {number} [options.duration=0] - 视频总时长（秒）
         * @param {number} [options.currentTime=0] - 当前播放时间（秒）
         * @param {Function} [options.formatTime] - 时间格式化函数
         * @param {Function} [options.onSeek] - 跳转回调，接收目标时间（秒）参数
         * @param {Function} [options.onChange] - 进度变化回调，接收当前进度百分比
         * @returns {Object} 进度条实例
         */
        create(options = {}) {
            const {
                container = document.body,
                className = 'bili-speed-progress',
                duration = 0,
                currentTime = 0,
                formatTime = (seconds) => {
                    if (!seconds || isNaN(seconds)) return '00:00';
                    const h = Math.floor(seconds / 3600);
                    const m = Math.floor((seconds % 3600) / 60);
                    const s = Math.floor(seconds % 60);
                    if (h > 0) {
                        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                    }
                    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                },
                onSeek,
                onChange
            } = options;

            const instanceId = ++instanceCounter;
            const progressId = `${className}-instance-${instanceId}`;

            let wrapperEl = null;
            let barEl = null;
            let tooltipEl = null;
            let isDragging = false;
            let currentDuration = duration;
            let currentPosition = currentTime;
            let cleanupFns = [];

            function render() {
                wrapperEl = document.createElement('div');
                wrapperEl.className = `${className}-wrapper`;
                wrapperEl.style.cssText = `
                    flex: 1;
                    height: 5px;
                    background: #ddd;
                    border-radius: 2px;
                    cursor: pointer;
                    position: relative;
                `;

                barEl = document.createElement('div');
                barEl.className = `${className}-bar`;
                barEl.style.cssText = `
                    height: 100%;
                    background: #00AEEC;
                    border-radius: 2px;
                    width: 0%;
                    transition: width 0.1s ease;
                `;

                tooltipEl = document.createElement('div');
                tooltipEl.className = `${className}-tooltip`;
                tooltipEl.style.cssText = `
                    position: absolute;
                    bottom: 12px;
                    left: 0;
                    background: rgba(0,0,0,0.8);
                    color: #fff;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 12px;
                    display: none;
                    white-space: nowrap;
                    transform: translateX(-50%);
                `;

                wrapperEl.appendChild(barEl);
                wrapperEl.appendChild(tooltipEl);
                container.appendChild(wrapperEl);

                bindEvents();
                updateProgress(currentPosition);
            }

            function bindEvents() {
                const onMouseEnter = (e) => updateTooltip(e.clientX);
                const onMouseMove = (e) => {
                    if (!isDragging) updateTooltip(e.clientX);
                };
                const onMouseLeave = () => {
                    if (!isDragging) tooltipEl.style.display = 'none';
                };
                const onClick = (e) => {
                    if (!currentDuration) return;
                    const time = getTimeFromPosition(e.clientX);
                    if (onSeek) onSeek(time);
                };
                const onDragStart = (e) => {
                    if (!currentDuration) return;
                    isDragging = true;
                    e.preventDefault();
                };
                const onDragMove = (e) => {
                    if (!isDragging) return;
                    updateTooltip(e.clientX);
                    const time = getTimeFromPosition(e.clientX);
                    updateProgress(time);
                    if (onSeek) onSeek(time);
                };
                const onDragEnd = () => {
                    if (isDragging) {
                        isDragging = false;
                        tooltipEl.style.display = 'none';
                    }
                };

                wrapperEl.addEventListener('mouseenter', onMouseEnter);
                wrapperEl.addEventListener('mousemove', onMouseMove);
                wrapperEl.addEventListener('mouseleave', onMouseLeave);
                wrapperEl.addEventListener('click', onClick);
                wrapperEl.addEventListener('mousedown', onDragStart);
                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('mouseup', onDragEnd);

                cleanupFns.push(() => {
                    wrapperEl.removeEventListener('mouseenter', onMouseEnter);
                    wrapperEl.removeEventListener('mousemove', onMouseMove);
                    wrapperEl.removeEventListener('mouseleave', onMouseLeave);
                    wrapperEl.removeEventListener('click', onClick);
                    wrapperEl.removeEventListener('mousedown', onDragStart);
                    document.removeEventListener('mousemove', onDragMove);
                    document.removeEventListener('mouseup', onDragEnd);
                });
            }

            function getTimeFromPosition(clientX) {
                const rect = wrapperEl.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return percent * currentDuration;
            }

            function updateTooltip(clientX) {
                if (!currentDuration) return;
                const time = getTimeFromPosition(clientX);
                const rect = wrapperEl.getBoundingClientRect();
                const percent = (clientX - rect.left) / rect.width;
                tooltipEl.textContent = formatTime(time);
                tooltipEl.style.left = `${percent * 100}%`;
                tooltipEl.style.display = 'block';
            }

            function updateProgress(time) {
                currentPosition = time;
                if (currentDuration > 0) {
                    const percent = (time / currentDuration) * 100;
                    barEl.style.width = `${percent}%`;
                    currentPosition = Math.min(time, currentDuration);
                    if (onChange) onChange(percent);
                }
            }

            render();

            return {
                id: progressId,
                element: wrapperEl,
                barElement: barEl,
                tooltipElement: tooltipEl,

                setDuration(duration) {
                    currentDuration = duration || 0;
                    return this;
                },

                setProgress(time) {
                    updateProgress(time);
                    return this;
                },

                getProgress() {
                    return currentPosition;
                },

                getDuration() {
                    return currentDuration;
                },

                getPercent() {
                    if (currentDuration <= 0) return 0;
                    return (currentPosition / currentDuration) * 100;
                },

                destroy() {
                    cleanupFns.forEach(fn => fn());
                    cleanupFns = [];
                    if (wrapperEl) {
                        wrapperEl.remove();
                        wrapperEl = null;
                        barEl = null;
                        tooltipEl = null;
                    }
                }
            };
        }
    };
})();

/**
 * Pagination - 通用分页组件
 * UI基础组件 - 提供分页控制功能
 */
const Pagination = (() => {
    let styleInjected = false;

    function injectStyles() {
        if (styleInjected) return;
        styleInjected = true;

        const style = document.createElement('style');
        style.id = 'bili-pagination-style';
        style.textContent = `
            .bili-pagination {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 8px 0;
                font-size: 13px;
                user-select: none;
            }
            .bili-pagination-btn {
                padding: 4px 10px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background: #fff;
                color: #000;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
                transition: all 0.2s;
                min-width: 28px;
                text-align: center;
            }
            .bili-pagination-btn:hover:not(:disabled) {
                background: #e0e0e0;
            }
            .bili-pagination-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            .bili-pagination-info {
                color: #666;
                min-width: 60px;
                text-align: center;
                font-size: 13px;
            }
            .bili-pagination-input {
                width: 50px;
                padding: 3px 6px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background: #fff;
                color: #000;
                font-size: 13px;
                text-align: center;
                outline: none;
                transition: border-color 0.2s;
            }
            .bili-pagination-input:focus {
                border-color: #00AEEC;
            }
            .bili-pagination-input::-webkit-inner-spin-button,
            .bili-pagination-input::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            .bili-pagination-input[type=number] {
                -moz-appearance: textfield;
            }
            .bili-pagination-total {
                color: #999;
                font-size: 12px;
                margin-left: 4px;
            }
            .bili-pagination-hidden {
                display: none !important;
            }
            .theme-dark .bili-pagination-btn {
                background: #333;
                border-color: #555;
                color: #fff;
            }
            .theme-dark .bili-pagination-btn:hover:not(:disabled) {
                background: #444;
            }
            .theme-dark .bili-pagination-info {
                color: #aaa;
            }
            .theme-dark .bili-pagination-input {
                background: #333;
                color: #fff;
                border-color: #555;
            }
            .theme-dark .bili-pagination-input:focus {
                border-color: #00AEEC;
            }
            .theme-dark .bili-pagination-total {
                color: #777;
            }
        `;
        document.head.appendChild(style);
    }

    return {
        create(options = {}) {
            const {
                container,
                total = 0,
                pageSize = 10,
                currentPage: initialPage = 1,
                onChange,
                theme = 'light'
            } = options;

            if (!container) {
                console.warn('Pagination: container is required');
                return null;
            }

            injectStyles();

            let currentPage = initialPage;
            let currentTotal = total;
            let paginationEl = null;

            function getTotalPages() {
                return Math.max(1, Math.ceil(currentTotal / pageSize));
            }

            function render() {
                if (paginationEl) {
                    paginationEl.remove();
                }

                const totalPages = getTotalPages();
                const showPagination = currentTotal > pageSize;

                paginationEl = document.createElement('div');
                paginationEl.className = 'bili-pagination';

                if (!showPagination) {
                    paginationEl.classList.add('bili-pagination-hidden');
                }

                const prevBtn = document.createElement('button');
                prevBtn.className = 'bili-pagination-btn';
                prevBtn.textContent = '‹';
                prevBtn.title = '上一页';
                prevBtn.disabled = currentPage <= 1;

                const pageInfo = document.createElement('span');
                pageInfo.className = 'bili-pagination-info';
                pageInfo.textContent = `${currentPage} / ${totalPages}`;

                const pageInput = document.createElement('input');
                pageInput.className = 'bili-pagination-input';
                pageInput.type = 'number';
                pageInput.min = 1;
                pageInput.max = totalPages;
                pageInput.value = currentPage;

                const nextBtn = document.createElement('button');
                nextBtn.className = 'bili-pagination-btn';
                nextBtn.textContent = '›';
                nextBtn.title = '下一页';
                nextBtn.disabled = currentPage >= totalPages;

                const totalInfo = document.createElement('span');
                totalInfo.className = 'bili-pagination-total';
                totalInfo.textContent = `共 ${currentTotal}`;

                prevBtn.addEventListener('click', () => {
                    if (currentPage > 1) {
                        goToPage(currentPage - 1);
                    }
                });

                nextBtn.addEventListener('click', () => {
                    if (currentPage < totalPages) {
                        goToPage(currentPage + 1);
                    }
                });

                pageInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const val = parseInt(pageInput.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                            goToPage(val);
                        } else {
                            pageInput.value = currentPage;
                        }
                    }
                });
                pageInput.addEventListener('blur', () => {
                    pageInput.value = currentPage;
                });

                paginationEl.appendChild(prevBtn);
                paginationEl.appendChild(pageInfo);
                paginationEl.appendChild(pageInput);
                paginationEl.appendChild(nextBtn);
                paginationEl.appendChild(totalInfo);

                container.appendChild(paginationEl);

                if (theme === 'dark') {
                    applyThemeToUI('dark');
                }
            }

            function applyThemeToUI(newTheme) {
                if (!paginationEl) return;

                if (newTheme === 'dark') {
                    paginationEl.classList.add('theme-dark');
                } else {
                    paginationEl.classList.remove('theme-dark');
                }
            }

            function goToPage(page) {
                const totalPages = getTotalPages();
                if (page < 1 || page > totalPages || page === currentPage) return;

                currentPage = page;

                if (onChange) {
                    onChange(currentPage);
                }

                render();
            }

            function setTotal(newTotal) {
                currentTotal = newTotal;
                const totalPages = getTotalPages();

                if (currentPage > totalPages) {
                    currentPage = totalPages;
                }

                render();
            }

            function setCurrentPage(page) {
                const totalPages = getTotalPages();
                if (page < 1) page = 1;
                if (page > totalPages) page = totalPages;
                if (page === currentPage) return;

                currentPage = page;
                render();
            }

            function setTheme(newTheme) {
                applyThemeToUI(newTheme);
            }

            function destroy() {
                if (paginationEl) {
                    paginationEl.remove();
                    paginationEl = null;
                }
            }

            function getCurrentPage() {
                return currentPage;
            }

            function getTotal() {
                return currentTotal;
            }

            render();

            return {
                goToPage,
                setTotal,
                setCurrentPage,
                setTheme,
                destroy,
                getCurrentPage,
                getTotal,
                getTotalPages
            };
        }
    };
})();


/**
 * Switch - 开关组件
 * UI基础组件 - 提供美观的开关控件
 *
 * @module UI/Components
 *
 * @example
 * const switchEl = Switch.create({
 *   checked: false,
 *   onChange: (isChecked) => {
 *     console.log('Switch:', isChecked);
 *   }
 * });
 *
 * document.body.appendChild(switchEl);
 */
const Switch = (() => {
    return {
        /**
         * 创建Switch实例
         * @param {Object} options - 配置选项
         * @param {boolean} [options.checked=false] - 初始是否选中
         * @param {Function} [options.onChange] - 状态变化回调
         * @param {boolean} [options.disabled=false] - 是否禁用
         * @param {string} [options.size='normal'] - 尺寸: 'small', 'normal', 'large'
         * @returns {HTMLElement} Switch元素
         */
        create(options = {}) {
            const {
                checked = false,
                onChange,
                disabled = false,
                size = 'normal'
            } = options;

            const container = document.createElement('div');
            container.className = 'bili-speed-switch-container';

            const sizes = {
                small: { width: 28, height: 16, knob: 12 },
                normal: { width: 40, height: 22, knob: 18 },
                large: { width: 52, height: 28, knob: 24 }
            };

            const config = sizes[size] || sizes.normal;
            const transitionDuration = '0.25s';

            container.innerHTML = `
                <div class="bili-speed-switch ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}" 
                     role="switch" 
                     aria-checked="${checked}"
                     tabindex="0">
                    <div class="bili-speed-switch-track">
                        <div class="bili-speed-switch-knob"></div>
                    </div>
                </div>
            `;

            const switchEl = container.querySelector('.bili-speed-switch');
            const trackEl = container.querySelector('.bili-speed-switch-track');

            const baseStyles = `
                display: inline-block;
                vertical-align: middle;
            `;
            container.style.cssText = baseStyles;

            const switchStyles = `
                position: relative;
                display: inline-block;
                width: ${config.width}px;
                height: ${config.height}px;
                cursor: ${disabled ? 'not-allowed' : 'pointer'};
                transition: all ${transitionDuration} ease;
            `;
            switchEl.style.cssText = switchStyles;

            const trackStyles = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                border-radius: ${config.height / 2}px;
                transition: background-color ${transitionDuration} ease;
            `;
            trackEl.style.cssText = trackStyles;

            const knobEl = container.querySelector('.bili-speed-switch-knob');
            const knobSize = config.knob;
            const knobMargin = (config.height - knobSize) / 2;
            const knobStyles = `
                position: absolute;
                top: ${knobMargin}px;
                left: ${knobMargin}px;
                width: ${knobSize}px;
                height: ${knobSize}px;
                background-color: #fff;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                transition: transform ${transitionDuration} ease;
            `;
            knobEl.style.cssText = knobStyles;

            if (checked) {
                const translateX = config.width - knobSize - knobMargin * 2;
                knobEl.style.transform = `translateX(${translateX}px)`;
                trackEl.style.backgroundColor = '#00aeec';
            }

            function updateState(newChecked) {
                if (disabled) return;

                const isChecked = newChecked;
                if (isChecked) {
                    switchEl.classList.add('checked');
                    trackEl.style.backgroundColor = '#00aeec';
                    knobEl.style.transform = `translateX(${config.width - knobSize - knobMargin * 2}px)`;
                } else {
                    switchEl.classList.remove('checked');
                    trackEl.style.backgroundColor = '#ccc';
                    knobEl.style.transform = 'translateX(0)';
                }
                switchEl.setAttribute('aria-checked', isChecked);

                if (onChange && typeof onChange === 'function') {
                    onChange(isChecked);
                }
            }

            switchEl.addEventListener('click', () => {
                if (disabled) return;
                const newChecked = !switchEl.classList.contains('checked');
                updateState(newChecked);
            });

            switchEl.addEventListener('keydown', (e) => {
                if (disabled) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const newChecked = !switchEl.classList.contains('checked');
                    updateState(newChecked);
                }
            });

            const switchInstance = {
                element: container,
                getValue: () => container.querySelector('.bili-speed-switch').classList.contains('checked'),
                setValue: (value) => updateState(!!value),
                enable: () => {
                    switchEl.classList.remove('disabled');
                    switchEl.style.cursor = 'pointer';
                },
                disable: () => {
                    switchEl.classList.add('disabled');
                    switchEl.style.cursor = 'not-allowed';
                },
                destroy: () => {
                    container.remove();
                }
            };

            return switchInstance;
        }
    };
})();


const AddGroup = (() => {
    function create(onSubmit) {
        const container = document.createElement('div');
        container.className = 'add-group';
        container.style.cssText = `
            display: flex;
            gap: 0;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
        `;

        const form = document.createElement('form');
        form.className = 'input-group';
        form.style.cssText = `
            display: flex;
            width: 100%;
        `;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = form.querySelector('input');
            const name = input.value.trim();
            if (name && onSubmit) {
                await onSubmit(name);
                input.value = '';
            }
        });

        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 20;
        input.placeholder = '最多可输入20个字';
        input.style.cssText = `
            flex: 1;
            padding: 10px 12px;
            border: none;
            outline: none;
            font-size: 14px;
        `;
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const name = input.value.trim();
                if (name && onSubmit) {
                    onSubmit(name);
                    input.value = '';
                }
            }
        });

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'submit';
        submitBtn.textContent = '新建';
        submitBtn.style.cssText = `
            padding: 10px 20px;
            border: none;
            background: #00a1d6;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
        `;

        form.appendChild(input);
        form.appendChild(submitBtn);
        container.appendChild(form);

        return container;
    }

    return {
        create
    };
})();

/**
 * VideoController - 视频倍速控制模块
 */
const VideoController = (() => {
    let video = null;
    const throttledSetRate = Utils.throttle((rate) => {
        VideoController.setRate(rate);
    }, 100);

    return {
        init() {
            video = document.querySelector('video');
            if (!video) {
                Logger.info('未找到视频元素');
                return false;
            }
            Logger.info('视频元素已找到');
            EventBus.emit('video:found', video);
            return true;
        },

        getVideo() {
            return video;
        },

        setRate(rate) {
            if (!video) return;
            const newRate = Math.min(Config.data.maxRate, Math.max(Config.data.minRate, Utils.round2(rate)));
            video.playbackRate = newRate;
            Toast.show(`${newRate}x`);
            Logger.info(`设置倍速: ${newRate}x`);
            EventBus.emit('rate:change', newRate);
        },

        adjustRate(delta) {
            if (!video || Config.data.panelVisible || PageGuard.isInputFocused()) return;
            throttledSetRate(video.playbackRate + delta);
        },

        resetRate() {
            if (!video || Config.data.panelVisible || PageGuard.isInputFocused()) return;
            throttledSetRate(Config.data.defaultRate);
        },

        reset() {
            video = null;
        }
    };
})();

const Storage = (() => {
    const DB_NAME = 'BiliSpeedDB';
    const DB_VERSION = 2;
    const NOTES_STORE = 'notes';
    const FAVORITES_STORE = 'favorites';
    const FAVORITE_GROUPS_STORE = 'favoriteGroups';
    const SETTINGS_STORE = 'settings';

    let db = null;
    let isInitialized = false;

    function openDB() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                Logger.error('打开 IndexedDB 失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                db = request.result;
                Logger.info('IndexedDB 已打开');
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
        const database = event.target.result;
        const oldVersion = event.oldVersion || 0;

        if (oldVersion < 1) {
            if (!database.objectStoreNames.contains(NOTES_STORE)) {
                const notesStore = database.createObjectStore(NOTES_STORE, { keyPath: 'id' });
                notesStore.createIndex('bvid', 'bvid', { unique: false });
                notesStore.createIndex('noteType', 'noteType', { unique: false });
                notesStore.createIndex('createdAt', 'createdAt', { unique: false });
                notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }

            if (!database.objectStoreNames.contains(FAVORITES_STORE)) {
                const favoritesStore = database.createObjectStore(FAVORITES_STORE, { keyPath: 'id' });
                favoritesStore.createIndex('bvid', 'bvid', { unique: false });
                favoritesStore.createIndex('addedAt', 'addedAt', { unique: false });
            }

            if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
                database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
            }
        }

        if (oldVersion < 2) {
            if (!database.objectStoreNames.contains(FAVORITE_GROUPS_STORE)) {
                const groupsStore = database.createObjectStore(FAVORITE_GROUPS_STORE, { keyPath: 'id' });
                groupsStore.createIndex('order', 'order', { unique: false });
                groupsStore.createIndex('isVisible', 'isVisible', { unique: false });
                groupsStore.createIndex('isDefault', 'isDefault', { unique: false });
            }
        }
    };
        });
    }

    async function ensureDB() {
        if (!isInitialized) {
            await openDB();
            isInitialized = true;
        }
        return db;
    }

    function transaction(storeName, mode = 'readonly') {
        return new Promise((resolve, reject) => {
            ensureDB().then(database => {
                const tx = database.transaction(storeName, mode);
                const store = tx.objectStore(storeName);
                resolve({ tx, store });
            }).catch(reject);
        });
    }

    async function getAll(storeName) {
        const { store } = await transaction(storeName, 'readonly');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function get(storeName, id) {
        const { store } = await transaction(storeName, 'readonly');
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function put(storeName, data) {
        const { store } = await transaction(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function remove(storeName, id) {
        const { store } = await transaction(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async function clear(storeName) {
        const { store } = await transaction(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async function count(storeName) {
        const { store } = await transaction(storeName, 'readonly');
        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function getByIndex(storeName, indexName, value) {
        const { store } = await transaction(storeName, 'readonly');
        const index = store.index(indexName);
        return new Promise((resolve, reject) => {
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function getSettings(key) {
        const { store } = await transaction(SETTINGS_STORE, 'readonly');
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    async function setSettings(key, value) {
        const { store } = await transaction(SETTINGS_STORE, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put({ key, value });
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async function migrateFromGM() {
        try {
            const notesData = GM_getValue('notes');
            if (notesData && Array.isArray(notesData)) {
                for (const note of notesData) {
                    await put(NOTES_STORE, note);
                }
                Logger.info(`从 GM 迁移了 ${notesData.length} 条笔记到 IndexedDB`);
            }

            const favoritesData = GM_getValue('favorites');
            if (favoritesData && Array.isArray(favoritesData)) {
                for (const item of favoritesData) {
                    await put(FAVORITES_STORE, item);
                }
                Logger.info(`从 GM 迁移了 ${favoritesData.length} 条收藏到 IndexedDB`);
            }
            return true;
        } catch (err) {
            Logger.error('数据迁移失败:', err);
            return false;
        }
    }

    async function exportData() {
    const notes = await getAll(NOTES_STORE);
    const favorites = await getAll(FAVORITES_STORE);
    return {
        version: '2.0',
        exportedAt: Date.now(),
        notes,
        favorites
    };
}

async function exportFavoritesAsJSON() {
    const favorites = await getAll(FAVORITES_STORE);
    const data = {
        version: '2.0',
        exportedAt: Date.now(),
        type: 'favorites',
        data: favorites
    };
    return downloadJSON(data, `bili-speed-favorites-${Date.now()}.json`);
}

async function exportFavoritesAsCSV() {
    const favorites = await getAll(FAVORITES_STORE);
    const headers = ['id', 'bvid', 'title', 'addedAt'];
    const rows = favorites.map(fav => [
        fav.id,
        fav.bvid,
        `"${(fav.title || '').replace(/"/g, '""')}"`,
        fav.addedAt
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return downloadCSV(csvContent, `bili-speed-favorites-${Date.now()}.csv`);
}

async function exportNotesAsJSON() {
    const notes = await getAll(NOTES_STORE);
    const data = {
        version: '2.0',
        exportedAt: Date.now(),
        type: 'notes',
        data: notes
    };
    return downloadJSON(data, `bili-speed-notes-${Date.now()}.json`);
}

async function exportNotesAsCSV() {
    const notes = await getAll(NOTES_STORE);
    const headers = ['id', 'bvid', 'title', 'noteType', 'content', 'createdAt', 'updatedAt'];
    const rows = notes.map(note => [
        note.id,
        note.bvid,
        `"${(note.title || '').replace(/"/g, '""')}"`,
        note.noteType,
        `"${(note.content || '').replace(/"/g, '""')}"`,
        note.createdAt,
        note.updatedAt
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return downloadCSV(csvContent, `bili-speed-notes-${Date.now()}.csv`);
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    return downloadBlob(blob, filename);
}

function downloadCSV(content, filename) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' });
    return downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
}

    async function importNotes(notesArray) {
        let importedCount = 0;
        for (const note of notesArray) {
            try {
                await put(NOTES_STORE, note);
                importedCount++;
            } catch (err) {
                Logger.warn('导入笔记失败:', note.id, err);
            }
        }
        return importedCount;
    }

    async function importFavorites(favoritesArray) {
        let importedCount = 0;
        for (const item of favoritesArray) {
            try {
                await put(FAVORITES_STORE, item);
                importedCount++;
            } catch (err) {
                Logger.warn('导入收藏失败:', item.id, err);
            }
        }
        return importedCount;
    }

    return {
        init: openDB,
        ensureDB,

        notes: {
            getAll: () => getAll(NOTES_STORE),
            get: (id) => get(NOTES_STORE, id),
            put: (note) => put(NOTES_STORE, note),
            remove: (id) => remove(NOTES_STORE, id),
            clear: () => clear(NOTES_STORE),
            count: () => count(NOTES_STORE),
            getByBvid: (bvid) => getByIndex(NOTES_STORE, 'bvid', bvid),
            getByType: (type) => getByIndex(NOTES_STORE, 'noteType', type)
        },

        favorites: {
            getAll: () => getAll(FAVORITES_STORE),
            get: (id) => get(FAVORITES_STORE, id),
            put: (item) => put(FAVORITES_STORE, item),
            remove: (id) => remove(FAVORITES_STORE, id),
            clear: () => clear(FAVORITES_STORE),
            count: () => count(FAVORITES_STORE),
            getByBvid: (bvid) => getByIndex(FAVORITES_STORE, 'bvid', bvid)
        },

        favoriteGroups: {
            getAll: () => getAll(FAVORITE_GROUPS_STORE),
            get: (id) => get(FAVORITE_GROUPS_STORE, id),
            put: (group) => put(FAVORITE_GROUPS_STORE, group),
            remove: (id) => remove(FAVORITE_GROUPS_STORE, id),
            clear: () => clear(FAVORITE_GROUPS_STORE),
            count: () => count(FAVORITE_GROUPS_STORE),
            getByOrder: (order) => getByIndex(FAVORITE_GROUPS_STORE, 'order', order),
            getByIsVisible: (isVisible) => getByIndex(FAVORITE_GROUPS_STORE, 'isVisible', isVisible),
            getByIsDefault: (isDefault) => getByIndex(FAVORITE_GROUPS_STORE, 'isDefault', isDefault)
        },

        settings: {
            get: getSettings,
            set: setSettings
        },

        migrateFromGM,
        exportData,
        exportFavoritesAsJSON,
        exportFavoritesAsCSV,
        exportNotesAsJSON,
        exportNotesAsCSV,
        importNotes,
        importFavorites
    };
})();

const FavoritesGroups = (() => {
    let isInitialized = false;
    const DEFAULT_GROUP_ID = 'default';

    function generateId() {
        return 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function createDefaultGroup() {
        return {
            id: DEFAULT_GROUP_ID,
            name: '默认收藏夹',
            order: 0,
            isDefault: true,
            isVisible: true,
            isPublic: false,
            description: '',
            image: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    }

    async function ensureInitialized() {
        if (isInitialized) return;

        const groups = await Storage.favoriteGroups.getAll();
        const hasDefault = groups.some(g => g.id === DEFAULT_GROUP_ID);

        if (!hasDefault) {
            const defaultGroup = createDefaultGroup();
            await Storage.favoriteGroups.put(defaultGroup);
            Logger.info('创建了默认收藏夹分组');
        }

        isInitialized = true;
    }

    async function getAll() {
        await ensureInitialized();
        const groups = await Storage.favoriteGroups.getAll();
        return groups.sort((a, b) => a.order - b.order);
    }

    async function getVisibleForModal() {
        await ensureInitialized();
        const groups = await getAll();

        const defaultGroup = groups.find(g => g.id === DEFAULT_GROUP_ID);
        const visibleCustomGroups = groups
            .filter(g => !g.isDefault && g.isVisible)
            .sort((a, b) => a.order - b.order)
            .slice(0, 9);

        const result = [defaultGroup, ...visibleCustomGroups].filter(Boolean);
        return result;
    }

    async function get(id) {
        await ensureInitialized();
        return Storage.favoriteGroups.get(id);
    }

    async function create(name, options = {}) {
        await ensureInitialized();

        const allGroups = await getAll();
        const nextOrder = allGroups.length > 0 
            ? Math.max(...allGroups.map(g => g.order)) + 1 
            : 1;

        const group = {
            id: generateId(),
            name: name || '新分组',
            order: nextOrder,
            isDefault: false,
            isVisible: true,
            isPublic: options.isPublic || false,
            description: options.description || '',
            image: options.image || '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await Storage.favoriteGroups.put(group);
        EventBus.emit('favoriteGroups:created', group);
        EventBus.emit('favoriteGroups:updated');
        Toast.show('分组创建成功');
        return group;
    }

    async function update(id, updates) {
        await ensureInitialized();
        const group = await Storage.favoriteGroups.get(id);

        if (!group) {
            Toast.show('分组不存在');
            return null;
        }

        if (group.isDefault) {
            if (updates.name !== undefined || updates.isDefault !== undefined || updates.isVisible !== undefined) {
                Toast.show('默认分组不可修改');
                return null;
            }
        }

        const updatedGroup = {
            ...group,
            ...updates,
            updatedAt: Date.now()
        };

        await Storage.favoriteGroups.put(updatedGroup);
        EventBus.emit('favoriteGroups:updated', updatedGroup);
        return updatedGroup;
    }

    async function remove(id) {
        await ensureInitialized();
        const group = await Storage.favoriteGroups.get(id);

        if (!group) {
            Toast.show('分组不存在');
            return false;
        }

        if (group.isDefault) {
            Toast.show('默认分组不可删除');
            return false;
        }

        const DEFAULT_GROUP_ID = 'default';

        const allFavorites = await Storage.favorites.getAll();
        let movedCount = 0;

        for (const item of allFavorites) {
            if (item.groups && item.groups.includes(id)) {
                const newGroups = item.groups.filter(g => g !== id);
                if (!newGroups.includes(DEFAULT_GROUP_ID)) {
                    newGroups.push(DEFAULT_GROUP_ID);
                }
                await Storage.favorites.put({ ...item, groups: newGroups });
                movedCount++;
            }
        }

        await Storage.favoriteGroups.remove(id);
        EventBus.emit('favoriteGroups:deleted', group);
        EventBus.emit('favoriteGroups:updated');
        EventBus.emit('favorites:updated');

        if (movedCount > 0) {
            Toast.show(`分组已删除，${movedCount}个收藏已移至默认分组`);
        } else {
            Toast.show('分组删除成功');
        }
        return true;
    }

    async function moveUp(id) {
        await ensureInitialized();
        const groups = await getAll();
        const index = groups.findIndex(g => g.id === id);

        if (index <= 0) {
            Toast.show('已经是第一个了');
            return false;
        }

        const current = groups[index];
        const prev = groups[index - 1];

        if (current.isDefault) {
            if (index >= 10) {
                Toast.show('默认分组不能移出前10位');
                return false;
            }
            [current.order, prev.order] = [prev.order, current.order];
            await Storage.favoriteGroups.put(current);
            await Storage.favoriteGroups.put(prev);
            EventBus.emit('favoriteGroups:updated');
            return true;
        } else {
            if (index < 10) {
                [current.order, prev.order] = [prev.order, current.order];
                await Storage.favoriteGroups.put(current);
                await Storage.favoriteGroups.put(prev);
                EventBus.emit('favoriteGroups:updated');
                return true;
            } else {
                Toast.show('前10个分组位置已固定');
                return false;
            }
        }
    }

    async function moveDown(id) {
        await ensureInitialized();
        const groups = await getAll();
        const index = groups.findIndex(g => g.id === id);

        if (index === -1) {
            Toast.show('分组不存在');
            return false;
        }

        const current = groups[index];
        const next = groups[index + 1];

        if (!next) {
            Toast.show('已经是最后一个了');
            return false;
        }

        if (current.isDefault) {
            if (index >= 9) {
                Toast.show('默认分组不能移出前10位');
                return false;
            }
            [current.order, next.order] = [next.order, current.order];
            await Storage.favoriteGroups.put(current);
            await Storage.favoriteGroups.put(next);
            EventBus.emit('favoriteGroups:updated');
            return true;
        } else {
            if (index < 9) {
                [current.order, next.order] = [next.order, current.order];
                await Storage.favoriteGroups.put(current);
                await Storage.favoriteGroups.put(next);
                EventBus.emit('favoriteGroups:updated');
                return true;
            } else {
                Toast.show('前10个分组位置已固定');
                return false;
            }
        }
    }

    async function setVisible(id, isVisible) {
        await ensureInitialized();
        const group = await Storage.favoriteGroups.get(id);

        if (!group) {
            Toast.show('分组不存在');
            return false;
        }

        if (group.isDefault) {
            Toast.show('默认分组始终可见');
            return false;
        }

        await update(id, { isVisible });
        Toast.show(isVisible ? '分组已显示' : '分组已隐藏');
        return true;
    }

    async function rename(id, newName) {
        await ensureInitialized();
        const group = await Storage.favoriteGroups.get(id);

        if (!group) {
            Toast.show('分组不存在');
            return false;
        }

        if (group.isDefault) {
            Toast.show('默认分组不可重命名');
            return false;
        }

        await update(id, { name: newName });
        Toast.show('分组重命名成功');
        return true;
    }

    return {
        ensureInitialized,
        getAll,
        getVisibleForModal,
        get,
        create,
        update,
        remove,
        moveUp,
        moveDown,
        setVisible,
        rename
    };
})();


const Favorites = (() => {
    const DEFAULT_VIDEO = {
        id: 'BV123456789x',
        bvid: 'BV123456789x',
        title: '默认视频',
        author: '默认UP主',
        duration: 0,
        cover: '',
        url: 'https://www.bilibili.com/video/BV123456789x',
        addedAt: new Date('2026-06-01').getTime(),
        groups: ['default']
    };

    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return str.replace(/[&<>"']/g, char => escapeMap[char]);
    }

    function validateItem(item) {
        if (!item || typeof item !== 'object') return false;
        if (!item.id || typeof item.id !== 'string') return false;
        if (!item.bvid || typeof item.bvid !== 'string') return false;
        if (!item.title || typeof item.title !== 'string') return false;
        if (!item.url || typeof item.url !== 'string') return false;
        return true;
    }

    function sanitizeItem(item) {
        return {
            id: escapeHtml(String(item.id)),
            bvid: escapeHtml(String(item.bvid)),
            title: escapeHtml(String(item.title)),
            author: escapeHtml(String(item.author || '未知')),
            duration: Math.max(0, parseInt(item.duration) || 0),
            cover: escapeHtml(String(item.cover || '')),
            url: escapeHtml(String(item.url)),
            addedAt: parseInt(item.addedAt) || Date.now(),
            groups: item.groups && Array.isArray(item.groups) ? item.groups : ['default']
        };
    }

    async function ensureGroupsInitialized() {
        await FavoritesGroups.ensureInitialized();
    }

    return {
        async add(item, groupIds) {
            await ensureGroupsInitialized();
            if (!validateItem(item)) {
                Logger.warn('无效的收藏项');
                return false;
            }

            const existing = await Storage.favorites.get(item.id);
            
            const groupsToAdd = groupIds && groupIds.length > 0 ? groupIds : ['default'];
            
            if (existing) {
                const currentGroups = existing.groups || ['default'];
                const newGroups = [...new Set([...currentGroups, ...groupsToAdd])];
                const updatedItem = { ...existing, groups: newGroups };
                await Storage.favorites.put(updatedItem);
                EventBus.emit('favorites:updated');
                Toast.show('已更新收藏分组');
                return true;
            }

            const sanitizedItem = sanitizeItem({ ...item, groups: groupsToAdd });
            
            try {
                await Storage.favorites.put(sanitizedItem);
                EventBus.emit('favorites:add', sanitizedItem);
                EventBus.emit('favorites:updated');
                Toast.show('已添加到收藏夹');
                return true;
            } catch (err) {
                Logger.error('添加收藏失败:', err);
                Toast.show('添加收藏失败');
                return false;
            }
        },

        async remove(id, groupId) {
            await ensureGroupsInitialized();
            if (!id) return false;

            const existing = await Storage.favorites.get(id);
            if (!existing) {
                Logger.warn('未找到要删除的收藏项');
                return false;
            }

            if (groupId) {
                const currentGroups = existing.groups || ['default'];
                const newGroups = currentGroups.filter(g => g !== groupId);
                
                if (newGroups.length === 0) {
                    await Storage.favorites.remove(id);
                    Toast.show('已从所有分组移除');
                } else {
                    await Storage.favorites.put({ ...existing, groups: newGroups });
                    Toast.show('已从分组移除');
                }
            } else {
                await Storage.favorites.remove(id);
                Toast.show('已从收藏夹移除');
            }
            
            EventBus.emit('favorites:remove', existing);
            EventBus.emit('favorites:updated');
            return true;
        },

        async get(id) {
            await ensureGroupsInitialized();
            if (!id) return null;
            try {
                return await Storage.favorites.get(id);
            } catch (err) {
                Logger.error('获取收藏失败:', err);
                return null;
            }
        },

        async getAll(groupId) {
            await ensureGroupsInitialized();
            try {
                const all = await Storage.favorites.getAll();
                if (!groupId) return all;
                return all.filter(item => (item.groups || ['default']).includes(groupId));
            } catch (err) {
                Logger.error('获取所有收藏失败:', err);
                return [];
            }
        },

        async has(id, groupId) {
            await ensureGroupsInitialized();
            if (!id) return false;
            const item = await this.get(id);
            if (!item) return false;
            
            if (!groupId) return true;
            return (item.groups || ['default']).includes(groupId);
        },

        async clear() {
            await ensureGroupsInitialized();
            try {
                await Storage.favorites.clear();
                if (typeof GM_setValue === 'function') {
                    GM_setValue('favorites', null);
                }
                EventBus.emit('favorites:clear');
                EventBus.emit('favorites:updated');
                Toast.show('收藏夹已清空');
            } catch (err) {
                Logger.error('清空收藏失败:', err);
                Toast.show('清空收藏失败');
            }
        },

        async count(groupId) {
            await ensureGroupsInitialized();
            try {
                const all = await Storage.favorites.getAll();
                if (!groupId) return all.length;
                return all.filter(item => (item.groups || ['default']).includes(groupId)).length;
            } catch (err) {
                Logger.error('获取收藏数量失败:', err);
                return 0;
            }
        },

        async exportData() {
            await ensureGroupsInitialized();
            const groups = await FavoritesGroups.getAll();
            const data = {
                version: "3.0",
                exportedAt: Date.now(),
                count: await this.count(),
                groups: groups,
                data: await this.getAll()
            };
            return JSON.stringify(data, null, 2);
        },

        async downloadExport() {
            const json = await this.exportData();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bili-favorites-${new Date().toISOString().slice(0, 10)}.json`;
            const target = document.body || document.documentElement;
            target.appendChild(a);
            a.click();
            target.removeChild(a);
            URL.revokeObjectURL(url);
            Toast.show('收藏数据已导出');
        },

        async importData(jsonString) {
            await ensureGroupsInitialized();
            try {
                const data = JSON.parse(jsonString);
                
                if (!data.data || !Array.isArray(data.data)) {
                    throw new Error('无效的数据格式');
                }

                if (data.groups && Array.isArray(data.groups)) {
                    for (const group of data.groups) {
                        const existing = await FavoritesGroups.get(group.id);
                        if (!existing) {
                            await Storage.favoriteGroups.put(group);
                        }
                    }
                }

                const validItems = data.data.filter(item => validateItem(item))
                    .map(item => sanitizeItem(item));

                if (validItems.length === 0) {
                    Toast.show('没有有效的收藏数据');
                    return false;
                }

                let addedCount = 0;

                for (const item of validItems) {
                    const existing = await Storage.favorites.get(item.id);
                    if (!existing) {
                        await Storage.favorites.put(item);
                        addedCount++;
                    }
                }

                if (addedCount > 0) {
                    EventBus.emit('favorites:updated');
                    EventBus.emit('favoriteGroups:updated');
                    Toast.show(`成功导入 ${addedCount} 条收藏`);
                    return true;
                } else {
                    Toast.show('没有新的收藏数据可导入');
                    return false;
                }
            } catch (err) {
                Logger.error('导入收藏数据失败:', err);
                Toast.show('导入失败：数据格式错误');
                return false;
            }
        },

        async removeFromGroup(id, groupId) {
            return this.remove(id, groupId);
        },

        getDefaultVideo() {
            return { ...DEFAULT_VIDEO };
        }
    };
})();

const Notes = (() => {
    const MAX_CONTENT_SIZE = 51200;

    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return str.replace(/[&<>"']/g, char => escapeMap[char]);
    }

    function generateId() {
        return 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }

    function validateNote(note) {
        if (!note || typeof note !== 'object') return false;
        if (!note.id || typeof note.id !== 'string') return false;
        if (!note.noteType || !['videoNote', 'normalNote'].includes(note.noteType)) return false;
        if (note.noteType === 'videoNote' && !note.bvid) return false;
        if (!note.editorType || !['quill', 'vditor'].includes(note.editorType)) return false;
        if (typeof note.title !== 'string') return false;
        if (typeof note.content !== 'string') return false;
        return true;
    }

    function sanitizeNote(note) {
        return {
            id: escapeHtml(String(note.id)),
            noteType: note.noteType === 'normalNote' ? 'normalNote' : 'videoNote',
            bvid: escapeHtml(String(note.bvid || '')),
            videoTitle: escapeHtml(String(note.videoTitle || '未知视频')),
            videoUrl: escapeHtml(String(note.videoUrl || '')),
            editorType: note.editorType === 'vditor' ? 'vditor' : 'quill',
            title: String(note.title || '').substring(0, 200),
            content: String(note.content || ''),
            contentDelta: String(note.contentDelta || ''),
            tags: Array.isArray(note.tags)
                ? note.tags.filter(t => typeof t === 'string').map(t => escapeHtml(t.substring(0, 20))).slice(0, 10)
                : [],
            videoTimestamp: Math.max(0, parseFloat(note.videoTimestamp) || 0),
            createdAt: parseInt(note.createdAt) || Date.now(),
            updatedAt: parseInt(note.updatedAt) || Date.now()
        };
    }

    function checkContentSize(content) {
        try {
            return new Blob([content]).size <= MAX_CONTENT_SIZE;
        } catch {
            return content.length <= MAX_CONTENT_SIZE;
        }
    }

    return {
        async add(note) {
            if (!validateNote(note)) {
                Logger.warn('无效的笔记数据');
                return false;
            }

            if (!checkContentSize(note.content)) {
                Toast.show('笔记内容超出大小限制');
                return false;
            }

            const existing = await Storage.notes.get(note.id);
            if (existing) {
                Logger.info('笔记ID已存在');
                return false;
            }

            const sanitizedNote = sanitizeNote(note);
            
            try {
                await Storage.notes.put(sanitizedNote);
                EventBus.emit('notes:add', sanitizedNote);
                EventBus.emit('notes:updated');
                Toast.show('笔记已保存');
                return true;
            } catch (err) {
                Logger.error('保存笔记失败:', err);
                Toast.show('保存笔记失败');
                return false;
            }
        },

        async update(id, updates) {
            if (!id) return false;

            const existingNote = await Storage.notes.get(id);
            if (!existingNote) {
                Logger.warn('未找到要更新的笔记');
                return false;
            }

            if (updates.content && !checkContentSize(updates.content)) {
                Toast.show('笔记内容超出大小限制');
                return false;
            }

            const updatedNote = { ...existingNote };

            if (updates.title !== undefined) updatedNote.title = String(updates.title).substring(0, 200);
            if (updates.content !== undefined) updatedNote.content = String(updates.content);
            if (updates.contentDelta !== undefined) updatedNote.contentDelta = String(updates.contentDelta);
            if (updates.tags !== undefined) {
                updatedNote.tags = Array.isArray(updates.tags)
                    ? updates.tags.filter(t => typeof t === 'string').map(t => escapeHtml(t.substring(0, 20))).slice(0, 10)
                    : [];
            }
            if (updates.videoTimestamp !== undefined) updatedNote.videoTimestamp = Math.max(0, parseFloat(updates.videoTimestamp) || 0);
            if (updates.videoTitle !== undefined) updatedNote.videoTitle = escapeHtml(String(updates.videoTitle));
            if (updates.videoUrl !== undefined) updatedNote.videoUrl = escapeHtml(String(updates.videoUrl));

            updatedNote.updatedAt = Date.now();

            const sanitizedNote = sanitizeNote(updatedNote);

            try {
                await Storage.notes.put(sanitizedNote);
                EventBus.emit('notes:update', sanitizedNote);
                EventBus.emit('notes:updated');
                Toast.show('笔记已更新');
                return true;
            } catch (err) {
                Logger.error('更新笔记失败:', err);
                Toast.show('更新笔记失败');
                return false;
            }
        },

        async remove(id) {
            if (!id) return false;

            const existingNote = await Storage.notes.get(id);
            if (!existingNote) {
                Logger.warn('未找到要删除的笔记');
                return false;
            }

            try {
                await Storage.notes.remove(id);
                EventBus.emit('notes:remove', existingNote);
                EventBus.emit('notes:updated');
                Toast.show('笔记已删除');
                return true;
            } catch (err) {
                Logger.error('删除笔记失败:', err);
                Toast.show('删除笔记失败');
                return false;
            }
        },

        async get(id) {
            if (!id) return null;
            try {
                return await Storage.notes.get(id);
            } catch (err) {
                Logger.error('获取笔记失败:', err);
                return null;
            }
        },

        async getAll() {
            try {
                return await Storage.notes.getAll();
            } catch (err) {
                Logger.error('获取所有笔记失败:', err);
                return [];
            }
        },

        async getByBvid(bvid) {
            if (!bvid) return [];
            try {
                return await Storage.notes.getByBvid(bvid);
            } catch (err) {
                Logger.error('获取视频笔记失败:', err);
                return [];
            }
        },

        async search(keyword) {
            if (!keyword || typeof keyword !== 'string') {
                return await this.getAll();
            }
            
            const lowerKeyword = keyword.toLowerCase();
            const notes = await this.getAll();
            
            return notes.filter(n =>
                n.title.toLowerCase().includes(lowerKeyword) ||
                n.content.toLowerCase().includes(lowerKeyword) ||
                n.videoTitle.toLowerCase().includes(lowerKeyword) ||
                (n.tags && n.tags.some(t => t.toLowerCase().includes(lowerKeyword)))
            );
        },

        async getByTag(tag) {
            if (!tag) return [];
            const notes = await this.getAll();
            return notes.filter(n => n.tags && n.tags.includes(tag));
        },

        async getAllTags() {
            const notes = await this.getAll();
            const tagSet = new Set();
            notes.forEach(n => {
                if (Array.isArray(n.tags)) {
                    n.tags.forEach(t => tagSet.add(t));
                }
            });
            return Array.from(tagSet).sort();
        },

        async count() {
            try {
                return await Storage.notes.count();
            } catch (err) {
                Logger.error('获取笔记数量失败:', err);
                return 0;
            }
        },

        async countByBvid(bvid) {
            if (!bvid) return 0;
            const notes = await this.getByBvid(bvid);
            return notes.length;
        },

        async countByType(type) {
            if (!type) return 0;
            try {
                const notes = await Storage.notes.getByType(type);
                return notes ? notes.length : 0;
            } catch (err) {
                Logger.error('按类型统计笔记失败:', err);
                return 0;
            }
        },

        async getByType(type) {
            if (!type) return [];
            try {
                return await Storage.notes.getByType(type);
            } catch (err) {
                Logger.error('按类型获取笔记失败:', err);
                return [];
            }
        },

        async clear() {
            try {
                await Storage.notes.clear();
                if (typeof GM_setValue === 'function') {
                    GM_setValue('notes', null);
                }
                EventBus.emit('notes:clear');
                EventBus.emit('notes:updated');
                Toast.show('所有笔记已清空');
            } catch (err) {
                Logger.error('清空笔记失败:', err);
                Toast.show('清空笔记失败');
            }
        },

        async exportData() {
            const data = {
                version: "2.0",
                exportedAt: Date.now(),
                count: await this.count(),
                data: await this.getAll()
            };
            return JSON.stringify(data, null, 2);
        },

        async downloadExport() {
            const json = await this.exportData();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bili-notes-${new Date().toISOString().slice(0, 10)}.json`;
            const target = document.body || document.documentElement;
            target.appendChild(a);
            a.click();
            target.removeChild(a);
            URL.revokeObjectURL(url);
            Toast.show('笔记数据已导出');
        },

        async importData(jsonString) {
            try {
                const data = JSON.parse(jsonString);

                if (!data.data || !Array.isArray(data.data)) {
                    throw new Error('无效的数据格式');
                }

                const validItems = data.data.filter(item => validateNote(item))
                    .map(item => sanitizeNote(item));

                if (validItems.length === 0) {
                    Toast.show('没有有效的笔记数据');
                    return false;
                }

                let addedCount = 0;

                for (const item of validItems) {
                    const existing = await Storage.notes.get(item.id);
                    if (!existing) {
                        await Storage.notes.put(item);
                        addedCount++;
                    }
                }

                if (addedCount > 0) {
                    EventBus.emit('notes:updated');
                    Toast.show(`成功导入 ${addedCount} 条笔记`);
                    return true;
                } else {
                    Toast.show('没有新的笔记数据可导入');
                    return false;
                }
            } catch (err) {
                Logger.error('导入笔记数据失败:', err);
                Toast.show('导入失败：数据格式错误');
                return false;
            }
        }
    };
})();

/**
 * CardPanel - 信息卡片视图
 * 视图层 - 使用Card和Progress组件渲染悬浮信息卡片
 */
const CardPanel = (() => {
    let cardInstance = null;
    let progressInstance = null;
    let playBtn = null;
    let rateEl = null;
    let timeEl = null;
    let collectionEl = null;
    let dragCleanup = null;
    let favoriteBtn = null;
    let noteBtn = null;
    const cleanupFns = new Set();
    let createTimer = null;

    async function updateCard() {
        const video = VideoController.getVideo();
        if (!video || !cardInstance) return;

        if (rateEl) rateEl.textContent = `${video.playbackRate}x`;

        if (timeEl) {
            const remaining = video.duration - video.currentTime;
            timeEl.textContent = `${Utils.formatTime(remaining)} / ${Utils.formatTime(video.duration)}`;
        }

        if (progressInstance) {
            progressInstance.setDuration(video.duration);
            progressInstance.setProgress(video.currentTime);
        }

        if (collectionEl) {
            const isCollection = Utils.isCollection();
            const totalDuration = Utils.getCollectionDuration();
            if (isCollection && totalDuration > 0) {
                collectionEl.textContent = `📚 合集总时长: ${Utils.formatTime(totalDuration)}`;
                collectionEl.style.display = 'block';
            } else {
                collectionEl.style.display = 'none';
            }
        }

        await updateFavoriteBtn();
        await updateNoteBtn();
    }

    function updatePlayBtn(video) {
        if (!video || !playBtn) return;
        playBtn.textContent = video.paused ? '▶' : '⏸';
    }

    async function updateFavoriteBtn() {
        if (!favoriteBtn) return;
        const isFavorited = await FavoritesPanel.isCurrentVideoFavorited();
        favoriteBtn.textContent = isFavorited ? '★' : '☆';
        favoriteBtn.classList.toggle('favorited', isFavorited);
        favoriteBtn.title = isFavorited ? '取消收藏' : '添加收藏';
    }

    async function updateNoteBtn() {
        if (!noteBtn) return;
        const url = location.href;
        const match = url.match(/BV[\w]+/);
        if (match) {
            const count = await Notes.countByBvid(match[0]);
            noteBtn.textContent = count > 0 ? '📝' : '🗒️';
            noteBtn.title = count > 0 ? `当前视频有 ${count} 条笔记` : '打开笔记';
        }
    }

    function createCard() {
        const danmukuBox = document.getElementById('danmukuBox');
        const panelWidth = danmukuBox ? danmukuBox.offsetWidth + 'px' : '260px';

        let savedPosition = Config.data.cardPosition;
        let initialPosition = { left: '20px', bottom: '100px' };

        if (danmukuBox) {
            const rect = danmukuBox.getBoundingClientRect();
            initialPosition = { left: rect.left + 'px', top: rect.top + 'px' };
        }

        if (savedPosition) {
            initialPosition = savedPosition;
        }

        const currentTheme = Config.data.theme || 'light';

        cardInstance = Card.create({
            className: `bili-speed-card theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: `⚡ 倍速: <span class="bili-speed-rate">1.0x</span>`
            },
            footer: { visible: true },
            styles: {
                width: panelWidth,
                display: Config.data.cardVisible ? 'block' : 'none',
                ...(savedPosition ? {
                    left: savedPosition.left,
                    top: savedPosition.top,
                    right: 'auto',
                    bottom: 'auto'
                } : initialPosition)
            },
            onHeaderReady: (headerEl) => {
                rateEl = headerEl.querySelector('.bili-speed-rate');

                const actionsEl = headerEl.querySelector('.bili-speed-card-actions');
                if (!actionsEl) {
                    console.error('actionsEl is null');
                    return;
                }
                
                // 确保 actionsEl 可以点击
                actionsEl.style.zIndex = '1000';
                actionsEl.style.pointerEvents = 'auto';
                actionsEl.style.visibility = 'visible';

                noteBtn = document.createElement('button');
                noteBtn.className = 'bili-speed-note-btn';
                noteBtn.title = '打开笔记';
                noteBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; position: relative; z-index: 1000; pointer-events: auto; transition: all 0.2s;';
                noteBtn.textContent = '🗒️';
                noteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const url = location.href;
                    const match = url.match(/BV[\w]+/);
                    if (match) {
                        const bvid = match[0];
                        const existingNotes = await Notes.getByBvid(bvid);
                        if (existingNotes && existingNotes.length > 0) {
                            const note = existingNotes[0];
                            EventBus.emit('notes:edit', note);
                        } else {
                            EventBus.emit('notes:new');
                        }
                    } else {
                        EventBus.emit('notes:new');
                    }
                });

                favoriteBtn = document.createElement('button');
                favoriteBtn.className = 'bili-speed-favorite-btn';
                favoriteBtn.title = '添加收藏';
                favoriteBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; position: relative; z-index: 1000; pointer-events: auto;';
                favoriteBtn.textContent = '☆';
                favoriteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const url = location.href;
                    const match = url.match(/BV[\w]+/);
                    if (match) {
                        AddToFavoritesModal.show();
                    } else {
                        const defaultVideo = Favorites.getDefaultVideo();
                        AddToFavoritesModal.show(defaultVideo);
                    }
                });

                const settingsBtn = document.createElement('button');
                settingsBtn.className = 'bili-speed-panel-btn';
                settingsBtn.title = `快捷键: ${Config.data.keyReset.toUpperCase()}重置 | ${Config.data.keyUp.toUpperCase()}加速 | ${Config.data.keyDown.toUpperCase()}减速`;
                settingsBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; position: relative; z-index: 1000; pointer-events: auto;';
                settingsBtn.textContent = '⚙️';
                settingsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (EventBus) {
                        EventBus.emit('panel:toggle');
                    }
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-close-btn';
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; position: relative; z-index: 1000; pointer-events: auto;';
                closeBtn.textContent = 'X';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (EventBus) {
                        EventBus.emit('card:toggle');
                    }
                });

                actionsEl.appendChild(noteBtn);
                actionsEl.appendChild(favoriteBtn);
                actionsEl.appendChild(settingsBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'cardPosition', `[class*="-header"]`);

                updateFavoriteBtn();
            },
            onBodyReady: (bodyEl) => {
                bodyEl.innerHTML = `
                    <div>⏱️ 剩余: <span class="bili-speed-time">00:00 / 00:00</span></div>
                    <div class="bili-speed-collection" style="display: none;"></div>
                `;

                timeEl = bodyEl.querySelector('.bili-speed-time');
                collectionEl = bodyEl.querySelector('.bili-speed-collection');
            },
            onFooterReady: (footerEl) => {
                footerEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="bili-speed-play-btn" title="播放/暂停" style="color: #fff; border: none; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">▶</button>
                        <div class="bili-speed-progress-wrapper" style="flex: 1; height: 5px; background: #ddd; border-radius: 2px; cursor: pointer; position: relative;">
                            <div class="bili-speed-progress-bar" style="height: 100%; background: #00AEEC; border-radius: 2px; width: 0%;"></div>
                            <div class="bili-speed-progress-tooltip" style="position: absolute; bottom: 12px; left: 0; background: rgba(0,0,0,0.8); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 12px; display: none; white-space: nowrap; transform: translateX(-50%);"></div>
                        </div>
                    </div>
                `;

                playBtn = footerEl.querySelector('.bili-speed-play-btn');
                const progressWrapper = footerEl.querySelector('.bili-speed-progress-wrapper');
                const progressBar = footerEl.querySelector('.bili-speed-progress-bar');
                const tooltip = footerEl.querySelector('.bili-speed-progress-tooltip');

                let video = VideoController.getVideo();
                updatePlayBtn(video);

                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const v = VideoController.getVideo();
                    if (!v) return;
                    if (v.paused) {
                        v.play();
                    } else {
                        v.pause();
                    }
                });

                let isDraggingProgress = false;
                const getTimeFromPosition = (clientX) => {
                    const v = VideoController.getVideo();
                    if (!v || !v.duration) return 0;
                    const rect = progressWrapper.getBoundingClientRect();
                    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                    return percent * v.duration;
                };

                const updateTooltip = (clientX) => {
                    const v = VideoController.getVideo();
                    if (!v || !v.duration) return;
                    const time = getTimeFromPosition(clientX);
                    const rect = progressWrapper.getBoundingClientRect();
                    const percent = (clientX - rect.left) / rect.width;
                    tooltip.textContent = Utils.formatTime(time);
                    tooltip.style.left = `${percent * 100}%`;
                    tooltip.style.display = 'block';
                };

                const seekVideo = Utils.throttle((time) => {
                    const v = VideoController.getVideo();
                    if (v) v.currentTime = time;
                }, 100);

                const onMouseEnter = (e) => updateTooltip(e.clientX);
                const onMouseMove = (e) => { if (!isDraggingProgress) updateTooltip(e.clientX); };
                const onMouseLeave = () => { if (!isDraggingProgress) tooltip.style.display = 'none'; };

                const onClick = (e) => {
                    const v = VideoController.getVideo();
                    if (!v || !v.duration) return;
                    v.currentTime = getTimeFromPosition(e.clientX);
                };

                const onDragStart = (e) => {
                    const v = VideoController.getVideo();
                    if (!v || !v.duration) return;
                    isDraggingProgress = true;
                    e.preventDefault();
                };

                const onDragMove = (e) => {
                    if (!isDraggingProgress) return;
                    const v = VideoController.getVideo();
                    if (!v || !v.duration) return;
                    updateTooltip(e.clientX);
                    const time = getTimeFromPosition(e.clientX);
                    seekVideo(time);
                    progressBar.style.width = `${(time / v.duration) * 100}%`;
                };

                const onDragEnd = () => {
                    if (isDraggingProgress) {
                        isDraggingProgress = false;
                        tooltip.style.display = 'none';
                    }
                };

                progressWrapper.addEventListener('mouseenter', onMouseEnter);
                progressWrapper.addEventListener('mousemove', onMouseMove);
                progressWrapper.addEventListener('mouseleave', onMouseLeave);
                progressWrapper.addEventListener('click', onClick);
                progressWrapper.addEventListener('mousedown', onDragStart);
                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('mouseup', onDragEnd);

                const cleanupProgress = () => {
                    progressWrapper.removeEventListener('mouseenter', onMouseEnter);
                    progressWrapper.removeEventListener('mousemove', onMouseMove);
                    progressWrapper.removeEventListener('mouseleave', onMouseLeave);
                    progressWrapper.removeEventListener('click', onClick);
                    progressWrapper.removeEventListener('mousedown', onDragStart);
                    document.removeEventListener('mousemove', onDragMove);
                    document.removeEventListener('mouseup', onDragEnd);
                };
                cleanupFns.add(cleanupProgress);

                const updateProgress = () => {
                    const v = VideoController.getVideo();
                    if (!v || !v.duration) return;
                    progressBar.style.width = `${(v.currentTime / v.duration) * 100}%`;
                };

                function attachVideoListeners() {
                    const v = VideoController.getVideo();
                    if (!v) return false;
                    v.addEventListener('timeupdate', updateProgress);
                    cleanupFns.add(() => v.removeEventListener('timeupdate', updateProgress));
                    updateProgress();
                    return true;
                }

                if (!attachVideoListeners()) {
                    const retryTimer = setInterval(() => {
                        if (attachVideoListeners()) {
                            clearInterval(retryTimer);
                        }
                    }, 500);
                    cleanupFns.add(() => clearInterval(retryTimer));
                    video = VideoController.getVideo();
                }
            }
        });

        const video = VideoController.getVideo();
        if (video) {
            const onRateChange = () => updateCard();
            const onTimeUpdate = () => updateCard();
            const onPlay = () => updatePlayBtn(video);
            const onPause = () => updatePlayBtn(video);

            video.addEventListener('ratechange', onRateChange);
            video.addEventListener('timeupdate', onTimeUpdate);
            video.addEventListener('play', onPlay);
            video.addEventListener('pause', onPause);

            cleanupFns.add(() => {
                video.removeEventListener('ratechange', onRateChange);
                video.removeEventListener('timeupdate', onTimeUpdate);
                video.removeEventListener('play', onPlay);
                video.removeEventListener('pause', onPause);
            });

            updateCard();
            updatePlayBtn(video);
            setTimeout(updateCard, 500);
        } else {
            const retryTimer = setInterval(() => {
                const retryVideo = VideoController.getVideo();
                if (retryVideo) {
                    clearInterval(retryTimer);
                    const onRateChange = () => updateCard();
                    const onTimeUpdate = () => updateCard();
                    retryVideo.addEventListener('timeupdate', onTimeUpdate);
                    retryVideo.addEventListener('ratechange', onRateChange);
                    cleanupFns.add(() => {
                        retryVideo.removeEventListener('timeupdate', onTimeUpdate);
                        retryVideo.removeEventListener('ratechange', onRateChange);
                    });
                    updateCard();
                    updatePlayBtn(retryVideo);
                }
            }, 500);
            cleanupFns.add(() => clearInterval(retryTimer));
        }

        EventBus.on('favorites:updated', updateFavoriteBtn);
        EventBus.on('notes:updated', updateNoteBtn);
    }

    return {
        create() {
            if (createTimer) {
                clearTimeout(createTimer);
                createTimer = null;
            }

            if (cardInstance) cardInstance.destroy();
            cleanupFns.forEach(fn => fn());
            cleanupFns.clear();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            progressInstance = null;

            createCard();
        },

        toggle() {
            Config.data.cardVisible = !Config.data.cardVisible;
            if (cardInstance) {
                cardInstance.element.style.display = Config.data.cardVisible ? 'block' : 'none';
            }
        },

        hide() {
            if (cardInstance && Config.data.cardVisible) {
                cardInstance.element.style.display = 'none';
            }
        },

        show() {
            if (cardInstance && Config.data.cardVisible) {
                cardInstance.element.style.display = 'block';
            }
        },

        applyTheme(theme) {
            if (!cardInstance) return;
            const cardEl = cardInstance.element;
            cardEl.classList.remove('theme-light', 'theme-dark');
            cardEl.classList.add(`theme-${theme}`);
        },

        destroy() {
            if (createTimer) {
                clearTimeout(createTimer);
                createTimer = null;
            }
            cleanupFns.forEach(fn => fn());
            cleanupFns.clear();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (progressInstance) progressInstance.destroy();
            progressInstance = null;
            if (cardInstance) cardInstance.destroy();
            cardInstance = null;
            rateEl = null;
            timeEl = null;
            collectionEl = null;
            playBtn = null;
            favoriteBtn = null;
            noteBtn = null;
        }
    };
})();


const SystemMenu = (() => {
    let toggleThemeLocal = null;

    function setToggleThemeCallback(callback) {
        toggleThemeLocal = callback;
    }

    function renderSystemMenu(contentEl) {
        const currentTheme = Config.data.theme || 'light';
        contentEl.innerHTML = `
            <div class="bili-speed-panel-menu-container">
                <div class="bili-speed-panel-menu-section">
                    <div class="bili-speed-panel-menu-title">🎨 主题设置</div>
                    <div class="bili-speed-panel-theme-row">
                        <span class="bili-speed-panel-theme-label">当前主题:</span>
                        <button class="theme-toggle-btn">
                            ${currentTheme === 'dark' ? '🌙' : '☀️'}
                        </button>
                        <span class="bili-speed-panel-theme-status">${currentTheme === 'dark' ? '深色模式' : '浅色模式'}</span>
                    </div>
                </div>
                <div class="bili-speed-panel-tip">
                    💡 提示: 主题设置会应用到所有面板组件
                </div>
                <div class="bili-speed-panel-menu-section bili-speed-panel-export-section">
                    <div class="bili-speed-panel-menu-title">📤 数据导出</div>
                    <div class="bili-speed-panel-export-group">
                        <div class="bili-speed-panel-export-category">⭐ 收藏夹数据</div>
                        <div class="bili-speed-panel-export-buttons">
                            <button class="export-favorites-json">📄 导出为 JSON</button>
                        </div>
                    </div>
                    <div class="bili-speed-panel-export-group">
                        <div class="bili-speed-panel-export-category">📝 笔记数据</div>
                        <div class="bili-speed-panel-export-buttons">
                            <button class="export-notes-json">📄 导出为 JSON</button>
                        </div>
                    </div>
                </div>
                <div class="bili-speed-panel-menu-section bili-speed-panel-cdn-section">
                    <div class="bili-speed-panel-menu-title">📦 编辑器 CDN 资源</div>
                    <div class="bili-speed-panel-cdn-row">
                        <span class="bili-speed-panel-cdn-label">Quill JS:</span>
                        <input type="text" class="cdn-quill-js" value="${Config.data.quillCdnJs}">
                    </div>
                    <div class="bili-speed-panel-cdn-row">
                        <span class="bili-speed-panel-cdn-label">Quill CSS:</span>
                        <input type="text" class="cdn-quill-css" value="${Config.data.quillCdnCss}">
                    </div>
                    <div class="bili-speed-panel-cdn-row">
                        <span class="bili-speed-panel-cdn-label">Vditor JS:</span>
                        <input type="text" class="cdn-vditor-js" value="${Config.data.vditorCdnJs}">
                    </div>
                    <div class="bili-speed-panel-cdn-row">
                        <span class="bili-speed-panel-cdn-label">Vditor CSS:</span>
                        <input type="text" class="cdn-vditor-css" value="${Config.data.vditorCdnCss}">
                    </div>
                    <div class="bili-speed-panel-cdn-buttons">
                        <button class="cdn-save">💾 保存 CDN 配置</button>
                        <button class="cdn-restore">↩️ 恢复默认</button>
                    </div>
                </div>
            </div>
        `;

        const themeBtn = contentEl.querySelector('.theme-toggle-btn');
        themeBtn.addEventListener('click', () => {
            if (toggleThemeLocal) toggleThemeLocal();
        });

        contentEl.querySelector('.export-favorites-json').addEventListener('click', async () => {
            try {
                await Favorites.downloadExport();
            } catch (err) {
                Logger.error('导出收藏夹失败:', err);
                Toast.show('导出失败，请重试');
            }
        });

        contentEl.querySelector('.export-notes-json').addEventListener('click', async () => {
            try {
                await Notes.downloadExport();
            } catch (err) {
                Logger.error('导出笔记失败:', err);
                Toast.show('导出失败，请重试');
            }
        });

        contentEl.querySelector('.cdn-save').addEventListener('click', () => {
            const quillJs = contentEl.querySelector('.cdn-quill-js').value.trim();
            const quillCss = contentEl.querySelector('.cdn-quill-css').value.trim();
            const vditorJs = contentEl.querySelector('.cdn-vditor-js').value.trim();
            const vditorCss = contentEl.querySelector('.cdn-vditor-css').value.trim();
            if (quillJs) Config.data.quillCdnJs = quillJs;
            if (quillCss) Config.data.quillCdnCss = quillCss;
            if (vditorJs) Config.data.vditorCdnJs = vditorJs;
            if (vditorCss) Config.data.vditorCdnCss = vditorCss;
            Toast.show('CDN 配置已保存，刷新后生效');
        });

        contentEl.querySelector('.cdn-restore').addEventListener('click', () => {
            Config.data.quillCdnJs = Config.DEFAULTS.quillCdnJs;
            Config.data.quillCdnCss = Config.DEFAULTS.quillCdnCss;
            Config.data.vditorCdnJs = Config.DEFAULTS.vditorCdnJs;
            Config.data.vditorCdnCss = Config.DEFAULTS.vditorCdnCss;
            contentEl.querySelector('.cdn-quill-js').value = Config.DEFAULTS.quillCdnJs;
            contentEl.querySelector('.cdn-quill-css').value = Config.DEFAULTS.quillCdnCss;
            contentEl.querySelector('.cdn-vditor-js').value = Config.DEFAULTS.vditorCdnJs;
            contentEl.querySelector('.cdn-vditor-css').value = Config.DEFAULTS.vditorCdnCss;
            Toast.show('CDN 配置已恢复默认');
        });
    }

    return {
        render: renderSystemMenu,
        setToggleThemeCallback
    };
})();


const SpeedMenu = (() => {
    function updateButtonStateLocal(contentEl) {
        const buttonGroups = [
            { selector: '.step-btn', dataAttr: 'step', configKey: 'step' },
            { selector: '.default-btn', dataAttr: 'rate', configKey: 'defaultRate' },
            { selector: '.min-rate-btn', dataAttr: 'rate', configKey: 'minRate' },
            { selector: '.max-rate-btn', dataAttr: 'rate', configKey: 'maxRate' }
        ];

        buttonGroups.forEach(({ selector, dataAttr, configKey }) => {
            contentEl.querySelectorAll(selector).forEach(btn => {
                const isActive = parseFloat(btn.dataset[dataAttr]) === Config.data[configKey];
                btn.classList.toggle('active', isActive);
            });
        });
    }

    function validateKey(key) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'f') return false;
        return /^[a-z]$/.test(lowerKey);
    }

    function handleKeyInput(inputId, configKey) {
        const input = document.getElementById(inputId);
        if (!input) return;

        input.addEventListener('input', (e) => {
            let value = e.target.value.toLowerCase();
            if (value === 'f') {
                e.target.value = Config.data[configKey].toUpperCase();
                Toast.show('不支持F键');
                return;
            }
            if (value && !validateKey(value)) {
                e.target.value = Config.data[configKey].toUpperCase();
                return;
            }
            Config.data[configKey] = value || Config.data[configKey];
            e.target.value = Config.data[configKey].toUpperCase();
        });
    }

    function renderSpeedMenu(contentEl) {
        contentEl.innerHTML = `
            <div class="bili-speed-panel-speed-menu">
                <div class="bili-speed-panel-option-group">
                    <div class="bili-speed-panel-option-label">📏 步进值:</div>
                    <div class="bili-speed-panel-button-group">
                        <button class="step-btn" data-step="0.02">0.02</button>
                        <button class="step-btn" data-step="0.05">0.05</button>
                        <button class="step-btn" data-step="0.10">0.10</button>
                    </div>
                </div>
                <div class="bili-speed-panel-option-group">
                    <div class="bili-speed-panel-option-label">🎯 初始倍速:</div>
                    <div class="bili-speed-panel-button-group">
                        <button class="default-btn" data-rate="0.8">0.8x</button>
                        <button class="default-btn" data-rate="0.9">0.9x</button>
                        <button class="default-btn" data-rate="1.0">1.0x</button>
                        <button class="default-btn" data-rate="1.1">1.1x</button>
                        <button class="default-btn" data-rate="1.25">1.25x</button>
                    </div>
                </div>
                <div class="bili-speed-panel-option-group advanced-option" style="display: none;">
                    <div class="bili-speed-panel-option-label">⬇️ 最小倍速:</div>
                    <div class="bili-speed-panel-button-group">
                        <button class="min-rate-btn" data-rate="0.3">0.3x</button>
                        <button class="min-rate-btn" data-rate="0.5">0.5x</button>
                        <button class="min-rate-btn" data-rate="0.6">0.6x</button>
                        <button class="min-rate-btn" data-rate="0.7">0.7x</button>
                    </div>
                </div>
                <div class="bili-speed-panel-option-group advanced-option" style="display: none;">
                    <div class="bili-speed-panel-option-label">⬆️ 最大倍速:</div>
                    <div class="bili-speed-panel-button-group">
                        <button class="max-rate-btn" data-rate="2">2x</button>
                        <button class="max-rate-btn" data-rate="3">3x</button>
                        <button class="max-rate-btn" data-rate="4">4x</button>
                        <button class="max-rate-btn" data-rate="5">5x</button>
                    </div>
                </div>
                <div class="bili-speed-panel-option-group advanced-option" style="display: none;">
                    <div class="bili-speed-panel-option-label">⌨️ 快捷键设置:</div>
                    <div class="bili-speed-panel-keybind-group">
                        <div class="bili-speed-panel-keybind-item">
                            <span>🔄 重置:</span>
                            <input type="text" id="key-reset" maxlength="1" value="${Config.data.keyReset.toUpperCase()}">
                        </div>
                        <div class="bili-speed-panel-keybind-item">
                            <span>⏩ 加速:</span>
                            <input type="text" id="key-up" maxlength="1" value="${Config.data.keyUp.toUpperCase()}">
                        </div>
                        <div class="bili-speed-panel-keybind-item">
                            <span>⏪ 减速:</span>
                            <input type="text" id="key-down" maxlength="1" value="${Config.data.keyDown.toUpperCase()}">
                        </div>
                    </div>
                    <div class="bili-speed-panel-keybind-tip">* 快捷键修改后需刷新网页生效，不支持F键</div>
                </div>
                <div class="bili-speed-panel-action-buttons">
                    <button id="reset-btn">🔄 重置</button>
                    <button id="save-btn">💾 保存</button>
                </div>
            </div>
        `;

        updateButtonStateLocal(contentEl);

        contentEl.querySelectorAll('.step-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.step = parseFloat(btn.dataset.step);
                updateButtonStateLocal(contentEl);
            });
        });

        contentEl.querySelectorAll('.default-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.defaultRate = parseFloat(btn.dataset.rate);
                updateButtonStateLocal(contentEl);
            });
        });

        contentEl.querySelectorAll('.min-rate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.minRate = parseFloat(btn.dataset.rate);
                updateButtonStateLocal(contentEl);
            });
        });

        contentEl.querySelectorAll('.max-rate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.maxRate = parseFloat(btn.dataset.rate);
                updateButtonStateLocal(contentEl);
            });
        });

        handleKeyInput('key-reset', 'keyReset');
        handleKeyInput('key-up', 'keyUp');
        handleKeyInput('key-down', 'keyDown');

        contentEl.querySelector('#reset-btn').addEventListener('click', () => {
            Config.batchUpdate({
                step: Config.DEFAULTS.step,
                minRate: Config.DEFAULTS.minRate,
                maxRate: Config.DEFAULTS.maxRate,
                defaultRate: Config.DEFAULTS.defaultRate,
                keyReset: Config.DEFAULTS.keyReset,
                keyUp: Config.DEFAULTS.keyUp,
                keyDown: Config.DEFAULTS.keyDown
            });
            contentEl.querySelector('#key-reset').value = Config.DEFAULTS.keyReset.toUpperCase();
            contentEl.querySelector('#key-up').value = Config.DEFAULTS.keyUp.toUpperCase();
            contentEl.querySelector('#key-down').value = Config.DEFAULTS.keyDown.toUpperCase();
            updateButtonStateLocal(contentEl);
            EventBus.emit('config:reset');
        });

        contentEl.querySelector('#save-btn').addEventListener('click', () => {
            Config.data.keyReset = contentEl.querySelector('#key-reset').value.toLowerCase() || 'z';
            Config.data.keyUp = contentEl.querySelector('#key-up').value.toLowerCase() || 'x';
            Config.data.keyDown = contentEl.querySelector('#key-down').value.toLowerCase() || 'c';
            const video = VideoController.getVideo();
            if (video && video.playbackRate === Config.data.defaultRate) {
                VideoController.setRate(Config.data.defaultRate);
            }
            EventBus.emit('panel:toggle');
            EventBus.emit('config:saved');
            Toast.show('配置已保存，刷新后生效');
        });
    }

    return {
        render: renderSpeedMenu
    };
})();


const FavoritesMenu = (() => {
    let renderCallback = null;

    function setRenderCallback(callback) {
        renderCallback = callback;
    }

    async function renderFavoritesMenu(contentEl) {
        const favorites = await Favorites.getAll();
        const count = favorites.length;
        
        contentEl.innerHTML = `
            <div class="bili-speed-panel-favorites-menu">
                <div class="bili-speed-panel-favorites-header">
                    <div class="bili-speed-panel-favorites-title">📚 收藏管理</div>
                    <div class="bili-speed-panel-favorites-count">共 ${count} 条收藏</div>
                </div>
                <div class="bili-speed-panel-favorites-action">
                    <button id="export-favorites-btn">
                        <span>📤</span>
                        <span>导出收藏数据</span>
                    </button>
                </div>
                <div class="bili-speed-panel-favorites-action">
                    <button id="import-favorites-btn">
                        <span>📥</span>
                        <span>导入收藏数据</span>
                    </button>
                    <input type="file" id="import-favorites-file" accept=".json">
                </div>
                <div class="bili-speed-panel-favorites-action bili-speed-panel-favorites-action-primary">
                    <button id="open-favorites-panel-btn">
                        <span>⭐</span>
                        <span>打开收藏面板</span>
                    </button>
                </div>
                ${count > 0 ? `
                <div class="bili-speed-panel-favorites-action bili-speed-panel-favorites-action-danger">
                    <button id="clear-favorites-btn">
                        🗑️ 清空所有收藏
                    </button>
                </div>
                ` : ''}
            </div>
        `;

        contentEl.querySelector('#export-favorites-btn').addEventListener('click', () => {
            Favorites.downloadExport();
        });

        const importBtn = contentEl.querySelector('#import-favorites-btn');
        const importFile = contentEl.querySelector('#import-favorites-file');
        
        importBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                await Favorites.importData(event.target.result);
                if (renderCallback) await renderCallback(contentEl);
            };
            reader.readAsText(file);
        });

        contentEl.querySelector('#open-favorites-panel-btn').addEventListener('click', () => {
            EventBus.emit('favorites:toggle');
        });

        const clearBtn = contentEl.querySelector('#clear-favorites-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (confirm('确定要清空所有收藏吗？此操作不可恢复。')) {
                    await Favorites.clear();
                    if (renderCallback) await renderCallback(contentEl);
                }
            });
        }
    }

    return {
        render: renderFavoritesMenu,
        setRenderCallback
    };
})();


const NotesMenu = (() => {
    let renderCallback = null;

    function setRenderCallback(callback) {
        renderCallback = callback;
    }

    function updateEditorBtnState(contentEl, editor) {
        contentEl.querySelectorAll('.editor-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.editor === editor);
        });
        const quillSettings = contentEl.querySelector('.quill-settings');
        const vditorSettings = contentEl.querySelector('.vditor-settings');
        if (quillSettings) quillSettings.style.display = editor === 'quill' ? 'block' : 'none';
        if (vditorSettings) vditorSettings.style.display = editor === 'vditor' ? 'block' : 'none';
    }

    function updateVditorModeState(contentEl, mode) {
        contentEl.querySelectorAll('.vditor-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    async function renderNotesMenu(contentEl) {
        const currentEditor = Config.data.defaultEditor || 'quill';
        const noteCount = await Notes.count();
        const url = location.href;
        const match = url.match(/BV[\w]+/);
        const currentNoteCount = match ? await Notes.countByBvid(match[0]) : 0;

        const currentVditorMode = Config.data.vditorEditorMode || 'ir';
        const currentQuillWidth = Config.data.quillEditorWidth || '520px';
        const currentQuillHeight = Config.data.quillEditorHeight || '500px';
        const currentQuillMinWidth = Config.data.quillEditorMinWidth || '400px';
        const currentQuillMinHeight = Config.data.quillEditorMinHeight || '350px';
        const vditorWidthKey = 'vditorWidth_' + currentVditorMode;
        const vditorHeightKey = 'vditorHeight_' + currentVditorMode;
        const currentVditorWidth = Config.data[vditorWidthKey] || '560px';
        const currentVditorHeight = Config.data[vditorHeightKey] || '550px';
        const currentVditorMinWidth = Config.data['vditorEditorMinWidth_' + currentVditorMode] || '400px';
        const currentVditorMinHeight = Config.data['vditorEditorMinHeight_' + currentVditorMode] || '400px';

        contentEl.innerHTML = `
            <div style="padding: 16px; overflow-y: auto; max-height: 440px;">
                <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 14px; font-weight: bold;">📝 笔记管理</div>
                    <div style="font-size: 12px; color: #999;">共 ${noteCount} 条笔记</div>
                </div>
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 13px; margin-bottom: 8px;">默认编辑器:</div>
                    <div style="display: flex; gap: 8px;">
                        <button class="editor-btn ${currentEditor === 'quill' ? 'active' : ''}" data-editor="quill">Quill 富文本</button>
                        <button class="editor-btn ${currentEditor === 'vditor' ? 'active' : ''}" data-editor="vditor">Vditor Markdown</button>
                    </div>
                </div>
                <div class="quill-settings" style="margin-bottom: 16px; ${currentEditor === 'quill' ? 'display: block;' : 'display: none;'}">
                    <div style="font-size: 13px; margin-bottom: 8px;">📐 Quill 面板尺寸:</div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">宽度:</span>
                        <input type="text" class="quill-width-input" value="${currentQuillWidth}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">高度:</span>
                        <input type="text" class="quill-height-input" value="${currentQuillHeight}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">最小宽度:</span>
                        <input type="text" class="quill-min-width-input" value="${currentQuillMinWidth}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">最小高度:</span>
                        <input type="text" class="quill-min-height-input" value="${currentQuillMinHeight}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button class="quill-size-save" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; cursor: pointer; font-size: 12px;">💾 保存</button>
                        <button class="quill-size-restore" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 12px;">↩️ 恢复默认</button>
                    </div>
                </div>
                <div class="vditor-settings" style="margin-bottom: 16px; ${currentEditor === 'vditor' ? 'display: block;' : 'display: none;'}">
                    <div style="font-size: 13px; margin-bottom: 8px;">Vditor 编辑模式:</div>
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <button class="vditor-mode-btn ${currentVditorMode === 'wysiwyg' ? 'active' : ''}" data-mode="wysiwyg">所见即所得</button>
                        <button class="vditor-mode-btn ${currentVditorMode === 'ir' ? 'active' : ''}" data-mode="ir">即时渲染</button>
                        <button class="vditor-mode-btn ${currentVditorMode === 'sv' ? 'active' : ''}" data-mode="sv">分屏预览</button>
                    </div>
                    <div style="font-size: 13px; margin-bottom: 8px;">📐 Vditor 面板尺寸 (${currentVditorMode === 'wysiwyg' ? '所见即所得' : currentVditorMode === 'ir' ? '即时渲染' : '分屏预览'}):</div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">宽度:</span>
                        <input type="text" class="vditor-width-input" value="${currentVditorWidth}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">高度:</span>
                        <input type="text" class="vditor-height-input" value="${currentVditorHeight}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">最小宽度:</span>
                        <input type="text" class="vditor-min-width-input" value="${currentVditorMinWidth}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">最小高度:</span>
                        <input type="text" class="vditor-min-height-input" value="${currentVditorMinHeight}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button class="vditor-size-save" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; cursor: pointer; font-size: 12px;">💾 保存</button>
                        <button class="vditor-size-restore" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 12px;">↩️ 恢复默认</button>
                    </div>
                </div>
                <div style="margin-bottom: 16px; padding-top: 12px; border-top: 1px solid #eee;">
                    <div style="font-size: 12px; color: #999; margin-bottom: 8px;">当前视频笔记: ${currentNoteCount} 条</div>
                    <button id="open-notes-panel-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: none; background: #00AEEC; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>📝</span>
                        <span>打开笔记面板</span>
                    </button>
                </div>
                <div style="margin-bottom: 16px; display: flex; gap: 8px;">
                    <button id="export-notes-btn" style="flex: 1; padding: 10px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>📤</span>
                        <span>导出</span>
                    </button>
                    <button id="import-notes-btn" style="flex: 1; padding: 10px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>📥</span>
                        <span>导入</span>
                    </button>
                    <input type="file" id="import-notes-file" accept=".json" style="display: none;">
                </div>
                ${noteCount > 0 ? `
                <div style="padding-top: 12px; border-top: 1px solid #eee;">
                    <button id="clear-notes-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ff6b6b; background: #fff; color: #ff6b6b; cursor: pointer;">
                        🗑️ 清空所有笔记
                    </button>
                </div>
                ` : ''}
            </div>
        `;

        contentEl.querySelector('.quill-size-save').addEventListener('click', () => {
            const width = contentEl.querySelector('.quill-width-input').value.trim();
            const height = contentEl.querySelector('.quill-height-input').value.trim();
            const minWidth = contentEl.querySelector('.quill-min-width-input').value.trim();
            const minHeight = contentEl.querySelector('.quill-min-height-input').value.trim();
            if (width) Config.data.quillEditorWidth = width;
            if (height) Config.data.quillEditorHeight = height;
            if (minWidth) Config.data.quillEditorMinWidth = minWidth;
            if (minHeight) Config.data.quillEditorMinHeight = minHeight;
            Toast.show('Quill 面板尺寸已保存');
        });

        contentEl.querySelector('.quill-size-restore').addEventListener('click', () => {
            Config.data.quillEditorWidth = Config.DEFAULTS.quillEditorWidth;
            Config.data.quillEditorHeight = Config.DEFAULTS.quillEditorHeight;
            Config.data.quillEditorMinWidth = Config.DEFAULTS.quillEditorMinWidth;
            Config.data.quillEditorMinHeight = Config.DEFAULTS.quillEditorMinHeight;
            contentEl.querySelector('.quill-width-input').value = Config.DEFAULTS.quillEditorWidth;
            contentEl.querySelector('.quill-height-input').value = Config.DEFAULTS.quillEditorHeight;
            contentEl.querySelector('.quill-min-width-input').value = Config.DEFAULTS.quillEditorMinWidth;
            contentEl.querySelector('.quill-min-height-input').value = Config.DEFAULTS.quillEditorMinHeight;
            Toast.show('Quill 面板尺寸已恢复默认');
        });

        contentEl.querySelectorAll('.editor-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const editor = btn.dataset.editor;
                Config.data.defaultEditor = editor;
                updateEditorBtnState(contentEl, editor);
                Toast.show(`默认编辑器已切换为 ${editor === 'quill' ? 'Quill 富文本' : 'Vditor Markdown'}`);
            });
        });

        contentEl.querySelectorAll('.vditor-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                Config.data.vditorEditorMode = mode;
                updateVditorModeState(contentEl, mode);

                const widthKey = 'vditorWidth_' + mode;
                const heightKey = 'vditorHeight_' + mode;
                const widthVal = Config.data[widthKey] || '560px';
                const heightVal = Config.data[heightKey] || '550px';
                const minWidthKey = 'vditorEditorMinWidth_' + mode;
                const minHeightKey = 'vditorEditorMinHeight_' + mode;
                const minWidthVal = Config.data[minWidthKey] || '400px';
                const minHeightVal = Config.data[minHeightKey] || '400px';

                const vWidthInput = contentEl.querySelector('.vditor-width-input');
                const vHeightInput = contentEl.querySelector('.vditor-height-input');
                if (vWidthInput) vWidthInput.value = widthVal;
                if (vHeightInput) vHeightInput.value = heightVal;
                const vMinWidthInput = contentEl.querySelector('.vditor-min-width-input');
                const vMinHeightInput = contentEl.querySelector('.vditor-min-height-input');
                if (vMinWidthInput) vMinWidthInput.value = minWidthVal;
                if (vMinHeightInput) vMinHeightInput.value = minHeightVal;

                const sizeLabel = contentEl.querySelector('.vditor-settings div:nth-child(3)');
                if (sizeLabel) {
                    const modeNames = { wysiwyg: '所见即所得', ir: '即时渲染', sv: '分屏预览' };
                    sizeLabel.textContent = `📐 Vditor 面板尺寸 (${modeNames[mode] || mode}):`;
                }

                EventBus.emit('vditor:mode:change', mode);

                Toast.show(`Vditor 编辑模式已切换为 ${mode === 'wysiwyg' ? '所见即所得' : mode === 'ir' ? '即时渲染' : '分屏预览'}`);
            });
        });

        contentEl.querySelector('.vditor-size-save').addEventListener('click', () => {
            const mode = Config.data.vditorEditorMode || 'ir';
            const widthKey = 'vditorWidth_' + mode;
            const heightKey = 'vditorHeight_' + mode;
            const minWidthKey = 'vditorEditorMinWidth_' + mode;
            const minHeightKey = 'vditorEditorMinHeight_' + mode;
            const width = contentEl.querySelector('.vditor-width-input').value.trim();
            const height = contentEl.querySelector('.vditor-height-input').value.trim();
            const minWidth = contentEl.querySelector('.vditor-min-width-input').value.trim();
            const minHeight = contentEl.querySelector('.vditor-min-height-input').value.trim();
            if (width) Config.data[widthKey] = width;
            if (height) Config.data[heightKey] = height;
            if (minWidth) Config.data[minWidthKey] = minWidth;
            if (minHeight) Config.data[minHeightKey] = minHeight;
            Toast.show('Vditor 面板尺寸已保存');
        });

        contentEl.querySelector('.vditor-size-restore').addEventListener('click', () => {
            const mode = Config.data.vditorEditorMode || 'ir';
            const widthKey = 'vditorWidth_' + mode;
            const heightKey = 'vditorHeight_' + mode;
            const minWidthKey = 'vditorEditorMinWidth_' + mode;
            const minHeightKey = 'vditorEditorMinHeight_' + mode;
            Config.data[widthKey] = Config.DEFAULTS[widthKey];
            Config.data[heightKey] = Config.DEFAULTS[heightKey];
            Config.data[minWidthKey] = Config.DEFAULTS[minWidthKey];
            Config.data[minHeightKey] = Config.DEFAULTS[minHeightKey];
            contentEl.querySelector('.vditor-width-input').value = Config.DEFAULTS[widthKey];
            contentEl.querySelector('.vditor-height-input').value = Config.DEFAULTS[heightKey];
            contentEl.querySelector('.vditor-min-width-input').value = Config.DEFAULTS[minWidthKey];
            contentEl.querySelector('.vditor-min-height-input').value = Config.DEFAULTS[minHeightKey];
            Toast.show('Vditor 面板尺寸已恢复默认');
        });

        contentEl.querySelector('#open-notes-panel-btn').addEventListener('click', () => {
            EventBus.emit('notes:toggle');
        });

        contentEl.querySelector('#export-notes-btn').addEventListener('click', () => {
            Notes.downloadExport();
        });

        const importBtn = contentEl.querySelector('#import-notes-btn');
        const importFile = contentEl.querySelector('#import-notes-file');

        importBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                await Notes.importData(event.target.result);
                if (renderCallback) await renderCallback(contentEl);
            };
            reader.readAsText(file);
        });

        const clearBtn = contentEl.querySelector('#clear-notes-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (confirm('确定要清空所有笔记吗？此操作不可恢复。')) {
                    try {
                        await Notes.clear();
                        if (renderCallback) await renderCallback(contentEl);
                    } catch (err) {
                        Logger.error('清空笔记失败:', err);
                    }
                }
            });
        }
    }

    return {
        render: renderNotesMenu,
        setRenderCallback
    };
})();


const ControlPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let multiClickCleanup = null;
    let currentMenu = 'speed';

    function applyTheme(theme) {
        if (!panelInstance) return;
        const panelEl = panelInstance.element;
        
        panelEl.classList.remove('theme-light', 'theme-dark');
        panelEl.classList.add(`theme-${theme}`);
        
        const themeBtn = panelEl.querySelector('.theme-toggle-btn');
        if (themeBtn) {
            themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
            themeBtn.title = theme === 'dark' ? '切换到浅色主题' : '切换到深色主题';
        }
    }

    function toggleTheme() {
        const currentTheme = Config.data.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        Config.data.theme = newTheme;
        applyTheme(newTheme);
        EventBus.emit('theme:changed', newTheme);
        Toast.show(`已切换到${newTheme === 'dark' ? '深色' : '浅色'}主题`);
    }

    async function switchMenu(menuName) {
        if (!panelInstance) return;
        
        currentMenu = menuName;
        const panelEl = panelInstance.element;
        
        panelEl.querySelectorAll('.bili-speed-panel-menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.menu === menuName);
        });

        const contentEl = panelEl.querySelector('.bili-speed-panel-content');
        if (!contentEl) return;

        switch (menuName) {
            case 'system':
                SystemMenu.render(contentEl);
                break;
            case 'speed':
                SpeedMenu.render(contentEl);
                break;
            case 'favorites':
                await FavoritesMenu.render(contentEl);
                break;
            case 'notes':
                await NotesMenu.render(contentEl);
                break;
        }
    }

    function createPanel() {
        if (multiClickCleanup) {
            multiClickCleanup();
            multiClickCleanup = null;
        }

        let savedPosition = Config.data.panelPosition;
        const currentTheme = Config.data.theme || 'light';

        panelInstance = Card.create({
            className: `bili-speed-panel theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: '⚙️ 控制面板'
            },
            footer: { visible: false },
            styles: {
                width: '420px',
                display: Config.data.panelVisible ? 'block' : 'none',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 9999,
                ...(savedPosition ? {
                    left: savedPosition.left,
                    top: savedPosition.top,
                    transform: 'none'
                } : {})
            },
            onHeaderReady: (headerEl) => {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-close';
                closeBtn.style.cssText = 'background: none; border: none; color: #000; font-size: 20px; cursor: pointer;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', () => {
                    EventBus.emit('panel:toggle');
                });

                const titleEl = headerEl.querySelector('.bili-speed-panel-drag-text') || headerEl.querySelector('.bili-speed-drag-text');
                const actionsEl = headerEl.querySelector('.bili-speed-panel-actions');
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'panelPosition', `[class*="-header"]`);

                let advancedVisible = false;
                multiClickCleanup = Utils.multiClick(titleEl, 5, () => {
                    advancedVisible = !advancedVisible;
                    const contentEl = panelInstance.element.querySelector('.bili-speed-panel-content');
                    if (contentEl) {
                        contentEl.querySelectorAll('.advanced-option').forEach(item => {
                            item.style.display = advancedVisible ? 'block' : 'none';
                        });
                    }
                    Toast.show(advancedVisible ? '已显示高级选项' : '已隐藏高级选项');
                });
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-panel-body';
                bodyEl.style.cssText = 'padding: 0; display: flex;';

                bodyEl.innerHTML = `
                    <div class="bili-speed-panel-menu" style="width: 120px; border-right: 1px solid #ddd; padding: 8px 0; flex-shrink: 0;">
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'system' ? 'active' : ''}" data-menu="system" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            🔧 系统菜单
                        </div>
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'speed' ? 'active' : ''}" data-menu="speed" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            ⚡ 倍速设置
                        </div>
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'favorites' ? 'active' : ''}" data-menu="favorites" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            ⭐ 收藏夹
                        </div>
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'notes' ? 'active' : ''}" data-menu="notes" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            📝 笔记
                        </div>
                    </div>
                    <div class="bili-speed-panel-content" style="flex: 1; min-height: 300px;"></div>
                `;

                const menuItems = bodyEl.querySelectorAll('.bili-speed-panel-menu-item');
                menuItems.forEach(item => {
                    item.addEventListener('click', () => {
                        void switchMenu(item.dataset.menu);
                    });

                    item.addEventListener('mouseenter', () => {
                        if (!item.classList.contains('active')) {
                            item.style.background = '#f0f0f0';
                        }
                    });

                    item.addEventListener('mouseleave', () => {
                        if (!item.classList.contains('active')) {
                            item.style.background = '';
                        }
                    });
                });

                const contentEl = bodyEl.querySelector('.bili-speed-panel-content');
                void switchMenu(currentMenu);
            }
        });

        const panelStyle = document.createElement('style');
        panelStyle.textContent = `
            .bili-speed-panel button {
                transition: all 0.2s;
            }
            .bili-speed-panel .step-btn,
            .bili-speed-panel .default-btn,
            .bili-speed-panel .min-rate-btn,
            .bili-speed-panel .max-rate-btn {
                padding: 4px 12px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background: #fff;
                color: #000;
                cursor: pointer;
                transition: all 0.2s;
            }
            .bili-speed-panel .step-btn:hover,
            .bili-speed-panel .default-btn:hover,
            .bili-speed-panel .min-rate-btn:hover,
            .bili-speed-panel .max-rate-btn:hover {
                background: #e0e0e0;
            }
            .bili-speed-panel .step-btn.active,
            .bili-speed-panel .default-btn.active,
            .bili-speed-panel .min-rate-btn.active,
            .bili-speed-panel .max-rate-btn.active {
                background: #00AEEC;
                color: #fff;
                border-color: #00AEEC;
            }
            .bili-speed-panel .editor-btn,
            .bili-speed-panel .vditor-mode-btn,
            .bili-speed-panel .editor-size-btn {
                padding: 4px 12px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background: #fff;
                color: #000;
                cursor: pointer;
                transition: all 0.2s;
            }
            .bili-speed-panel .editor-btn:hover,
            .bili-speed-panel .vditor-mode-btn:hover,
            .bili-speed-panel .editor-size-btn:hover {
                background: #e0e0e0;
            }
            .bili-speed-panel .editor-btn.active,
            .bili-speed-panel .vditor-mode-btn.active,
            .bili-speed-panel .editor-size-btn.active {
                background: #00AEEC;
                color: #fff;
                border-color: #00AEEC;
            }
            .bili-speed-panel #reset-btn:hover {
                background: #888 !important;
            }
            .bili-speed-panel #save-btn:hover {
                background: #0099d6 !important;
            }
            .bili-speed-panel #export-favorites-btn:hover,
            .bili-speed-panel #import-favorites-btn:hover,
            .bili-speed-panel #export-notes-btn:hover,
            .bili-speed-panel #import-notes-btn:hover,
            .bili-speed-panel .quill-size-save:hover,
            .bili-speed-panel .quill-size-restore:hover,
            .bili-speed-panel .vditor-size-save:hover,
            .bili-speed-panel .vditor-size-restore:hover {
                background: #e0e0e0;
            }
            .bili-speed-panel #open-favorites-panel-btn:hover,
            .bili-speed-panel #open-notes-panel-btn:hover {
                background: #0099d6 !important;
            }
            .bili-speed-panel #clear-favorites-btn:hover,
            .bili-speed-panel #clear-notes-btn:hover {
                background: #ffe0e0;
            }
            .bili-speed-panel-menu-item.active {
                background: #e6f7ff;
                border-left-color: #00AEEC;
                color: #00AEEC;
            }
            .bili-speed-panel.theme-dark {
                background: #1f1f1f;
                color: #fff;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu {
                border-right-color: #333;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu-item {
                color: #ccc;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu-item:hover {
                background: #333;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu-item.active {
                background: #333;
                border-left-color: #00AEEC;
                color: #00AEEC;
            }
            .bili-speed-panel.theme-dark button {
                color: #fff;
                border-color: #444;
                background: #333;
            }
            .bili-speed-panel.theme-dark button:hover {
                background: #444;
            }
            .bili-speed-panel.theme-dark button.active {
                background: #00AEEC;
                border-color: #00AEEC;
            }
            .bili-speed-panel.theme-dark #reset-btn:hover {
                background: #555 !important;
            }
            .bili-speed-panel.theme-dark #save-btn:hover,
            .bili-speed-panel.theme-dark #open-favorites-panel-btn:hover,
            .bili-speed-panel.theme-dark #open-notes-panel-btn:hover {
                background: #0088b3 !important;
            }
            .bili-speed-panel.theme-dark #export-favorites-btn:hover,
            .bili-speed-panel.theme-dark #import-favorites-btn:hover,
            .bili-speed-panel.theme-dark #export-notes-btn:hover,
            .bili-speed-panel.theme-dark #import-notes-btn:hover,
            .bili-speed-panel.theme-dark .quill-size-save:hover,
            .bili-speed-panel.theme-dark .quill-size-restore:hover,
            .bili-speed-panel.theme-dark .vditor-size-save:hover,
            .bili-speed-panel.theme-dark .vditor-size-restore:hover {
                background: #444 !important;
            }
            .bili-speed-panel.theme-dark #clear-favorites-btn:hover,
            .bili-speed-panel.theme-dark #clear-notes-btn:hover {
                background: #553333 !important;
                border-color: #ff6b6b !important;
            }
            .bili-speed-panel.theme-dark input {
                background: #333;
                color: #fff;
                border-color: #444;
            }
            .bili-speed-panel.theme-dark .bili-speed-close {
                color: #fff;
            }
        `;
        if (!document.querySelector('#bili-speed-panel-style')) {
            panelStyle.id = 'bili-speed-panel-style';
            document.head.appendChild(panelStyle);
        }

        SystemMenu.setToggleThemeCallback(toggleTheme);
        FavoritesMenu.setRenderCallback(FavoritesMenu.render);
        NotesMenu.setRenderCallback(NotesMenu.render);
    }

    return {
        create() {
            if (panelInstance) panelInstance.destroy();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (multiClickCleanup) {
                multiClickCleanup();
                multiClickCleanup = null;
            }

            createPanel();
        },

        toggle() {
            Config.data.panelVisible = !Config.data.panelVisible;
            if (panelInstance) {
                panelInstance.element.style.display = Config.data.panelVisible ? 'block' : 'none';
            }
        },

        switchMenu(menuName) {
            void switchMenu(menuName);
        },

        applyTheme(theme) {
            applyTheme(theme);
        },

        destroy() {
            if (multiClickCleanup) {
                multiClickCleanup();
                multiClickCleanup = null;
            }
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
        }
    };
})();


const AddToFavoritesModal = (() => {
    let panelInstance = null;
    let currentVideoInfo = null;
    let selectedGroups = [];
    let confirmBtn = null;

    function getCurrentVideoInfo() {
        const url = location.href;
        const match = url.match(/BV[\w]+/);
        if (!match) return null;

        const bvid = match[0];
        const video = VideoController.getVideo();

        let title = document.querySelector('h1.video-title, .video-title-href, h1[class*="title"]')?.textContent?.trim() || '未知标题';
        let author = document.querySelector('.up-name, a.up-name, [class*="up-name"]')?.textContent?.trim() || '未知UP主';
        let cover = document.querySelector('meta[property="og:image"]')?.content || '';

        return {
            id: bvid,
            bvid: bvid,
            title: title,
            author: author,
            duration: video ? video.duration : 0,
            cover: cover,
            url: url,
            addedAt: Date.now()
        };
    }

    function updateConfirmButtonState() {
        if (!confirmBtn) return;

        if (selectedGroups.length > 0) {
            confirmBtn.disabled = false;
            confirmBtn.style.background = '#00a1d6';
            confirmBtn.style.cursor = 'pointer';
        } else {
            confirmBtn.disabled = true;
            confirmBtn.style.background = '#CCCECF';
            confirmBtn.style.cursor = 'not-allowed';
        }
    }

    function createAddGroupForm(container, onComplete) {
        const form = document.createElement('form');
        form.className = 'input-group';
        form.style.cssText = `
            display: flex;
            gap: 0;
            border: 1px dashed #ddd;
            border-radius: 4px;
            overflow: hidden;
        `;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = form.querySelector('input');
            const name = input.value.trim();
            if (name && onComplete) {
                try {
                    await FavoritesGroups.create(name, {
                        isPublic: false,
                        description: '',
                        image: ''
                    });
                    Toast.show('分组创建成功');
                    await onComplete();
                } catch (error) {
                    Logger.error('创建分组失败:', error);
                    Toast.show('创建失败，请重试');
                }
            }
        });

        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 20;
        input.placeholder = '最多可输入20个字';
        input.style.cssText = `
            flex: 1;
            padding: 10px 12px;
            border: none;
            outline: none;
            font-size: 14px;
            background: transparent;
        `;

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'submit';
        submitBtn.textContent = '新建';
        submitBtn.style.cssText = `
            padding: 10px 20px;
            border: none;
            background: #00a1d6;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
        `;

        form.appendChild(input);
        form.appendChild(submitBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            padding: 10px 16px;
            border: none;
            background: transparent;
            color: #999;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelBtn.addEventListener('click', () => {
            onComplete();
        });

        const rowEl = document.createElement('div');
        rowEl.style.cssText = `
            display: flex;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        `;
        rowEl.appendChild(form);
        rowEl.appendChild(cancelBtn);

        container.innerHTML = '';
        container.appendChild(rowEl);

        input.focus();
    }

    function createAddButton(container, onClick) {
        const addBtn = document.createElement('button');
        addBtn.className = 'group-item add-group-btn';
        addBtn.style.cssText = `
            width: 100%;
            display: flex;
            align-items: center;
            padding: 10px 0;
            border: none;
            border-bottom: 1px solid #eee;
            background: transparent;
            color: #999;
            cursor: pointer;
            font-size: 14px;
            justify-content: flex-start;
            gap: 6px;
        `;
        addBtn.innerHTML = '<span style="font-size: 16px;">+</span> 新建收藏夹';
        addBtn.addEventListener('click', onClick);
        container.innerHTML = '';
        container.appendChild(addBtn);
    }

    async function renderGroupsList(bodyEl) {
        const container = bodyEl.querySelector('.groups-container');
        if (!container) return;

        container.innerHTML = '';

        const groups = await FavoritesGroups.getVisibleForModal();
        const existingItem = currentVideoInfo ? await Favorites.get(currentVideoInfo.id) : null;
        const existingGroups = existingItem ? (existingItem.groups || ['default']) : [];

        selectedGroups = [...existingGroups];
        updateConfirmButtonState();

        groups.forEach(group => {
            const itemEl = document.createElement('div');
            itemEl.className = 'group-item';
            itemEl.style.cssText = `
                display: flex;
                align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid #eee;
                cursor: pointer;
            `;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.cssText = `
                width: 18px;
                height: 18px;
                margin-right: 10px;
                cursor: pointer;
            `;
            checkbox.checked = selectedGroups.includes(group.id);

            const nameEl = document.createElement('span');
            nameEl.style.cssText = `
                flex: 1;
                font-size: 14px;
                color: #333;
            `;
            nameEl.textContent = group.name;

            if (group.isDefault) {
                const badgeEl = document.createElement('span');
                badgeEl.style.cssText = `
                    background: #00a1d6;
                    color: #fff;
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    margin-left: 8px;
                `;
                badgeEl.textContent = '默认';
                nameEl.appendChild(badgeEl);
            }

            itemEl.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
                handleCheckboxChange(group.id, checkbox.checked);
            });

            checkbox.addEventListener('change', () => {
                handleCheckboxChange(group.id, checkbox.checked);
            });

            itemEl.appendChild(checkbox);
            itemEl.appendChild(nameEl);
            container.appendChild(itemEl);
        });

        const addContainer = document.createElement('div');
        addContainer.className = 'add-group-container';
        container.appendChild(addContainer);

        createAddButton(addContainer, () => {
            createAddGroupForm(addContainer, async () => {
                await renderGroupsList(bodyEl);
            });
        });
    }

    function handleCheckboxChange(groupId, checked) {
        if (checked) {
            if (!selectedGroups.includes(groupId)) {
                selectedGroups.push(groupId);
            }
        } else {
            selectedGroups = selectedGroups.filter(id => id !== groupId);
        }
        updateConfirmButtonState();
    }

    async function createPanel(videoInfo) {
        currentVideoInfo = videoInfo || getCurrentVideoInfo();

        panelInstance = Card.create({
            className: 'add-to-favorites-modal',
            header: {
                visible: true,
                draggable: true,
                title: '添加到收藏夹'
            },
            footer: { visible: false },
            styles: {
                width: '380px',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 99999
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.add-to-favorites-modal-actions');

                const closeBtn = document.createElement('button');
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    destroy();
                });

                actionsEl.appendChild(closeBtn);
            },
            onBodyReady: async (bodyEl) => {
                bodyEl.style.cssText = 'padding: 16px;';

                const titleEl = document.createElement('div');
                titleEl.style.cssText = `
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 12px;
                    text-align: center;
                `;
                titleEl.textContent = currentVideoInfo ? `收藏：${currentVideoInfo.title}` : '请选择分组';
                bodyEl.appendChild(titleEl);

                const hintEl = document.createElement('div');
                hintEl.style.cssText = `
                    font-size: 12px;
                    color: #999;
                    margin-bottom: 12px;
                    text-align: center;
                    padding: 8px;
                    background: #f5f5f5;
                    border-radius: 4px;
                `;
                hintEl.textContent = '提示：最多显示10个分组，支持多选';
                bodyEl.appendChild(hintEl);

                const container = document.createElement('div');
                container.className = 'groups-container';
                container.style.cssText = `
                    max-height: 300px;
                    overflow-y: auto;
                `;
                bodyEl.appendChild(container);

                const btnContainer = document.createElement('div');
                btnContainer.style.cssText = `
                    display: flex;
                    margin-top: 16px;
                `;

                confirmBtn = document.createElement('button');
                confirmBtn.textContent = '确认';
                confirmBtn.style.cssText = `
                    flex: 1;
                    padding: 10px 16px;
                    border: none;
                    border-radius: 4px;
                    background: #CCCECF;
                    color: #fff;
                    cursor: not-allowed;
                `;
                confirmBtn.disabled = true;
                confirmBtn.addEventListener('click', async () => {
                    if (currentVideoInfo && selectedGroups.length > 0) {
                        await Favorites.add(currentVideoInfo, selectedGroups);
                    }
                    destroy();
                });

                btnContainer.appendChild(confirmBtn);
                bodyEl.appendChild(btnContainer);

                await renderGroupsList(bodyEl);
            }
        });
    }

    function show(videoInfo) {
        if (panelInstance) {
            destroy();
        }
        createPanel(videoInfo);
    }

    function destroy() {
        if (panelInstance) {
            panelInstance.destroy();
            panelInstance = null;
        }
        currentVideoInfo = null;
        selectedGroups = [];
        confirmBtn = null;
    }

    return {
        show,
        destroy
    };
})();

const FavoritesPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let currentPage = 1;
    let paginationInstance = null;
    let currentGroupId = null;
    const pageSize = 10;

    function getCurrentVideoInfo() {
        const url = location.href;
        const match = url.match(/BV[\w]+/);
        if (!match) return null;

        const bvid = match[0];
        const video = VideoController.getVideo();

        let title = document.querySelector('h1.video-title, .video-title-href, h1[class*="title"]')?.textContent?.trim() || '未知标题';
        let author = document.querySelector('.up-name, a.up-name, [class*="up-name"]')?.textContent?.trim() || '未知UP主';
        let cover = document.querySelector('meta[property="og:image"]')?.content || '';

        return {
            id: bvid,
            bvid: bvid,
            title: title,
            author: author,
            duration: video ? video.duration : 0,
            cover: cover,
            url: url,
            addedAt: Date.now()
        };
    }

    function renderFavoriteItem(item, containerEl, groupMap) {
        const itemEl = document.createElement('div');
        itemEl.className = 'bili-speed-favorite-item';
        itemEl.dataset.id = item.id;
        itemEl.style.cssText = `
            display: flex;
            gap: 12px;
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
            position: relative;
        `;

        const coverEl = document.createElement('img');
        coverEl.src = item.cover || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect fill="%23ddd" width="60" height="60"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">暂无</text></svg>';
        coverEl.style.cssText = `
            width: 60px;
            height: 60px;
            border-radius: 4px;
            object-fit: cover;
            flex-shrink: 0;
        `;
        coverEl.onerror = () => {
            coverEl.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect fill="%23ddd" width="60" height="60"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">暂无</text></svg>';
        };

        const infoEl = document.createElement('div');
        infoEl.style.cssText = `
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
        `;

        const titleEl = document.createElement('div');
        titleEl.className = 'bili-speed-favorite-title';
        titleEl.textContent = item.title;
        titleEl.style.cssText = `
            font-size: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;

        const metaEl = document.createElement('div');
        metaEl.style.cssText = `
            font-size: 12px;
            color: #999;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        `;

        const authorEl = document.createElement('span');
        authorEl.textContent = item.author;

        const durationEl = document.createElement('span');
        durationEl.textContent = Utils.formatTime(item.duration);

        const groupsContainer = document.createElement('div');
        groupsContainer.style.cssText = `
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        `;
        if (item.groups && item.groups.length > 0) {
            item.groups.forEach(groupId => {
                const groupBadge = document.createElement('span');
                groupBadge.style.cssText = `
                    background: #e6f7ff;
                    color: #1890ff;
                    padding: 0 4px;
                    border-radius: 2px;
                    font-size: 10px;
                `;
                const groupName = groupMap.get(groupId) || (groupId === 'default' ? '默认' : groupId);
                groupBadge.textContent = groupName;
                groupsContainer.appendChild(groupBadge);
            });
        }

        metaEl.appendChild(authorEl);
        metaEl.appendChild(durationEl);
        metaEl.appendChild(groupsContainer);

        infoEl.appendChild(titleEl);
        infoEl.appendChild(metaEl);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'bili-speed-favorite-delete';
        deleteBtn.textContent = '×';
        deleteBtn.style.cssText = `
            position: absolute;
            right: 4px;
            top: 4px;
            background: rgba(255, 0, 0, 0.8);
            color: #fff;
            border: none;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            font-size: 12px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        itemEl.appendChild(coverEl);
        itemEl.appendChild(infoEl);
        itemEl.appendChild(deleteBtn);

        itemEl.addEventListener('mouseenter', () => {
            deleteBtn.style.opacity = '1';
            itemEl.style.background = '#f5f5f5';
        });

        itemEl.addEventListener('mouseleave', () => {
            deleteBtn.style.opacity = '0';
            itemEl.style.background = '';
        });

        itemEl.addEventListener('click', (e) => {
            if (e.target === deleteBtn) return;
            window.open(item.url, '_blank');
        });

        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await Favorites.remove(item.id);
        });

        return itemEl;
    }

    async function renderFavoritesList(containerEl) {
        containerEl.innerHTML = '';

        const allFavorites = await Favorites.getAll(currentGroupId);
        const total = allFavorites.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const start = (currentPage - 1) * pageSize;
        const pageData = allFavorites.slice(start, start + pageSize);

        const groups = await FavoritesGroups.getAll();
        const groupMap = new Map();
        groups.forEach(group => {
            groupMap.set(group.id, group.name);
        });

        if (pageData.length === 0) {
            containerEl.innerHTML = `
                <div style="text-align: center; padding: 40px 0; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 8px;">📭</div>
                    <div>暂无收藏</div>
                </div>
            `;
        } else {
            pageData.forEach(item => {
                containerEl.appendChild(renderFavoriteItem(item, containerEl, groupMap));
            });
        }

        if (paginationInstance) {
            paginationInstance.setTotal(total);
        }
    }

    async function createPanel() {
        let savedPosition = Config.data.favoritesPanelPosition;
        const currentTheme = Config.data.theme || 'light';

        panelInstance = Card.create({
            className: `bili-speed-favorites-panel theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: '⭐ 收藏夹'
            },
            footer: { visible: false },
            styles: {
                width: '320px',
                display: Config.data.favoritesPanelVisible ? 'block' : 'none',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 9999,
                ...(savedPosition ? {
                    left: savedPosition.left,
                    top: savedPosition.top,
                    transform: 'none'
                } : {})
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.bili-speed-favorites-panel-actions');

                const manageBtn = document.createElement('button');
                manageBtn.title = '管理分组';
                manageBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;';
                manageBtn.textContent = '📁';
                manageBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    FavoritesGroupPanel.show();
                });

                const exportBtn = document.createElement('button');
                exportBtn.className = 'bili-speed-favorites-export';
                exportBtn.title = '导出收藏数据';
                exportBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;';
                exportBtn.textContent = '📤';
                exportBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    Favorites.downloadExport();
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-favorites-close';
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    EventBus.emit('favorites:toggle');
                });

                actionsEl.appendChild(manageBtn);
                actionsEl.appendChild(exportBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'favoritesPanelPosition', `[class*="-header"]`);
            },
            onBodyReady: async (bodyEl) => {
                bodyEl.className = 'bili-speed-favorites-panel-body';
                bodyEl.style.cssText = 'padding: 8px; max-height: 400px; overflow-y: auto; display: flex; flex-direction: column;';

                const filterContainer = document.createElement('div');
                filterContainer.style.cssText = `
                    display: flex;
                    gap: 4px;
                    flex-wrap: wrap;
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #eee;
                `;

                const allBtn = document.createElement('button');
                allBtn.textContent = '全部';
                allBtn.style.cssText = `
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    background: ${!currentGroupId ? '#00a1d6' : '#fff'};
                    color: ${!currentGroupId ? '#fff' : '#666'};
                    cursor: pointer;
                    font-size: 12px;
                `;
                allBtn.addEventListener('click', async () => {
                    currentGroupId = null;
                    currentPage = 1;
                    await renderGroupsFilter(filterContainer);
                    await renderFavoritesList(listEl);
                });

                filterContainer.appendChild(allBtn);

                const listEl = document.createElement('div');
                listEl.className = 'bili-speed-favorites-list';
                bodyEl.appendChild(filterContainer);
                bodyEl.appendChild(listEl);

                const paginationContainer = document.createElement('div');
                paginationContainer.className = 'bili-speed-favorites-pagination';
                bodyEl.appendChild(paginationContainer);

                currentPage = 1;
                if (paginationInstance) {
                    paginationInstance.destroy();
                    paginationInstance = null;
                }

                paginationInstance = Pagination.create({
                    container: paginationContainer,
                    total: 0,
                    pageSize: pageSize,
                    currentPage: 1,
                    theme: Config.data.theme || 'light',
                    onChange: async (page) => {
                        currentPage = page;
                        const list = bodyEl.querySelector('.bili-speed-favorites-list');
                        if (list) await renderFavoritesList(list);
                    }
                });

                async function renderGroupsFilter(container) {
                    const existingButtons = container.querySelectorAll('button:not(:first-child)');
                    existingButtons.forEach(btn => btn.remove());

                    const groups = await FavoritesGroups.getAll();
                    groups.forEach(group => {
                        const btn = document.createElement('button');
                        btn.textContent = group.name;
                        btn.style.cssText = `
                            padding: 4px 8px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            background: ${currentGroupId === group.id ? '#00a1d6' : '#fff'};
                            color: ${currentGroupId === group.id ? '#fff' : '#666'};
                            cursor: pointer;
                            font-size: 12px;
                        `;
                        btn.addEventListener('click', async () => {
                            currentGroupId = group.id;
                            currentPage = 1;
                            await renderGroupsFilter(container);
                            await renderFavoritesList(listEl);
                        });
                        container.appendChild(btn);
                    });

                    const allButton = container.querySelector('button:first-child');
                    if (allButton) {
                        allButton.style.background = !currentGroupId ? '#00a1d6' : '#fff';
                        allButton.style.color = !currentGroupId ? '#fff' : '#666';
                    }
                }

                await renderGroupsFilter(filterContainer);
                await renderFavoritesList(listEl);

                EventBus.on('favorites:updated', async () => {
                    if (panelInstance && bodyEl) {
                        currentPage = 1;
                        const list = bodyEl.querySelector('.bili-speed-favorites-list');
                        if (list) await renderFavoritesList(list);
                    }
                });

                EventBus.on('favoriteGroups:updated', async () => {
                    if (panelInstance && bodyEl) {
                        await renderGroupsFilter(filterContainer);
                        await renderFavoritesList(listEl);
                    }
                });
            }
        });
    }

    return {
        create() {
            if (panelInstance) panelInstance.destroy();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;

            createPanel();
        },

        toggle() {
            Config.data.favoritesPanelVisible = !Config.data.favoritesPanelVisible;
            if (panelInstance) {
                panelInstance.element.style.display = Config.data.favoritesPanelVisible ? 'block' : 'none';
            }
        },

        show() {
            Config.data.favoritesPanelVisible = true;
            if (panelInstance) {
                panelInstance.element.style.display = 'block';
            }
        },

        hide() {
            Config.data.favoritesPanelVisible = false;
            if (panelInstance) {
                panelInstance.element.style.display = 'none';
            }
        },

        applyTheme(theme) {
            if (!panelInstance) return;
            const el = panelInstance.element;
            el.classList.remove('theme-light', 'theme-dark');
            el.classList.add(`theme-${theme}`);
            if (paginationInstance) {
                paginationInstance.setTheme(theme);
            }
        },

        async addCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }
            return await Favorites.add(videoInfo);
        },

        async removeCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }
            return await Favorites.remove(videoInfo.id);
        },

        async toggleCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }

            if (await Favorites.has(videoInfo.id)) {
                return await Favorites.remove(videoInfo.id);
            } else {
                return await Favorites.add(videoInfo);
            }
        },

        async isCurrentVideoFavorited() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) return false;
            return await Favorites.has(videoInfo.id);
        },

        destroy() {
            if (paginationInstance) {
                paginationInstance.destroy();
                paginationInstance = null;
            }
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
        }
    };
})();


const FavoritesGroupPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let paginationInstance = null;
    let currentPage = 1;
    let groupsUpdateHandler = null;
    const pageSize = 10;

    async function renderGroupsList(containerEl) {
        containerEl.innerHTML = '';

        const allGroups = await FavoritesGroups.getAll();
        const total = allGroups.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const start = (currentPage - 1) * pageSize;
        const pageGroups = allGroups.slice(start, start + pageSize);

        if (pageGroups.length === 0) {
            containerEl.innerHTML = `
                <div style="text-align: center; padding: 40px 0; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 8px;">📁</div>
                    <div>暂无分组</div>
                </div>
            `;
        } else {
            const totalGroups = allGroups.length;
            pageGroups.forEach((group, pageIndex) => {
                const globalIndex = (currentPage - 1) * pageSize + pageIndex;
                containerEl.appendChild(renderGroupItem(group, containerEl, globalIndex, totalGroups));
            });
        }

        if (paginationInstance) {
            paginationInstance.setTotal(total);
            paginationInstance.setCurrentPage(currentPage);
        }
    }

    function renderGroupItem(group, containerEl, index, total) {
        const isFirst = index === 0;
        const isLast = index === total - 1;
        const itemEl = document.createElement('div');
        itemEl.className = 'group-management-item';
        itemEl.style.cssText = `
            display: flex;
            align-items: center;
            padding: 12px 8px;
            border-bottom: 1px solid #eee;
        `;

        const nameEl = document.createElement('div');
        nameEl.style.cssText = `
            flex: 1;
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        const imageContainer = document.createElement('div');
        imageContainer.className = 'group-image-container';
        imageContainer.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 6px;
            overflow: hidden;
            flex-shrink: 0;
            background: #f0f0f0;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        if (group.image) {
            const img = document.createElement('img');
            img.src = group.image;
            img.className = 'group-thumbnail';
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;
            img.onerror = () => {
                imageContainer.innerHTML = '<span style="font-size: 20px;">📁</span>';
            };
            imageContainer.appendChild(img);
        } else {
            const defaultIcon = document.createElement('span');
            defaultIcon.style.cssText = 'font-size: 20px;';
            defaultIcon.textContent = '📁';
            imageContainer.appendChild(defaultIcon);
        }

        const nameTextEl = document.createElement('span');
        nameTextEl.style.cssText = `
            font-size: 14px;
            color: #333;
        `;
        nameTextEl.textContent = group.name;

        nameEl.appendChild(imageContainer);
        nameEl.appendChild(nameTextEl);

        const statusEl = document.createElement('span');
        statusEl.style.cssText = `
            font-size: 12px;
            color: ${group.isVisible ? '#52c41a' : '#999'};
            margin-right: 12px;
        `;
        statusEl.textContent = group.isVisible ? '显示中' : '已隐藏';

        const actionsEl = document.createElement('div');
        actionsEl.style.cssText = `
            display: flex;
            gap: 4px;
        `;

        if (!group.isDefault) {
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '删除';
            deleteBtn.style.cssText = `
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #fff;
                cursor: pointer;
                font-size: 12px;
            `;
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`确定要删除分组「${group.name}」吗？该分组下的收藏不会被删除。`)) {
                    await FavoritesGroups.remove(group.id);
                }
            });

            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = group.isVisible ? '隐藏' : '显示';
            toggleBtn.style.cssText = `
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #fff;
                cursor: pointer;
                font-size: 12px;
            `;
            toggleBtn.addEventListener('click', async () => {
                await FavoritesGroups.setVisible(group.id, !group.isVisible);
            });

            actionsEl.appendChild(deleteBtn);
            actionsEl.appendChild(toggleBtn);
        }

        const publicBtn = document.createElement('button');
        publicBtn.textContent = group.isPublic ? '公开' : '私密';
        publicBtn.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fff;
            color: #333;
            cursor: pointer;
            font-size: 12px;
        `;
        publicBtn.addEventListener('click', async () => {
            const newIsPublic = !group.isPublic;
            await FavoritesGroups.update(group.id, { isPublic: newIsPublic });
            publicBtn.textContent = newIsPublic ? '公开' : '私密';
        });
        actionsEl.appendChild(publicBtn);

        const editBtn = document.createElement('button');
        editBtn.textContent = '编辑';
        editBtn.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fff;
            cursor: pointer;
            font-size: 12px;
        `;
        editBtn.addEventListener('click', () => {
            FavoritesGroupFormPanel.show({
                group: group,
                onSubmit: async (formData) => {
                    try {
                        await FavoritesGroups.update(group.id, {
                            name: formData.name,
                            image: formData.image,
                            description: formData.description,
                            isPublic: formData.isPublic
                        });
                        Toast.show('分组信息已保存');
                    } catch (error) {
                        Logger.error('更新分组失败:', error);
                        Toast.show('保存失败，请重试');
                    }
                }
            });
        });
        actionsEl.appendChild(editBtn);

        const upBtn = document.createElement('button');
        upBtn.textContent = '↑';
        upBtn.title = isFirst ? '已是第一位' : '上移';
        upBtn.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: ${isFirst ? '#f5f5f5' : '#fff'};
            color: ${isFirst ? '#999' : '#333'};
            cursor: ${isFirst ? 'not-allowed' : 'pointer'};
            font-size: 12px;
        `;
        if (!isFirst) {
            upBtn.addEventListener('click', async () => {
                await FavoritesGroups.moveUp(group.id);
            });
        }

        const downBtn = document.createElement('button');
        downBtn.textContent = '↓';
        downBtn.title = isLast ? '已是最后一位' : '下移';
        downBtn.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: ${isLast ? '#f5f5f5' : '#fff'};
            color: ${isLast ? '#999' : '#333'};
            cursor: ${isLast ? 'not-allowed' : 'pointer'};
            font-size: 12px;
        `;
        if (!isLast) {
            downBtn.addEventListener('click', async () => {
                await FavoritesGroups.moveDown(group.id);
            });
        }

        actionsEl.appendChild(upBtn);
        actionsEl.appendChild(downBtn);

        itemEl.appendChild(nameEl);
        itemEl.appendChild(statusEl);
        itemEl.appendChild(actionsEl);

        return itemEl;
    }

    async function createPanel() {
        panelInstance = Card.create({
            className: 'favorites-group-panel',
            header: {
                visible: true,
                draggable: true,
                title: '分组管理'
            },
            footer: { visible: false },
            styles: {
                width: '450px',
                display: 'block',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 99999
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.favorites-group-panel-actions');

                const closeBtn = document.createElement('button');
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    destroy();
                });

                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, null, '[class*="-header"]');
            },
            onBodyReady: async (bodyEl) => {
                bodyEl.style.cssText = 'padding: 16px;';

                const hintEl = document.createElement('div');
                hintEl.style.cssText = `
                    font-size: 12px;
                    color: #999;
                    margin-bottom: 12px;
                    padding: 8px;
                    background: #f5f5f5;
                    border-radius: 4px;
                `;
                hintEl.innerHTML = `
                    💡 <strong>提示</strong>：<br>
                    • 默认分组不可删除<br>
                    • 「添加到收藏夹」弹窗最多显示10个分组（1个默认+9个可见分组）
                `;
                bodyEl.appendChild(hintEl);

                const addBtn = document.createElement('button');
                addBtn.textContent = '+ 新建分组';
                addBtn.style.cssText = `
                    width: 100%;
                    padding: 10px;
                    border: 1px dashed #ddd;
                    border-radius: 4px;
                    background: #fff;
                    color: #666;
                    cursor: pointer;
                    margin-bottom: 12px;
                    font-size: 14px;
                `;
                addBtn.addEventListener('click', () => {
                    FavoritesGroupFormPanel.show({
                        onSubmit: async (formData) => {
                            try {
                                await FavoritesGroups.create(formData.name, {
                                    isPublic: formData.isPublic,
                                    description: formData.description,
                                    image: formData.image
                                });
                                Toast.show('分组创建成功');
                            } catch (error) {
                                Logger.error('创建分组失败:', error);
                                Toast.show('创建失败，请重试');
                            }
                        }
                    });
                });
                bodyEl.appendChild(addBtn);

                const listContainer = document.createElement('div');
                listContainer.style.cssText = `
                    max-height: 300px;
                    overflow-y: auto;
                `;
                bodyEl.appendChild(listContainer);

                const paginationContainer = document.createElement('div');
                paginationContainer.style.cssText = 'margin-top: 12px;';
                bodyEl.appendChild(paginationContainer);

                currentPage = 1;
                paginationInstance = Pagination.create({
                    container: paginationContainer,
                    total: 0,
                    pageSize: pageSize,
                    currentPage: 1,
                    onChange: async (page) => {
                        currentPage = page;
                        await renderGroupsList(listContainer);
                    }
                });

                await renderGroupsList(listContainer);

                groupsUpdateHandler = async () => {
                    await renderGroupsList(listContainer);
                };
                EventBus.on('favoriteGroups:updated', groupsUpdateHandler);
            }
        });
    }

    function show() {
        if (panelInstance) {
            destroy();
        }
        createPanel();
    }

    function destroy() {
        if (groupsUpdateHandler) {
            EventBus.off('favoriteGroups:updated', groupsUpdateHandler);
            groupsUpdateHandler = null;
        }
        if (paginationInstance) {
            paginationInstance.destroy();
            paginationInstance = null;
        }
        if (dragCleanup) {
            dragCleanup();
            dragCleanup = null;
        }
        if (panelInstance) {
            panelInstance.destroy();
            panelInstance = null;
        }
        currentPage = 1;
    }

    return {
        show,
        destroy
    };
})();


/**
 * FavoritesGroupFormPanel - 收藏夹分组表单面板
 * 提供新建/编辑收藏夹分组的表单界面
 *
 * @module UI/Views
 *
 * @example
 * // 新建模式
 * FavoritesGroupFormPanel.show({
 *   onSubmit: (formData) => {
 *     console.log('Form submitted:', formData);
 *   }
 * });
 *
 * // 编辑模式
 * FavoritesGroupFormPanel.show({
 *   group: { id: 'xxx', name: '分组1', image: '', description: '', isPublic: false },
 *   onSubmit: (formData) => {
 *     console.log('Form updated:', formData);
 *   }
 * });
 */
const FavoritesGroupFormPanel = (() => {
    let panelInstance = null;
    let onSubmitCallback = null;
    let currentEditGroup = null;

    function createFormPanel(options = {}) {
        const { onSubmit, group } = options;
        onSubmitCallback = onSubmit;
        currentEditGroup = group || null;

        const isEditMode = !!group;
        const panelTitle = isEditMode ? '编辑收藏夹分组' : '新建收藏夹分组';

        panelInstance = Card.create({
            className: 'favorites-group-form-panel',
            header: {
                visible: true,
                draggable: true,
                title: panelTitle
            },
            footer: { visible: false },
            styles: {
                width: '420px',
                display: 'block',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 99999
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.favorites-group-form-panel-actions');

                const closeBtn = document.createElement('button');
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', () => {
                    destroy();
                });
                actionsEl.appendChild(closeBtn);

                Draggable.make(headerEl.parentElement, null, '[class*="-header"]');
            },
            onBodyReady: (bodyEl) => {
                bodyEl.style.cssText = 'padding: 20px;';

                const formContainer = document.createElement('div');
                formContainer.className = 'favorites-group-form-container';
                formContainer.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                `;

                const nameGroup = createNameGroup();
                const imageGroup = createImageGroup();
                const descriptionGroup = createDescriptionGroup();
                const publicGroup = createPublicGroup();
                const buttonGroup = createButtonGroup(onSubmit, isEditMode);

                formContainer.appendChild(nameGroup);
                formContainer.appendChild(imageGroup);
                formContainer.appendChild(descriptionGroup);
                formContainer.appendChild(publicGroup);
                formContainer.appendChild(buttonGroup);

                bodyEl.appendChild(formContainer);

                if (isEditMode) {
                    populateFormData(group);
                }
            }
        });
    }

    function populateFormData(group) {
        const formContainer = document.querySelector('.favorites-group-form-container');
        if (!formContainer || !group) return;

        const nameInput = formContainer.querySelector('.group-name-input');
        const imageInput = formContainer.querySelector('.group-image-input');
        const descriptionInput = formContainer.querySelector('.group-description-input');

        if (nameInput) {
            nameInput.value = group.name || '';
        }

        if (imageInput) {
            imageInput.value = group.image || '';
            if (group.image) {
                const previewContainer = formContainer.querySelector('.image-preview-container');
                if (previewContainer) {
                    previewContainer.innerHTML = '';
                    const img = document.createElement('img');
                    img.className = 'preview-image';
                    img.src = group.image;
                    img.style.cssText = `
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: cover;
                    `;
                    img.onload = () => {
                        previewContainer.innerHTML = '';
                        previewContainer.appendChild(img);
                    };
                    img.onerror = () => {
                        previewContainer.innerHTML = '';
                        const placeholder = document.createElement('div');
                        placeholder.className = 'preview-placeholder';
                        placeholder.style.cssText = 'color: #999; font-size: 14px;';
                        placeholder.textContent = '图片加载失败';
                        previewContainer.appendChild(placeholder);
                    };
                }
            }
        }

        if (descriptionInput) {
            descriptionInput.value = group.description || '';
        }

        const publicGroupEl = formContainer.querySelector('.form-group:has(.form-buttons)');
        if (publicGroupEl && publicGroupEl.switchInstance) {
            publicGroupEl.switchInstance.setValue(group.isPublic || false);
        }
    }

    function createNameGroup() {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = '分组名称';
        label.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            color: #333;
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'group-name-input';
        input.placeholder = '请输入分组名称';
        input.required = true;
        input.style.cssText = `
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        `;

        input.addEventListener('focus', () => {
            input.style.borderColor = '#00aeec';
        });

        input.addEventListener('blur', () => {
            input.style.borderColor = '#ddd';
        });

        group.appendChild(label);
        group.appendChild(input);

        return group;
    }

    function createImageGroup() {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = '封面图片';
        label.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            color: #333;
        `;

        const inputRow = document.createElement('div');
        inputRow.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: center;
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'group-image-input';
        input.placeholder = '输入图片URL（可选）';
        input.style.cssText = `
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        `;

        input.addEventListener('focus', () => {
            input.style.borderColor = '#00aeec';
        });

        input.addEventListener('blur', () => {
            input.style.borderColor = '#ddd';
        });

        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.textContent = '预览';
        previewBtn.style.cssText = `
            padding: 10px 16px;
            border: 1px solid #00aeec;
            border-radius: 4px;
            background: #fff;
            color: #00aeec;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        `;

        previewBtn.addEventListener('mouseenter', () => {
            previewBtn.style.background = '#e6f7ff';
        });

        previewBtn.addEventListener('mouseleave', () => {
            previewBtn.style.background = '#fff';
        });

        inputRow.appendChild(input);
        inputRow.appendChild(previewBtn);

        const previewContainer = document.createElement('div');
        previewContainer.className = 'image-preview-container';
        previewContainer.style.cssText = `
            width: 100%;
            height: 160px;
            border: 1px dashed #ddd;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fafafa;
            overflow: hidden;
            margin-top: 8px;
        `;

        const previewPlaceholder = document.createElement('div');
        previewPlaceholder.className = 'preview-placeholder';
        previewPlaceholder.style.cssText = `
            color: #999;
            font-size: 14px;
        `;
        previewPlaceholder.textContent = '暂无预览图片';

        previewContainer.appendChild(previewPlaceholder);

        previewBtn.addEventListener('click', () => {
            const imageUrl = input.value.trim();
            if (!imageUrl) {
                Toast.show('请先输入图片URL');
                return;
            }

            const existingImg = previewContainer.querySelector('.preview-image');
            if (existingImg) {
                existingImg.remove();
            }

            previewPlaceholder.style.display = 'none';

            const img = document.createElement('img');
            img.className = 'preview-image';
            img.src = imageUrl;
            img.style.cssText = `
                max-width: 100%;
                max-height: 100%;
                object-fit: cover;
            `;

            img.onload = () => {
                previewContainer.innerHTML = '';
                previewContainer.appendChild(img);
            };

            img.onerror = () => {
                previewContainer.innerHTML = '';
                previewContainer.appendChild(previewPlaceholder);
                previewPlaceholder.textContent = '图片加载失败，请检查URL';
                Toast.show('图片加载失败');
            };
        });

        group.appendChild(label);
        group.appendChild(inputRow);
        group.appendChild(previewContainer);

        return group;
    }

    function createDescriptionGroup() {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = '简介';
        label.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            color: #333;
        `;

        const textarea = document.createElement('textarea');
        textarea.className = 'group-description-input';
        textarea.placeholder = '可以简单描述下你的收藏夹';
        textarea.style.cssText = `
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            resize: vertical;
            min-height: 80px;
            max-height: 160px;
            outline: none;
            transition: border-color 0.2s;
            font-family: inherit;
        `;

        textarea.addEventListener('focus', () => {
            textarea.style.borderColor = '#00aeec';
        });

        textarea.addEventListener('blur', () => {
            textarea.style.borderColor = '#ddd';
        });

        group.appendChild(label);
        group.appendChild(textarea);

        return group;
    }

    function createPublicGroup() {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: #f5f5f5;
            border-radius: 4px;
        `;

        const labelContainer = document.createElement('div');
        labelContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
        `;

        const label = document.createElement('label');
        label.textContent = '公开';
        label.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            color: #333;
        `;

        const hint = document.createElement('small');
        hint.textContent = '开启后其他用户可以查看此分组';
        hint.style.cssText = `
            font-size: 12px;
            color: #999;
        `;

        labelContainer.appendChild(label);
        labelContainer.appendChild(hint);

        const switchInstance = Switch.create({
            checked: false,
            onChange: (isChecked) => {
                console.log('Public status changed:', isChecked);
            }
        });

        group.appendChild(labelContainer);
        group.appendChild(switchInstance.element);

        group.switchInstance = switchInstance;

        return group;
    }

    function createButtonGroup(onSubmit, isEditMode = false) {
        const group = document.createElement('div');
        group.className = 'form-buttons';
        group.style.cssText = `
            display: flex;
            gap: 12px;
            margin-top: 8px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fff;
            color: #666;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        `;

        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = '#f5f5f5';
        });

        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = '#fff';
        });

        cancelBtn.addEventListener('click', () => {
            destroy();
        });

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button';
        submitBtn.textContent = isEditMode ? '保存' : '创建';
        submitBtn.className = 'submit-btn';
        submitBtn.style.cssText = `
            flex: 1;
            padding: 12px;
            border: 1px solid #00aeec;
            border-radius: 4px;
            background: #00aeec;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        `;

        submitBtn.addEventListener('mouseenter', () => {
            submitBtn.style.background = '#0097d6';
        });

        submitBtn.addEventListener('mouseleave', () => {
            submitBtn.style.background = '#00aeec';
        });

        submitBtn.addEventListener('click', () => {
            const formData = collectFormData();

            if (!validateForm(formData)) {
                return;
            }

            if (onSubmit && typeof onSubmit === 'function') {
                if (isEditMode && currentEditGroup) {
                    formData.id = currentEditGroup.id;
                }
                onSubmit(formData);
            }

            destroy();
        });

        group.appendChild(cancelBtn);
        group.appendChild(submitBtn);

        return group;
    }

    function collectFormData() {
        const formContainer = document.querySelector('.favorites-group-form-container');
        if (!formContainer) return null;

        const name = formContainer.querySelector('.group-name-input').value.trim();
        const image = formContainer.querySelector('.group-image-input').value.trim();
        const description = formContainer.querySelector('.group-description-input').value.trim();
        const publicGroupEl = formContainer.querySelector('.form-group:has(.form-buttons)');
        const switchEl = publicGroupEl ? publicGroupEl.querySelector('.bili-speed-switch-container') : null;
        const isPublic = switchEl && switchEl.querySelector('.bili-speed-switch') ?
            switchEl.querySelector('.bili-speed-switch').classList.contains('checked') : false;

        return {
            name,
            image,
            description,
            isPublic
        };
    }

    function validateForm(data) {
        if (!data.name) {
            Toast.show('请输入分组名称');
            return false;
        }

        if (data.name.length > 50) {
            Toast.show('分组名称不能超过50个字符');
            return false;
        }

        if (data.image && !isValidUrl(data.image)) {
            Toast.show('请输入有效的图片URL');
            return false;
        }

        if (data.description && data.description.length > 200) {
            Toast.show('简介不能超过200个字符');
            return false;
        }

        return true;
    }

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    function show(options = {}) {
        destroy();
        createFormPanel(options);
    }

    function destroy() {
        if (panelInstance) {
            panelInstance.destroy();
            panelInstance = null;
        }
        onSubmitCallback = null;
        currentEditGroup = null;
    }

    return {
        show,
        destroy
    };
})();


const NotesPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let currentFilter = 'all';
    let currentSearchKeyword = '';
    let currentTagFilter = '';
    let currentTypeFilter = 'all';
    let currentPage = 1;
    let paginationInstance = null;
    const pageSize = 10;

    function getCurrentBvid() {
        const match = location.href.match(/BV[\w]+/);
        return match ? match[0] : '';
    }

    function formatDate(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}`;
    }

    async function getFilteredNotes() {
        let notes = await Notes.getAll();

        if (currentTypeFilter === 'videoNote') {
            notes = notes.filter(n => n.noteType === 'videoNote');
        } else if (currentTypeFilter === 'normalNote') {
            notes = notes.filter(n => n.noteType === 'normalNote');
        }

        if (currentFilter === 'current') {
            const bvid = getCurrentBvid();
            if (bvid) {
                notes = notes.filter(n => n.bvid === bvid);
            }
        }

        if (currentTagFilter) {
            notes = notes.filter(n => n.tags && n.tags.includes(currentTagFilter));
        }

        if (currentSearchKeyword) {
            const kw = currentSearchKeyword.toLowerCase();
            notes = notes.filter(n =>
                n.title.toLowerCase().includes(kw) ||
                n.content.toLowerCase().includes(kw) ||
                n.videoTitle.toLowerCase().includes(kw)
            );
        }

        notes.sort((a, b) => b.updatedAt - a.updatedAt);

        return notes;
    }

    function renderNoteItem(note, containerEl) {
        const itemEl = document.createElement('div');
        itemEl.className = 'bili-speed-note-item';
        itemEl.dataset.id = note.id;

        const tagsHtml = (note.tags && note.tags.length > 0)
            ? note.tags.map(t => `<span class="bili-speed-note-tag">${t}</span>`).join('')
            : '';

        const timestampHtml = note.videoTimestamp > 0
            ? `<span class="bili-speed-note-timestamp" data-timestamp="${note.videoTimestamp}">📍 ${Utils.formatTime(note.videoTimestamp)}</span>`
            : '';

        const editorLabel = note.editorType === 'vditor' ? 'Md' : '富文本';
        const typeLabel = note.noteType === 'normalNote' ? '📄 普通' : '🎬 视频';

        itemEl.innerHTML = `
            <div class="bili-speed-note-item-title">${note.title || '无标题'}</div>
            <div class="bili-speed-note-item-meta">
                <span class="bili-speed-note-type-badge">${typeLabel}</span>
                ${note.noteType === 'videoNote' ? `
                <span class="bili-speed-note-bvid" data-url="${note.videoUrl}" title="${note.videoTitle}">${note.bvid}</span>
                <span>${formatDate(note.updatedAt)}</span>
                ${timestampHtml}
                ` : `
                <span>${formatDate(note.updatedAt)}</span>
                `}
                <span class="bili-speed-note-editor-type">${editorLabel}</span>
            </div>
            <div class="bili-speed-note-item-tags">${tagsHtml}</div>
            <div class="bili-speed-note-item-actions">
                <button class="bili-speed-note-edit-btn" title="编辑笔记">✏️</button>
                <button class="bili-speed-note-delete-btn" title="删除笔记">🗑️</button>
            </div>
        `;

        if (note.noteType === 'videoNote') {
            const bvidEl = itemEl.querySelector('.bili-speed-note-bvid');
            if (bvidEl) {
                bvidEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (note.videoUrl) {
                        window.open(note.videoUrl, '_blank');
                    }
                });
            }

            const timestampEl = itemEl.querySelector('.bili-speed-note-timestamp');
            if (timestampEl) {
                timestampEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const video = VideoController.getVideo();
                    if (video) {
                        video.currentTime = note.videoTimestamp;
                        Toast.show(`跳转到 ${Utils.formatTime(note.videoTimestamp)}`);
                    }
                });
            }
        }

        const editBtn = itemEl.querySelector('.bili-speed-note-edit-btn');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            EventBus.emit('notes:edit', note);
        });

        const deleteBtn = itemEl.querySelector('.bili-speed-note-delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('确定要删除这条笔记吗？')) {
                await Notes.remove(note.id);
            }
        });

        itemEl.addEventListener('mouseenter', () => {
            const actions = itemEl.querySelector('.bili-speed-note-item-actions');
            if (actions) actions.style.opacity = '1';
            itemEl.style.background = '#f5f5f5';
        });

        itemEl.addEventListener('mouseleave', () => {
            const actions = itemEl.querySelector('.bili-speed-note-item-actions');
            if (actions) actions.style.opacity = '0';
            itemEl.style.background = '';
        });

        return itemEl;
    }

    async function renderNotesList(containerEl) {
        containerEl.innerHTML = '';

        const allNotes = await getFilteredNotes();
        const total = allNotes.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const start = (currentPage - 1) * pageSize;
        const pageData = allNotes.slice(start, start + pageSize);

        if (pageData.length === 0) {
            containerEl.innerHTML = `
                <div style="text-align: center; padding: 40px 0; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 8px;">📭</div>
                    <div>${currentSearchKeyword || currentTagFilter || currentFilter === 'current' ? '没有匹配的笔记' : '暂无笔记'}</div>
                </div>
            `;
        } else {
            pageData.forEach(note => {
                containerEl.appendChild(renderNoteItem(note, containerEl));
            });
        }

        if (paginationInstance) {
            paginationInstance.setTotal(total);
        }
    }

    async function renderFilterBar(bodyEl) {
        const bvid = getCurrentBvid();
        const allTags = await Notes.getAllTags();
        const currentNoteCount = bvid ? await Notes.countByBvid(bvid) : 0;
        const videoNoteCount = await Notes.countByType('videoNote');
        const normalNoteCount = await Notes.countByType('normalNote');

        const filterBar = document.createElement('div');
        filterBar.className = 'bili-speed-notes-filter';
        filterBar.innerHTML = `
            <div class="bili-speed-notes-search">
                <input type="text" class="bili-speed-notes-search-input" placeholder="搜索笔记..." value="${currentSearchKeyword}">
            </div>
            <div class="bili-speed-notes-filter-tabs">
                <button class="bili-speed-notes-filter-btn ${currentTypeFilter === 'all' ? 'active' : ''}" data-type="all">全部</button>
                <button class="bili-speed-notes-filter-btn ${currentTypeFilter === 'videoNote' ? 'active' : ''}" data-type="videoNote">🎬 视频笔记${videoNoteCount > 0 ? `(${videoNoteCount})` : ''}</button>
                <button class="bili-speed-notes-filter-btn ${currentTypeFilter === 'normalNote' ? 'active' : ''}" data-type="normalNote">📄 普通笔记${normalNoteCount > 0 ? `(${normalNoteCount})` : ''}</button>
            </div>
            <div class="bili-speed-notes-filter-tabs">
                <button class="bili-speed-notes-filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">全部视频</button>
                <button class="bili-speed-notes-filter-btn ${currentFilter === 'current' ? 'active' : ''}" data-filter="current">当前视频${currentNoteCount > 0 ? `(${currentNoteCount})` : ''}</button>
                ${allTags.length > 0 ? `
                <select class="bili-speed-notes-tag-select">
                    <option value="">全部标签</option>
                    ${allTags.map(t => `<option value="${t}" ${currentTagFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                ` : ''}
            </div>
        `;

        async function onFilterChange() {
            currentPage = 1;
            const listEl = bodyEl.querySelector('.bili-speed-notes-list');
            if (listEl) await renderNotesList(listEl);
        }

        const searchInput = filterBar.querySelector('.bili-speed-notes-search-input');
        let searchTimer = null;
        searchInput.addEventListener('input', (e) => {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(async () => {
                currentSearchKeyword = e.target.value.trim();
                await onFilterChange();
            }, 300);
        });

        filterBar.querySelectorAll('[data-type]').forEach(btn => {
            btn.addEventListener('click', async () => {
                currentTypeFilter = btn.dataset.type;
                filterBar.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await onFilterChange();
            });
        });

        filterBar.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', async () => {
                currentFilter = btn.dataset.filter;
                filterBar.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await onFilterChange();
            });
        });

        const tagSelect = filterBar.querySelector('.bili-speed-notes-tag-select');
        if (tagSelect) {
            tagSelect.addEventListener('change', async (e) => {
                currentTagFilter = e.target.value;
                await onFilterChange();
            });
        }

        bodyEl.appendChild(filterBar);
    }

    async function createPanel() {
        let savedPosition = Config.data.notesPanelPosition;
        const currentTheme = Config.data.theme || 'light';

        const noteCount = await Notes.count();

        panelInstance = Card.create({
            className: `bili-speed-notes-panel theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: '📝 视频笔记'
            },
            footer: { visible: false },
            styles: {
                width: '380px',
                display: Config.data.notesPanelVisible ? 'block' : 'none',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 9999,
                ...(savedPosition ? {
                    left: savedPosition.left,
                    top: savedPosition.top,
                    transform: 'none'
                } : {})
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.bili-speed-notes-panel-actions');

                const exportBtn = document.createElement('button');
                exportBtn.className = 'bili-speed-notes-export';
                exportBtn.title = '导出笔记数据';
                exportBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;';
                exportBtn.textContent = '📤';
                exportBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    Notes.downloadExport();
                });

                const addBtn = document.createElement('button');
                addBtn.className = 'bili-speed-notes-add';
                addBtn.title = '新建笔记';
                addBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;';
                addBtn.textContent = '➕';
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    EventBus.emit('notes:new');
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-notes-close';
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    EventBus.emit('notes:toggle');
                });

                actionsEl.appendChild(exportBtn);
                actionsEl.appendChild(addBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'notesPanelPosition', `[class*="-header"]`);
            },
            onBodyReady: async (bodyEl) => {
                bodyEl.className = 'bili-speed-notes-panel-body';
                bodyEl.style.cssText = 'padding: 8px; max-height: 500px; overflow-y: auto; display: flex; flex-direction: column;';

                await renderFilterBar(bodyEl);

                const listEl = document.createElement('div');
                listEl.className = 'bili-speed-notes-list';
                bodyEl.appendChild(listEl);

                const paginationContainer = document.createElement('div');
                paginationContainer.className = 'bili-speed-notes-pagination';
                bodyEl.appendChild(paginationContainer);

                currentPage = 1;
                if (paginationInstance) {
                    paginationInstance.destroy();
                    paginationInstance = null;
                }

                paginationInstance = Pagination.create({
                    container: paginationContainer,
                    total: 0,
                    pageSize: pageSize,
                    currentPage: 1,
                    theme: Config.data.theme || 'light',
                    onChange: async (page) => {
                        currentPage = page;
                        const list = bodyEl.querySelector('.bili-speed-notes-list');
                        if (list) await renderNotesList(list);
                    }
                });

                await renderNotesList(listEl);

                const countEl = document.createElement('div');
                countEl.className = 'bili-speed-notes-count';
                countEl.style.cssText = 'text-align: center; padding: 8px 0; font-size: 12px; color: #999;';
                countEl.textContent = `共 ${noteCount} 条笔记`;
                bodyEl.appendChild(countEl);

                EventBus.on('notes:updated', async () => {
                    if (panelInstance && bodyEl) {
                        currentPage = 1;
                        const list = bodyEl.querySelector('.bili-speed-notes-list');
                        const count = bodyEl.querySelector('.bili-speed-notes-count');
                        if (list) await renderNotesList(list);
                        if (count) {
                            const newCount = await Notes.count();
                            count.textContent = `共 ${newCount} 条笔记`;
                        }
                    }
                });
            }
        });
    }

    return {
        create() {
            if (panelInstance) panelInstance.destroy();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;

            currentFilter = 'all';
            currentSearchKeyword = '';
            currentTagFilter = '';
            currentTypeFilter = 'all';
            currentPage = 1;

            createPanel();
        },

        toggle() {
            Config.data.notesPanelVisible = !Config.data.notesPanelVisible;
            if (panelInstance) {
                panelInstance.element.style.display = Config.data.notesPanelVisible ? 'block' : 'none';
            }
        },

        show() {
            Config.data.notesPanelVisible = true;
            if (panelInstance) {
                panelInstance.element.style.display = 'block';
            }
        },

        hide() {
            Config.data.notesPanelVisible = false;
            if (panelInstance) {
                panelInstance.element.style.display = 'none';
            }
        },

        applyTheme(theme) {
            if (!panelInstance) return;
            const el = panelInstance.element;
            el.classList.remove('theme-light', 'theme-dark');
            el.classList.add(`theme-${theme}`);
            if (paginationInstance) {
                paginationInstance.setTheme(theme);
            }
        },

        destroy() {
            if (paginationInstance) {
                paginationInstance.destroy();
                paginationInstance = null;
            }
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
        }
    };
})();


const QuillEditorPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let resizeCleanup = null;
    let quillInstance = null;
    let currentNoteId = null;
    let tags = [];
    let videoTimestamp = 0;

    function getCurrentVideoInfo() {
        const url = location.href;
        const match = url.match(/BV[\w]+/);
        const video = VideoController.getVideo();
        const title = document.querySelector('h1.video-title, .video-title-href, h1[class*="title"]')?.textContent?.trim() || '未知标题';

        return {
            bvid: match ? match[0] : '',
            videoTitle: title,
            videoUrl: url,
            currentTime: video ? video.currentTime : 0,
            hasVideo: !!video
        };
    }

    function getQuill() {
        return (typeof unsafeWindow !== 'undefined' && unsafeWindow.Quill) ? unsafeWindow.Quill : window.Quill;
    }

    function loadQuillResources() {
        return new Promise((resolve, reject) => {
            const Quill = getQuill();
            console.log('[QuillEditorPanel] loadQuillResources called, Quill:', !!Quill);
            if (Quill) {
                console.log('[QuillEditorPanel] Quill already loaded');
                resolve();
                return;
            }

            const existingScript = document.getElementById('quill-js');
            if (existingScript) {
                console.log('[QuillEditorPanel] Script exists, loading:', existingScript.dataset.loading);
                if (existingScript.dataset.loading === 'true') {
                    const checkInterval = setInterval(() => {
                        const Q = getQuill();
                        console.log('[QuillEditorPanel] Checking Quill...', !!Q);
                        if (Q) {
                            clearInterval(checkInterval);
                            console.log('[QuillEditorPanel] Quill loaded via interval');
                            resolve();
                        }
                    }, 100);

                    setTimeout(() => {
                        clearInterval(checkInterval);
                        console.log('[QuillEditorPanel] Quill load timeout');
                        reject(new Error('Quill 资源加载超时'));
                    }, 30000);
                    return;
                } else {
                    console.log('[QuillEditorPanel] Removing existing script');
                    existingScript.remove();
                }
            }

            console.log('[QuillEditorPanel] Creating new script tag');
            const script = document.createElement('script');
            script.src = Config.data.quillCdnJs;
            script.id = 'quill-js';
            script.dataset.loading = 'true';
            script.onload = () => {
                console.log('[QuillEditorPanel] Script onload fired, Quill:', !!getQuill());
                const waitForQuill = (retries = 0) => {
                    const Q = getQuill();
                    if (Q) {
                        console.log('[QuillEditorPanel] Quill loaded after', retries, 'retries');
                        resolve();
                    } else if (retries < 50) {
                        setTimeout(() => waitForQuill(retries + 1), 100);
                    } else {
                        console.log('[QuillEditorPanel] Quill load timeout after onload');
                        reject(new Error('Quill 加载超时'));
                    }
                };
                waitForQuill();
            };
            script.onerror = (e) => {
                console.log('[QuillEditorPanel] Script onerror', e);
                script.dataset.loading = 'false';
                reject(new Error('Quill 资源加载失败'));
            };
            document.head.appendChild(script);
            console.log('[QuillEditorPanel] Script appended to head');
        });
    }

    function injectQuillCSS() {
        if (document.getElementById('quill-snow-css')) return;

        const cssUrl = Config.data.quillCdnCss;

        if (typeof GM_addStyle !== 'undefined') {
            fetch(cssUrl)
                .then(res => res.text())
                .then(css => GM_addStyle(css))
                .catch(() => {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = cssUrl;
                    link.id = 'quill-snow-css';
                    document.head.appendChild(link);
                });
        } else {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssUrl;
            link.id = 'quill-snow-css';
            document.head.appendChild(link);
        }
    }

    function initQuillEditor(containerEl) {
        const Quill = getQuill();
        if (!Quill) return;

        const editorContainer = containerEl.querySelector('#quill-editor-container');
        if (!editorContainer) return;

        quillInstance = new Quill(editorContainer, {
            theme: 'snow',
            placeholder: '开始记录笔记...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'strike', 'underline'],
                    [{ header: 2 }],
                    ['blockquote'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['link'],
                    ['clean']
                ]
            }
        });

        requestAnimationFrame(() => {
            adjustQuillEditorHeight();

            const qlContainer = editorContainer.querySelector('.ql-container');
            if (qlContainer) {
                qlContainer.style.borderRadius = '0 0 4px 4px';
                qlContainer.style.borderLeft = '1px solid #ddd';
                qlContainer.style.borderRight = '1px solid #ddd';
                qlContainer.style.borderBottom = '1px solid #ddd';
                qlContainer.style.borderTop = 'none';
                qlContainer.style.background = '#FFFFFF';
            }

            const qlToolbar = editorContainer.previousElementSibling?.classList.contains('ql-toolbar')
                ? editorContainer.previousElementSibling
                : editorContainer.parentElement?.querySelector('.ql-toolbar');
            if (qlToolbar) {
                qlToolbar.style.borderRadius = '4px 4px 0 0';
                qlToolbar.style.borderLeft = '1px solid #ddd';
                qlToolbar.style.borderRight = '1px solid #ddd';
                qlToolbar.style.borderTop = '1px solid #ddd';
                qlToolbar.style.borderBottom = 'none';
                qlToolbar.style.marginBottom = '0';
                qlToolbar.style.background = '#FFFFFF';
            }

            const qlEditor = editorContainer.querySelector('.ql-editor');
            if (qlEditor) {
                qlEditor.style.background = '#FFFFFF';
            }
        });
    }

    function adjustQuillEditorHeight() {
        const editorContainer = document.querySelector('#quill-editor-container');
        if (!editorContainer || !quillInstance) return;

        const availableHeight = editorContainer.clientHeight;
        if (availableHeight <= 0) return;

        const qlToolbar = editorContainer.querySelector('.ql-toolbar');
        const toolbarHeight = qlToolbar ? qlToolbar.offsetHeight || 42 : 42;
        const contentHeight = Math.max(50, availableHeight - toolbarHeight);

        const qlContainer = editorContainer.querySelector('.ql-container');
        if (qlContainer) {
            qlContainer.style.height = contentHeight + 'px';
        }

        const qlEditor = editorContainer.querySelector('.ql-editor');
        if (qlEditor) {
            qlEditor.style.minHeight = contentHeight + 'px';
        }
    }

    function renderTags(containerEl) {
        const tagsContainer = containerEl.querySelector('.bili-speed-editor-tags');
        if (!tagsContainer) return;

        tagsContainer.innerHTML = '';
        tags.forEach((tag, index) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'bili-speed-editor-tag';
            tagEl.innerHTML = `${tag} <span class="bili-speed-editor-tag-remove" data-index="${index}">×</span>`;
            tagsContainer.appendChild(tagEl);
        });

        tagsContainer.querySelectorAll('.bili-speed-editor-tag-remove').forEach(removeBtn => {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(removeBtn.dataset.index);
                tags.splice(idx, 1);
                renderTags(containerEl);
            });
        });
    }

    function addTag(containerEl, tagInput) {
        const tag = tagInput.value.trim();
        if (!tag) return;
        if (tags.length >= 10) {
            Toast.show('标签数量已达上限');
            return;
        }
        if (tags.includes(tag)) {
            Toast.show('标签已存在');
            return;
        }
        tags.push(tag);
        tagInput.value = '';
        renderTags(containerEl);
    }

    function updateFooterStatus() {
        const footerEl = panelInstance?.getFooter();
        if (!footerEl) return;

        const charCount = quillInstance ? quillInstance.getLength() - 1 : 0;
        const selection = quillInstance ? quillInstance.getSelection() : null;
        const selectedCount = selection ? selection.length : 0;

        footerEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #666;">
                <span class="bili-speed-quill-footer-status"></span>
                <span>字数: ${charCount} | 已选中: ${selectedCount}</span>
            </div>
        `;
    }

    function showSaveStatus(message, isError = false) {
        const footerEl = panelInstance?.getFooter();
        if (!footerEl) return;

        const statusEl = footerEl.querySelector('.bili-speed-quill-footer-status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = isError ? '#ff4d4f' : '#52c41a';
            statusEl.style.fontWeight = 'bold';
        }

        setTimeout(() => {
            if (statusEl) {
                statusEl.textContent = '';
                updateFooterStatus();
            }
        }, 3000);
    }

    async function saveNote() {
        const panelEl = panelInstance?.element;
        if (!panelEl) return;

        const titleInput = panelEl.querySelector('.bili-speed-editor-title-input');
        const title = titleInput ? titleInput.value.trim() : '';
        if (!title) {
            Toast.show('请输入笔记标题');
            return;
        }

        const content = quillInstance ? quillInstance.root.innerHTML : '';
        const contentDelta = quillInstance ? JSON.stringify(quillInstance.getContents()) : '';

        const videoInfo = getCurrentVideoInfo();
        const noteType = videoInfo.hasVideo ? 'videoNote' : 'normalNote';

        if (currentNoteId) {
            await Notes.update(currentNoteId, {
                title: title,
                content: content,
                contentDelta: contentDelta,
                tags: [...tags],
                videoTimestamp: videoTimestamp,
                videoTitle: videoInfo.videoTitle,
                videoUrl: videoInfo.videoUrl
            });
            showSaveStatus('✓ 笔记已更新');
        } else {
            const note = {
                id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                noteType: noteType,
                bvid: videoInfo.bvid,
                videoTitle: videoInfo.videoTitle,
                videoUrl: videoInfo.videoUrl,
                editorType: 'quill',
                title: title,
                content: content,
                contentDelta: contentDelta,
                tags: [...tags],
                videoTimestamp: videoTimestamp,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await Notes.add(note);
            currentNoteId = note.id;
            showSaveStatus('✓ 笔记已保存');
        }
    }

    function createPanel(note) {
        injectQuillCSS();

        let savedPosition = Config.data.editorPanelPosition;
        const savedSize = Config.data.quillEditorPanelSize;
        const currentTheme = Config.data.theme || 'light';

        currentNoteId = note ? note.id : null;
        tags = note ? [...(note.tags || [])] : [];
        videoTimestamp = note ? (note.videoTimestamp || 0) : 0;

        const videoInfo = getCurrentVideoInfo();
        const noteTitle = note ? note.title : '';
        const isEdit = !!note;
        const headerTitle = videoInfo.hasVideo
            ? `✏️ ${isEdit ? '编辑笔记' : '新建笔记'} - Quill`
            : `✏️ ${isEdit ? '编辑笔记' : '新建普通笔记'} - Quill`;

        panelInstance = Card.create({
            className: `bili-speed-quill-panel theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: headerTitle
            },
            footer: { visible: true },
            styles: {
                width: savedSize ? savedSize.width : (Config.data.quillEditorWidth || '520px'),
                height: savedSize ? savedSize.height : (Config.data.quillEditorHeight || '500px'),
                display: 'flex',
                flexDirection: 'column',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10000,
                ...(savedPosition ? {
                    left: savedPosition.left,
                    top: savedPosition.top,
                    transform: 'none'
                } : {})
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.bili-speed-quill-panel-actions');
                if (actionsEl) {
                    actionsEl.style.pointerEvents = 'auto';
                    actionsEl.style.position = 'relative';
                    actionsEl.style.zIndex = '1001';
                }

                const listBtn = document.createElement('button');
                listBtn.className = 'bili-speed-editor-list';
                listBtn.title = '打开笔记列表';
                listBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; position: relative; z-index: 1001; pointer-events: auto;';
                listBtn.textContent = '📋';
                listBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    NotesPanel.show();
                });

                const saveBtn = document.createElement('button');
                saveBtn.className = 'bili-speed-editor-save';
                saveBtn.title = '保存笔记';
                saveBtn.style.cssText = 'background: #F0F1F2; color: #333; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; position: relative; z-index: 1001; pointer-events: auto;';
                saveBtn.textContent = '💾 保存';
                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    saveNote();
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-editor-close';
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; position: relative; z-index: 1001; pointer-events: auto;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    QuillEditorPanel.close();
                });

                actionsEl.appendChild(listBtn);
                actionsEl.appendChild(saveBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'editorPanelPosition', `[class*="-header"]`);
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-quill-panel-body';
                bodyEl.style.cssText = 'padding: 0 12px 8px 12px; flex: 1; min-height: 0; overflow: hidden;';

                bodyEl.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <input type="text" class="bili-speed-editor-title-input" placeholder="输入笔记标题..." value="${noteTitle}" style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; outline: none;">
                    </div>
                    <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <div class="bili-speed-editor-tags" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
                        <input type="text" class="bili-speed-editor-tag-input" placeholder="添加标签..." style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 100px; outline: none;">
                        <button class="bili-speed-editor-tag-add" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer; font-size: 12px;">+</button>
                    </div>
                    ${videoInfo.hasVideo ? `
                    <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 12px; color: #999;">时间点:</span>
                        <span class="bili-speed-editor-timestamp" style="font-size: 12px; color: #00AEEC;">${videoTimestamp > 0 ? Utils.formatTime(videoTimestamp) : '未标记'}</span>
                        <button class="bili-speed-editor-mark-time" style="padding: 2px 8px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer; font-size: 11px;">📍标记当前时间</button>
                    </div>
                    ` : ''}
                    <div id="quill-editor-container"></div>
                    <div class="bili-speed-editor-loading" style="text-align: center; padding: 40px 0; color: #999; display: none;">
                        <div>正在加载编辑器资源...</div>
                    </div>
                `;

                renderTags(bodyEl);

                const titleInput = bodyEl.querySelector('.bili-speed-editor-title-input');
                const tagInput = bodyEl.querySelector('.bili-speed-editor-tag-input');
                const tagAddBtn = bodyEl.querySelector('.bili-speed-editor-tag-add');
                tagAddBtn.addEventListener('click', () => addTag(bodyEl, tagInput));
                tagInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(bodyEl, tagInput);
                    }
                });

                const markTimeBtn = bodyEl.querySelector('.bili-speed-editor-mark-time');
                if (markTimeBtn) {
                    markTimeBtn.addEventListener('click', () => {
                        const video = VideoController.getVideo();
                        if (video) {
                            videoTimestamp = video.currentTime;
                            const tsEl = bodyEl.querySelector('.bili-speed-editor-timestamp');
                            if (tsEl) tsEl.textContent = Utils.formatTime(videoTimestamp);
                            Toast.show(`已标记时间点: ${Utils.formatTime(videoTimestamp)}`);
                        } else {
                            Toast.show('未找到视频元素');
                        }
                    });
                }

                const editorContainer = bodyEl.querySelector('#quill-editor-container');
                if (editorContainer) {
                    editorContainer.style.flex = '1';
                    editorContainer.style.minHeight = '0';
                }
                const loadingEl = bodyEl.querySelector('.bili-speed-editor-loading');
                const panelEl = bodyEl.parentElement;

                resizeCleanup = Resizable.make(panelEl, {
                    minWidth: parseInt(Config.data.quillEditorMinWidth) || 400,
                    minHeight: parseInt(Config.data.quillEditorMinHeight) || 350,
                    onResize: () => {
                        if (quillInstance) {
                            adjustQuillEditorHeight();
                        }
                    },
                    saveKey: 'quillEditorPanelSize'
                });

                if (getQuill()) {
                    requestAnimationFrame(() => {
                        initQuillEditor(bodyEl);
                        if (quillInstance) {
                            quillInstance.root?.blur();
                            quillInstance.on('text-change', () => {
                                updateFooterStatus();
                            });
                            quillInstance.on('selection-change', () => {
                                updateFooterStatus();
                            });
                        }
                        if (note && note.content) {
                            if (note.contentDelta) {
                                try {
                                    quillInstance.setContents(JSON.parse(note.contentDelta));
                                } catch {
                                    quillInstance.clipboard.dangerouslyPasteHTML(note.content);
                                }
                            } else {
                                quillInstance.clipboard.dangerouslyPasteHTML(note.content);
                            }
                        }
                        updateFooterStatus();

                        if (titleInput) {
                            titleInput.addEventListener('focus', () => {
                                if (quillInstance) quillInstance.root?.blur();
                            });
                        }
                        if (tagInput) {
                            tagInput.addEventListener('focus', () => {
                                if (quillInstance) quillInstance.root?.blur();
                            });
                        }
                    });
                } else {
                    editorContainer.style.display = 'none';
                    loadingEl.style.display = 'block';

                    loadQuillResources().then(() => {
                        editorContainer.style.display = 'block';
                        loadingEl.style.display = 'none';
                        requestAnimationFrame(() => {
                            initQuillEditor(bodyEl);
                            if (quillInstance) {
                                quillInstance.root?.blur();
                                quillInstance.on('text-change', () => {
                                    updateFooterStatus();
                                });
                                quillInstance.on('selection-change', () => {
                                    updateFooterStatus();
                                });
                            }
                            if (note && note.content) {
                                if (note.contentDelta) {
                                    try {
                                        quillInstance.setContents(JSON.parse(note.contentDelta));
                                    } catch {
                                        quillInstance.clipboard.dangerouslyPasteHTML(note.content);
                                    }
                                } else {
                                    quillInstance.clipboard.dangerouslyPasteHTML(note.content);
                                }
                            }
                            updateFooterStatus();

                            if (titleInput) {
                                titleInput.addEventListener('focus', () => {
                                    if (quillInstance) quillInstance.root?.blur();
                                });
                            }
                            if (tagInput) {
                                tagInput.addEventListener('focus', () => {
                                    if (quillInstance) quillInstance.root?.blur();
                                });
                            }
                        });
                    }).catch(() => {
                        loadingEl.innerHTML = '<div style="color: #ff6b6b;">编辑器加载失败，使用简易编辑模式</div>';
                        loadingEl.style.display = 'none';
                        editorContainer.innerHTML = `<textarea class="bili-speed-editor-fallback" style="width: 100%; min-height: 200px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical; outline: none; box-sizing: border-box;">${note ? note.content : ''}</textarea>`;
                    });
                }
            }
        });
    }

    return {
        create() {
            if (panelInstance) panelInstance.destroy();
            if (dragCleanup) dragCleanup();
            if (resizeCleanup) resizeCleanup();
            dragCleanup = null;
            resizeCleanup = null;
            if (quillInstance) {
                quillInstance = null;
            }
        },

        open(note) {
            if (panelInstance) {
                QuillEditorPanel.close();
            }

            if (VditorEditorPanel && typeof VditorEditorPanel.close === 'function') {
                VditorEditorPanel.close();
            }

            createPanel(note || null);
        },

        close() {
            if (quillInstance) {
                try {
                    quillInstance = null;
                } catch {}
            }
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
            currentNoteId = null;
            tags = [];
            videoTimestamp = 0;
        },

        applyTheme(theme) {
            if (!panelInstance) return;
            const el = panelInstance.element;
            el.classList.remove('theme-light', 'theme-dark');
            el.classList.add(`theme-${theme}`);
        },

        isOpen() {
            return panelInstance !== null;
        },

        destroy() {
            QuillEditorPanel.close();
        }
    };
})();


const VditorEditorPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let resizeCleanup = null;
    let vditorInstance = null;
    let currentNoteId = null;
    let isResourcesLoaded = false;
    let isLoadingResources = false;
    let tags = [];
    let videoTimestamp = 0;
    let pendingContent = '';

    function getCurrentVideoInfo() {
        const url = location.href;
        const match = url.match(/BV[\w]+/);
        const video = VideoController.getVideo();
        const title = document.querySelector('h1.video-title, .video-title-href, h1[class*="title"]')?.textContent?.trim() || '未知标题';

        return {
            bvid: match ? match[0] : '',
            videoTitle: title,
            videoUrl: url,
            currentTime: video ? video.currentTime : 0,
            hasVideo: !!video
        };
    }

    // 获取 Vditor 构造函数（兼容沙箱环境）
    function getVditor() {
        return (typeof unsafeWindow !== 'undefined' && unsafeWindow.Vditor)
            ? unsafeWindow.Vditor
            : window.Vditor;
    }

    function loadVditorResources() {
        return new Promise((resolve, reject) => {
            if (getVditor()) {
                isResourcesLoaded = true;
                resolve();
                return;
            }

            if (isLoadingResources) {
                const checkInterval = setInterval(() => {
                    if (getVditor()) {
                        clearInterval(checkInterval);
                        isResourcesLoaded = true;
                        resolve();
                    }
                }, 100);

                setTimeout(() => {
                    clearInterval(checkInterval);
                    reject(new Error('Vditor 资源加载超时'));
                }, 15000);
                return;
            }

            isLoadingResources = true;

            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = Config.data.vditorCdnCss;
            css.id = 'vditor-css';
            document.head.appendChild(css);

            const script = document.createElement('script');
            script.src = Config.data.vditorCdnJs;
            script.id = 'vditor-script';
            script.onload = () => {
                isResourcesLoaded = true;
                isLoadingResources = false;
                EventBus.emit('editor:vditor:loaded');
                resolve();
            };
            script.onerror = () => {
                isLoadingResources = false;
                reject(new Error('Vditor 资源加载失败'));
            };
            document.head.appendChild(script);
        });
    }

    function initVditorEditor(containerEl, content, theme, height) {
        const Vditor = getVditor();
        if (!Vditor) return;

        const editorContainer = containerEl.querySelector('#vditor-editor-container');
        if (!editorContainer) return;

        const vditorMode = Config.data.vditorEditorMode || 'ir';
        vditorInstance = new Vditor('vditor-editor-container', {
            height: '100%',
            mode: vditorMode,
            theme: theme === 'dark' ? 'dark' : 'classic',
            toolbar: ['headings', 'bold', 'italic', 'strike', 'link', 'code', 'table'],
            placeholder: '开始记录笔记（Markdown格式）...',
            cache: { enable: false },
            after: () => {
                if (content) {
                    vditorInstance.setValue(content);
                }
                setTimeout(() => adjustVditorEditorHeight(), 100);
            }
        });
    }

    function adjustVditorEditorHeight() {
        if (!vditorInstance) return;
        const container = document.getElementById('vditor-editor-container');
        if (!container) return;

        const containerHeight = container.clientHeight;
        if (containerHeight <= 0) return;

        const vditorRoot = container.querySelector('.vditor');
        if (vditorRoot) {
            vditorRoot.style.height = containerHeight + 'px';
        }

        const toolbar = container.querySelector('.vditor-toolbar');
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 40;
        const contentHeight = Math.max(50, containerHeight - toolbarHeight);

        const vditorContent = container.querySelector('.vditor-content');
        if (vditorContent) vditorContent.style.height = contentHeight + 'px';

        const wysiwyg = container.querySelector('.vditor-wysiwyg');
        if (wysiwyg) wysiwyg.style.height = contentHeight + 'px';
        const ir = container.querySelector('.vditor-ir');
        if (ir) ir.style.height = contentHeight + 'px';
        const sv = container.querySelector('.vditor-sv');
        if (sv) sv.style.height = contentHeight + 'px';
        const preview = container.querySelector('.vditor-preview');
        if (preview) preview.style.height = contentHeight + 'px';

        const reset = container.querySelector('.vditor-reset');
        if (reset) reset.style.height = contentHeight + 'px';
    }

    function switchMode(newMode) {
        if (!vditorInstance) return;

        const currentContent = vditorInstance.getValue();

        Config.data.vditorEditorMode = newMode;

        if (typeof vditorInstance.setMode === 'function') {
            try {
                vditorInstance.setMode(newMode);
                setTimeout(() => adjustVditorEditorHeight(), 50);
                setTimeout(() => updateFooterStatus(), 100);
                return;
            } catch (e) {
                console.warn('[VditorEditorPanel] setMode 失败，降级为重建:', e);
            }
        }

        try { vditorInstance.destroy(); } catch {}
        vditorInstance = null;

        const container = document.getElementById('vditor-editor-container');
        if (container) container.innerHTML = '';

        const bodyEl = panelInstance?.element?.querySelector('.bili-speed-vditor-panel-body');
        if (bodyEl) {
            const currentTheme = Config.data.theme || 'light';
            initVditorEditor(bodyEl, currentContent, currentTheme,
                panelInstance.element.getBoundingClientRect().height);
            setTimeout(() => updateFooterStatus(), 500);
        }
    }

    function renderTags(containerEl) {
        const tagsContainer = containerEl.querySelector('.bili-speed-editor-tags');
        if (!tagsContainer) return;

        tagsContainer.innerHTML = '';
        tags.forEach((tag, index) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'bili-speed-editor-tag';
            tagEl.innerHTML = `${tag} <span class="bili-speed-editor-tag-remove" data-index="${index}">×</span>`;
            tagsContainer.appendChild(tagEl);
        });

        tagsContainer.querySelectorAll('.bili-speed-editor-tag-remove').forEach(removeBtn => {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(removeBtn.dataset.index);
                tags.splice(idx, 1);
                renderTags(containerEl);
            });
        });
    }

    function addTag(containerEl, tagInput) {
        const tag = tagInput.value.trim();
        if (!tag) return;
        if (tags.length >= 10) {
            Toast.show('标签数量已达上限');
            return;
        }
        if (tags.includes(tag)) {
            Toast.show('标签已存在');
            return;
        }
        tags.push(tag);
        tagInput.value = '';
        renderTags(containerEl);
    }

    function updateFooterStatus() {
        const footerEl = panelInstance?.getFooter();
        if (!footerEl) return;

        let charCount = 0;
        let selectedCount = 0;

        if (vditorInstance) {
            const content = vditorInstance.getValue();
            charCount = content.length;
            const textarea = vditorInstance.element?.querySelector('textarea');
            if (textarea) {
                selectedCount = textarea.selectionEnd - textarea.selectionStart;
            }
        }

        footerEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #666;">
                <span class="bili-speed-vditor-footer-status"></span>
                <span>字数: ${charCount} | 已选中: ${selectedCount}</span>
            </div>
        `;
    }

    function showSaveStatus(message, isError = false) {
        const footerEl = panelInstance?.getFooter();
        if (!footerEl) return;

        const statusEl = footerEl.querySelector('.bili-speed-vditor-footer-status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = isError ? '#ff4d4f' : '#52c41a';
            statusEl.style.fontWeight = 'bold';
        }

        setTimeout(() => {
            if (statusEl) {
                statusEl.textContent = '';
                updateFooterStatus();
            }
        }, 3000);
    }

    async function saveNote() {
        const panelEl = panelInstance?.element;
        if (!panelEl) return;

        const titleInput = panelEl.querySelector('.bili-speed-editor-title-input');
        const title = titleInput ? titleInput.value.trim() : '';
        if (!title) {
            Toast.show('请输入笔记标题');
            return;
        }

        let content = '';
        if (vditorInstance) {
            content = vditorInstance.getValue();
        } else {
            const fallback = panelEl.querySelector('.bili-speed-editor-fallback');
            if (fallback) content = fallback.value;
        }

        const videoInfo = getCurrentVideoInfo();
        const noteType = videoInfo.hasVideo ? 'videoNote' : 'normalNote';

        if (currentNoteId) {
            await Notes.update(currentNoteId, {
                title: title,
                content: content,
                contentDelta: '',
                tags: [...tags],
                videoTimestamp: videoTimestamp,
                videoTitle: videoInfo.videoTitle,
                videoUrl: videoInfo.videoUrl
            });
            showSaveStatus('✓ 笔记已更新');
        } else {
            const note = {
                id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                noteType: noteType,
                bvid: videoInfo.bvid,
                videoTitle: videoInfo.videoTitle,
                videoUrl: videoInfo.videoUrl,
                editorType: 'vditor',
                title: title,
                content: content,
                contentDelta: '',
                tags: [...tags],
                videoTimestamp: videoTimestamp,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await Notes.add(note);
            currentNoteId = note.id;
            showSaveStatus('✓ 笔记已保存');
        }
    }

    function createPanel(note) {
        let savedPosition = Config.data.editorPanelPosition;
        const savedSize = Config.data.vditorEditorPanelSize;
        const currentTheme = Config.data.theme || 'light';

        currentNoteId = note ? note.id : null;
        tags = note ? [...(note.tags || [])] : [];
        videoTimestamp = note ? (note.videoTimestamp || 0) : 0;
        pendingContent = note ? (note.content || '') : '';

        const noteTitle = note ? note.title : '';
        const isEdit = !!note;
        const videoInfo = getCurrentVideoInfo();
        const vditorMode = Config.data.vditorEditorMode || 'ir';
        const headerTitle = videoInfo.hasVideo
            ? `✏️ ${isEdit ? '编辑笔记' : '新建笔记'} - Vditor`
            : `✏️ ${isEdit ? '编辑笔记' : '新建普通笔记'} - Vditor`;

        const vditorWidthKey = 'vditorWidth_' + vditorMode;
        const vditorHeightKey = 'vditorHeight_' + vditorMode;
        const panelWidth = savedSize ? savedSize.width : (Config.data[vditorWidthKey] || '560px');
        const panelHeight = savedSize ? savedSize.height : (Config.data[vditorHeightKey] || '550px');

        panelInstance = Card.create({
            className: `bili-speed-vditor-panel theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: headerTitle
            },
            footer: { visible: true },
            styles: {
                width: panelWidth,
                height: panelHeight,
                display: 'flex',
                flexDirection: 'column',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10000,
                ...(savedPosition ? {
                    left: savedPosition.left,
                    top: savedPosition.top,
                    transform: 'none'
                } : {})
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.bili-speed-vditor-panel-actions');
                if (actionsEl) {
                    actionsEl.style.pointerEvents = 'auto';
                    actionsEl.style.position = 'relative';
                    actionsEl.style.zIndex = '1001';
                }

                const listBtn = document.createElement('button');
                listBtn.className = 'bili-speed-editor-list';
                listBtn.title = '打开笔记列表';
                listBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; position: relative; z-index: 1001; pointer-events: auto;';
                listBtn.textContent = '📋';
                listBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    NotesPanel.show();
                });

                const saveBtn = document.createElement('button');
                saveBtn.className = 'bili-speed-editor-save';
                saveBtn.title = '保存笔记';
                saveBtn.style.cssText = 'background: #F0F1F2; color: #333; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; position: relative; z-index: 1001; pointer-events: auto;';
                saveBtn.textContent = '💾 保存';
                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    saveNote();
                });

                const vditorMode = Config.data.vditorEditorMode || 'ir';
                const modeConfigs = [
                    { mode: 'wysiwyg', label: '所见' },
                    { mode: 'ir', label: '即显' },
                    { mode: 'sv', label: '分屏' }
                ];
                const modeButtons = [];
                modeConfigs.forEach(({ mode, label }) => {
                    const btn = document.createElement('button');
                    btn.className = 'bili-speed-editor-mode';
                    btn.title = `切换到${mode === 'wysiwyg' ? '所见即所得' : mode === 'ir' ? '即时渲染' : '分屏预览'}模式`;
                    const isActive = mode === vditorMode;
                    btn.style.cssText = `background: ${isActive ? '#00AEEC' : 'transparent'}; color: ${isActive ? '#fff' : '#000'}; border: ${isActive ? '1px solid #00AEEC' : '1px solid #ddd'}; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 12px; position: relative; z-index: 1001; pointer-events: auto;`;
                    btn.textContent = label;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (Config.data.vditorEditorMode !== mode) {
                            modeButtons.forEach(b => {
                                b.style.background = 'transparent';
                                b.style.color = '#000';
                                b.style.border = '1px solid #ddd';
                            });
                            btn.style.background = '#00AEEC';
                            btn.style.color = '#fff';
                            btn.style.border = '1px solid #00AEEC';
                            Config.data.vditorEditorMode = mode;
                            if (vditorInstance) {
                                switchMode(mode);
                            }
                        }
                    });
                    modeButtons.push(btn);
                    actionsEl.appendChild(btn);
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-editor-close';
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; position: relative; z-index: 1001; pointer-events: auto;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    VditorEditorPanel.close();
                });

                actionsEl.appendChild(listBtn);
                actionsEl.appendChild(saveBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'editorPanelPosition', `[class*="-header"]`);
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-vditor-panel-body';
                bodyEl.style.cssText = 'padding: 12px; flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;';

                bodyEl.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <input type="text" class="bili-speed-editor-title-input" placeholder="输入笔记标题..." value="${noteTitle}" style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; outline: none;">
                    </div>
                    <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <div class="bili-speed-editor-tags" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
                        <input type="text" class="bili-speed-editor-tag-input" placeholder="添加标签..." style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 100px; outline: none;">
                        <button class="bili-speed-editor-tag-add" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer; font-size: 12px;">+</button>
                    </div>
                    ${videoInfo.hasVideo ? `
                    <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 12px; color: #999;">时间点:</span>
                        <span class="bili-speed-editor-timestamp" style="font-size: 12px; color: #00AEEC;">${videoTimestamp > 0 ? Utils.formatTime(videoTimestamp) : '未标记'}</span>
                        <button class="bili-speed-editor-mark-time" style="padding: 2px 8px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer; font-size: 11px;">📍标记当前时间</button>
                    </div>
                    ` : ''}
                    <div id="vditor-editor-container"></div>
                    <div class="bili-speed-editor-loading" style="text-align: center; padding: 40px 0; color: #999; display: none;">
                        <div>正在加载编辑器资源...</div>
                    </div>
                `;

                const editorContainer = document.getElementById('vditor-editor-container');
                if (editorContainer) {
                    editorContainer.style.flex = '1';
                    editorContainer.style.minHeight = '0';
                    editorContainer.style.height = '100%';
                }

                const style = document.createElement('style');
                style.textContent = `
                    #vditor-editor-container {
                        display: flex;
                        flex-direction: column;
                    }
                    #vditor-editor-container .vditor {
                        height: 100% !important;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }
                    #vditor-editor-container .vditor-content {
                        flex: 1;
                        min-height: 0;
                    }
                `;
                document.head.appendChild(style);

                renderTags(bodyEl);

                const tagInput = bodyEl.querySelector('.bili-speed-editor-tag-input');
                const tagAddBtn = bodyEl.querySelector('.bili-speed-editor-tag-add');
                tagAddBtn.addEventListener('click', () => addTag(bodyEl, tagInput));
                tagInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(bodyEl, tagInput);
                    }
                });

                const markTimeBtn = bodyEl.querySelector('.bili-speed-editor-mark-time');
                if (markTimeBtn) {
                    markTimeBtn.addEventListener('click', () => {
                        const video = VideoController.getVideo();
                        if (video) {
                            videoTimestamp = video.currentTime;
                            const tsEl = bodyEl.querySelector('.bili-speed-editor-timestamp');
                            if (tsEl) tsEl.textContent = Utils.formatTime(videoTimestamp);
                            Toast.show(`已标记时间点: ${Utils.formatTime(videoTimestamp)}`);
                        } else {
                            Toast.show('未找到视频元素');
                        }
                    });
                }

                const loadingEl = bodyEl.querySelector('.bili-speed-editor-loading');
                const panelEl = bodyEl.parentElement;

                const vditorMode = Config.data.vditorEditorMode || 'ir';
                const minWidthKey = 'vditorEditorMinWidth_' + vditorMode;
                const minHeightKey = 'vditorEditorMinHeight_' + vditorMode;

                resizeCleanup = Resizable.make(panelEl, {
                    minWidth: parseInt(Config.data[minWidthKey]) || 400,
                    minHeight: parseInt(Config.data[minHeightKey]) || 400,
                    onResize: (newWidth, newHeight) => {
                        if (vditorInstance) {
                            adjustVditorEditorHeight();
                        }
                    },
                    saveKey: 'vditorEditorPanelSize'
                });

                if (isResourcesLoaded && getVditor()) {
                    initVditorEditor(bodyEl, pendingContent, currentTheme, panelEl.getBoundingClientRect().height);
                    setTimeout(() => updateFooterStatus(), 500);
                } else {
                    loadingEl.style.display = 'block';

                    loadVditorResources().then(() => {
                        loadingEl.style.display = 'none';
                        initVditorEditor(bodyEl, pendingContent, currentTheme, panelEl.getBoundingClientRect().height);
                        setTimeout(() => updateFooterStatus(), 500);
                    }).catch(() => {
                        loadingEl.innerHTML = '<div style="color: #ff6b6b;">编辑器加载失败，使用简易编辑模式</div>';
                        setTimeout(() => { loadingEl.style.display = 'none'; }, 2000);
                        const editorContainer = bodyEl.querySelector('#vditor-editor-container');
                        if (editorContainer) {
                            editorContainer.innerHTML = `<textarea class="bili-speed-editor-fallback" style="width: 100%; min-height: 200px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical; outline: none; box-sizing: border-box;">${pendingContent}</textarea>`;
                        }
                    });
                }
            }
        });
    }

    EventBus.on('vditor:mode:change', (mode) => {
        if (panelInstance && vditorInstance) {
            switchMode(mode);
        }
    });

    return {
        create() {
            if (panelInstance) panelInstance.destroy();
            if (dragCleanup) dragCleanup();
            if (resizeCleanup) resizeCleanup();
            dragCleanup = null;
            resizeCleanup = null;
            if (vditorInstance) {
                try { vditorInstance.destroy(); } catch {}
                vditorInstance = null;
            }
        },

        open(note) {
            if (panelInstance) {
                VditorEditorPanel.close();
            }

            if (QuillEditorPanel && typeof QuillEditorPanel.close === 'function') {
                QuillEditorPanel.close();
            }

            createPanel(note || null);
        },

        close() {
            if (vditorInstance) {
                try { vditorInstance.destroy(); } catch {}
                vditorInstance = null;
            }
            if (dragCleanup) dragCleanup();
            if (resizeCleanup) resizeCleanup();
            dragCleanup = null;
            resizeCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
            currentNoteId = null;
            tags = [];
            videoTimestamp = 0;
            pendingContent = '';
        },

        applyTheme(theme) {
            if (!panelInstance) return;
            const el = panelInstance.element;
            el.classList.remove('theme-light', 'theme-dark');
            el.classList.add(`theme-${theme}`);
            
            // 更新 Vditor 编辑器自身的主题
            if (vditorInstance) {
                const Vditor = getVditor();
                if (Vditor && vditorInstance.element) {
                    const vditorRoot = vditorInstance.element.querySelector('.vditor');
                    if (vditorRoot) {
                        vditorRoot.classList.remove('vditor-classic', 'vditor-dark');
                        vditorRoot.classList.add(theme === 'dark' ? 'vditor-dark' : 'vditor-classic');
                    }
                }
            }
        },

        isOpen() {
            return panelInstance !== null;
        },

        destroy() {
            VditorEditorPanel.close();
        }
    };
})();


/**
 * KeyboardHandler - 键盘快捷键模块
 */
const KeyboardHandler = (() => {
    let boundHandler = null;

    return {
        register() {
            boundHandler = (e) => {
                if (PageGuard.isNotAllowedPage() || PageGuard.isInputFocused()) return;

                if (e.ctrlKey || e.metaKey || e.altKey) return;

                const key = e.key.toLowerCase();
                if (key === Config.data.keyReset) {
                    e.preventDefault();
                    VideoController.resetRate();
                } else if (key === Config.data.keyUp) {
                    e.preventDefault();
                    VideoController.adjustRate(Config.data.step);
                } else if (key === Config.data.keyDown) {
                    e.preventDefault();
                    VideoController.adjustRate(-Config.data.step);
                }
            };
            document.addEventListener('keydown', boundHandler);
        },

        unregister() {
            if (boundHandler) {
                document.removeEventListener('keydown', boundHandler);
                boundHandler = null;
            }
        }
    };
})();

/**
 * ScreenModeManager - 屏幕模式管理模块
 */
const ScreenModeManager = (() => {
    let checkInterval = null;
    let clickHandler = null;

    function updateByScreenMode(screenMode) {
        if (screenMode === 'wide' || screenMode === 'web') {
            CardPanel.hide();
        } else {
            CardPanel.show();
        }
    }

    return {
        init() {
            clickHandler = (e) => {
                const target = e.target;
                const wideBtn = target.closest('.bpx-player-ctrl-wide');
                const webBtn = target.closest('.bpx-player-ctrl-web');

                if (wideBtn || webBtn) {
                    Logger.info('点击了宽屏/网页全屏按钮');
                    CardPanel.hide();
                }
            };
            document.addEventListener('click', clickHandler, true);

            let lastScreenMode = '';
            checkInterval = setInterval(() => {
                const playerContainer = document.querySelector('.bpx-player-container');
                if (!playerContainer) return;

                const screenMode = playerContainer.getAttribute('data-screen') || '';
                if (screenMode !== lastScreenMode) {
                    lastScreenMode = screenMode;
                    Logger.info(`播放器模式变化: ${screenMode}`);
                    updateByScreenMode(screenMode);
                }
            }, 500);
        },

        destroy() {
            if (clickHandler) {
                document.removeEventListener('click', clickHandler, true);
                clickHandler = null;
            }
            if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
            }
        }
    };
})();


const App = (() => {
    let lastUrl = location.href;

    async function init() {
        if (PageGuard.isNotAllowedPage()) {
            Logger.info('当前页面不启用脚本');
            return;
        }

        try {
            await Storage.init();
            Logger.info('存储层初始化完成');

            const migrated = await Storage.migrateFromGM();
            if (migrated) {
                Logger.info('数据迁移完成');
            }
        } catch (err) {
            Logger.error('存储层初始化失败:', err);
        }

        Toast.create();
        VideoController.init();
        CardPanel.create();
        ControlPanel.create();
        FavoritesPanel.create();
        NotesPanel.create();
        QuillEditorPanel.create();
        VditorEditorPanel.create();
        ScreenModeManager.init();
        KeyboardHandler.register();

        GM_registerMenuCommand('打开信息卡片', () => EventBus.emit('card:toggle'));
        GM_registerMenuCommand('打开控制面板', () => EventBus.emit('panel:toggle'));
        GM_registerMenuCommand('打开收藏面板', () => EventBus.emit('favorites:toggle'));
        GM_registerMenuCommand('打开笔记面板', () => EventBus.emit('notes:toggle'));

        EventBus.on('panel:toggle', ControlPanel.toggle);
        EventBus.on('card:toggle', CardPanel.toggle);
        EventBus.on('favorites:toggle', FavoritesPanel.toggle);
        EventBus.on('notes:toggle', NotesPanel.toggle);

        EventBus.on('notes:edit', (note) => {
            if (note.editorType === 'vditor') {
                VditorEditorPanel.open(note);
            } else {
                QuillEditorPanel.open(note);
            }
        });

        EventBus.on('notes:new', () => {
            const editorType = Config.data.defaultEditor || 'quill';
            if (editorType === 'vditor') {
                VditorEditorPanel.open(null);
            } else {
                QuillEditorPanel.open(null);
            }
        });

        EventBus.on('theme:changed', (theme) => {
            CardPanel.applyTheme(theme);
            ControlPanel.applyTheme(theme);
            FavoritesPanel.applyTheme(theme);
            NotesPanel.applyTheme(theme);
            QuillEditorPanel.applyTheme(theme);
            VditorEditorPanel.applyTheme(theme);
        });

        Logger.info('脚本初始化完成');
    }

    function cleanup() {
        Toast.destroy();
        CardPanel.destroy();
        ControlPanel.destroy();
        FavoritesPanel.destroy();
        NotesPanel.destroy();
        QuillEditorPanel.destroy();
        VditorEditorPanel.destroy();
        ScreenModeManager.destroy();
        KeyboardHandler.unregister();
        EventBus.clear();
        VideoController.reset();
    }

    function checkUrlChange() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            Logger.info('URL 变化');
            cleanup();
            setTimeout(init, 500);
        }
    }

    return {
        start() {
            setInterval(checkUrlChange, 500);

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else {
                init();
            }

            Logger.info('脚本已加载');
        }
    };
})();

    // 启动应用
    App.start();
})();