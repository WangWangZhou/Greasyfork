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
        favoritesVisible: false,
        cardPosition: null,
        panelPosition: null,
        favoritesPosition: null,
        keyReset: 'z',
        keyUp: 'c',
        keyDown: 'x'
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
 * Favorites - 收藏数据存储模块
 * 实现收藏数据的本地持久化存储，包括增删改查操作及数据格式验证
 */
const Favorites = (() => {
    const STORAGE_KEY = 'favorites';
    const MAX_FAVORITES = 1000;

    /**
     * 获取所有收藏
     * @returns {Array} 收藏列表
     */
    function getAll() {
        try {
            const data = GM_getValue(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            Logger.error('获取收藏数据失败', e);
            return [];
        }
    }

    /**
     * 保存收藏数据
     * @param {Array} favorites 收藏列表
     */
    function saveAll(favorites) {
        try {
            GM_setValue(STORAGE_KEY, JSON.stringify(favorites));
            EventBus.emit('favorites:updated');
        } catch (e) {
            Logger.error('保存收藏数据失败', e);
        }
    }

    /**
     * 验证收藏项数据格式
     * @param {Object} item 收藏项
     * @returns {boolean} 是否有效
     */
    function validateItem(item) {
        return item &&
               typeof item.id === 'string' && item.id.length > 0 &&
               typeof item.bvid === 'string' && item.bvid.length > 0 &&
               typeof item.title === 'string' && item.title.length > 0 &&
               typeof item.author === 'string' &&
               typeof item.duration === 'number' && item.duration >= 0 &&
               typeof item.url === 'string' && item.url.startsWith('https://');
    }

    /**
     * 获取当前页面视频信息
     * @returns {Object|null} 视频信息
     */
    function getCurrentVideoInfo() {
        try {
            const video = VideoController.getVideo();
            if (!video) return null;

            const bvid = Utils.getBVid();
            if (!bvid) return null;

            const title = document.querySelector('h1.video-title')?.textContent?.trim() ||
                         document.querySelector('.video-info-title')?.textContent?.trim() ||
                         document.title.replace('- 哔哩哔哩', '').trim() ||
                         '未知标题';

            const author = document.querySelector('.up-name')?.textContent?.trim() ||
                          document.querySelector('.video-owner-name')?.textContent?.trim() ||
                          '未知UP主';

            const duration = video.duration || 0;

            const cover = document.querySelector('meta[property="og:image"]')?.content ||
                         document.querySelector('.cover img')?.src || '';

            return {
                id: bvid,
                bvid: bvid,
                title: title,
                author: author,
                duration: duration,
                cover: cover,
                url: window.location.href,
                addedAt: Date.now()
            };
        } catch (e) {
            Logger.error('获取当前视频信息失败', e);
            return null;
        }
    }

    return {
        /**
         * 添加收藏
         * @param {Object} item 收藏项
         * @returns {boolean} 是否添加成功
         */
        add(item) {
            if (!validateItem(item)) {
                Logger.warn('收藏项数据格式无效');
                return false;
            }

            const favorites = getAll();
            
            if (favorites.length >= MAX_FAVORITES) {
                Toast.show('收藏数量已达上限');
                return false;
            }

            const existingIndex = favorites.findIndex(f => f.id === item.id);
            if (existingIndex !== -1) {
                favorites[existingIndex] = { ...item, addedAt: Date.now() };
            } else {
                favorites.push({ ...item, addedAt: Date.now() });
            }

            saveAll(favorites);
            Toast.show('已添加收藏');
            return true;
        },

        /**
         * 删除收藏
         * @param {string} id 视频ID
         * @returns {boolean} 是否删除成功
         */
        remove(id) {
            const favorites = getAll();
            const initialLength = favorites.length;
            const filtered = favorites.filter(f => f.id !== id);
            
            if (filtered.length === initialLength) {
                return false;
            }

            saveAll(filtered);
            return true;
        },

        /**
         * 获取单个收藏
         * @param {string} id 视频ID
         * @returns {Object|null} 收藏项
         */
        get(id) {
            const favorites = getAll();
            return favorites.find(f => f.id === id) || null;
        },

        /**
         * 获取所有收藏
         * @returns {Array} 收藏列表
         */
        getAll() {
            return getAll();
        },

        /**
         * 判断是否已收藏
         * @param {string} id 视频ID
         * @returns {boolean} 是否已收藏
         */
        has(id) {
            return getAll().some(f => f.id === id);
        },

        /**
         * 清空所有收藏
         */
        clear() {
            saveAll([]);
            Toast.show('已清空所有收藏');
        },

        /**
         * 获取收藏数量
         * @returns {number} 收藏数量
         */
        count() {
            return getAll().length;
        },

        /**
         * 添加当前页面视频到收藏
         * @returns {boolean} 是否添加成功
         */
        addCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }
            
            const isAlreadyFavorited = this.has(videoInfo.id);
            if (isAlreadyFavorited) {
                this.remove(videoInfo.id);
                Toast.show('已取消收藏');
                return false;
            }
            
            return this.add(videoInfo);
        },

        /**
         * 获取当前页面视频的收藏状态
         * @returns {boolean} 是否已收藏
         */
        isCurrentVideoFavorited() {
            const bvid = Utils.getBVid();
            return bvid ? this.has(bvid) : false;
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
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.classList.contains('bili-speed-drag-text')) return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = el.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
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
                    titleEl.className = `${className}-drag-text`;
                    titleEl.style.cssText = 'font-weight: bold; cursor: default;';
                    titleEl.innerHTML = header.title;

                    const actionsEl = document.createElement('div');
                    actionsEl.className = `${className}-actions`;
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
                const actionsEl = cardEl.querySelector(`.${className}-actions`);
                if (!actionsEl) return;

                actionsEl.style.visibility = 'visible';
                setTimeout(() => {
                    if (actionsEl.parentElement) {
                        actionsEl.style.visibility = 'hidden';
                    }
                }, 5000);

                cardEl.addEventListener('mouseenter', () => {
                    actionsEl.style.visibility = 'visible';
                });
                cardEl.addEventListener('mouseleave', () => {
                    actionsEl.style.visibility = 'hidden';
                });
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
                    return cardEl.querySelector(`.${className}-actions`);
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
    const cleanupFns = new Set();

    function updateCard() {
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
    }

    function updatePlayBtn(video) {
        if (!video || !playBtn) return;
        playBtn.textContent = video.paused ? '▶' : '⏸';
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

        cardInstance = Card.create({
            className: 'bili-speed-card',
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

                const settingsBtn = document.createElement('button');
                settingsBtn.className = 'bili-speed-panel-btn';
                settingsBtn.title = `快捷键: ${Config.data.keyReset.toUpperCase()}重置 | ${Config.data.keyUp.toUpperCase()}加速 | ${Config.data.keyDown.toUpperCase()}减速`;
                settingsBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;';
                settingsBtn.textContent = '⚙️';
                settingsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    EventBus.emit('panel:toggle');
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-close-btn';
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
                closeBtn.textContent = 'X';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    EventBus.emit('card:toggle');
                });

                actionsEl.appendChild(settingsBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'cardPosition', `.bili-speed-card-header`);
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

                const video = VideoController.getVideo();
                updatePlayBtn(video);

                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!video) return;
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                });

                let isDraggingProgress = false;
                const getTimeFromPosition = (clientX) => {
                    if (!video || !video.duration) return 0;
                    const rect = progressWrapper.getBoundingClientRect();
                    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                    return percent * video.duration;
                };

                const updateTooltip = (clientX) => {
                    if (!video || !video.duration) return;
                    const time = getTimeFromPosition(clientX);
                    const rect = progressWrapper.getBoundingClientRect();
                    const percent = (clientX - rect.left) / rect.width;
                    tooltip.textContent = Utils.formatTime(time);
                    tooltip.style.left = `${percent * 100}%`;
                    tooltip.style.display = 'block';
                };

                const seekVideo = Utils.throttle((time) => {
                    if (video) video.currentTime = time;
                }, 100);

                const onMouseEnter = (e) => updateTooltip(e.clientX);
                const onMouseMove = (e) => { if (!isDraggingProgress) updateTooltip(e.clientX); };
                const onMouseLeave = () => { if (!isDraggingProgress) tooltip.style.display = 'none'; };

                const onClick = (e) => {
                    if (!video || !video.duration) return;
                    video.currentTime = getTimeFromPosition(e.clientX);
                };

                const onDragStart = (e) => {
                    if (!video || !video.duration) return;
                    isDraggingProgress = true;
                    e.preventDefault();
                };

                const onDragMove = (e) => {
                    if (!isDraggingProgress) return;
                    updateTooltip(e.clientX);
                    const time = getTimeFromPosition(e.clientX);
                    seekVideo(time);
                    progressBar.style.width = `${(time / video.duration) * 100}%`;
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
                    if (!video || !video.duration) return;
                    progressBar.style.width = `${(video.currentTime / video.duration) * 100}%`;
                };

                if (video) {
                    video.addEventListener('timeupdate', updateProgress);
                    cleanupFns.add(() => video.removeEventListener('timeupdate', updateProgress));
                    updateProgress();
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
        }
    }

    return {
        create() {
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

        destroy() {
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
        }
    };
})();

/**
 * ControlPanel - 控制面板视图
 * 视图层 - 使用Card组件渲染设置面板
 */
const ControlPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let multiClickCleanup = null;

    function updateButtonState() {
        if (!panelInstance) return;

        const panelEl = panelInstance.element;

        const buttonGroups = [
            { selector: '.step-btn', dataAttr: 'step', configKey: 'step' },
            { selector: '.default-btn', dataAttr: 'rate', configKey: 'defaultRate' },
            { selector: '.min-rate-btn', dataAttr: 'rate', configKey: 'minRate' },
            { selector: '.max-rate-btn', dataAttr: 'rate', configKey: 'maxRate' }
        ];

        buttonGroups.forEach(({ selector, dataAttr, configKey }) => {
            panelEl.querySelectorAll(selector).forEach(btn => {
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
        if (!panelInstance) return;
        const panelEl = panelInstance.element;
        const input = panelEl.querySelector(`#${inputId}`);
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

    function createPanel() {
        if (multiClickCleanup) {
            multiClickCleanup();
            multiClickCleanup = null;
        }

        let savedPosition = Config.data.panelPosition;

        panelInstance = Card.create({
            className: 'bili-speed-panel',
            header: {
                visible: true,
                draggable: true,
                title: '⚙️ 控制面板'
            },
            footer: { visible: false },
            styles: {
                width: '300px',
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

                dragCleanup = Draggable.make(headerEl.parentElement, 'panelPosition', `.bili-speed-panel-header`);

                let advancedVisible = false;
                multiClickCleanup = Utils.multiClick(titleEl, 5, () => {
                    advancedVisible = !advancedVisible;
                    const hiddenItems = headerEl.parentElement.querySelectorAll('.bili-speed-panel-body > div[style*="display: none"]');
                    hiddenItems.forEach(item => {
                        item.style.display = advancedVisible ? 'block' : 'none';
                    });
                    Toast.show(advancedVisible ? '已显示高级选项' : '已隐藏高级选项');
                });
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-panel-body';
                bodyEl.style.cssText = 'padding: 0 16px;';

                bodyEl.innerHTML = `
                    <div style="margin-bottom: 12px;">
                        <div style="margin-bottom: 8px;">📏 步进值:</div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="step-btn" data-step="0.02">0.02</button>
                            <button class="step-btn" data-step="0.05">0.05</button>
                            <button class="step-btn" data-step="0.10">0.10</button>
                        </div>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <div style="margin-bottom: 8px;">🎯 初始倍速:</div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="default-btn" data-rate="0.8">0.8x</button>
                            <button class="default-btn" data-rate="0.9">0.9x</button>
                            <button class="default-btn" data-rate="1.0">1.0x</button>
                            <button class="default-btn" data-rate="1.1">1.1x</button>
                            <button class="default-btn" data-rate="1.25">1.25x</button>
                        </div>
                    </div>
                    <div style="margin-bottom: 12px; display: none;">
                        <div style="margin-bottom: 8px;">⬇️ 最小倍速:</div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="min-rate-btn" data-rate="0.3">0.3x</button>
                            <button class="min-rate-btn" data-rate="0.5">0.5x</button>
                            <button class="min-rate-btn" data-rate="0.6">0.6x</button>
                            <button class="min-rate-btn" data-rate="0.7">0.7x</button>
                        </div>
                    </div>
                    <div style="margin-bottom: 12px; display: none;">
                        <div style="margin-bottom: 8px;">⬆️ 最大倍速:</div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="max-rate-btn" data-rate="2">2x</button>
                            <button class="max-rate-btn" data-rate="3">3x</button>
                            <button class="max-rate-btn" data-rate="4">4x</button>
                            <button class="max-rate-btn" data-rate="5">5x</button>
                        </div>
                    </div>
                    <div style="margin-bottom: 12px; display: none;">
                        <div style="margin-bottom: 8px;">⌨️ 快捷键设置:</div>
                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 12px;">🔄 重置:</span>
                                <input type="text" id="key-reset" maxlength="1" value="${Config.data.keyReset.toUpperCase()}" style="width: 30px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; text-transform: uppercase;">
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 12px;">⏩ 加速:</span>
                                <input type="text" id="key-up" maxlength="1" value="${Config.data.keyUp.toUpperCase()}" style="width: 30px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; text-transform: uppercase;">
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 12px;">⏪ 减速:</span>
                                <input type="text" id="key-down" maxlength="1" value="${Config.data.keyDown.toUpperCase()}" style="width: 30px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; text-transform: uppercase;">
                            </div>
                        </div>
                        <div style="font-size: 11px; color: #999; margin-top: 4px;">* 快捷键修改后需刷新网页生效，不支持F键</div>
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: flex-end; padding: 12px 0;">
                        <button id="reset-btn" style="padding: 8px 16px; border-radius: 4px; border: none; background: #999; color: #fff; cursor: pointer;">🔄 重置</button>
                        <button id="save-btn" style="padding: 8px 16px; border-radius: 4px; border: none; background: #00AEEC; color: #fff; cursor: pointer;">💾 保存</button>
                    </div>
                `;

                const panelStyle = document.createElement('style');
                panelStyle.textContent = `
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
                `;
                if (!document.querySelector('#bili-speed-panel-style')) {
                    panelStyle.id = 'bili-speed-panel-style';
                    document.head.appendChild(panelStyle);
                }

                const updateButtonState = (el) => {
                    const buttonGroups = [
                        { selector: '.step-btn', dataAttr: 'step', configKey: 'step' },
                        { selector: '.default-btn', dataAttr: 'rate', configKey: 'defaultRate' },
                        { selector: '.min-rate-btn', dataAttr: 'rate', configKey: 'minRate' },
                        { selector: '.max-rate-btn', dataAttr: 'rate', configKey: 'maxRate' }
                    ];

                    buttonGroups.forEach(({ selector, dataAttr, configKey }) => {
                        el.querySelectorAll(selector).forEach(btn => {
                            const isActive = parseFloat(btn.dataset[dataAttr]) === Config.data[configKey];
                            btn.classList.toggle('active', isActive);
                        });
                    });
                };

                updateButtonState(bodyEl);

                bodyEl.querySelectorAll('.step-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.step = parseFloat(btn.dataset.step);
                        updateButtonState(bodyEl);
                    });
                });

                bodyEl.querySelectorAll('.default-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.defaultRate = parseFloat(btn.dataset.rate);
                        updateButtonState(bodyEl);
                    });
                });

                bodyEl.querySelectorAll('.min-rate-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.minRate = parseFloat(btn.dataset.rate);
                        updateButtonState(bodyEl);
                    });
                });

                bodyEl.querySelectorAll('.max-rate-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.maxRate = parseFloat(btn.dataset.rate);
                        updateButtonState(bodyEl);
                    });
                });

                handleKeyInput('key-reset', 'keyReset');
                handleKeyInput('key-up', 'keyUp');
                handleKeyInput('key-down', 'keyDown');

                bodyEl.querySelector('#reset-btn').addEventListener('click', () => {
                    Config.batchUpdate({
                        step: Config.DEFAULTS.step,
                        minRate: Config.DEFAULTS.minRate,
                        maxRate: Config.DEFAULTS.maxRate,
                        defaultRate: Config.DEFAULTS.defaultRate,
                        keyReset: Config.DEFAULTS.keyReset,
                        keyUp: Config.DEFAULTS.keyUp,
                        keyDown: Config.DEFAULTS.keyDown
                    });
                    bodyEl.querySelector('#key-reset').value = Config.DEFAULTS.keyReset.toUpperCase();
                    bodyEl.querySelector('#key-up').value = Config.DEFAULTS.keyUp.toUpperCase();
                    bodyEl.querySelector('#key-down').value = Config.DEFAULTS.keyDown.toUpperCase();
                    updateButtonState(bodyEl);
                    EventBus.emit('config:reset');
                });

                bodyEl.querySelector('#save-btn').addEventListener('click', () => {
                    Config.data.keyReset = bodyEl.querySelector('#key-reset').value.toLowerCase() || 'z';
                    Config.data.keyUp = bodyEl.querySelector('#key-up').value.toLowerCase() || 'x';
                    Config.data.keyDown = bodyEl.querySelector('#key-down').value.toLowerCase() || 'c';
                    const video = VideoController.getVideo();
                    if (video && video.playbackRate === Config.data.defaultRate) {
                        VideoController.setRate(Config.data.defaultRate);
                    }
                    EventBus.emit('panel:toggle');
                    EventBus.emit('config:saved');
                    Toast.show('配置已保存，刷新后生效');
                });
            }
        });
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

/**
 * FavoritesPanel - 收藏夹视图
 * 展示收藏列表、添加收藏、删除收藏、跳转视频
 */
const FavoritesPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;

    /**
     * 渲染收藏列表
     * @param {HTMLElement} bodyEl 容器元素
     */
    function renderFavorites(bodyEl) {
        const favorites = Favorites.getAll();
        
        if (favorites.length === 0) {
            bodyEl.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                    <div style="font-size: 14px;">暂无收藏</div>
                    <div style="font-size: 12px; margin-top: 8px;">在视频页面点击收藏按钮添加</div>
                </div>
            `;
            return;
        }

        const favoritesHtml = favorites.map((item, index) => `
            <div class="favorites-item" data-id="${item.id}" style="display: flex; gap: 12px; padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;" data-index="${index}">
                <img src="${item.cover}" alt="${item.title}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; flex-shrink: 0;" onerror="this.src='https://i0.hdslb.com/bfs/archive/6d1e3e6d4a7c5f8b9a0c3e2d1f4b5a6c.png';">
                <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0;">
                    <div>
                        <div class="favorites-title" style="font-size: 13px; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.title)}</div>
                        <div style="font-size: 12px; color: #999; margin-top: 4px;">${escapeHtml(item.author)} · ${Utils.formatTime(item.duration)}</div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; color: #ccc;">${formatDate(item.addedAt)}</span>
                        <button class="favorites-delete-btn" data-id="${item.id}" style="display: none; padding: 4px 8px; border: none; border-radius: 4px; background: #ff4d4f; color: #fff; font-size: 11px; cursor: pointer;">删除</button>
                    </div>
                </div>
            </div>
        `).join('');

        bodyEl.innerHTML = `
            <div class="favorites-list" style="max-height: 400px; overflow-y: auto;">
                ${favoritesHtml}
            </div>
        `;

        // 添加事件监听
        bindEvents(bodyEl);
    }

    /**
     * HTML转义
     * @param {string} text 文本
     * @returns {string} 转义后的文本
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 格式化日期
     * @param {number} timestamp 时间戳
     * @returns {string} 格式化后的日期
     */
    function formatDate(timestamp) {
        const date = new Date(timestamp);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}月${day}日`;
    }

    /**
     * 绑定事件
     * @param {HTMLElement} bodyEl 容器元素
     */
    function bindEvents(bodyEl) {
        // 列表项点击事件
        bodyEl.querySelectorAll('.favorites-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('favorites-delete-btn')) return;
                
                const id = item.dataset.id;
                const favorite = Favorites.get(id);
                if (favorite) {
                    window.open(favorite.url, '_blank');
                }
            });

            // 鼠标悬停显示删除按钮
            item.addEventListener('mouseenter', () => {
                const deleteBtn = item.querySelector('.favorites-delete-btn');
                if (deleteBtn) deleteBtn.style.display = 'block';
            });

            item.addEventListener('mouseleave', () => {
                const deleteBtn = item.querySelector('.favorites-delete-btn');
                if (deleteBtn) deleteBtn.style.display = 'none';
            });
        });

        // 删除按钮点击事件
        bodyEl.querySelectorAll('.favorites-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (Favorites.remove(id)) {
                    renderFavorites(bodyEl);
                    Toast.show('已删除收藏');
                }
            });
        });
    }

    /**
     * 创建面板
     */
    function createPanel() {
        let savedPosition = Config.data.favoritesPosition;

        panelInstance = Card.create({
            className: 'bili-speed-favorites',
            header: {
                visible: true,
                draggable: true,
                title: '⭐ 收藏夹'
            },
            footer: { visible: false },
            styles: {
                width: '320px',
                display: Config.data.favoritesVisible ? 'block' : 'none',
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
                    EventBus.emit('favorites:toggle');
                });

                const clearBtn = document.createElement('button');
                clearBtn.className = 'bili-speed-clear';
                clearBtn.style.cssText = 'background: none; border: none; color: #999; font-size: 16px; cursor: pointer; padding: 0 4px;';
                clearBtn.textContent = '🗑';
                clearBtn.title = '清空收藏';
                clearBtn.addEventListener('click', () => {
                    if (confirm('确定要清空所有收藏吗？')) {
                        Favorites.clear();
                        renderFavorites(headerEl.parentElement.querySelector('.bili-speed-favorites-body'));
                    }
                });

                const actionsEl = headerEl.querySelector('.bili-speed-favorites-actions') || 
                                 headerEl.querySelector('.bili-speed-actions') || 
                                 headerEl.querySelector('div:last-child');
                actionsEl.appendChild(clearBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'favoritesPosition', '.bili-speed-favorites-header');
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-favorites-body';
                bodyEl.style.cssText = 'padding: 0;';
                renderFavorites(bodyEl);
            }
        });
    }

    /**
     * 订阅收藏更新事件
     */
    function subscribeToUpdates() {
        EventBus.on('favorites:updated', () => {
            if (panelInstance) {
                const bodyEl = panelInstance.element.querySelector('.bili-speed-favorites-body');
                if (bodyEl) {
                    renderFavorites(bodyEl);
                }
            }
        });
    }

    return {
        /**
         * 创建收藏面板
         */
        create() {
            if (panelInstance) panelInstance.destroy();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;

            createPanel();
            subscribeToUpdates();
        },

        /**
         * 切换面板显示/隐藏
         */
        toggle() {
            Config.data.favoritesVisible = !Config.data.favoritesVisible;
            if (panelInstance) {
                panelInstance.element.style.display = Config.data.favoritesVisible ? 'block' : 'none';
            }
        },

        /**
         * 销毁面板
         */
        destroy() {
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
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


/**
 * App - 主控模块
 * 负责初始化、生命周期管理、模块编排与URL变化检测
 */
const App = (() => {
    let lastUrl = location.href;

    function init() {
        if (PageGuard.isNotAllowedPage()) {
            Logger.info('当前页面不启用脚本');
            return;
        }

        if (!VideoController.init()) {
            setTimeout(init, 1000);
            return;
        }

        Toast.create();
        CardPanel.create();
        ControlPanel.create();
        FavoritesPanel.create();
        ScreenModeManager.init();
        KeyboardHandler.register();

        GM_registerMenuCommand('打开信息卡片', () => EventBus.emit('card:toggle'));
        GM_registerMenuCommand('打开控制面板', () => EventBus.emit('panel:toggle'));
        GM_registerMenuCommand('收藏面板', () => EventBus.emit('favorites:toggle'));

        EventBus.on('panel:toggle', ControlPanel.toggle);
        EventBus.on('card:toggle', CardPanel.toggle);
        EventBus.on('favorites:toggle', FavoritesPanel.toggle);

        Logger.info('脚本初始化完成');
    }

    function cleanup() {
        Toast.destroy();
        CardPanel.destroy();
        ControlPanel.destroy();
        FavoritesPanel.destroy();
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