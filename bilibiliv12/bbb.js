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

/**
 * ============================================================================
 * B站自定义倍速油猴脚本 - 模块化重构版
 * ============================================================================
 *
 * 模块架构概览:
 * ┌─────────────────────────────────────────────────────────┐
 * │                      App (主控模块)                      │
 * │  负责初始化、生命周期管理、模块编排与URL变化检测           │
 * └──────────┬──────────────────────────────────────────────┘
 *            │ 依赖注入
 * ┌─────────┴─────────┐  ┌──────────────┐  ┌───────────────┐
 * │   EventBus        │  │   Config     │  │   Logger      │
 * │ (事件总线/通信中枢)│  │ (配置持久化) │  │ (日志输出)    │
 * └─────────┬─────────┘  └──────┬───────┘  └───────────────┘
 *           │                   │
 * ┌────────┴───────────────────┴─────────────────────────────┐
 * │                    核心业务模块                           │
 * │  ┌──────────────────┐  ┌──────────────────────────────┐ │
 * │  │ VideoController  │  │    KeyboardHandler           │ │
 * │  │ (倍速控制核心)    │  │    (键盘快捷键处理)          │ │
 * │  └──────────────────┘  └──────────────────────────────┘ │
 * └──────────────────────────────────────────────────────────┘
 *           │
 * ┌─────────┴────────────────────────────────────────────────┐
 * │                    UI 组件模块                            │
 * │  ┌────────┐  ┌───────────┐  ┌──────────────┐           │
 * │  │ Toast  │  │ CardPanel │  │ ControlPanel │           │
 * │  │ (提示) │  │ (信息卡片) │  │ (控制面板)   │           │
 * │  └────────┘  └───────────┘  └──────────────┘           │
 * └──────────────────────────────────────────────────────────┘
 *           │
 * ┌─────────┴────────────────────────────────────────────────┐
 * │                    基础设施模块                            │
 * │  ┌────────┐  ┌───────────┐  ┌──────────────────────┐   │
 * │  │ Utils  │  │ Draggable │  │  ScreenModeManager   │   │
 * │  │ (工具) │  │ (拖拽行为) │  │  (屏幕模式管理)      │   │
 * │  └────────┘  └───────────┘  └──────────────────────┘   │
 * │  ┌──────────┐                                          │
 * │  │ PageGuard│                                          │
 * │  │ (页面守卫)│                                          │
 * │  └──────────┘                                          │
 * └──────────────────────────────────────────────────────────┘
 *
 * 模块间通信机制:
 *   - EventBus: 发布/订阅模式，模块间松耦合通信
 *   - Config:   共享配置状态，通过 Proxy 实现响应式持久化
 *   - 依赖注入: App 初始化时将依赖显式传递给各模块
 *
 * ============================================================================
 */

(function () {
    'use strict';

    // =========================================================================
    // 模块1: EventBus - 事件总线
    // =========================================================================
    /**
     * 事件总线模块 - 模块间通信的核心枢纽
     *
     * 职责:
     *   - 提供发布/订阅模式的事件通信机制
     *   - 解耦模块间的直接依赖关系
     *   - 支持一次性事件监听与事件取消
     *
     * 支持的事件列表:
     *   - 'rate:change'      - 倍速变化时触发
     *   - 'video:found'      - 视频元素被发现时触发
     *   - 'panel:toggle'     - 控制面板切换显示时触发
     *   - 'card:toggle'      - 信息卡片切换显示时触发
     *   - 'config:reset'     - 配置被重置时触发
     *   - 'config:saved'     - 配置被保存时触发
     *   - 'screen:mode'      - 屏幕模式变化时触发
     *   - 'cleanup'          - 页面清理时触发
     */
    const EventBus = (() => {
        /** @type {Map<string, Set<Function>>} 事件监听器映射表 */
        const listeners = new Map();

        return {
            /**
             * 订阅事件
             * @param {string} event - 事件名称
             * @param {Function} callback - 回调函数
             * @returns {Function} 取消订阅的函数
             */
            on(event, callback) {
                if (!listeners.has(event)) {
                    listeners.set(event, new Set());
                }
                listeners.get(event).add(callback);
                // 返回取消订阅函数，方便调用方清理
                return () => listeners.get(event)?.delete(callback);
            },

            /**
             * 订阅一次性事件（触发一次后自动移除）
             * @param {string} event - 事件名称
             * @param {Function} callback - 回调函数
             */
            once(event, callback) {
                const wrapper = (...args) => {
                    callback(...args);
                    this.off(event, wrapper);
                };
                this.on(event, wrapper);
            },

            /**
             * 取消订阅事件
             * @param {string} event - 事件名称
             * @param {Function} callback - 要移除的回调函数
             */
            off(event, callback) {
                listeners.get(event)?.delete(callback);
            },

            /**
             * 发布事件，通知所有订阅者
             * @param {string} event - 事件名称
             * @param {...*} args - 传递给回调的参数
             */
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

            /**
             * 清除所有事件监听器（用于脚本清理时）
             */
            clear() {
                listeners.clear();
            }
        };
    })();

    // =========================================================================
    // 模块2: Logger - 日志模块
    // =========================================================================
    /**
     * 日志模块 - 统一的调试日志输出
     *
     * 职责:
     *   - 提供分级日志输出（info / warn / error）
     *   - 通过 DEBUG 开关控制日志是否输出
     *   - 统一日志前缀格式，便于在控制台中过滤
     *
     * 使用方式:
     *   Logger.info('视频元素已找到');
     *   Logger.warn('倍速超出范围');
     *   Logger.error('初始化失败');
     */
    const Logger = (() => {
        const DEBUG = false;
        const PREFIX = '[BiliSpeed]';

        return {
            /**
             * 输出 info 级别日志
             * @param {string} msg - 日志消息
             */
            info(msg) {
                if (DEBUG) console.log(`${PREFIX} ${msg}`);
            },

            /**
             * 输出 warn 级别日志
             * @param {string} msg - 警告消息
             */
            warn(msg) {
                if (DEBUG) console.warn(`${PREFIX} ${msg}`);
            },

            /**
             * 输出 error 级别日志
             * @param {string} msg - 错误消息
             */
            error(msg) {
                console.error(`${PREFIX} ${msg}`);
            }
        };
    })();

    // =========================================================================
    // 模块3: Utils - 通用工具函数模块
    // =========================================================================
    /**
     * 工具函数模块 - 提供各模块复用的基础工具
     *
     * 职责:
     *   - 数值处理: round2 (保留两位小数)
     *   - 时间处理: formatTime / parseTimeToSeconds (时间格式化与解析)
     *   - 函数增强: throttle (节流函数)
     *   - DOM操作:  multiClick (多次点击检测)
     *   - 合集信息: isCollection / getCollectionCount / getCollectionDuration
     */
    const Utils = (() => ({
        /**
         * 保留两位小数
         * @param {number} num - 输入数值
         * @returns {number} 保留两位小数的结果
         */
        round2(num) {
            return Math.round(num * 100) / 100;
        },

        /**
         * 将秒数格式化为 mm:ss 或 hh:mm:ss 字符串
         * @param {number} seconds - 秒数
         * @returns {string} 格式化后的时间字符串
         */
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

        /**
         * 节流函数 - 限制函数在指定时间间隔内只执行一次
         * @param {Function} fn - 需要节流的函数
         * @param {number} delay - 节流间隔（毫秒）
         * @returns {Function} 节流后的函数
         */
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

        /**
         * 将时间字符串 (mm:ss 或 hh:mm:ss) 解析为秒数
         * @param {string} timeStr - 时间字符串
         * @returns {number} 秒数
         */
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

        /**
         * 判断当前视频是否为合集/选集
         * @returns {boolean} 是否为合集
         */
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

        /**
         * 获取合集/选集的视频总数
         * @returns {number} 视频数量
         */
        getCollectionCount() {
            const domCount = document.querySelectorAll('.simple-base-item').length;
            if (domCount > 0) return domCount;
            try {
                return window.__INITIAL_STATE__?.videoData?.videos || 1;
            } catch {
                return 1;
            }
        },

        /**
         * 获取合集/选集的总时长（秒）
         * @returns {number} 总时长秒数
         */
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

        /**
         * 多次点击检测 - 在指定时间内连续点击指定次数后触发回调
         * @param {HTMLElement} element - 目标元素
         * @param {number} times - 需要点击的次数
         * @param {Function} callback - 达到次数后的回调
         * @param {number} timeout - 点击间隔超时（毫秒），默认 800
         */
        multiClick(element, times, callback, timeout = 800) {
            let clickCount = 0;
            let clickTimer = null;

            element.addEventListener('click', () => {
                clickCount++;
                if (clickTimer) clearTimeout(clickTimer);
                clickTimer = setTimeout(() => {
                    clickCount = 0;
                }, timeout);

                if (clickCount >= times) {
                    clickCount = 0;
                    callback();
                }
            });
        }
    }))();

    // =========================================================================
    // 模块4: Config - 配置管理模块
    // =========================================================================
    /**
     * 配置管理模块 - 响应式持久化配置
     *
     * 职责:
     *   - 定义默认配置项 (DEFAULTS)
     *   - 通过 Proxy 实现配置的自动持久化（读写 GM_setValue/GM_getValue）
     *   - 提供配置重置功能
     *   - 配置变更时通过 EventBus 通知相关模块
     *
     * 配置项说明:
     *   - step:         倍速调节步进值（默认 0.05）
     *   - minRate:      最小倍速（默认 0.5）
     *   - maxRate:      最大倍速（默认 2.0）
     *   - defaultRate:  默认倍速（默认 1.0）
     *   - cardVisible:  信息卡片是否可见
     *   - panelVisible: 控制面板是否可见
     *   - cardPosition: 信息卡片拖拽位置 {left, top}
     *   - panelPosition:控制面板拖拽位置 {left, top}
     *   - keyReset:     重置快捷键（默认 'z'）
     *   - keyUp:        加速快捷键（默认 'c'）
     *   - keyDown:      减速快捷键（默认 'x'）
     */
    const Config = (() => {
        /** @type {Object} 默认配置 */
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
            keyDown: 'x'
        };

        /**
         * 响应式配置代理对象
         * 读取时自动从 GM_getValue 获取（带默认值回退）
         * 写入时自动通过 GM_setValue 持久化
         */
        const proxy = new Proxy({}, {
            get(_, key) {
                return GM_getValue(key, DEFAULTS[key]);
            },
            set(_, key, value) {
                GM_setValue(key, value);
                return true;
            }
        });

        return {
            /** 响应式配置代理，可直接读写 */
            data: proxy,

            /** 默认配置常量 */
            DEFAULTS,

            /**
             * 重置所有配置项为默认值
             */
            reset() {
                Object.keys(DEFAULTS).forEach(key => GM_setValue(key, DEFAULTS[key]));
                EventBus.emit('config:reset');
            },

            /**
             * 批量设置配置项
             * @param {Object} updates - 要更新的配置键值对
             */
            batchUpdate(updates) {
                Object.entries(updates).forEach(([key, value]) => {
                    proxy[key] = value;
                });
            }
        };
    })();

    // =========================================================================
    // 模块5: PageGuard - 页面守卫模块
    // =========================================================================
    /**
     * 页面守卫模块 - 判断脚本是否应在当前页面运行
     *
     * 职责:
     *   - 检测当前页面是否为不允许运行脚本的页面类型
     *     (直播页、首页、个人空间、创作中心)
     *   - 检测当前焦点是否在输入框中（避免快捷键冲突）
     */
    const PageGuard = (() => ({
        /**
         * 判断当前页面是否为不启用脚本的页面
         * 不启用的页面类型: 直播、首页、个人空间、创作中心
         * @returns {boolean} 是否为不允许的页面
         */
        isNotAllowedPage() {
            const url = window.location.href;
            const path = window.location.pathname;
            return url.includes('/live/') ||
                   path === '/' ||
                   url.includes('space.bilibili.com') ||
                   url.includes('member.bilibili.com');
        },

        /**
         * 判断当前焦点是否在输入框内
         * 避免在用户输入时触发快捷键
         * @returns {boolean} 是否有输入框获得焦点
         */
        isInputFocused() {
            const active = document.activeElement;
            return active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.contentEditable === 'true'
            );
        }
    }))();

    // =========================================================================
    // 模块6: Draggable - 拖拽行为模块
    // =========================================================================
    /**
     * 拖拽行为模块 - 为 DOM 元素添加拖拽移动功能
     *
     * 职责:
     *   - 使指定元素可通过鼠标拖拽移动位置
     *   - 拖拽范围限制在视口内
     *   - 拖拽结束后自动保存位置到 Config
     *   - 支持指定拖拽触发区域（header选择器）
     *   - 提供清理方法以移除事件监听
     *
     * 使用方式:
     *   const unsub = Draggable.make(element, 'cardPosition', '.card-header');
     *   // 清理时调用 unsub() 移除所有拖拽事件监听
     */
    const Draggable = (() => {
        /** @type {Set<Function>} 所有拖拽实例的清理函数集合 */
        const cleanupFns = new Set();

        return {
            /**
             * 为元素添加拖拽功能
             * @param {HTMLElement} el - 需要拖拽的元素
             * @param {string} saveKey - 位置保存到 Config 中的键名
             * @param {string} [headerSelector] - 拖拽触发区域的 CSS 选择器（可选，默认整个元素）
             * @returns {Function} 清理函数，调用后移除所有拖拽相关事件监听
             */
            make(el, saveKey, headerSelector) {
                let isDragging = false;
                let startX, startY, startLeft, startTop;

                const header = headerSelector ? el.querySelector(headerSelector) : el;
                if (!header) return () => {};

                const onMouseDown = e => {
                    // 排除按钮和输入框上的拖拽
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

                const onMouseMove = e => {
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

                // 返回清理函数
                const cleanup = () => {
                    header.removeEventListener('mousedown', onMouseDown);
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    cleanupFns.delete(cleanup);
                };

                cleanupFns.add(cleanup);
                return cleanup;
            },

            /**
             * 清理所有拖拽实例的事件监听（用于脚本卸载时）
             */
            cleanupAll() {
                cleanupFns.forEach(fn => fn());
                cleanupFns.clear();
            }
        };
    })();

    // =========================================================================
    // 模块7: Toast - 消息提示模块
    // =========================================================================
    /**
     * 消息提示模块 - 在视频播放器中央显示短暂的消息提示
     *
     * 职责:
     *   - 创建和管理 Toast 提示的 DOM 元素
     *   - 提供 showToast 接口供其他模块调用
     *   - 自动管理提示的显示/隐藏动画和定时器
     *   - 提供销毁方法以清理 DOM 和定时器
     *
     * 依赖: 无外部依赖（纯 UI 组件）
     */
    const Toast = (() => {
        /** @type {HTMLElement|null} Toast DOM 元素 */
        let toastEl = null;
        /** @type {number|null} 自动隐藏定时器 */
        let toastTimer = null;

        return {
            /**
             * 创建 Toast DOM 元素并添加到视频播放器容器中
             * Toast 定位在播放器中央，半透明黑色背景白色文字
             */
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

            /**
             * 显示 Toast 消息提示
             * @param {string} text - 要显示的文本内容
             */
            show(text) {
                if (!toastEl) return;
                toastEl.textContent = text;
                toastEl.style.opacity = '1';
                if (toastTimer) clearTimeout(toastTimer);
                toastTimer = setTimeout(() => {
                    toastEl.style.opacity = '0';
                }, 1500);
            },

            /**
             * 销毁 Toast 元素，清理定时器
             */
            destroy() {
                if (toastTimer) clearTimeout(toastTimer);
                toastTimer = null;
                if (toastEl) toastEl.remove();
                toastEl = null;
            }
        };
    })();

    // =========================================================================
    // 模块8: VideoController - 视频倍速控制模块
    // =========================================================================
    /**
     * 视频倍速控制模块 - 核心业务逻辑
     *
     * 职责:
     *   - 管理视频元素的查找与引用
     *   - 提供倍速设置接口（带范围限制）
     *   - 提供倍速调节接口（增减步进）
     *   - 提供倍速重置接口
     *   - 倍速变化时通过 EventBus 广播事件
     *   - 内置节流机制防止频繁触发
     *
     * 依赖:
     *   - Config:  读取 minRate/maxRate/defaultRate/step 配置
     *   - Toast:   倍速变化时显示提示
     *   - EventBus: 发布 rate:change 事件
     *   - Logger:  记录倍速变化日志
     */
    const VideoController = (() => {
        /** @type {HTMLVideoElement|null} 视频元素引用 */
        let video = null;

        /** 节流后的倍速操作函数，100ms 内只执行一次 */
        const throttledSetRate = Utils.throttle(fn => fn(), 100);

        return {
            /**
             * 初始化视频控制器，查找视频元素
             * @returns {boolean} 是否成功找到视频元素
             */
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

            /**
             * 获取当前视频元素引用
             * @returns {HTMLVideoElement|null} 视频元素
             */
            getVideo() {
                return video;
            },

            /**
             * 设置视频播放倍速（自动限制在配置范围内）
             * @param {number} rate - 目标倍速值
             */
            setRate(rate) {
                if (!video) return;
                const newRate = Math.min(Config.data.maxRate, Math.max(Config.data.minRate, Utils.round2(rate)));
                video.playbackRate = newRate;
                Toast.show(`${newRate}x`);
                Logger.info(`设置倍速: ${newRate}x`);
                EventBus.emit('rate:change', newRate);
            },

            /**
             * 调整倍速（增加或减少步进值）
             * @param {number} delta - 倍速变化量（正数加速，负数减速）
             */
            adjustRate(delta) {
                if (!video || Config.data.panelVisible || PageGuard.isInputFocused()) return;
                throttledSetRate(() => this.setRate(video.playbackRate + delta));
            },

            /**
             * 重置倍速为默认值
             */
            resetRate() {
                if (!video || Config.data.panelVisible || PageGuard.isInputFocused()) return;
                throttledSetRate(() => this.setRate(Config.data.defaultRate));
            },

            /**
             * 重置视频元素引用（用于页面切换后重新绑定）
             */
            reset() {
                video = null;
            }
        };
    })();

    // =========================================================================
    // 模块9: CardPanel - 信息卡片模块
    // =========================================================================
    /**
     * 信息卡片模块 - 显示倍速、时间、进度、合集信息的浮动卡片
     *
     * 职责:
     *   - 创建信息卡片的 DOM 结构（header/main/footer 三段式布局）
     *   - 实时更新倍速、剩余时间、进度条、合集信息
     *   - 集成拖拽移动功能
     *   - 集成进度条交互（点击跳转、拖拽定位、悬停预览时间）
     *   - 提供播放/暂停按钮
     *   - 卡片内快捷键提示
     *   - 提供 toggle 和 destroy 接口
     *
     * 依赖:
     *   - Config:      读取 cardVisible/cardPosition 配置
     *   - Draggable:   提供拖拽移动能力
     *   - VideoController: 获取视频元素引用
     *   - Utils:       时间格式化与合集信息获取
     *   - EventBus:    监听 panel:toggle 事件
     *   - Toast:       显示提示信息
     */
    const CardPanel = (() => {
        /** @type {HTMLElement|null} 卡片 DOM 元素 */
        let cardEl = null;
        /** @type {Function|null} 拖拽清理函数 */
        let dragCleanup = null;
        /** @type {Set<Function>} 事件清理函数集合 */
        const cleanupFns = new Set();

        /**
         * 更新卡片中显示的所有信息
         * 包括倍速、剩余时间、进度条、合集信息
         */
        function updateCard() {
            const video = VideoController.getVideo();
            if (!video || !cardEl) return;

            const rateEl = cardEl.querySelector('.bili-speed-rate');
            const timeEl = cardEl.querySelector('.bili-speed-time');
            const progressBar = cardEl.querySelector('.bili-speed-progress-bar');
            const collectionEl = cardEl.querySelector('.bili-speed-collection');

            // 更新倍速显示
            if (rateEl) rateEl.textContent = `${video.playbackRate}x`;

            // 更新时间显示（剩余时间 / 总时长）
            if (timeEl) {
                const remaining = video.duration - video.currentTime;
                timeEl.textContent = `${Utils.formatTime(remaining)} / ${Utils.formatTime(video.duration)}`;
            }

            // 更新进度条宽度
            if (progressBar && video.duration) {
                progressBar.style.width = `${(video.currentTime / video.duration) * 100}%`;
            }

            // 更新合集信息
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

        /**
         * 更新播放/暂停按钮的图标状态
         * @param {HTMLVideoElement} video - 视频元素
         * @param {HTMLElement} playBtn - 播放按钮元素
         */
        function updatePlayBtn(video, playBtn) {
            if (!video) return;
            playBtn.textContent = video.paused ? '▶' : '⏸';
        }

        /**
         * 初始化进度条交互功能
         * 支持: 悬停显示时间预览、点击跳转、拖拽定位
         * @param {HTMLElement} progressWrapper - 进度条容器
         * @param {HTMLElement} progressBar - 进度条填充元素
         * @param {HTMLElement} tooltip - 时间预览提示
         */
        function initProgressBar(progressWrapper, progressBar, tooltip) {
            const video = VideoController.getVideo();
            let isDraggingProgress = false;

            /** 根据鼠标位置计算对应的时间 */
            const getTimeFromPosition = (clientX) => {
                const rect = progressWrapper.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return percent * video.duration;
            };

            /** 更新 tooltip 位置和时间文本 */
            const updateTooltip = (clientX) => {
                if (!video || !video.duration) return;
                const time = getTimeFromPosition(clientX);
                const rect = progressWrapper.getBoundingClientRect();
                const percent = (clientX - rect.left) / rect.width;
                tooltip.textContent = Utils.formatTime(time);
                tooltip.style.left = `${percent * 100}%`;
                tooltip.style.display = 'block';
            };

            /** 节流后的视频跳转函数 */
            const seekVideo = Utils.throttle((time) => {
                if (video) video.currentTime = time;
            }, 100);

            // 悬停显示时间预览
            const onMouseEnter = (e) => updateTooltip(e.clientX);
            const onMouseMove = (e) => { if (!isDraggingProgress) updateTooltip(e.clientX); };
            const onMouseLeave = () => { if (!isDraggingProgress) tooltip.style.display = 'none'; };

            // 点击跳转到指定位置
            const onClick = (e) => {
                if (!video || !video.duration) return;
                video.currentTime = getTimeFromPosition(e.clientX);
            };

            // 拖拽开始
            const onDragStart = (e) => {
                if (!video || !video.duration) return;
                isDraggingProgress = true;
                e.preventDefault();
            };

            // 拖拽中 - 实时更新进度条和时间
            const onDragMove = (e) => {
                if (!isDraggingProgress) return;
                updateTooltip(e.clientX);
                const time = getTimeFromPosition(e.clientX);
                seekVideo(time);
                progressBar.style.width = `${(time / video.duration) * 100}%`;
            };

            // 拖拽结束
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

            // 注册清理函数
            const cleanupDrag = () => {
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd);
            };
            cleanupFns.add(cleanupDrag);
        }

        return {
            /**
             * 创建信息卡片并绑定所有交互事件
             */
            create() {
                if (cardEl) cardEl.remove();

                // 获取弹幕盒宽度作为面板宽度
                const danmukuBox = document.getElementById('danmukuBox');
                const panelWidth = danmukuBox ? danmukuBox.offsetWidth + 'px' : '260px';

                cardEl = document.createElement('div');
                cardEl.className = 'bili-speed-card';
                cardEl.style.cssText = `
                    position: fixed;
                    width: ${panelWidth};
                    background: #F0F1F2;
                    color: #000;
                    border-radius: 8px;
                    z-index: 9998;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    font-size: 14px;
                    display: ${Config.data.cardVisible ? 'block' : 'none'};
                    box-sizing: border-box;
                `;

                // 设置面板位置（优先使用保存的位置）
                if (Config.data.cardPosition) {
                    cardEl.style.left = Config.data.cardPosition.left;
                    cardEl.style.top = Config.data.cardPosition.top;
                } else {
                    if (danmukuBox) {
                        const rect = danmukuBox.getBoundingClientRect();
                        cardEl.style.left = rect.left + 'px';
                        cardEl.style.top = rect.top + 'px';
                    } else {
                        cardEl.style.right = '20px';
                        cardEl.style.bottom = '100px';
                    }
                }

                // 面板 HTML 结构：header（倍速+按钮）、main（时间+合集）、footer（进度条）
                cardEl.innerHTML = `
                    <div class="bili-speed-card-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 12px 8px 12px; cursor: move;">
                        <div class="bili-speed-drag-text" style="font-weight: bold; cursor: default;">⚡ 倍速: <span class="bili-speed-rate">1.0x</span></div>
                        <div class="bili-speed-card-btns" style="visibility: hidden; gap: 4px; display: flex;">
                            <button class="bili-speed-panel-btn" title="快捷键: ${Config.data.keyReset.toUpperCase()}重置 | ${Config.data.keyUp.toUpperCase()}加速 | ${Config.data.keyDown.toUpperCase()}减速" style="background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;">⚙️</button>
                            <button class="bili-speed-close-btn" style="background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">X</button>
                        </div>
                    </div>
                    <div class="bili-speed-card-main" style="padding: 0 12px 8px 12px;">
                        <div>⏱️ 剩余: <span class="bili-speed-time">00:00 / 00:00</span></div>
                        <div class="bili-speed-collection" style="display: none;"></div>
                    </div>
                    <div class="bili-speed-card-footer" style="padding: 0 12px 12px 12px; position: relative;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button class="bili-speed-play-btn" title='播放/暂停' style="color: #fff; border: none; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">▶</button>
                            <div class="bili-speed-progress-wrapper" style="flex: 1; height: 5px; background: #ddd; border-radius: 2px; cursor: pointer; position: relative;">
                                <div class="bili-speed-progress-bar" style="height: 100%; background: #00AEEC; border-radius: 2px; width: 0%;"></div>
                                <div class="bili-speed-progress-tooltip" style="position: absolute; bottom: 12px; left: 0; background: rgba(0,0,0,0.8); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 12px; display: none; white-space: nowrap; transform: translateX(-50%);"></div>
                            </div>
                        </div>
                    </div>
                `;

                document.body.appendChild(cardEl);

                // ---- 按钮容器交互：默认显示5秒，鼠标移入显示 ----
                const btnsContainer = cardEl.querySelector('.bili-speed-card-btns');
                btnsContainer.style.visibility = 'visible';
                const autoHideTimer = setTimeout(() => {
                    btnsContainer.style.visibility = 'hidden';
                }, 5000);

                cardEl.addEventListener('mouseenter', () => {
                    btnsContainer.style.visibility = 'visible';
                });
                cardEl.addEventListener('mouseleave', () => {
                    btnsContainer.style.visibility = 'hidden';
                });

                // ---- 控制面板按钮：打开设置面板 ----
                cardEl.querySelector('.bili-speed-panel-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    EventBus.emit('panel:toggle');
                });

                // ---- 关闭按钮：隐藏信息卡片 ----
                cardEl.querySelector('.bili-speed-close-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    EventBus.emit('card:toggle');
                });

                // ---- 使面板可拖拽 ----
                dragCleanup = Draggable.make(cardEl, 'cardPosition', '.bili-speed-card-header');

                // ---- 播放/暂停按钮 ----
                const video = VideoController.getVideo();
                const playBtn = cardEl.querySelector('.bili-speed-play-btn');

                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!video) return;
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                });

                // ---- 进度条交互 ----
                const progressWrapper = cardEl.querySelector('.bili-speed-progress-wrapper');
                const progressBar = cardEl.querySelector('.bili-speed-progress-bar');
                const tooltip = cardEl.querySelector('.bili-speed-progress-tooltip');
                initProgressBar(progressWrapper, progressBar, tooltip);

                // ---- 监听视频事件，更新卡片内容 ----
                if (video) {
                    const onRateChange = () => updateCard();
                    const onTimeUpdate = () => updateCard();
                    const onPlay = () => updatePlayBtn(video, playBtn);
                    const onPause = () => updatePlayBtn(video, playBtn);

                    video.addEventListener('ratechange', onRateChange);
                    video.addEventListener('timeupdate', onTimeUpdate);
                    video.addEventListener('play', onPlay);
                    video.addEventListener('pause', onPause);

                    // 注册清理函数
                    cleanupFns.add(() => {
                        video.removeEventListener('ratechange', onRateChange);
                        video.removeEventListener('timeupdate', onTimeUpdate);
                        video.removeEventListener('play', onPlay);
                        video.removeEventListener('pause', onPause);
                    });

                    updateCard();
                    updatePlayBtn(video, playBtn);
                    setTimeout(updateCard, 500);
                }
            },

            /**
             * 切换信息卡片的显示/隐藏状态
             */
            toggle() {
                Config.data.cardVisible = !Config.data.cardVisible;
                if (cardEl) {
                    cardEl.style.display = Config.data.cardVisible ? 'block' : 'none';
                }
            },

            /**
             * 隐藏信息卡片（用于宽屏/网页全屏模式）
             */
            hide() {
                if (cardEl && Config.data.cardVisible) {
                    cardEl.style.display = 'none';
                }
            },

            /**
             * 显示信息卡片
             */
            show() {
                if (cardEl && Config.data.cardVisible) {
                    cardEl.style.display = 'block';
                }
            },

            /**
             * 销毁信息卡片，清理所有事件监听和 DOM 元素
             */
            destroy() {
                cleanupFns.forEach(fn => fn());
                cleanupFns.clear();
                if (dragCleanup) dragCleanup();
                dragCleanup = null;
                if (cardEl) cardEl.remove();
                cardEl = null;
            }
        };
    })();

    // =========================================================================
    // 模块10: ControlPanel - 控制面板模块
    // =========================================================================
    /**
     * 控制面板模块 - 提供倍速、步进、快捷键等配置的用户界面
     *
     * 职责:
     *   - 创建控制面板的 DOM 结构（步进值/初始倍速/极值倍速/快捷键设置）
     *   - 处理步进值、初始倍速、最小/最大倍速的按钮选择交互
     *   - 处理快捷键输入框的验证与更新
     *   - 提供"保存"和"重置"功能
     *   - 隐藏高级选项（连续点击标题5次切换显示）
     *   - 集成拖拽移动功能
     *   - 提供 toggle 和 destroy 接口
     *
     * 依赖:
     *   - Config:      读写配置项
     *   - Draggable:   提供拖拽移动能力
     *   - VideoController: 保存时设置默认倍速
     *   - Utils:       multiClick 检测
     *   - EventBus:    监听 card:toggle 事件
     *   - Toast:       显示提示信息
     */
    const ControlPanel = (() => {
        /** @type {HTMLElement|null} 面板 DOM 元素 */
        let panelEl = null;
        /** @type {Function|null} 拖拽清理函数 */
        let dragCleanup = null;

        /**
         * 更新所有按钮组的激活状态
         * 根据当前配置值高亮对应的按钮
         */
        function updateButtonState() {
            if (!panelEl) return;

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

        /**
         * 验证快捷键是否有效（仅允许单个字母，不支持 F 键）
         * @param {string} key - 待验证的按键字符
         * @returns {boolean} 是否为有效快捷键
         */
        function validateKey(key) {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'f') return false;
            return /^[a-z]$/.test(lowerKey);
        }

        /**
         * 处理快捷键输入框的交互逻辑
         * 验证输入内容，拒绝无效字符并提示用户
         * @param {string} inputId - 输入框的 DOM ID
         * @param {string} configKey - 对应的配置键名
         */
        function handleKeyInput(inputId, configKey) {
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

        return {
            /**
             * 创建控制面板并绑定所有交互事件
             */
            create() {
                if (panelEl) panelEl.remove();

                panelEl = document.createElement('div');
                panelEl.className = 'bili-speed-panel';
                panelEl.style.cssText = `
                    position: fixed;
                    width: 300px;
                    background: #F0F1F2;
                    color: #000;
                    border-radius: 8px;
                    z-index: 9999;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    font-size: 14px;
                    display: ${Config.data.panelVisible ? 'block' : 'none'};
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                `;

                // 恢复保存的面板位置
                if (Config.data.panelPosition) {
                    panelEl.style.left = Config.data.panelPosition.left;
                    panelEl.style.top = Config.data.panelPosition.top;
                    panelEl.style.transform = 'none';
                }

                // 控制面板 HTML 结构
                panelEl.innerHTML = `
                    <div class="bili-speed-panel-header" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 16px 12px 16px; cursor: move;">
                        <div class="bili-speed-drag-text" style="font-weight: bold; font-size: 16px; cursor: default;">⚙️ 控制面板</div>
                        <button class="bili-speed-close" style="background: none; border: none; color: #000; font-size: 20px; cursor: pointer;">×</button>
                    </div>
                    <div class="bili-speed-panel-main" style="padding: 0 16px;">
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
                    </div>
                    <div class="bili-speed-panel-footer" style="display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px 16px 16px;">
                        <button id="reset-btn" style="padding: 8px 16px; border-radius: 4px; border: none; background: #999; color: #fff; cursor: pointer;">🔄 重置</button>
                        <button id="save-btn" style="padding: 8px 16px; border-radius: 4px; border: none; background: #00AEEC; color: #fff; cursor: pointer;">💾 保存</button>
                    </div>
                `;

                document.body.appendChild(panelEl);

                // 使控制面板可拖拽
                dragCleanup = Draggable.make(panelEl, 'panelPosition', '.bili-speed-panel-header');

                // 连续点击5次标题显示/隐藏高级选项
                let advancedVisible = false;
                const panelTitle = panelEl.querySelector('.bili-speed-drag-text');
                Utils.multiClick(panelTitle, 5, () => {
                    advancedVisible = !advancedVisible;
                    const hiddenItems = panelEl.querySelectorAll('.bili-speed-panel-main > div[style*="display: none"]');
                    hiddenItems.forEach(item => {
                        item.style.display = advancedVisible ? 'block' : 'none';
                    });
                    Toast.show(advancedVisible ? '已显示高级选项' : '已隐藏高级选项');
                });

                // ---- 控制面板按钮样式 ----
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

                // ---- 初始化按钮激活状态 ----
                updateButtonState();

                // ---- 关闭按钮 ----
                panelEl.querySelector('.bili-speed-close').addEventListener('click', () => {
                    EventBus.emit('panel:toggle');
                });

                // ---- 步进值按钮 ----
                panelEl.querySelectorAll('.step-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.step = parseFloat(btn.dataset.step);
                        updateButtonState();
                    });
                });

                // ---- 初始倍速按钮 ----
                panelEl.querySelectorAll('.default-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.defaultRate = parseFloat(btn.dataset.rate);
                        updateButtonState();
                    });
                });

                // ---- 最小倍速按钮 ----
                panelEl.querySelectorAll('.min-rate-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.minRate = parseFloat(btn.dataset.rate);
                        updateButtonState();
                    });
                });

                // ---- 最大倍速按钮 ----
                panelEl.querySelectorAll('.max-rate-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.maxRate = parseFloat(btn.dataset.rate);
                        updateButtonState();
                    });
                });

                // ---- 快捷键输入框 ----
                handleKeyInput('key-reset', 'keyReset');
                handleKeyInput('key-up', 'keyUp');
                handleKeyInput('key-down', 'keyDown');

                // ---- 重置按钮 ----
                panelEl.querySelector('#reset-btn').addEventListener('click', () => {
                    Config.data.step = 0.05;
                    Config.data.minRate = 0.5;
                    Config.data.maxRate = 4.0;
                    Config.data.defaultRate = 1.0;
                    Config.data.keyReset = 'z';
                    Config.data.keyUp = 'x';
                    Config.data.keyDown = 'c';
                    panelEl.querySelector('#key-reset').value = 'Z';
                    panelEl.querySelector('#key-up').value = 'X';
                    panelEl.querySelector('#key-down').value = 'C';
                    updateButtonState();
                    EventBus.emit('config:reset');
                });

                // ---- 保存按钮 ----
                panelEl.querySelector('#save-btn').addEventListener('click', () => {
                    Config.data.keyReset = panelEl.querySelector('#key-reset').value.toLowerCase() || 'z';
                    Config.data.keyUp = panelEl.querySelector('#key-up').value.toLowerCase() || 'x';
                    Config.data.keyDown = panelEl.querySelector('#key-down').value.toLowerCase() || 'c';
                    const video = VideoController.getVideo();
                    if (video && video.playbackRate === Config.data.defaultRate) {
                        VideoController.setRate(Config.data.defaultRate);
                    }
                    EventBus.emit('panel:toggle');
                    EventBus.emit('config:saved');
                    Toast.show('配置已保存，刷新后生效');
                });
            },

            /**
             * 切换控制面板的显示/隐藏状态
             */
            toggle() {
                Config.data.panelVisible = !Config.data.panelVisible;
                if (panelEl) {
                    panelEl.style.display = Config.data.panelVisible ? 'block' : 'none';
                }
            },

            /**
             * 销毁控制面板，清理拖拽和 DOM 元素
             */
            destroy() {
                if (dragCleanup) dragCleanup();
                dragCleanup = null;
                if (panelEl) panelEl.remove();
                panelEl = null;
            }
        };
    })();

    // =========================================================================
    // 模块11: KeyboardHandler - 键盘快捷键模块
    // =========================================================================
    /**
     * 键盘快捷键模块 - 处理全局键盘事件
     *
     * 职责:
     *   - 监听全局 keydown 事件
     *   - 根据配置的快捷键映射执行对应操作
     *     (z: 重置倍速, c: 加速, x: 减速)
     *   - 排除不允许页面和输入框焦点场景
     *   - 提供事件监听的注册与清理接口
     *
     * 依赖:
     *   - Config:          读取快捷键配置
     *   - PageGuard:       判断页面与焦点状态
     *   - VideoController: 执行倍速操作
     */
    const KeyboardHandler = (() => {
        /** @type {Function|null} 绑定的 keydown 处理函数引用 */
        let boundHandler = null;

        return {
            /**
             * 注册全局键盘事件监听
             */
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

            /**
             * 移除全局键盘事件监听
             */
            unregister() {
                if (boundHandler) {
                    document.removeEventListener('keydown', boundHandler);
                    boundHandler = null;
                }
            }
        };
    })();

    // =========================================================================
    // 模块12: ScreenModeManager - 屏幕模式管理模块
    // =========================================================================
    /**
     * 屏幕模式管理模块 - 检测B站播放器屏幕模式变化并控制卡片显示
     *
     * 职责:
     *   - 监听播放器屏幕模式变化（正常/宽屏/网页全屏）
     *   - 在宽屏和网页全屏模式下隐藏信息卡片
     *   - 在正常模式下恢复信息卡片显示
     *   - 提供三种检测方案（当前启用方案1：事件委托）
     *     方案1: 事件委托 - 在 document 上监听点击事件
     *     方案2: MutationObserver 监听播放器属性变化（备用）
     *     方案3: 定时轮询检查播放器属性（备用）
     *   - 提供初始化与销毁接口
     *
     * 依赖:
     *   - CardPanel: 控制卡片的显示/隐藏
     *   - Logger:    记录模式变化日志
     */
    const ScreenModeManager = (() => {
        /** @type {MutationObserver|null} MutationObserver 实例 */
        let observer = null;
        /** @type {number|null} 定时检查的 interval ID */
        let checkInterval = null;
        /** @type {Function|null} 事件委托的点击处理函数 */
        let clickHandler = null;

        /**
         * 根据屏幕模式更新卡片显示状态
         * 宽屏(wide)和网页全屏(web)模式下隐藏卡片
         * @param {string} screenMode - 当前屏幕模式标识
         */
        function updateByScreenMode(screenMode) {
            if (screenMode === 'wide' || screenMode === 'web') {
                CardPanel.hide();
            } else {
                CardPanel.show();
            }
        }

        return {
            /**
             * 初始化屏幕模式管理器
             * 启用方案1（事件委托）；方案2、3为备用，可按需开启
             */
            init() {
                // 方案1: 事件委托 - 在 document 上监听点击事件
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
            },

            /**
             * 启用方案2: MutationObserver 监听播放器 data-screen 属性变化
             * （备用方案，当前未启用）
             */
            setupMutationObserver() {
                if (observer) observer.disconnect();

                const playerContainer = document.querySelector('.bpx-player-container');
                if (!playerContainer) return;

                observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'data-screen') {
                            const screenMode = playerContainer.getAttribute('data-screen');
                            Logger.info(`播放器模式变化: ${screenMode}`);
                            updateByScreenMode(screenMode);
                        }
                    });
                });

                observer.observe(playerContainer, {
                    attributes: true,
                    attributeFilter: ['data-screen']
                });
            },

            /**
             * 启用方案3: 定时检查播放器状态（备用方案）
             * 每500ms检查一次 data-screen 属性是否变化
             */
            setupIntervalCheck() {
                if (checkInterval) clearInterval(checkInterval);

                let lastScreenMode = '';
                checkInterval = setInterval(() => {
                    const playerContainer = document.querySelector('.bpx-player-container');
                    if (!playerContainer) return;

                    const screenMode = playerContainer.getAttribute('data-screen') || '';
                    if (screenMode !== lastScreenMode) {
                        lastScreenMode = screenMode;
                        Logger.info(`播放器模式变化(定时检测): ${screenMode}`);
                        updateByScreenMode(screenMode);
                    }
                }, 500);
            },

            /**
             * 销毁屏幕模式管理器，清理所有监听器
             */
            destroy() {
                if (clickHandler) {
                    document.removeEventListener('click', clickHandler, true);
                    clickHandler = null;
                }
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
                if (checkInterval) {
                    clearInterval(checkInterval);
                    checkInterval = null;
                }
            }
        };
    })();

    // =========================================================================
    // 模块13: App - 主控模块
    // =========================================================================
    /**
     * 主控模块 - 脚本的全局生命周期管理与模块编排
     *
     * 职责:
     *   - 按正确顺序初始化所有功能模块
     *   - 注册油猴菜单命令
     *   - 绑定 EventBus 事件到各模块的 toggle 接口
     *   - 检测 SPA 页面 URL 变化，触发清理与重新初始化
     *   - 提供统一的清理函数
     *
     * 初始化顺序:
     *   1. PageGuard 检查 → 2. VideoController 初始化 →
     *   3. Toast 创建 → 4. CardPanel 创建 → 5. ControlPanel 创建 →
     *   6. ScreenModeManager 初始化 → 7. KeyboardHandler 注册 →
     *   8. EventBus 绑定 → 9. 油猴菜单注册
     *
     * 依赖: 所有功能模块
     */
    const App = (() => {
        /** @type {string} 上次检测到的 URL，用于 SPA 变化检测 */
        let lastUrl = location.href;
        /** @type {number|null} URL 变化检测定时器 */
        let urlCheckInterval = null;

        /**
         * 绑定 EventBus 事件到各模块的对应操作
         * 将面板/卡片的 toggle 操作统一通过事件总线解耦
         */
        function bindEvents() {
            EventBus.on('card:toggle', () => CardPanel.toggle());
            EventBus.on('panel:toggle', () => ControlPanel.toggle());
            EventBus.on('config:reset', () => Logger.info('配置已重置'));
            EventBus.on('config:saved', () => Logger.info('配置已保存'));
        }

        /**
         * 注册油猴菜单命令
         * 提供信息卡片和控制面板的快速切换入口
         */
        function registerMenuCommands() {
            GM_registerMenuCommand('切换信息卡片', () => EventBus.emit('card:toggle'));
            GM_registerMenuCommand('打开控制面板', () => EventBus.emit('panel:toggle'));
        }

        return {
            /**
             * 主初始化函数
             * 按顺序初始化所有模块，如果视频元素尚未加载则延时重试
             */
            init() {
                // 检查是否为不允许的页面
                if (PageGuard.isNotAllowedPage()) {
                    Logger.info('当前页面不启用脚本');
                    return;
                }

                // 尝试初始化视频控制器
                if (!VideoController.init()) {
                    setTimeout(App.init, 1000);
                    return;
                }

                // 按顺序创建 UI 组件
                Toast.create();
                CardPanel.create();
                ControlPanel.create();

                // 初始化屏幕模式管理器
                ScreenModeManager.init();

                // 注册键盘事件监听
                KeyboardHandler.register();

                // 绑定事件总线
                bindEvents();

                // 注册油猴菜单
                registerMenuCommands();

                Logger.info('脚本初始化完成');
            },

            /**
             * 清理函数 - 页面切换时调用
             * 销毁所有 UI 组件，移除事件监听，清理事件总线
             */
            cleanup() {
                Toast.destroy();
                CardPanel.destroy();
                ControlPanel.destroy();
                KeyboardHandler.unregister();
                ScreenModeManager.destroy();
                Draggable.cleanupAll();
                EventBus.clear();
                VideoController.reset();
            },

            /**
             * 检测 URL 变化（支持 B站 SPA 路由切换）
             * 检测到变化后执行清理并延时重新初始化
             */
            checkUrlChange() {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    Logger.info('URL 变化');
                    App.cleanup();
                    setTimeout(App.init, 500);
                }
            },

            /**
             * 启动应用
             * 注册 URL 变化检测定时器，并在页面就绪后初始化
             */
            start() {
                // 定时检测 URL 变化（支持 SPA）
                urlCheckInterval = setInterval(App.checkUrlChange, 500);

                // 页面加载完成后初始化
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', App.init);
                } else {
                    App.init();
                }

                Logger.info('脚本已加载');
            }
        };
    })();

    // =========================================================================
    // 启动入口
    // =========================================================================
    App.start();

})();
