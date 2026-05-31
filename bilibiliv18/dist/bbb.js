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
        favoritesPanelPosition: null
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
                    const baseClassName = className.split(' ')[0];
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
 * Favorites - 收藏夹存储模块
 * 提供视频收藏的增删改查及数据导出功能
 */
const Favorites = (() => {
    const STORAGE_KEY = 'favorites';
    const MAX_FAVORITES = 1000;

    function getFavorites() {
        try {
            const data = GM_getValue(STORAGE_KEY);
            return Array.isArray(data) ? data : [];
        } catch (err) {
            Logger.error('读取收藏数据失败:', err);
            return [];
        }
    }

    function saveFavorites(favorites) {
        try {
            GM_setValue(STORAGE_KEY, favorites);
            EventBus.emit('favorites:updated');
            return true;
        } catch (err) {
            Logger.error('保存收藏数据失败:', err);
            return false;
        }
    }

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
            addedAt: parseInt(item.addedAt) || Date.now()
        };
    }

    return {
        add(item) {
            if (!validateItem(item)) {
                Logger.warn('无效的收藏项');
                return false;
            }

            const favorites = getFavorites();
            
            if (favorites.length >= MAX_FAVORITES) {
                Toast.show(`收藏数量已达上限 (${MAX_FAVORITES})`);
                return false;
            }

            const existingIndex = favorites.findIndex(f => f.id === item.id);
            if (existingIndex !== -1) {
                Logger.info('视频已在收藏夹中');
                return false;
            }

            const sanitizedItem = sanitizeItem(item);
            favorites.push(sanitizedItem);
            
            if (saveFavorites(favorites)) {
                EventBus.emit('favorites:add', sanitizedItem);
                Toast.show('已添加到收藏夹');
                return true;
            }
            return false;
        },

        remove(id) {
            if (!id) return false;

            const favorites = getFavorites();
            const index = favorites.findIndex(f => f.id === id);
            
            if (index === -1) {
                Logger.warn('未找到要删除的收藏项');
                return false;
            }

            const removed = favorites.splice(index, 1)[0];
            
            if (saveFavorites(favorites)) {
                EventBus.emit('favorites:remove', removed);
                Toast.show('已从收藏夹移除');
                return true;
            }
            return false;
        },

        get(id) {
            if (!id) return null;
            const favorites = getFavorites();
            return favorites.find(f => f.id === id) || null;
        },

        getAll() {
            return getFavorites();
        },

        has(id) {
            if (!id) return false;
            const favorites = getFavorites();
            return favorites.some(f => f.id === id);
        },

        clear() {
            saveFavorites([]);
            EventBus.emit('favorites:clear');
            Toast.show('收藏夹已清空');
        },

        count() {
            return getFavorites().length;
        },

        exportData() {
            const data = {
                version: "1.0",
                exportedAt: Date.now(),
                count: this.count(),
                data: this.getAll()
            };
            return JSON.stringify(data, null, 2);
        },

        downloadExport() {
            const json = this.exportData();
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

        importData(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                
                if (!data.data || !Array.isArray(data.data)) {
                    throw new Error('无效的数据格式');
                }

                const validItems = data.data.filter(item => validateItem(item))
                    .map(item => sanitizeItem(item));

                if (validItems.length === 0) {
                    Toast.show('没有有效的收藏数据');
                    return false;
                }

                const favorites = getFavorites();
                let addedCount = 0;

                validItems.forEach(item => {
                    if (favorites.length >= MAX_FAVORITES) return;
                    if (!favorites.some(f => f.id === item.id)) {
                        favorites.push(item);
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    saveFavorites(favorites);
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

        updateFavoriteBtn();
    }

    function updatePlayBtn(video) {
        if (!video || !playBtn) return;
        playBtn.textContent = video.paused ? '▶' : '⏸';
    }

    function updateFavoriteBtn() {
        if (!favoriteBtn) return;
        const isFavorited = FavoritesPanel.isCurrentVideoFavorited();
        favoriteBtn.textContent = isFavorited ? '★' : '☆';
        favoriteBtn.classList.toggle('favorited', isFavorited);
        favoriteBtn.title = isFavorited ? '取消收藏' : '添加收藏';
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

                favoriteBtn = document.createElement('button');
                favoriteBtn.className = 'bili-speed-favorite-btn';
                favoriteBtn.title = '添加收藏';
                favoriteBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; position: relative; z-index: 1000; pointer-events: auto;';
                favoriteBtn.textContent = '☆';
                favoriteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    FavoritesPanel.toggleCurrentVideo();
                    updateFavoriteBtn();
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

                actionsEl.appendChild(favoriteBtn);
                actionsEl.appendChild(settingsBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'cardPosition', `.bili-speed-card-header`);

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

        EventBus.on('favorites:updated', updateFavoriteBtn);
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

        applyTheme(theme) {
            if (!cardInstance) return;
            const cardEl = cardInstance.element;
            cardEl.classList.remove('theme-light', 'theme-dark');
            cardEl.classList.add(`theme-${theme}`);
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
            favoriteBtn = null;
        }
    };
})();


/**
 * ControlPanel - 控制面板视图
 * 视图层 - 使用Card组件渲染设置面板
 * 支持左侧菜单导航和主题切换
 */
const ControlPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let multiClickCleanup = null;
    let currentMenu = 'speed';

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

    function renderSystemMenu(contentEl) {
        const currentTheme = Config.data.theme || 'light';
        contentEl.innerHTML = `
            <div style="padding: 16px;">
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 14px; font-weight: bold; margin-bottom: 12px;">🎨 主题设置</div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 13px;">当前主题:</span>
                        <button class="theme-toggle-btn" style="padding: 8px 16px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 16px;">
                            ${currentTheme === 'dark' ? '🌙' : '☀️'}
                        </button>
                        <span style="font-size: 12px; color: #999;">${currentTheme === 'dark' ? '深色模式' : '浅色模式'}</span>
                    </div>
                </div>
                <div style="font-size: 12px; color: #999; padding: 8px; background: #f5f5f5; border-radius: 4px;">
                    💡 提示: 主题设置会应用到所有面板组件
                </div>
            </div>
        `;

        const themeBtn = contentEl.querySelector('.theme-toggle-btn');
        themeBtn.addEventListener('click', toggleTheme);
    }

    function renderSpeedMenu(contentEl) {
        contentEl.innerHTML = `
            <div style="padding: 0 16px;">
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
                <div style="margin-bottom: 12px; display: none;" class="advanced-option">
                    <div style="margin-bottom: 8px;">⬇️ 最小倍速:</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="min-rate-btn" data-rate="0.3">0.3x</button>
                        <button class="min-rate-btn" data-rate="0.5">0.5x</button>
                        <button class="min-rate-btn" data-rate="0.6">0.6x</button>
                        <button class="min-rate-btn" data-rate="0.7">0.7x</button>
                    </div>
                </div>
                <div style="margin-bottom: 12px; display: none;" class="advanced-option">
                    <div style="margin-bottom: 8px;">⬆️ 最大倍速:</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="max-rate-btn" data-rate="2">2x</button>
                        <button class="max-rate-btn" data-rate="3">3x</button>
                        <button class="max-rate-btn" data-rate="4">4x</button>
                        <button class="max-rate-btn" data-rate="5">5x</button>
                    </div>
                </div>
                <div style="margin-bottom: 12px; display: none;" class="advanced-option">
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
            </div>
        `;

        const updateButtonStateLocal = (el) => {
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

    function renderFavoritesMenu(contentEl) {
        const favorites = Favorites.getAll();
        const count = favorites.length;
        
        contentEl.innerHTML = `
            <div style="padding: 16px;">
                <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 14px; font-weight: bold;">📚 收藏管理</div>
                    <div style="font-size: 12px; color: #999;">共 ${count} 条收藏</div>
                </div>
                <div style="margin-bottom: 16px;">
                    <button id="export-favorites-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>📤</span>
                        <span>导出收藏数据</span>
                    </button>
                </div>
                <div style="margin-bottom: 16px;">
                    <button id="import-favorites-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>📥</span>
                        <span>导入收藏数据</span>
                    </button>
                    <input type="file" id="import-favorites-file" accept=".json" style="display: none;">
                </div>
                <div style="margin-bottom: 16px;">
                    <button id="open-favorites-panel-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: none; background: #00AEEC; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>⭐</span>
                        <span>打开收藏面板</span>
                    </button>
                </div>
                ${count > 0 ? `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">
                    <button id="clear-favorites-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ff6b6b; background: #fff; color: #ff6b6b; cursor: pointer;">
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

        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                Favorites.importData(event.target.result);
                renderFavoritesMenu(contentEl);
            };
            reader.readAsText(file);
        });

        contentEl.querySelector('#open-favorites-panel-btn').addEventListener('click', () => {
            EventBus.emit('favorites:toggle');
        });

        const clearBtn = contentEl.querySelector('#clear-favorites-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('确定要清空所有收藏吗？此操作不可恢复。')) {
                    Favorites.clear();
                    renderFavoritesMenu(contentEl);
                }
            });
        }
    }

    function switchMenu(menuName) {
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
                renderSystemMenu(contentEl);
                break;
            case 'speed':
                renderSpeedMenu(contentEl);
                break;
            case 'favorites':
                renderFavoritesMenu(contentEl);
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

                dragCleanup = Draggable.make(headerEl.parentElement, 'panelPosition', `.bili-speed-panel-header`);

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
                    </div>
                    <div class="bili-speed-panel-content" style="flex: 1; min-height: 300px;"></div>
                `;

                const menuItems = bodyEl.querySelectorAll('.bili-speed-panel-menu-item');
                menuItems.forEach(item => {
                    item.addEventListener('click', () => {
                        switchMenu(item.dataset.menu);
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
                switchMenu(currentMenu);
            }
        });

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
            switchMenu(menuName);
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


/**
 * FavoritesPanel - 收藏夹面板视图
 * 视图层 - 使用Card组件渲染收藏夹面板
 */
const FavoritesPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;

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

    function renderFavoriteItem(item, containerEl) {
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
        `;

        const authorEl = document.createElement('span');
        authorEl.textContent = item.author;

        const durationEl = document.createElement('span');
        durationEl.textContent = Utils.formatTime(item.duration);

        metaEl.appendChild(authorEl);
        metaEl.appendChild(durationEl);

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

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            Favorites.remove(item.id);
            renderFavoritesList(containerEl);
        });

        return itemEl;
    }

    function renderFavoritesList(containerEl) {
        containerEl.innerHTML = '';
        
        const favorites = Favorites.getAll();
        
        if (favorites.length === 0) {
            containerEl.innerHTML = `
                <div style="text-align: center; padding: 40px 0; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 8px;">📭</div>
                    <div>暂无收藏</div>
                </div>
            `;
            return;
        }

        favorites.forEach(item => {
            containerEl.appendChild(renderFavoriteItem(item, containerEl));
        });
    }

    function createPanel() {
        let savedPosition = Config.data.favoritesPanelPosition;

        panelInstance = Card.create({
            className: 'bili-speed-favorites-panel',
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

                actionsEl.appendChild(exportBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'favoritesPanelPosition', `.bili-speed-favorites-panel-header`);
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-favorites-panel-body';
                bodyEl.style.cssText = 'padding: 8px; max-height: 400px; overflow-y: auto;';

                renderFavoritesList(bodyEl);

                EventBus.on('favorites:updated', () => {
                    if (panelInstance && bodyEl) {
                        renderFavoritesList(bodyEl);
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

        addCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }
            return Favorites.add(videoInfo);
        },

        removeCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }
            return Favorites.remove(videoInfo.id);
        },

        toggleCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }
            
            if (Favorites.has(videoInfo.id)) {
                return Favorites.remove(videoInfo.id);
            } else {
                return Favorites.add(videoInfo);
            }
        },

        isCurrentVideoFavorited() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) return false;
            return Favorites.has(videoInfo.id);
        },

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
        GM_registerMenuCommand('打开收藏面板', () => EventBus.emit('favorites:toggle'));

        EventBus.on('panel:toggle', ControlPanel.toggle);
        EventBus.on('card:toggle', CardPanel.toggle);
        EventBus.on('favorites:toggle', FavoritesPanel.toggle);

        EventBus.on('theme:changed', (theme) => {
            CardPanel.applyTheme(theme);
            ControlPanel.applyTheme(theme);
        });

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