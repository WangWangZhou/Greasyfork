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
        cardPosition: null,
        panelPosition: null,
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
 * Toast - 消息提示模块
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
 * CardPanel - 信息卡片模块
 */
const CardPanel = (() => {
    let cardEl = null;
    let dragCleanup = null;
    const cleanupFns = new Set();

    function updateCard() {
        const video = VideoController.getVideo();
        if (!video || !cardEl) return;

        const rateEl = cardEl.querySelector('.bili-speed-rate');
        const timeEl = cardEl.querySelector('.bili-speed-time');
        const progressBar = cardEl.querySelector('.bili-speed-progress-bar');
        const collectionEl = cardEl.querySelector('.bili-speed-collection');

        if (rateEl) rateEl.textContent = `${video.playbackRate}x`;

        if (timeEl) {
            const remaining = video.duration - video.currentTime;
            timeEl.textContent = `${Utils.formatTime(remaining)} / ${Utils.formatTime(video.duration)}`;
        }

        if (progressBar && video.duration) {
            progressBar.style.width = `${(video.currentTime / video.duration) * 100}%`;
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

    function updatePlayBtn(video, playBtn) {
        if (!video) return;
        playBtn.textContent = video.paused ? '▶' : '⏸';
    }

    function initProgressBar(progressWrapper, progressBar, tooltip) {
        const video = VideoController.getVideo();
        let isDraggingProgress = false;

        const getTimeFromPosition = (clientX) => {
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

        const cleanupDrag = () => {
            progressWrapper.removeEventListener('mouseenter', onMouseEnter);
            progressWrapper.removeEventListener('mousemove', onMouseMove);
            progressWrapper.removeEventListener('mouseleave', onMouseLeave);
            progressWrapper.removeEventListener('click', onClick);
            progressWrapper.removeEventListener('mousedown', onDragStart);
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
        };
        cleanupFns.add(cleanupDrag);
    }

    return {
        create() {
            if (cardEl) cardEl.remove();

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

            const btnsContainer = cardEl.querySelector('.bili-speed-card-btns');
            btnsContainer.style.visibility = 'visible';
            setTimeout(() => {
                btnsContainer.style.visibility = 'hidden';
            }, 5000);

            cardEl.addEventListener('mouseenter', () => {
                btnsContainer.style.visibility = 'visible';
            });
            cardEl.addEventListener('mouseleave', () => {
                btnsContainer.style.visibility = 'hidden';
            });

            cardEl.querySelector('.bili-speed-panel-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                EventBus.emit('panel:toggle');
            });

            cardEl.querySelector('.bili-speed-close-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                EventBus.emit('card:toggle');
            });

            dragCleanup = Draggable.make(cardEl, 'cardPosition', '.bili-speed-card-header');

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

            const progressWrapper = cardEl.querySelector('.bili-speed-progress-wrapper');
            const progressBar = cardEl.querySelector('.bili-speed-progress-bar');
            const tooltip = cardEl.querySelector('.bili-speed-progress-tooltip');
            initProgressBar(progressWrapper, progressBar, tooltip);

            if (video) {
                const onRateChange = () => updateCard();
                const onTimeUpdate = () => updateCard();
                const onPlay = () => updatePlayBtn(video, playBtn);
                const onPause = () => updatePlayBtn(video, playBtn);

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
                updatePlayBtn(video, playBtn);
                setTimeout(updateCard, 500);
            }
        },

        toggle() {
            Config.data.cardVisible = !Config.data.cardVisible;
            if (cardEl) {
                cardEl.style.display = Config.data.cardVisible ? 'block' : 'none';
            }
        },

        hide() {
            if (cardEl && Config.data.cardVisible) {
                cardEl.style.display = 'none';
            }
        },

        show() {
            if (cardEl && Config.data.cardVisible) {
                cardEl.style.display = 'block';
            }
        },

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

/**
 * ControlPanel - 控制面板模块
 */
const ControlPanel = (() => {
    let panelEl = null;
    let dragCleanup = null;
    let multiClickCleanup = null;

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

    function validateKey(key) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'f') return false;
        return /^[a-z]$/.test(lowerKey);
    }

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
        create() {
            if (panelEl) panelEl.remove();

            if (multiClickCleanup) {
                multiClickCleanup();
                multiClickCleanup = null;
            }

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

            if (Config.data.panelPosition) {
                panelEl.style.left = Config.data.panelPosition.left;
                panelEl.style.top = Config.data.panelPosition.top;
                panelEl.style.transform = 'none';
            }

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
                            <button class="min-rate-btn" data-rate="0.5">00.5x</button>
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

            dragCleanup = Draggable.make(panelEl, 'panelPosition', '.bili-speed-panel-header');

            let advancedVisible = false;
            const panelTitle = panelEl.querySelector('.bili-speed-drag-text');
            multiClickCleanup = Utils.multiClick(panelTitle, 5, () => {
                advancedVisible = !advancedVisible;
                const hiddenItems = panelEl.querySelectorAll('.bili-speed-panel-main > div[style*="display: none"]');
                hiddenItems.forEach(item => {
                    item.style.display = advancedVisible ? 'block' : 'none';
                });
                Toast.show(advancedVisible ? '已显示高级选项' : '已隐藏高级选项');
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
            `;
            if (!document.querySelector('#bili-speed-panel-style')) {
                panelStyle.id = 'bili-speed-panel-style';
                document.head.appendChild(panelStyle);
            }

            updateButtonState();

            panelEl.querySelector('.bili-speed-close').addEventListener('click', () => {
                EventBus.emit('panel:toggle');
            });

            panelEl.querySelectorAll('.step-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    Config.data.step = parseFloat(btn.dataset.step);
                    updateButtonState();
                });
            });

            panelEl.querySelectorAll('.default-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    Config.data.defaultRate = parseFloat(btn.dataset.rate);
                    updateButtonState();
                });
            });

            panelEl.querySelectorAll('.min-rate-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    Config.data.minRate = parseFloat(btn.dataset.rate);
                    updateButtonState();
                });
            });

            panelEl.querySelectorAll('.max-rate-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    Config.data.maxRate = parseFloat(btn.dataset.rate);
                    updateButtonState();
                });
            });

            handleKeyInput('key-reset', 'keyReset');
            handleKeyInput('key-up', 'keyUp');
            handleKeyInput('key-down', 'keyDown');

            panelEl.querySelector('#reset-btn').addEventListener('click', () => {
                Config.batchUpdate({
                    step: Config.DEFAULTS.step,
                    minRate: Config.DEFAULTS.minRate,
                    maxRate: Config.DEFAULTS.maxRate,
                    defaultRate: Config.DEFAULTS.defaultRate,
                    keyReset: Config.DEFAULTS.keyReset,
                    keyUp: Config.DEFAULTS.keyUp,
                    keyDown: Config.DEFAULTS.keyDown
                });
                panelEl.querySelector('#key-reset').value = Config.DEFAULTS.keyReset.toUpperCase();
                panelEl.querySelector('#key-up').value = Config.DEFAULTS.keyUp.toUpperCase();
                panelEl.querySelector('#key-down').value = Config.DEFAULTS.keyDown.toUpperCase();
                updateButtonState();
                EventBus.emit('config:reset');
            });

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

        toggle() {
            Config.data.panelVisible = !Config.data.panelVisible;
            if (panelEl) {
                panelEl.style.display = Config.data.panelVisible ? 'block' : 'none';
            }
        },

        destroy() {
            if (multiClickCleanup) {
                multiClickCleanup();
                multiClickCleanup = null;
            }
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelEl) panelEl.remove();
            panelEl = null;
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
        ScreenModeManager.init();
        KeyboardHandler.register();

        GM_registerMenuCommand('切换信息卡片', () => EventBus.emit('card:toggle'));
        GM_registerMenuCommand('打开控制面板', () => EventBus.emit('panel:toggle'));

        EventBus.on('panel:toggle', ControlPanel.toggle);
        EventBus.on('card:toggle', CardPanel.toggle);

        Logger.info('脚本初始化完成');
    }

    function cleanup() {
        Toast.destroy();
        CardPanel.destroy();
        ControlPanel.destroy();
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