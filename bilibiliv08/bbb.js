// ==UserScript==
// @name         Bilibili自定义倍速
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Bilibili视频自定义倍速控制，支持快捷键、步进值配置
// @author       You
// @match        *://www.bilibili.com/*
// @match        *://live.bilibili.com/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'bili_speed_config';

    const Storage = {
        get(key, defaultValue = null) {
            try {
                const data = localStorage.getItem(STORAGE_KEY);
                if (data) {
                    const parsed = JSON.parse(data);
                    return key ? (parsed[key] ?? defaultValue) : parsed;
                }
                return defaultValue;
            } catch (e) {
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                const data = this.get() || {};
                data[key] = value;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                return true;
            } catch (e) {
                return false;
            }
        },
        getAll() {
            return this.get() || {};
        }
    };

    const EventBus = {
        events: {},
        appEvents: ['app:init', 'app:ready', 'app:destroy'],
        moduleEvents: ['module:load', 'module:unload', 'module:error'],
        businessEvents: ['speed:change', 'speed:reset', 'video:play', 'video:pause', 'ui:show', 'ui:hide'],
        
        on(event, callback) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push(callback);
            return () => this.off(event, callback);
        },
        off(event, callback) {
            if (!this.events[event]) return;
            if (callback) {
                this.events[event] = this.events[event].filter(cb => cb !== callback);
            } else {
                delete this.events[event];
            }
        },
        emit(event, data) {
            if (!this.events[event]) return;
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    Logger.error(`EventBus emit error: ${event}`, e);
                }
            });
        },
        once(event, callback) {
            const wrapper = (data) => {
                callback(data);
                this.off(event, wrapper);
            };
            this.on(event, wrapper);
        }
    };

    const Logger = {
        prefix: '[BiliSpeed]',
        log(...args) {
            console.log(this.prefix, ...args);
        },
        warn(...args) {
            console.warn(this.prefix, ...args);
        },
        error(...args) {
            console.error(this.prefix, ...args);
        },
        info(...args) {
            console.info(this.prefix, ...args);
        }
    };

    const Utils = {
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
        add(a, b) {
            return Math.round((a + b) * 100) / 100;
        },
        subtract(a, b) {
            return Math.round((a - b) * 100) / 100;
        },
        throttle(fn, delay = 100) {
            let lastTime = 0;
            return function(...args) {
                const now = Date.now();
                if (now - lastTime >= delay) {
                    lastTime = now;
                    fn.apply(this, args);
                }
            };
        },
        debounce(fn, delay = 100) {
            let timer = null;
            return function(...args) {
                clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), delay);
            };
        },
        isInputMode() {
            const activeElement = document.activeElement;
            return activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable
            );
        },
        isLivePage() {
            return window.location.href.includes('live.bilibili.com');
        },
        waitForElement(selector, timeout = 10000) {
            return new Promise((resolve, reject) => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }
                const observer = new MutationObserver(() => {
                    const el = document.querySelector(selector);
                    if (el) {
                        observer.disconnect();
                        resolve(el);
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`Element ${selector} not found`));
                }, timeout);
            });
        }
    };

    class BaseElement {
        constructor(options = {}) {
            this.options = options;
            this.element = null;
            this.eventListeners = [];
            this.eventBus = options.eventBus || EventBus;
            this.dragConfig = {
                enabled: options.draggable || false,
                handle: null,
                threshold: 5,
                onDragStart: null,
                onDragMove: null,
                onDragEnd: null,
                onClick: null,
                onDoubleClick: null,
                excludeSelector: null
            };
            this.dragState = {
                isDragging: false,
                isActive: false,
                startX: 0,
                startY: 0,
                hasMoved: false,
                clickCount: 0,
                clickTimer: null
            };
            this.boundDragHandlers = {};
        }
        init() {
            this.createElement();
            this.bindEvents();
            this.mounted();
        }
        createElement() {
            this.element = document.createElement(this.options.tag || 'div');
            if (this.options.className) {
                this.element.className = this.options.className;
            }
            if (this.options.style) {
                Object.assign(this.element.style, this.options.style);
            }
            if (this.options.attrs) {
                Object.entries(this.options.attrs).forEach(([key, value]) => {
                    this.element.setAttribute(key, value);
                });
            }
        }
        bindEvents() {}
        mounted() {}
        on(event, handler, target = null) {
            const listenerTarget = target || this.element;
            listenerTarget.addEventListener(event, handler);
            this.eventListeners.push({ event, handler, target: listenerTarget });
        }
        off(event, handler, target = null) {
            const listenerTarget = target || this.element;
            listenerTarget.removeEventListener(event, handler);
            this.eventListeners = this.eventListeners.filter(e => 
                e.event !== event || e.handler !== handler || e.target !== listenerTarget
            );
        }
        emit(event, data) {
            this.eventBus.emit(event, data);
        }
        append(child) {
            if (child instanceof BaseElement) {
                this.element.appendChild(child.element);
            } else {
                this.element.appendChild(child);
            }
        }
        remove() {
            this.eventListeners.forEach(({ event, handler, target }) => {
                target.removeEventListener(event, handler);
            });
            this.eventListeners = [];
            this.disableDrag();
            this.element.remove();
        }
        show() {
            this.element.style.display = '';
        }
        hide() {
            this.element.style.display = 'none';
        }
        toggle() {
            if (this.element.style.display === 'none') {
                this.show();
            } else {
                this.hide();
            }
        }
        enableDrag(config = {}) {
            this.disableDrag();
            Object.assign(this.dragConfig, config);
            this.dragConfig.enabled = true;
            this.boundDragHandlers = {
                handleMouseDown: this.handleDragMouseDown.bind(this),
                handleMouseMove: this.handleDragMouseMove.bind(this),
                handleMouseUp: this.handleDragMouseUp.bind(this),
                handleTouchStart: this.handleDragTouchStart.bind(this),
                handleTouchMove: this.handleDragTouchMove.bind(this),
                handleTouchEnd: this.handleDragTouchEnd.bind(this)
            };
            const dragTarget = this.dragConfig.handle || this.element;
            dragTarget.addEventListener('mousedown', this.boundDragHandlers.handleMouseDown);
            dragTarget.addEventListener('touchstart', this.boundDragHandlers.handleTouchStart, { passive: false });
            document.addEventListener('mousemove', this.boundDragHandlers.handleMouseMove);
            document.addEventListener('mouseup', this.boundDragHandlers.handleMouseUp);
            document.addEventListener('touchmove', this.boundDragHandlers.handleTouchMove, { passive: false });
            document.addEventListener('touchend', this.boundDragHandlers.handleTouchEnd);
        }
        disableDrag() {
            if (!this.boundDragHandlers.handleMouseDown) return;
            const dragTarget = this.dragConfig.handle || this.element;
            dragTarget.removeEventListener('mousedown', this.boundDragHandlers.handleMouseDown);
            dragTarget.removeEventListener('touchstart', this.boundDragHandlers.handleTouchStart);
            document.removeEventListener('mousemove', this.boundDragHandlers.handleMouseMove);
            document.removeEventListener('mouseup', this.boundDragHandlers.handleMouseUp);
            document.removeEventListener('touchmove', this.boundDragHandlers.handleTouchMove);
            document.removeEventListener('touchend', this.boundDragHandlers.handleTouchEnd);
            this.boundDragHandlers = {};
        }
        handleDragMouseDown(e) {
            if (this.dragConfig.excludeSelector && e.target.closest(this.dragConfig.excludeSelector)) return;
            e.preventDefault();
            this.startDrag(e.clientX, e.clientY);
        }
        handleDragTouchStart(e) {
            if (this.dragConfig.excludeSelector && e.target.closest(this.dragConfig.excludeSelector)) return;
            e.preventDefault();
            const touch = e.touches[0];
            this.startDrag(touch.clientX, touch.clientY);
        }
        startDrag(x, y) {
            this.dragState.isDragging = false;
            this.dragState.hasMoved = false;
            this.dragState.startX = x;
            this.dragState.startY = y;
            this.dragState.isActive = true;
        }
        handleDragMouseMove(e) {
            if (!this.dragState.isActive) return;
            this.processDragMove(e.clientX, e.clientY, e);
        }
        handleDragTouchMove(e) {
            if (!this.dragState.isActive) return;
            const touch = e.touches[0];
            this.processDragMove(touch.clientX, touch.clientY, e);
        }
        processDragMove(x, y, e) {
            const dx = x - this.dragState.startX;
            const dy = y - this.dragState.startY;
            if (!this.dragState.isDragging && (Math.abs(dx) > this.dragConfig.threshold || Math.abs(dy) > this.dragConfig.threshold)) {
                this.dragState.isDragging = true;
                this.dragState.hasMoved = true;
                if (this.dragConfig.onDragStart) {
                    this.dragConfig.onDragStart(e);
                }
            }
            if (this.dragState.isDragging) {
                e.preventDefault();
                if (this.dragConfig.onDragMove) {
                    this.dragConfig.onDragMove(dx, dy, x, y, e);
                }
            }
        }
        handleDragMouseUp(e) {
            this.finishDrag(e);
        }
        handleDragTouchEnd(e) {
            this.finishDrag(e);
        }
        finishDrag(e) {
            if (this.dragState.isDragging) {
                if (this.dragConfig.onDragEnd) {
                    this.dragConfig.onDragEnd(e);
                }
            } else if (!this.dragState.hasMoved && this.dragState.isActive) {
                this.handlePossibleClick(e);
            }
            this.dragState.isDragging = false;
            this.dragState.isActive = false;
        }
        handlePossibleClick(e) {
            this.dragState.clickCount++;
            if (this.dragState.clickCount === 1) {
                this.dragState.clickTimer = setTimeout(() => {
                    if (this.dragConfig.onClick) {
                        this.dragConfig.onClick(e);
                    }
                    this.dragState.clickCount = 0;
                }, 250);
            } else if (this.dragState.clickCount === 2) {
                clearTimeout(this.dragState.clickTimer);
                this.dragState.clickCount = 0;
                if (this.dragConfig.onDoubleClick) {
                    this.dragConfig.onDoubleClick(e);
                }
            }
        }
        makeFixedDraggable(offsetX = 20, offsetY = 20) {
            const rect = this.element.getBoundingClientRect();
            this.element.style.position = 'fixed';
            this.element.style.left = rect.left + 'px';
            this.element.style.top = rect.top + 'px';
            this.element.style.right = 'auto';
            this.element.style.bottom = 'auto';
            this.element.style.margin = '0';
            this._dragOffsetX = offsetX;
            this._dragOffsetY = offsetY;
        }
        updateDragPosition(x, y) {
            this.element.style.left = (x - (this._dragOffsetX || 20)) + 'px';
            this.element.style.top = (y - (this._dragOffsetY || 20)) + 'px';
        }
    }

    class Toast extends BaseElement {
        constructor(options = {}) {
            super({
                tag: 'div',
                className: 'bili-speed-toast',
                style: {
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: '#fff',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    zIndex: '99999',
                    opacity: '0',
                    transition: 'opacity 0.3s',
                    pointerEvents: 'none'
                },
                ...options
            });
            this.visible = false;
            this.timer = null;
            this.init();
        }
        show(message, duration = 1500) {
            if (this.timer) {
                clearTimeout(this.timer);
            }
            this.element.textContent = message;
            this.element.style.opacity = '1';
            this.visible = true;
            this.timer = setTimeout(() => {
                this.hide();
            }, duration);
        }
        hide() {
            this.element.style.opacity = '0';
            this.visible = false;
        }
    }

    class IconCard extends BaseElement {
        constructor(options = {}) {
            super({
                tag: 'div',
                className: 'bili-speed-icon-card',
                style: {
                    position: 'fixed',
                    bottom: '100px',
                    right: '20px',
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #00a1d6, #fb7299)',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    zIndex: '99998',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                    userSelect: 'none',
                    fontSize: '18px',
                    color: '#fff'
                },
                draggable: true,
                ...options
            });
            this.init();
        }
        createElement() {
            super.createElement();
            this.element.innerHTML = '⚡';
        }
        mounted() {
            this.enableDrag({
                threshold: 5,
                onDragStart: () => {
                    this.element.style.right = 'auto';
                    this.element.style.bottom = 'auto';
                    this._dragOffsetX = 20;
                    this._dragOffsetY = 20;
                },
                onDragMove: (dx, dy, x, y) => {
                    this.updateDragPosition(x, y);
                },
                onDoubleClick: () => {
                    this.emit('ui:show', { target: 'vidoInfoCard' });
                    this.hide();
                }
            });
        }
    }

    class VidoInfoCard extends BaseElement {
        constructor(options = {}) {
            super({
                tag: 'div',
                className: 'bili-speed-info-card',
                style: {
                    background: '#F1F2F3',
                    borderRadius: '8px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    fontSize: '14px'
                },
                ...options
            });
            this.init();
        }
        createElement() {
            super.createElement();
            this.createHeader();
            this.createMain();
            //this.createFooter();
        }
        createHeader() {
            this.header = document.createElement('div');
            this.header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: linear-gradient(135deg, #00a1d6, #fb7299); color: #fff;';
            
            this.headerLeft = document.createElement('span');
            this.headerLeft.textContent = '📊视频信息';
            this.headerLeft.title = '快捷键: Z=1x | X=+0.05 | C=-0.05';
            this.headerLeft.style.cssText = 'cursor: default;';
            
            this.headerMiddle = document.createElement('div');
            this.headerMiddle.style.cssText = 'flex: 1; display: flex; justify-content: center;';
            this.dragHandle = document.createElement('span');
            this.dragHandle.style.cssText = 'cursor: move; font-size: 12px; opacity: 0.8;';
            this.dragHandle.textContent = '⋮⋮';
            this.headerMiddle.appendChild(this.dragHandle);
            
            this.headerRight = document.createElement('div');
            this.headerRight.style.cssText = 'display: flex; align-items: center;';
            
            this.settingsBtn = document.createElement('button');
            this.settingsBtn.textContent = '⚙️';
            this.settingsBtn.title = '倍速设置';
            this.settingsBtn.style.cssText = 'background: none; border: none; color: #fff; cursor: pointer; font-size: 14px; padding: 0 5px;';
            
            this.headerRightBtn = document.createElement('button');
            this.headerRightBtn.textContent = '﹤';
            this.headerRightBtn.className = 'collapse-btn';
            this.headerRightBtn.style.cssText = 'background: none; border: none; color: #fff; cursor: pointer; font-size: 16px; padding: 0 5px;';
            
            this.headerRight.appendChild(this.settingsBtn);
            this.headerRight.appendChild(this.headerRightBtn);
            
            this.header.appendChild(this.headerLeft);
            this.header.appendChild(this.headerMiddle);
            this.header.appendChild(this.headerRight);
            this.element.appendChild(this.header);
        }
        createMain() {
            this.main = document.createElement('div');
            this.main.style.cssText = 'padding: 12px; background: #F1F2F3;';
            this.speedInfo = document.createElement('div');
            this.speedInfo.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px;';
            this.speedInfo.innerHTML = '<span>播放速度</span><span class="speed-value">1.00X</span>';
            this.remainingInfo = document.createElement('div');
            this.remainingInfo.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px;';
            this.remainingInfo.innerHTML = '<span>剩余时长</span><span class="remaining-value">00:00</span>';
            this.durationInfo = document.createElement('div');
            this.durationInfo.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px;';
            this.durationInfo.innerHTML = '<span>视频时长</span><span class="duration-value">00:00</span>';
            this.collectionInfo = document.createElement('div');
            this.collectionInfo.style.cssText = 'display: flex; justify-content: space-between;';
            this.collectionInfo.innerHTML = '<span>合集时长</span><span class="collection-value">--</span>';
            this.main.appendChild(this.speedInfo);
            this.main.appendChild(this.remainingInfo);
            this.main.appendChild(this.durationInfo);
            this.main.appendChild(this.collectionInfo);
            this.element.appendChild(this.main);
        }
        createFooter() {
            this.footer = document.createElement('div');
            this.footer.style.cssText = 'padding: 8px 12px; background: #F1F2F3; font-size: 12px; color: #999;';
            this.footer.innerHTML = '<span>快捷键: Z=1x | X=+0.05 | C=-0.05</span>';
            this.element.appendChild(this.footer);
        }
        mounted() {
            this.enableDrag({
                handle: this.dragHandle,
                excludeSelector: '.collapse-btn',
                threshold: 5,
                onDragStart: () => {
                    this.makeFixedDraggable(0, 0);
                    this.element.style.zIndex = '99997';
                },
                onDragMove: (dx, dy, x, y) => {
                    const rect = this.element.getBoundingClientRect();
                    this.element.style.left = (rect.left + dx) + 'px';
                    this.element.style.top = (rect.top + dy) + 'px';
                    this.dragState.startX = x;
                    this.dragState.startY = y;
                }
            });
            this.on('click', () => {
                this.emit('ui:hide', { target: 'vidoInfoCard' });
                this.hide();
            }, this.headerRightBtn);
            this.on('click', () => {
                this.emit('ui:toggleControl', {});
            }, this.settingsBtn);
            this.eventBus.on('speed:change', this.updateSpeed.bind(this));
        }
        updateSpeed(speed) {
            const speedValue = this.speedInfo.querySelector('.speed-value');
            if (speedValue) {
                speedValue.textContent = speed.toFixed(2) + 'X';
            }
        }
        updateRemaining(seconds) {
            const remainingValue = this.remainingInfo.querySelector('.remaining-value');
            if (remainingValue) {
                remainingValue.textContent = Utils.formatTime(seconds);
            }
        }
        updateDuration(seconds) {
            const durationValue = this.durationInfo.querySelector('.duration-value');
            if (durationValue) {
                durationValue.textContent = Utils.formatTime(seconds);
            }
        }
        updateCollection(seconds, isCollection) {
            const collectionValue = this.collectionInfo.querySelector('.collection-value');
            if (collectionValue) {
                collectionValue.textContent = isCollection ? Utils.formatTime(seconds) : '--';
            }
            this.collectionInfo.style.display = isCollection ? 'flex' : 'none';
        }
    }

    class ControlPanel extends BaseElement {
        constructor(options = {}) {
            super({
                tag: 'div',
                className: 'bili-speed-control-panel',
                style: {
                    background: '#F1F2F3',
                    borderRadius: '8px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                    padding: '16px',
                    marginBottom: '10px',
                    fontSize: '14px'
                },
                ...options
            });
            this.config = options.config || {};
            this.init();
        }
        createElement() {
            super.createElement();
            this.createTitle();
            this.createInputs();
            this.createButtons();
        }
        createTitle() {
            const title = document.createElement('div');
            title.style.cssText = 'font-weight: bold; margin-bottom: 12px; color: #333;';
            title.textContent = '⚙️ 倍速设置';
            this.element.appendChild(title);
        }
        createInputs() {
            const inputs = [
                { label: '倍速步进', key: 'step', type: 'number', step: '0.05', min: '0.5', max: '1' },
                { label: '最小倍速', key: 'minSpeed', type: 'number', step: '0.1', min: '0.1', max: '16' },
                { label: '最大倍速', key: 'maxSpeed', type: 'number', step: '0.1', min: '0.1', max: '16' },
                { label: '初始倍速', key: 'initialSpeed', type: 'number', step: '0.1', min: '0.1', max: '16' }
            ];
            inputs.forEach(input => {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';
                const label = document.createElement('label');
                label.textContent = input.label;
                label.style.cssText = 'color: #666;';
                const inputEl = document.createElement('input');
                inputEl.type = input.type;
                inputEl.step = input.step;
                inputEl.min = input.min;
                inputEl.max = input.max;
                inputEl.value = this.config[input.key] || 1;
                inputEl.dataset.key = input.key;
                inputEl.style.cssText = 'width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center;';
                row.appendChild(label);
                row.appendChild(inputEl);
                this.element.appendChild(row);
            });
        }
        createButtons() {
            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display: flex; gap: 10px; margin-top: 12px;';
            const saveBtn = document.createElement('button');
            saveBtn.textContent = '保存';
            saveBtn.style.cssText = 'flex: 1; padding: 8px; background: #00a1d6; color: #fff; border: none; border-radius: 4px; cursor: pointer;';
            saveBtn.addEventListener('click', () => this.saveConfig());
            const resetBtn = document.createElement('button');
            resetBtn.textContent = '重置';
            resetBtn.style.cssText = 'flex: 1; padding: 8px; background: #f5f5f5; color: #666; border: none; border-radius: 4px; cursor: pointer;';
            resetBtn.addEventListener('click', () => this.resetConfig());
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '关闭';
            closeBtn.title = '关闭不保存';
            closeBtn.style.cssText = 'flex: 1; padding: 8px; background: #ff6b6b; color: #fff; border: none; border-radius: 4px; cursor: pointer;';
            closeBtn.addEventListener('click', () => this.emit('ui:toggleControl', {}));
            btnRow.appendChild(saveBtn);
            btnRow.appendChild(resetBtn);
            btnRow.appendChild(closeBtn);
            this.element.appendChild(btnRow);
        }
        bindEvents() {
            this.element.querySelectorAll('input').forEach(input => {
                input.addEventListener('change', () => {
                    const key = input.dataset.key;
                    const value = parseFloat(input.value);
                    this.config[key] = value;
                });
            });
        }
        saveConfig() {
            Object.entries(this.config).forEach(([key, value]) => {
                Storage.set(key, value);
            });
            this.emit('config:save', this.config);
            alert('配置已保存！');
        }
        resetConfig() {
            const defaultConfig = {
                step: 0.05,
                minSpeed: 0.5,
                maxSpeed: 4,
                initialSpeed: 1
            };
            this.config = { ...defaultConfig };
            this.element.querySelectorAll('input').forEach(input => {
                const key = input.dataset.key;
                input.value = defaultConfig[key];
            });
            this.saveConfig();
        }
        updateConfig(config) {
            this.config = { ...this.config, ...config };
            this.element.querySelectorAll('input').forEach(input => {
                const key = input.dataset.key;
                if (this.config[key] !== undefined) {
                    input.value = this.config[key];
                }
            });
        }
    }

    class SpeedModule {
        constructor(core) {
            this.core = core;
            this.config = {
                step: Storage.get('step', 0.05),
                minSpeed: Storage.get('minSpeed', 0.5),
                maxSpeed: Storage.get('maxSpeed', 4),
                initialSpeed: Storage.get('initialSpeed', 1)
            };
            this.currentSpeed = 1;
            this.video = null;
            this.toast = null;
            this.infoCard = null;
            this.controlPanel = null;
            this.iconCard = null;
            this.isLivePage = Utils.isLivePage();
            this.isCollection = false;
            this.collectionDuration = 0;
        }
        async init() {
            if (this.isLivePage) {
                Logger.info('直播页面，不启用倍速模块');
                return;
            }
            await this.initVideo();
            this.initCollectionInfo();
            this.createUI();
            this.bindEvents();
            this.setSpeed(this.config.initialSpeed);
            Logger.info('倍速模块初始化完成');
        }
        async initVideo() {
            const video = document.querySelector('video');
            if (video) {
                this.video = video;
                return;
            }
            try {
                this.video = await Utils.waitForElement('video', 10000);
            } catch (e) {
                Logger.error('未找到视频元素');
            }
        }
        initCollectionInfo() {
            try {
                const state = window.__INITIAL_STATE__;
                if (state && state.videoData) {
                    this.isCollection = state.videoData.videos > 1;
                    if (this.isCollection && state.videoData.pages) {
                        this.collectionDuration = state.videoData.pages.reduce((sum, page) => sum + (page.duration || 0), 0);
                    }
                }
            } catch (e) {
                Logger.warn('获取合集信息失败', e);
            }
        }
        createUI() {
            const playerWrap = document.querySelector('.bpx-player-video-wrap') || document.querySelector('.bpx-player-mini-warp');
            if (playerWrap) {
                this.toast = new Toast();
                playerWrap.appendChild(this.toast.element);
            }
            const danmukuBox = document.getElementById('danmukuBox');
            if (danmukuBox) {
                this.infoCard = new VidoInfoCard();
                const rect = danmukuBox.getBoundingClientRect();
                this.infoCard.element.style.cssText = `
                    position: fixed !important;
                    top: ${rect.top}px !important;
                    left: ${rect.left}px !important;
                    width: ${rect.width}px !important;
                    z-index: 99997 !important;
                    background: #F1F2F3 !important;
                    border-radius: 8px !important;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.1) !important;
                    overflow: hidden !important;
                    box-sizing: border-box !important;
                `;
                document.body.appendChild(this.infoCard.element);
            }
            const videoPod = document.querySelector('.video-pod');
            if (videoPod && danmukuBox) {
                this.controlPanel = new ControlPanel({ config: this.config });
                const danmukuRect = danmukuBox.getBoundingClientRect();
                const rect = videoPod.getBoundingClientRect();
                this.controlPanel.element.style.cssText = `
                    position: fixed !important;
                    top: ${rect.bottom + 20}px !important;
                    left: ${danmukuRect.left}px !important;
                    width: ${danmukuRect.width}px !important;
                    z-index: 99997 !important;
                    background: #F1F2F3 !important;
                    border-radius: 8px !important;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.1) !important;
                    padding: 16px !important;
                    box-sizing: border-box !important;
                    display: none !important;
                `;
                document.body.appendChild(this.controlPanel.element);
            }
            this.iconCard = new IconCard();
            this.iconCard.hide();
            document.body.appendChild(this.iconCard.element);
            this.bindUICardEvents();
            this.bindScrollEvents();
        }
        bindScrollEvents() {
            let lastScrollTop = 0;
            const getScrollThreshold = () => {
                const el = document.querySelector('#biliMainHeader');
                if (el) {
                    return el.offsetHeight;
                }
                return 60;
            };
            const setIconCardToBottomRight = () => {
                if (this.iconCard) {
                    this.iconCard.element.style.cssText = `
                        position: fixed !important;
                        right: 20px !important;
                        bottom: 20px !important;
                        left: auto !important;
                        top: auto !important;
                        width: 40px !important;
                        height: 40px !important;
                        z-index: 99998;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                        userSelect: none;
                        fontSize: 18px;
                        color: #fff;
                        background: linear-gradient(135deg, #00a1d6, #fb7299);
                        borderRadius: 50%;
                        cursor: pointer;
                    `;
                }
            };
            window.addEventListener('scroll', Utils.throttle(() => {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const threshold = getScrollThreshold();
                if (scrollTop > threshold) {
                    if (this.infoCard) {
                        this.infoCard.hide();
                    }
                    if (this.iconCard) {
                        setIconCardToBottomRight();
                        this.iconCard.show();
                    }
                } else {
                    if (this.iconCard) {
                        this.iconCard.hide();
                    }
                    if (this.infoCard) {
                        this.infoCard.show();
                    }
                }
                lastScrollTop = scrollTop;
            }, 100));
        }
        bindUICardEvents() {
            EventBus.on('ui:show', (data) => {
                if (data.target === 'vidoInfoCard' && this.infoCard) {
                    this.infoCard.show();
                }
            });
            EventBus.on('ui:hide', (data) => {
                if (data.target === 'vidoInfoCard' && this.iconCard && this.infoCard) {
                    const rect = this.infoCard.element.getBoundingClientRect();
                    this.iconCard.element.style.cssText = `
                        position: fixed !important;
                        top: ${rect.top}px !important;
                        left: ${rect.left}px !important;
                        width: 40px !important;
                        height: 40px !important;
                        z-index: 99998;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                        userSelect: none;
                        fontSize: 18px;
                        color: #fff;
                        background: linear-gradient(135deg, #00a1d6, #fb7299);
                        borderRadius: 50%;
                        cursor: pointer;
                    `;
                    this.iconCard.show();
                }
            });
        }
        bindEvents() {
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            if (this.video) {
                this.video.addEventListener('timeupdate', Utils.throttle(() => {
                    this.updateInfo();
                }, 500));
            }
            EventBus.on('config:save', (config) => {
                this.config = { ...this.config, ...config };
                if (this.controlPanel) {
                    this.controlPanel.updateConfig(config);
                }
            });
            EventBus.on('ui:toggleControl', () => {
                if (this.controlPanel) {
                    const isVisible = this.controlPanel.element.style.display !== 'none';
                    if (isVisible) {
                        this.controlPanel.element.style.display = 'none';
                    } else {
                        // 重新读取配置
                        this.config = {
                            step: Storage.get('step', 0.05),
                            minSpeed: Storage.get('minSpeed', 0.5),
                            maxSpeed: Storage.get('maxSpeed', 4),
                            initialSpeed: Storage.get('initialSpeed', 1)
                        };
                        this.controlPanel.updateConfig(this.config);
                        this.controlPanel.element.style.display = 'block';
                    }
                }
            });
        }
        handleKeyDown(e) {
            if (Utils.isInputMode()) {
                return;
            }
            // ControlPanel 显示时，快捷键不生效
            if (this.controlPanel && this.controlPanel.element.style.display !== 'none') {
                return;
            }
            const key = e.key.toLowerCase();
            switch (key) {
                case 'z':
                    e.preventDefault();
                    this.setSpeed(1, true);
                    break;
                case 'x':
                    e.preventDefault();
                    this.increaseSpeed();
                    break;
                case 'c':
                    e.preventDefault();
                    this.decreaseSpeed();
                    break;
            }
        }
        setSpeed(speed, showToast = false) {
            if (!this.video) return;
            speed = Math.max(this.config.minSpeed, Math.min(this.config.maxSpeed, speed));
            this.video.playbackRate = speed;
            this.currentSpeed = speed;
            if (showToast) {
                this.showToast(`${speed.toFixed(2)}x`);
            }
            EventBus.emit('speed:change', speed);
            this.updateInfo();
        }
        increaseSpeed() {
            const newSpeed = Utils.add(this.currentSpeed, this.config.step);
            this.setSpeed(newSpeed, true);
        }
        decreaseSpeed() {
            const newSpeed = Utils.subtract(this.currentSpeed, this.config.step);
            this.setSpeed(newSpeed, true);
        }
        showToast(message) {
            if (this.toast) {
                this.toast.show(message);
            }
        }
        updateInfo() {
            if (!this.video) return;
            const remaining = this.video.duration - this.video.currentTime;
            if (this.infoCard) {
                this.infoCard.updateSpeed(this.currentSpeed);
                this.infoCard.updateRemaining(remaining);
                this.infoCard.updateDuration(this.video.duration);
                this.infoCard.updateCollection(this.collectionDuration, this.isCollection);
            }
        }
        destroy() {
            document.removeEventListener('keydown', this.handleKeyDown.bind(this));
            if (this.toast) this.toast.remove();
            if (this.infoCard) this.infoCard.remove();
            if (this.controlPanel) this.controlPanel.remove();
            if (this.iconCard) this.iconCard.remove();
        }
    }

    class NoLoginModule {
        constructor(core) {
            this.core = core;
        }
        init() {
            this.removeLoginPopup();
            this.observeLoginPopup();
            Logger.info('免登录模块初始化完成');
        }
        removeLoginPopup() {
            const closeBtn = document.querySelector('.bili-mini-close-icon');
            if (closeBtn) {
                closeBtn.click();
            }
        }
        observeLoginPopup() {
            const observer = new MutationObserver(() => {
                this.removeLoginPopup();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    class AdBlockModule {
        constructor(core) {
            this.core = core;
        }
        init() {
            this.removeAds();
            this.observeAds();
            Logger.info('去广告模块初始化完成');
        }
        removeAds() {
            const ads = document.querySelectorAll('.right-bottom-banner');
            ads.forEach(ad => ad.remove());
        }
        observeAds() {
            const observer = new MutationObserver(() => {
                this.removeAds();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    class Core {
        constructor() {
            this.modules = new Map();
            this.config = Storage.getAll();
        }
        async init() {
            Logger.info('Bilibili自定义倍速脚本启动');
            this.registerModules();
            await this.loadModules();
            this.handleSPARouting();
            EventBus.emit('app:ready');
        }
        registerModules() {
            this.modules.set('speed', SpeedModule);
            this.modules.set('noLogin', NoLoginModule);
            this.modules.set('adBlock', AdBlockModule);
        }
        async loadModules() {
            for (const [name, ModuleClass] of this.modules) {
                try {
                    const module = new ModuleClass(this);
                    await module.init();
                    EventBus.emit('module:load', { name });
                } catch (e) {
                    Logger.error(`模块 ${name} 加载失败`, e);
                    EventBus.emit('module:error', { name, error: e });
                }
            }
        }
        handleSPARouting() {
            let lastUrl = location.href;
            const observer = new MutationObserver(() => {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    Logger.info('SPA路由变化');
                    EventBus.emit('app:routeChange', { url: lastUrl });
                    setTimeout(() => {
                        this.reloadModules();
                    }, 1000);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        async reloadModules() {
            for (const [name, ModuleClass] of this.modules) {
                try {
                    const module = new ModuleClass(this);
                    await module.init();
                } catch (e) {
                    Logger.error(`模块 ${name} 重载失败`, e);
                }
            }
        }
    }

    GM_addStyle(`
        .bili-speed-toast {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .bili-speed-info-card {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .bili-speed-control-panel {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .bili-speed-icon-card {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
    `);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new Core().init();
        });
    } else {
        new Core().init();
    }
})();
