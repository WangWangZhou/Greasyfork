// ==UserScript==
// @name         B站自定义倍速油猴脚本简洁版
// @namespace    http://tampermonkey.net/
// @version      v1.0
// @description  可以自定义bilibili 播放倍速，方便学习网课，x,c,z分别对减速、加速、恢复
// @author       小明
// @license MIT
// @icon         chrome://favicon/http://www.bilibili.com/
// @match        *://www.bilibili.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end


// ==/UserScript==

(function() {
    'use strict';

    // 调试开关
    const DEBUG = false;
    const PREFIX = '[BiliSpeed]';

    // 日志输出函数
    const log = (msg, level = 'info') => {
        if (DEBUG) console[level](`${PREFIX} ${msg}`);
    };

    // 工具函数集合
    const utils = {
        // 保留两位小数
        round2: num => Math.round(num * 100) / 100,

        // 时间格式化函数，将秒数转为 mm:ss 或 hh:mm:ss 格式
        formatTime: seconds => {
            if (!seconds || isNaN(seconds)) return '00:00';
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            if (h > 0) {
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        },

        // 节流函数，防止频繁触发
        throttle: (fn, delay) => {
            let last = 0;
            return function(...args) {
                const now = Date.now();
                if (now - last >= delay) {
                    last = now;
                    fn.apply(this, args);
                }
            };
        },

        // 解析时间字符串为秒数
        parseTimeToSeconds: timeStr => {
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

        isCollection: () => {
            const domCount = document.querySelectorAll('.simple-base-item').length;
            if (domCount > 1) return true;
            try {
                const state = window.__INITIAL_STATE__;
                return state?.videoData?.videos > 1;
            } catch {
                return false;
            }
        },

        getCollectionCount: () => {
            const domCount = document.querySelectorAll('.simple-base-item').length;
            if (domCount > 0) return domCount;
            try {
                return window.__INITIAL_STATE__?.videoData?.videos || 1;
            } catch {
                return 1;
            }
        },

        getCollectionDuration: () => {
            const timeElements = document.querySelectorAll('.simple-base-item .duration');
            let totalSeconds = 0;
            timeElements.forEach(el => {
                totalSeconds += utils.parseTimeToSeconds(el.innerText.trim());
            });
            if (totalSeconds > 0) return totalSeconds;
            try {
                const pages = window.__INITIAL_STATE__?.videoData?.pages;
                return pages?.reduce((sum, p) => sum + (p.duration || 0), 0) || 0;
            } catch {
                return 0;
            }
        },

        // 连续点击多次触发回调
        multiClick: (element, times, callback, timeout = 800) => {
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
    };

    // 默认配置
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

    // 配置对象（自动持久化）
    const config = new Proxy({}, {
        get: (_, key) => GM_getValue(key, DEFAULTS[key]),
        set: (_, key, value) => { GM_setValue(key, value); return true; }
    });

    // 重置配置
    const resetConfig = () => Object.keys(DEFAULTS).forEach(key => GM_setValue(key, DEFAULTS[key]));

    // 判断是否为不启用脚本的页面（直播、首页、个人空间、创作中心）
    const isNotAllowedPage = () => {
        const url = window.location.href;
        const path = window.location.pathname;
        return url.includes('/live/') ||
               path === '/' ||
               url.includes('space.bilibili.com') ||
               url.includes('member.bilibili.com');
    };

    // 判断当前焦点是否在输入框内
    const isInputFocused = () => {
        const active = document.activeElement;
        return active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.contentEditable === 'true'
        );
    };

    // 全局变量
    let video = null;       // 视频元素
    let toastEl = null;     // Toast提示元素
    let cardEl = null;      // 信息卡片元素
    let panelEl = null;     // 控制面板元素
    let toastTimer = null;  // Toast定时器

    // 显示Toast提示
    const showToast = text => {
        if (!toastEl) return;
        toastEl.textContent = text;
        toastEl.style.opacity = '1';
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastEl.style.opacity = '0';
        }, 1500);
    };

    // 设置视频倍速
    const setRate = rate => {
        if (!video) return;
        const newRate = Math.min(config.maxRate, Math.max(config.minRate, utils.round2(rate)));
        video.playbackRate = newRate;
        showToast(`${newRate}x`);
        log(`设置倍速: ${newRate}x`);
    };

    // 节流后的倍速设置函数
    const throttledSetRate = utils.throttle((fn) => fn(), 100);

    // 调整倍速（增加或减少）
    const adjustRate = delta => {
        if (!video || config.panelVisible || isInputFocused()) return;
        throttledSetRate(() => setRate(video.playbackRate + delta));
    };

    // 重置倍速为默认值
    const resetRate = () => {
        if (!video || config.panelVisible || isInputFocused()) return;
        throttledSetRate(() => setRate(config.defaultRate));
    };

    // 创建Toast提示元素
    const createToast = () => {
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
    };

    // 更新信息卡片内容
    const updateCard = () => {
        if (!video || !cardEl) return;
        const rateEl = cardEl.querySelector('.bili-speed-rate');
        const timeEl = cardEl.querySelector('.bili-speed-time');
        const progressBar = cardEl.querySelector('.bili-speed-progress-bar');
        const collectionEl = cardEl.querySelector('.bili-speed-collection');

        // 更新倍速显示
        if (rateEl) rateEl.textContent = `${video.playbackRate}x`;
        // 更新时间显示
        if (timeEl) {
            const remaining = video.duration - video.currentTime;
            timeEl.textContent = `${utils.formatTime(remaining)} / ${utils.formatTime(video.duration)}`;
        }
        // 更新进度条
        if (progressBar && video.duration) {
            progressBar.style.width = `${(video.currentTime / video.duration) * 100}%`;
        }

        // 更新合集信息
        if (collectionEl) {
            const isCollection = utils.isCollection();
            const totalDuration = utils.getCollectionDuration();
            if (isCollection && totalDuration > 0) {
                collectionEl.textContent = `📚 合集总时长: ${utils.formatTime(totalDuration)}`;
                collectionEl.style.display = 'block';
            } else {
                collectionEl.style.display = 'none';
            }
        }
    };

    // 使元素可拖拽
    const makeDraggable = (el, saveKey, headerSelector) => {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        const header = headerSelector ? el.querySelector(headerSelector) : el;
        if (!header) return;

        header.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.classList.contains('bili-speed-drag-text')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = el.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            el.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + dx));
            const newTop = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + dy));
            el.style.left = newLeft + 'px';
            el.style.top = newTop + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                el.style.cursor = '';
                config[saveKey] = { left: el.style.left, top: el.style.top };
            }
        });
    };

    // 创建信息卡片（CardPanel）
    const createCardPanel = () => {
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
            display: ${config.cardVisible ? 'block' : 'none'};
            box-sizing: border-box;
        `;

        // 设置面板位置（优先使用保存的位置）
        if (config.cardPosition) {
            cardEl.style.left = config.cardPosition.left;
            cardEl.style.top = config.cardPosition.top;
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

        // 面板HTML结构：header（倍速+按钮）、main（时间+合集）、footer（进度条）
        cardEl.innerHTML = `
            <div class="bili-speed-card-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 12px 8px 12px; cursor: move;">
                <div class="bili-speed-drag-text" style="font-weight: bold; cursor: default;">⚡ 倍速: <span class="bili-speed-rate">1.0x</span></div>
                <div class="bili-speed-card-btns" style="visibility: hidden; gap: 4px; display: flex;">
                    <button class="bili-speed-panel-btn" title="快捷键: ${config.keyReset.toUpperCase()}重置 | ${config.keyUp.toUpperCase()}加速 | ${config.keyDown.toUpperCase()}减速" style="background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;">⚙️</button>
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
        
        // 默认显示按钮5秒，让用户知道有按钮
        btnsContainer.style.visibility = 'visible';
        setTimeout(() => {
            btnsContainer.style.visibility = 'hidden';
        }, 5000);

        // 鼠标移入显示按钮，移出隐藏
        cardEl.addEventListener('mouseenter', () => {
            btnsContainer.style.visibility = 'visible';
        });
        cardEl.addEventListener('mouseleave', () => {
            btnsContainer.style.visibility = 'hidden';
        });

        // 控制面板按钮点击事件
        cardEl.querySelector('.bili-speed-panel-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            togglePanel();
        });
        // 关闭按钮点击事件
        cardEl.querySelector('.bili-speed-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCard();
        });

        // 使面板可拖拽
        makeDraggable(cardEl, 'cardPosition', '.bili-speed-card-header');

        // 播放/暂停按钮
        const playBtn = cardEl.querySelector('.bili-speed-play-btn');
        
        // 更新播放按钮状态
        const updatePlayBtn = () => {
            if (!video) return;
            playBtn.textContent = video.paused ? '▶' : '⏸';
        };

        // 点击播放/暂停
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!video) return;
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        });

        // 进度条交互功能
        const progressWrapper = cardEl.querySelector('.bili-speed-progress-wrapper');
        const progressBar = cardEl.querySelector('.bili-speed-progress-bar');
        const tooltip = cardEl.querySelector('.bili-speed-progress-tooltip');
        let isDraggingProgress = false;

        // 计算进度条位置对应的时间
        const getTimeFromPosition = (clientX) => {
            const rect = progressWrapper.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return percent * video.duration;
        };

        // 更新tooltip位置和内容
        const updateTooltip = (clientX) => {
            if (!video || !video.duration) return;
            const time = getTimeFromPosition(clientX);
            const rect = progressWrapper.getBoundingClientRect();
            const percent = (clientX - rect.left) / rect.width;
            tooltip.textContent = utils.formatTime(time);
            tooltip.style.left = `${percent * 100}%`;
            tooltip.style.display = 'block';
        };

        // 设置视频时间（节流）
        const seekVideo = utils.throttle((time) => {
            if (video) video.currentTime = time;
        }, 100);

        // 鼠标移入显示tooltip
        progressWrapper.addEventListener('mouseenter', (e) => {
            updateTooltip(e.clientX);
        });

        // 鼠标移动更新tooltip
        progressWrapper.addEventListener('mousemove', (e) => {
            if (isDraggingProgress) return;
            updateTooltip(e.clientX);
        });

        // 鼠标移出隐藏tooltip
        progressWrapper.addEventListener('mouseleave', () => {
            if (!isDraggingProgress) {
                tooltip.style.display = 'none';
            }
        });

        // 点击定位
        progressWrapper.addEventListener('click', (e) => {
            if (!video || !video.duration) return;
            const time = getTimeFromPosition(e.clientX);
            video.currentTime = time;
        });

        // 拖动开始
        progressWrapper.addEventListener('mousedown', (e) => {
            if (!video || !video.duration) return;
            isDraggingProgress = true;
            e.preventDefault();
        });

        // 拖动中
        document.addEventListener('mousemove', (e) => {
            if (!isDraggingProgress) return;
            updateTooltip(e.clientX);
            const time = getTimeFromPosition(e.clientX);
            seekVideo(time);
            // 实时更新进度条
            progressBar.style.width = `${(time / video.duration) * 100}%`;
        });

        // 拖动结束
        document.addEventListener('mouseup', () => {
            if (isDraggingProgress) {
                isDraggingProgress = false;
                tooltip.style.display = 'none';
            }
        });

        // 监听视频事件，更新卡片内容
        if (video) {
            video.addEventListener('ratechange', updateCard);
            video.addEventListener('timeupdate', updateCard);
            video.addEventListener('play', updatePlayBtn);
            video.addEventListener('pause', updatePlayBtn);
            updateCard();
            updatePlayBtn();
            setTimeout(updateCard, 500);
        }
    };

    // 创建控制面板（ControlPanel）
    const createControlPanel = () => {
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
            display: ${config.panelVisible ? 'block' : 'none'};
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        `;

        // 恢复保存的面板位置
        if (config.panelPosition) {
            panelEl.style.left = config.panelPosition.left;
            panelEl.style.top = config.panelPosition.top;
            panelEl.style.transform = 'none';
        }

        // 控制面板HTML结构
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
                            <input type="text" id="key-reset" maxlength="1" value="${config.keyReset.toUpperCase()}" style="width: 30px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; text-transform: uppercase;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 12px;">⏩ 加速:</span>
                            <input type="text" id="key-up" maxlength="1" value="${config.keyUp.toUpperCase()}" style="width: 30px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; text-transform: uppercase;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 12px;">⏪ 减速:</span>
                            <input type="text" id="key-down" maxlength="1" value="${config.keyDown.toUpperCase()}" style="width: 30px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; text-transform: uppercase;">
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
        makeDraggable(panelEl, 'panelPosition', '.bili-speed-panel-header');

        // 连续点击5次显示/隐藏高级选项
        let advancedVisible = false;
        const panelTitle = panelEl.querySelector('.bili-speed-drag-text');
        utils.multiClick(panelTitle, 5, () => {
            advancedVisible = !advancedVisible;
            const hiddenItems = panelEl.querySelectorAll('.bili-speed-panel-main > div[style*="display: none"]');
            hiddenItems.forEach(item => {
                item.style.display = advancedVisible ? 'block' : 'none';
            });
            showToast(advancedVisible ? '已显示高级选项' : '已隐藏高级选项');
        });

        // 控制面板按钮样式
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

        // 更新按钮激活状态
        const updateButtonState = () => {
            panelEl.querySelectorAll('.step-btn').forEach(btn => {
                if (parseFloat(btn.dataset.step) === config.step) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            panelEl.querySelectorAll('.default-btn').forEach(btn => {
                if (parseFloat(btn.dataset.rate) === config.defaultRate) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            panelEl.querySelectorAll('.min-rate-btn').forEach(btn => {
                if (parseFloat(btn.dataset.rate) === config.minRate) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            panelEl.querySelectorAll('.max-rate-btn').forEach(btn => {
                if (parseFloat(btn.dataset.rate) === config.maxRate) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        };

        updateButtonState();

        // 关闭按钮事件
        panelEl.querySelector('.bili-speed-close').addEventListener('click', togglePanel);

        // 步进值按钮事件
        panelEl.querySelectorAll('.step-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                config.step = parseFloat(btn.dataset.step);
                updateButtonState();
            });
        });

        // 初始倍速按钮事件
        panelEl.querySelectorAll('.default-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                config.defaultRate = parseFloat(btn.dataset.rate);
                updateButtonState();
            });
        });

        // 最小倍速按钮事件
        panelEl.querySelectorAll('.min-rate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                config.minRate = parseFloat(btn.dataset.rate);
                updateButtonState();
            });
        });

        // 最大倍速按钮事件
        panelEl.querySelectorAll('.max-rate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                config.maxRate = parseFloat(btn.dataset.rate);
                updateButtonState();
            });
        });

        // 验证快捷键是否有效（不支持F键）
        const validateKey = (key) => {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'f') return false;
            return /^[a-z]$/.test(lowerKey);
        };

        // 处理快捷键输入
        const handleKeyInput = (inputId, configKey) => {
            const input = panelEl.querySelector(`#${inputId}`);
            input.addEventListener('input', (e) => {
                let value = e.target.value.toLowerCase();
                if (value === 'f') {
                    e.target.value = config[configKey].toUpperCase();
                    showToast('不支持F键');
                    return;
                }
                if (value && !validateKey(value)) {
                    e.target.value = config[configKey].toUpperCase();
                    return;
                }
                config[configKey] = value || config[configKey];
                e.target.value = config[configKey].toUpperCase();
            });
        };

        handleKeyInput('key-reset', 'keyReset');
        handleKeyInput('key-up', 'keyUp');
        handleKeyInput('key-down', 'keyDown');

        // 重置按钮事件
        panelEl.querySelector('#reset-btn').addEventListener('click', () => {
            config.step = 0.05;
            config.minRate = 0.5;
            config.maxRate = 4.0;
            config.defaultRate = 1.0;
            config.keyReset = 'z';
            config.keyUp = 'x';
            config.keyDown = 'c';
            panelEl.querySelector('#key-reset').value = 'Z';
            panelEl.querySelector('#key-up').value = 'X';
            panelEl.querySelector('#key-down').value = 'C';
            updateButtonState();
        });

        // 保存按钮事件
        panelEl.querySelector('#save-btn').addEventListener('click', () => {
            config.keyReset = panelEl.querySelector('#key-reset').value.toLowerCase() || 'z';
            config.keyUp = panelEl.querySelector('#key-up').value.toLowerCase() || 'x';
            config.keyDown = panelEl.querySelector('#key-down').value.toLowerCase() || 'c';
            if (video && video.playbackRate === config.defaultRate) {
                setRate(config.defaultRate);
            }
            togglePanel();
            showToast('配置已保存，刷新后生效');
        });
    };

    // 切换控制面板显示/隐藏
    const togglePanel = () => {
        config.panelVisible = !config.panelVisible;
        if (panelEl) {
            panelEl.style.display = config.panelVisible ? 'block' : 'none';
        }
    };

    // 切换信息卡片显示/隐藏
    const toggleCard = () => {
        config.cardVisible = !config.cardVisible;
        if (cardEl) {
            cardEl.style.display = config.cardVisible ? 'block' : 'none';
        }
    };

    // 键盘事件处理
const handleKeydown = e => {
    if (isNotAllowedPage() || isInputFocused()) return;

    const key = e.key.toLowerCase();
        if (key === config.keyReset) {
            e.preventDefault();
            resetRate();
        } else if (key === config.keyUp) {
            e.preventDefault();
            adjustRate(config.step);
        } else if (key === config.keyDown) {
            e.preventDefault();
            adjustRate(-config.step);
        }
    };

    // 播放器屏幕模式管理类，整合三种检测方案
    class ScreenModeManager {
        constructor() {
            this.observer = null;
            this.checkInterval = null;
            this.clickHandler = null;
        }

        // 隐藏CardPanel
        hideCard() {
            if (cardEl && config.cardVisible) {
                cardEl.style.display = 'none';
            }
        }

        // 显示CardPanel
        showCard() {
            if (cardEl && config.cardVisible) {
                cardEl.style.display = 'block';
            }
        }

        // 根据屏幕模式更新CardPanel显示状态
        updateByScreenMode(screenMode) {
            if (screenMode === 'wide' || screenMode === 'web') {
                this.hideCard();
            } else {
                this.showCard();
            }
        }

        // 方案1：事件委托 - 在document上监听点击事件
        setupClickDelegation() {
            this.clickHandler = (e) => {
                const target = e.target;
                const wideBtn = target.closest('.bpx-player-ctrl-wide');
                const webBtn = target.closest('.bpx-player-ctrl-web');
                
                if (wideBtn || webBtn) {
                    log('---在document上监听点击事件点击了宽屏/网页全屏按钮---');
                    this.hideCard();
                }
            };
            document.addEventListener('click', this.clickHandler, true);
        }

        // 方案2：MutationObserver监听播放器状态变化
        setupMutationObserver() {
            if (this.observer) {
                this.observer.disconnect();
            }

            const playerContainer = document.querySelector('.bpx-player-container');
            if (!playerContainer) return;

            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'data-screen') {
                        const screenMode = playerContainer.getAttribute('data-screen');
                        log(`播放器模式变化: ${screenMode}`);
                        this.updateByScreenMode(screenMode);
                    }
                });
            });

            this.observer.observe(playerContainer, {
                attributes: true,
                attributeFilter: ['data-screen']
            });
        }

        // 方案3：定时检查播放器状态（备用方案）
        setupIntervalCheck() {
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
            }

            let lastScreenMode = '';
            this.checkInterval = setInterval(() => {
                const playerContainer = document.querySelector('.bpx-player-container');
                if (!playerContainer) return;

                const screenMode = playerContainer.getAttribute('data-screen') || '';
                if (screenMode !== lastScreenMode) {
                    lastScreenMode = screenMode;
                    log(`播放器模式变化(定时检测): ${screenMode}`);
                    this.updateByScreenMode(screenMode);
                }
            }, 500);
        }

        // 初始化所有方案
        init() {
            this.setupClickDelegation();
            //this.setupMutationObserver();
            //this.setupIntervalCheck();
        }

        // 清理所有监听器
        destroy() {
            if (this.clickHandler) {
                document.removeEventListener('click', this.clickHandler, true);
                this.clickHandler = null;
            }
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
        }
    }

    // 创建屏幕模式管理器实例
    const screenModeManager = new ScreenModeManager();

    // 初始化视频元素
    const initVideo = () => {
        video = document.querySelector('video');
        if (!video) {
            log('未找到视频元素');
            return false;
        }
        log('视频元素已找到');
        return true;
    };

    // 主初始化函数
    const init = () => {
        if (isNotAllowedPage()) {
            log('当前页面不启用脚本');
            return;
        }

        if (!initVideo()) {
            setTimeout(init, 1000);
            return;
        }

        createToast();
        createCardPanel();
        createControlPanel();
        screenModeManager.init();

        // 注册键盘事件监听
        document.addEventListener('keydown', handleKeydown);

        // 注册油猴菜单命令
        GM_registerMenuCommand('切换信息卡片', toggleCard);
        GM_registerMenuCommand('打开控制面板', togglePanel);

        log('脚本初始化完成');
    };

    // SPA页面URL变化检测
    let lastUrl = location.href;
    const checkUrlChange = () => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            log('URL 变化');
            cleanup();
            setTimeout(init, 500);
        }
    };

    // 清理函数，页面切换时调用
    const cleanup = () => {
        if (toastEl) toastEl.remove();
        if (cardEl) cardEl.remove();
        if (panelEl) panelEl.remove();
        toastEl = null;
        cardEl = null;
        panelEl = null;
        document.removeEventListener('keydown', handleKeydown);
        screenModeManager.destroy();
    };

    // 定时检测URL变化（支持SPA）
    setInterval(checkUrlChange, 500);

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    log('脚本已加载');
})();
