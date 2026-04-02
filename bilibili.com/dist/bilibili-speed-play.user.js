// ==UserScript==
// @name         Bilibili自定义倍速播放
// @namespace    http://tampermonkey.net/
// @version      0.9
// @author       小明
// @description  添加类似 Potplayer 的功能，默认倍速和记忆倍速，方便用户快速切换播放速度；2.修复了某些情况下倍速失效的问题。
// @license      MIT
// @icon         chrome://favicon/http://www.bilibili.com/
// @match        https://www.bilibili.com/*
// @require      https://cdn.jsdelivr.net/npm/systemjs@6.15.1/dist/system.min.js
// @require      https://cdn.jsdelivr.net/npm/systemjs@6.15.1/dist/extras/named-register.min.js
// @require      data:application/javascript,%3B(typeof%20System!%3D'undefined')%26%26(System%3Dnew%20System.constructor())%3B
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==


System.register("./__entry.js", [], (function (exports, module) {
  'use strict';
  return {
    execute: (function () {

      const scriptRel = (function detectScriptRel() {
        const relList = typeof document !== "undefined" && document.createElement("link").relList;
        return relList && relList.supports && relList.supports("modulepreload") ? "modulepreload" : "preload";
      })();
      const assetsURL = function(dep) {
        return "/" + dep;
      };
      const seen = {};
      const __vitePreload = function preload(baseModule, deps, importerUrl) {
        let promise = Promise.resolve();
        if (deps && deps.length > 0) {
          let allSettled2 = function(promises$2) {
            return Promise.all(promises$2.map((p) => Promise.resolve(p).then((value$1) => ({
              status: "fulfilled",
              value: value$1
            }), (reason) => ({
              status: "rejected",
              reason
            }))));
          };
          document.getElementsByTagName("link");
          const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
          const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
          promise = allSettled2(deps.map((dep) => {
            dep = assetsURL(dep);
            if (dep in seen) return;
            seen[dep] = true;
            const isCss = dep.endsWith(".css");
            const cssSelector = isCss ? '[rel="stylesheet"]' : "";
            if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) return;
            const link = document.createElement("link");
            link.rel = isCss ? "stylesheet" : scriptRel;
            if (!isCss) link.as = "script";
            link.crossOrigin = "";
            link.href = dep;
            if (cspNonce) link.setAttribute("nonce", cspNonce);
            document.head.appendChild(link);
            if (isCss) return new Promise((res, rej) => {
              link.addEventListener("load", res);
              link.addEventListener("error", () => rej( new Error(`Unable to preload CSS for ${dep}`)));
            });
          }));
        }
        function handlePreloadError(err$2) {
          const e$1 = new Event("vite:preloadError", { cancelable: true });
          e$1.payload = err$2;
          window.dispatchEvent(e$1);
          if (!e$1.defaultPrevented) throw err$2;
        }
        return promise.then((res) => {
          for (const item of res || []) {
            if (item.status !== "rejected") continue;
            handlePreloadError(item.reason);
          }
          return baseModule().catch(handlePreloadError);
        });
      };
      class Storage {
constructor(prefix = "app_") {
          this.prefix = prefix;
          this.storage = window.localStorage;
        }
set(key, value) {
          try {
            const serializedValue = JSON.stringify(value);
            this.storage.setItem(this.prefix + key, serializedValue);
            return true;
          } catch (error) {
            console.error("Storage set error:", error);
            return false;
          }
        }
get(key, defaultValue = null) {
          try {
            const value = this.storage.getItem(this.prefix + key);
            if (value === null) {
              return defaultValue;
            }
            return JSON.parse(value);
          } catch (error) {
            console.error("Storage get error:", error);
            return defaultValue;
          }
        }
remove(key) {
          try {
            this.storage.removeItem(this.prefix + key);
            return true;
          } catch (error) {
            console.error("Storage remove error:", error);
            return false;
          }
        }
clear() {
          try {
            const keys = this.keys();
            keys.forEach((key) => {
              this.remove(key);
            });
            return true;
          } catch (error) {
            console.error("Storage clear error:", error);
            return false;
          }
        }
has(key) {
          try {
            return this.storage.getItem(this.prefix + key) !== null;
          } catch (error) {
            console.error("Storage has error:", error);
            return false;
          }
        }
keys() {
          try {
            const allKeys = [];
            for (let i = 0; i < this.storage.length; i++) {
              const key = this.storage.key(i);
              if (key && key.startsWith(this.prefix)) {
                allKeys.push(key.substring(this.prefix.length));
              }
            }
            return allKeys;
          } catch (error) {
            console.error("Storage keys error:", error);
            return [];
          }
        }
size() {
          try {
            return this.keys().length;
          } catch (error) {
            console.error("Storage size error:", error);
            return 0;
          }
        }
getAll() {
          try {
            const data = {};
            const keys = this.keys();
            keys.forEach((key) => {
              data[key] = this.get(key);
            });
            return data;
          } catch (error) {
            console.error("Storage getAll error:", error);
            return {};
          }
        }
setMultiple(data) {
          try {
            Object.keys(data).forEach((key) => {
              this.set(key, data[key]);
            });
            return true;
          } catch (error) {
            console.error("Storage setMultiple error:", error);
            return false;
          }
        }
removeMultiple(keys) {
          try {
            keys.forEach((key) => {
              this.remove(key);
            });
            return true;
          } catch (error) {
            console.error("Storage removeMultiple error:", error);
            return false;
          }
        }
getStorageSize() {
          try {
            let total = 0;
            for (let i = 0; i < this.storage.length; i++) {
              const key = this.storage.key(i);
              if (key && key.startsWith(this.prefix)) {
                const value = this.storage.getItem(key);
                total += (key.length + value.length) * 2;
              }
            }
            return total;
          } catch (error) {
            console.error("Storage getStorageSize error:", error);
            return 0;
          }
        }
getStorageSizeInKB() {
          return (this.getStorageSize() / 1024).toFixed(2);
        }
getStorageSizeInMB() {
          return (this.getStorageSize() / 1024 / 1024).toFixed(2);
        }
      }
      class EventBus {
constructor() {
          this.subscribers = {};
        }
subscribe(event, callback) {
          if (!this.subscribers[event]) {
            this.subscribers[event] = new Set();
          }
          this.subscribers[event].add(callback);
          return () => {
            this.unsubscribe(event, callback);
          };
        }
unsubscribe(event, callback) {
          if (this.subscribers[event]) {
            this.subscribers[event].delete(callback);
          }
        }
publish(event, data) {
          if (this.subscribers[event]) {
            this.subscribers[event].forEach((callback) => {
              try {
                callback(data);
              } catch (error) {
                console.error(`通知订阅者失败 [${event}]:`, error);
              }
            });
          }
        }
clear() {
          this.subscribers = {};
        }
clearEvent(event) {
          if (this.subscribers[event]) {
            this.subscribers[event].clear();
          }
        }
getSubscriberCount(event) {
          return this.subscribers[event] ? this.subscribers[event].size : 0;
        }
      }
      const DEFAULT_CONFIG = {
        speedStep: 0.05,
        speedEnabled: true,
        timeEnabled: true,
        currentPageSpeed: 1,
        speedButtons: {
          "z": { type: "set", value: 1 },
          "x": { type: "decrease", value: 0.05 },
          "c": { type: "increase", value: 0.05 }
        }
      };
      let speedStep = DEFAULT_CONFIG.speedStep;
      let speedEnabled = DEFAULT_CONFIG.speedEnabled;
      let timeEnabled = DEFAULT_CONFIG.timeEnabled;
      let currentPageSpeed = DEFAULT_CONFIG.currentPageSpeed;
      let speedButtons = DEFAULT_CONFIG.speedButtons;
      let totalDuration = 0;
      let watchedDuration = 0;
      let remainingDuration = 0;
      const eventBus = new EventBus();
      function initGlobalVariables() {
        try {
          if (typeof GM_getValue !== "undefined") {
            speedStep = GM_getValue("speedStep", DEFAULT_CONFIG.speedStep);
            speedEnabled = GM_getValue("speedEnabled", DEFAULT_CONFIG.speedEnabled);
            timeEnabled = GM_getValue("timeEnabled", DEFAULT_CONFIG.timeEnabled);
            currentPageSpeed = GM_getValue("currentPageSpeed", DEFAULT_CONFIG.currentPageSpeed);
            speedButtons = GM_getValue("speedButtons", DEFAULT_CONFIG.speedButtons);
          } else {
            const storage = new Storage("bilibili_");
            speedStep = storage.get("speedStep", DEFAULT_CONFIG.speedStep);
            speedEnabled = storage.get("speedEnabled", DEFAULT_CONFIG.speedEnabled);
            timeEnabled = storage.get("timeEnabled", DEFAULT_CONFIG.timeEnabled);
            currentPageSpeed = storage.get("currentPageSpeed", DEFAULT_CONFIG.currentPageSpeed);
            speedButtons = storage.get("speedButtons", DEFAULT_CONFIG.speedButtons);
          }
        } catch (error) {
          console.error("获取全局变量失败:", error);
          speedStep = DEFAULT_CONFIG.speedStep;
          speedEnabled = DEFAULT_CONFIG.speedEnabled;
          timeEnabled = DEFAULT_CONFIG.timeEnabled;
          currentPageSpeed = DEFAULT_CONFIG.currentPageSpeed;
          speedButtons = DEFAULT_CONFIG.speedButtons;
        }
        registerMenuCommands();
      }
      function registerMenuCommands() {
        try {
          if (typeof GM_registerMenuCommand !== "undefined") {
            GM_registerMenuCommand("设置倍速步长", showSpeedStepCard);
            GM_registerMenuCommand("启用/禁用倍速视频功能", toggleSpeedEnabled);
            GM_registerMenuCommand("启用/禁用展示时间信息功能", toggleTimeEnabled);
          }
        } catch (error) {
          console.error("注册菜单项失败:", error);
        }
      }
      function showSpeedStepCard() {
        __vitePreload(async () => {
          const { default: Card } = await module.import('./card-DqbZNWO2-DCjoBVAn.js');
          return { default: Card };
        }, void 0 ).then(({ default: Card }) => {
          __vitePreload(async () => {
            const { default: Button } = await module.import('./button-CSGNcTaj-CviXCN8B.js');
            return { default: Button };
          }, void 0 ).then(({ default: Button }) => {
            const speedOptions = [0.05, 0.1, 0.2, 0.5];
            let content = '<div style="margin-bottom: 15px;"><strong>选择倍速步长：</strong></div>';
            speedOptions.forEach((option) => {
              const isSelected = speedStep === option;
              content += `
                    <div style="margin-bottom: 10px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="speedStep" value="${option}" ${isSelected ? "checked" : ""} style="margin-right: 8px;">
                            <span>${option}</span>
                        </label>
                    </div>
                `;
            });
            const card = new Card({
              title: "设置倍速步长",
              content,
              buttons: [
                {
                  text: "取消",
                  type: "secondary",
                  onClick: () => card.hide()
                },
                {
                  text: "确定",
                  type: "primary",
                  onClick: () => {
                    const selectedOption = document.querySelector('input[name="speedStep"]:checked');
                    if (selectedOption) {
                      const newSpeedStep = parseFloat(selectedOption.value);
                      speedStep = newSpeedStep;
                      eventBus.publish("speedStep", newSpeedStep);
                      try {
                        if (typeof GM_setValue !== "undefined") {
                          GM_setValue("speedStep", speedStep);
                        }
                        const storage = new Storage("bilibili_");
                        storage.set("speedStep", speedStep);
                      } catch (error) {
                        console.error("保存倍速步长失败:", error);
                      }
                      card.hide();
                    }
                  }
                }
              ]
            });
            card.show();
          });
        });
      }
      function toggleSpeedEnabled() {
        speedEnabled = !speedEnabled;
        eventBus.publish("speedEnabled", speedEnabled);
        try {
          if (typeof GM_setValue !== "undefined") {
            GM_setValue("speedEnabled", speedEnabled);
          }
          const storage = new Storage("bilibili_");
          storage.set("speedEnabled", speedEnabled);
        } catch (error) {
          console.error("保存倍速功能状态失败:", error);
        }
        showToast(speedEnabled ? "倍速功能已启用" : "倍速功能已禁用");
      }
      function toggleTimeEnabled() {
        timeEnabled = !timeEnabled;
        eventBus.publish("timeEnabled", timeEnabled);
        try {
          if (typeof GM_setValue !== "undefined") {
            GM_setValue("timeEnabled", timeEnabled);
          }
          const storage = new Storage("bilibili_");
          storage.set("timeEnabled", timeEnabled);
        } catch (error) {
          console.error("保存时间信息功能状态失败:", error);
        }
        showToast(timeEnabled ? "时间信息功能已启用" : "时间信息功能已禁用");
      }
      function showToast(message) {
        const toast = document.createElement("div");
        toast.textContent = message;
        toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        z-index: 10000;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
    `;
        const style = document.createElement("style");
        style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
        document.head.appendChild(style);
        document.body.appendChild(toast);
        setTimeout(() => {
          toast.style.animation = "slideIn 0.3s ease-out reverse";
          setTimeout(() => {
            if (toast.parentNode) {
              toast.parentNode.removeChild(toast);
            }
            if (style.parentNode) {
              style.parentNode.removeChild(style);
            }
          }, 300);
        }, 2e3);
      }
      function updateCurrentPageSpeed(speed) {
        currentPageSpeed = speed;
        eventBus.publish("currentPageSpeed", speed);
        try {
          if (typeof GM_setValue !== "undefined") {
            GM_setValue("currentPageSpeed", currentPageSpeed);
          }
          const storage = new Storage("bilibili_");
          storage.set("currentPageSpeed", currentPageSpeed);
        } catch (error) {
          console.error("保存当前页面速度失败:", error);
        }
      }
      function updateTotalDuration(seconds) {
        totalDuration = seconds;
        remainingDuration = totalDuration - watchedDuration;
        eventBus.publish("totalDuration", totalDuration);
        eventBus.publish("remainingDuration", remainingDuration);
      }
      function updateWatchedDuration(seconds) {
        watchedDuration = seconds;
        remainingDuration = totalDuration - watchedDuration;
        eventBus.publish("watchedDuration", watchedDuration);
        eventBus.publish("remainingDuration", remainingDuration);
      }
      const globalVariables = {
        get speedStep() {
          return speedStep;
        },
        get speedEnabled() {
          return speedEnabled;
        },
        get timeEnabled() {
          return timeEnabled;
        },
        get currentPageSpeed() {
          return currentPageSpeed;
        },
        set currentPageSpeed(value) {
          updateCurrentPageSpeed(value);
        },
        get speedButtons() {
          return speedButtons;
        },
        set speedButtons(value) {
          speedButtons = value;
          eventBus.publish("speedButtons", value);
          try {
            if (typeof GM_setValue !== "undefined") {
              GM_setValue("speedButtons", speedButtons);
            }
            const storage = new Storage("bilibili_");
            storage.set("speedButtons", speedButtons);
          } catch (error) {
            console.error("保存按钮配置失败:", error);
          }
        },
get totalDuration() {
          return totalDuration;
        },
        set totalDuration(value) {
          updateTotalDuration(value);
        },
        get watchedDuration() {
          return watchedDuration;
        },
        set watchedDuration(value) {
          updateWatchedDuration(value);
        },
        get remainingDuration() {
          return remainingDuration;
        },
        initGlobalVariables,
        showSpeedStepCard,
        toggleSpeedEnabled,
        toggleTimeEnabled,
        updateCurrentPageSpeed,
        updateTotalDuration,
        updateWatchedDuration,
        subscribe: (event, callback) => eventBus.subscribe(event, callback),
        publish: (event, data) => eventBus.publish(event, data)
      };
      class DOMObserverManager {
        constructor() {
          this.observer = null;
          this.callbacks = new Map();
          this.isObserving = false;
        }
observe() {
          if (this.observer) return;
          this.observer = new MutationObserver((mutations) => {
            this.callbacks.forEach((callback, selector) => {
              try {
                const relevantMutations = this.filterRelevantMutations(mutations, selector);
                if (relevantMutations.length > 0) {
                  callback(relevantMutations);
                }
              } catch (error) {
                console.error(`DOM Observer error for ${selector}:`, error);
              }
            });
          });
          this.observer.observe(document.body, {
            childList: true,
            subtree: true
          });
          this.isObserving = true;
          console.log("DOM Observer Manager 初始化完成");
        }
filterRelevantMutations(mutations, selector) {
          const selectors = selector.split(",").map((s) => s.trim());
          return mutations.filter((mutation) => {
            if (mutation.addedNodes.length > 0) {
              return Array.from(mutation.addedNodes).some((node) => {
                if (node.nodeType === 1) {
                  const matchesSelf = selectors.some((sel) => node.matches && node.matches(sel));
                  if (matchesSelf) return true;
                  const hasMatchingChild = selectors.some((sel) => node.querySelector && node.querySelector(sel));
                  if (hasMatchingChild) return true;
                }
                return false;
              });
            }
            return false;
          });
        }
register(selector, callback) {
          if (!this.isObserving) {
            this.observe();
          }
          this.callbacks.set(selector, callback);
          console.log(`注册观察器: ${selector}`);
        }
unregister(selector) {
          this.callbacks.delete(selector);
          console.log(`取消注册观察器: ${selector}`);
          if (this.callbacks.size === 0) {
            this.disconnect();
          }
        }
disconnect() {
          if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
          }
          this.callbacks.clear();
          this.isObserving = false;
          console.log("DOM Observer Manager 已停止");
        }
      }
      const domObserverManager = new DOMObserverManager();
      function formatSeconds(seconds) {
        if (seconds < 0) seconds = 0;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor(seconds % 3600 / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        } else {
          return `${minutes}:${secs.toString().padStart(2, "0")}`;
        }
      }
      function parseTimeString(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(":").map((part) => parseInt(part, 10));
        if (parts.length === 2) {
          return parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        console.warn("无法解析的时长格式:", timeStr);
        return 0;
      }
      function calculateTotalDuration() {
        const durationElements = document.querySelectorAll(".stat-item.duration");
        if (durationElements.length === 0) return 0;
        let totalSeconds = 0;
        durationElements.forEach((el) => {
          const timeStr = el.textContent.trim();
          if (!timeStr) return;
          totalSeconds += parseTimeString(timeStr);
        });
        return totalSeconds;
      }
      class VideoSpeedController {
        constructor(options = {}) {
          this.config = {
            speedStep: globalVariables.speedStep,
            minSpeed: 0.2,
            maxSpeed: 4,
            defaultSpeed: 1,
            ...options
          };
          this.video = null;
          this.isInitialized = false;
          this.unsubscribeSpeedButtons = null;
          this.handleKeyDown = this.handleKeyDown.bind(this);
          this.handleVideoChange = this.handleVideoChange.bind(this);
          this.handleSpeedButtonsChange = this.handleSpeedButtonsChange.bind(this);
          this.init();
        }
handleSpeedButtonsChange(buttons) {
          this.speedOperations = buttons;
          console.log("按钮配置已更新:", buttons);
        }
init() {
          if (this.isInitialized) return;
          this.speedOperations = globalVariables.speedButtons;
          this.unsubscribeSpeedButtons = globalVariables.subscribe("speedButtons", this.handleSpeedButtonsChange);
          this.setupVideoObserver();
          this.setupKeyboardListener();
          this.isInitialized = true;
          console.log("VideoSpeedController 初始化完成");
        }
setupVideoObserver() {
          this.findVideo();
          if (this.video) {
            return;
          }
          domObserverManager.register("video", () => {
            this.findVideo();
            if (this.video) {
              domObserverManager.unregister("video");
            }
          });
        }
findVideo() {
          const video = document.querySelector("video");
          if (video && video !== this.video) {
            this.video = video;
            this.handleVideoChange();
          }
        }
handleVideoChange() {
          if (this.video) {
            const initialSpeed = globalVariables.currentPageSpeed;
            this.video.playbackRate = initialSpeed;
            console.log("找到视频元素，设置初始速度:", initialSpeed);
          }
        }
setupKeyboardListener() {
          document.addEventListener("keydown", this.handleKeyDown);
        }
handleKeyDown(event) {
          const key = event.key.toLowerCase();
          if (this.isEditableElement(document.activeElement)) {
            return;
          }
          if (key in this.speedOperations) {
            event.preventDefault();
            event.stopPropagation();
            this.adjustSpeed(this.speedOperations[key]);
          }
        }
isEditableElement(element) {
          if (!element) return false;
          const tagName = element.tagName.toLowerCase();
          if (tagName === "input" || tagName === "textarea") {
            return true;
          }
          if (element.isContentEditable) {
            return true;
          }
          if (element.getAttribute("role") === "textbox") {
            return true;
          }
          return false;
        }
adjustSpeed(operation) {
          if (!this.video) {
            console.warn("未找到视频元素");
            return;
          }
          let newRate = this.video.playbackRate;
          switch (operation.type) {
            case "set":
              newRate = operation.value;
              break;
            case "increase":
              newRate += operation.value;
              break;
            case "decrease":
              newRate -= operation.value;
              break;
          }
          newRate = Math.max(this.config.minSpeed, Math.min(this.config.maxSpeed, newRate));
          newRate = Math.round(newRate * 100) / 100;
          this.video.playbackRate = newRate;
          globalVariables.currentPageSpeed = newRate;
          return newRate;
        }
setSpeed(speed) {
          return this.adjustSpeed({ type: "set", value: speed });
        }
increaseSpeed(step = this.config.speedStep) {
          return this.adjustSpeed({ type: "increase", value: step });
        }
decreaseSpeed(step = this.config.speedStep) {
          return this.adjustSpeed({ type: "decrease", value: step });
        }
resetSpeed() {
          return this.setSpeed(this.config.defaultSpeed);
        }
getCurrentSpeed() {
          return this.video ? this.video.playbackRate : null;
        }
getTotalDuration() {
          return calculateTotalDuration();
        }
addShortcut(key, operation) {
          this.speedOperations[key.toLowerCase()] = operation;
        }
removeShortcut(key) {
          delete this.speedOperations[key.toLowerCase()];
        }
destroy() {
          domObserverManager.unregister("video");
          document.removeEventListener("keydown", this.handleKeyDown);
          if (this.unsubscribeSpeedButtons) {
            this.unsubscribeSpeedButtons();
          }
          this.isInitialized = false;
          console.log("VideoSpeedController 已销毁");
        }
      }
      class Popover {
constructor(triggerElement, options = {}) {
          this.triggerElement = triggerElement;
          this.options = {
            content: "",
            placement: "top",
            offset: 10,
            trigger: "hover",
...options
          };
          this.popoverElement = null;
          this.isVisible = false;
          this.show = this.show.bind(this);
          this.hide = this.hide.bind(this);
          this.toggle = this.toggle.bind(this);
          this.handleMouseEnter = this.handleMouseEnter.bind(this);
          this.handleMouseLeave = this.handleMouseLeave.bind(this);
          this.handleClick = this.handleClick.bind(this);
          this.handleFocus = this.handleFocus.bind(this);
          this.handleBlur = this.handleBlur.bind(this);
          this.handleClickOutside = this.handleClickOutside.bind(this);
          this.init();
        }
init() {
          if (!this.triggerElement) return;
          this.createPopover();
          this.bindEvents();
        }
bindEvents() {
          const { trigger } = this.options;
          switch (trigger) {
            case "hover":
              this.triggerElement.addEventListener("mouseenter", this.handleMouseEnter);
              this.triggerElement.addEventListener("mouseleave", this.handleMouseLeave);
              break;
            case "click":
              this.triggerElement.addEventListener("click", this.handleClick);
              break;
            case "focus":
              this.triggerElement.addEventListener("focus", this.handleFocus);
              this.triggerElement.addEventListener("blur", this.handleBlur);
              break;
            case "manual":
              break;
            default:
              this.triggerElement.addEventListener("mouseenter", this.handleMouseEnter);
              this.triggerElement.addEventListener("mouseleave", this.handleMouseLeave);
          }
        }
unbindEvents() {
          if (!this.triggerElement) return;
          this.triggerElement.removeEventListener("mouseenter", this.handleMouseEnter);
          this.triggerElement.removeEventListener("mouseleave", this.handleMouseLeave);
          this.triggerElement.removeEventListener("click", this.handleClick);
          this.triggerElement.removeEventListener("focus", this.handleFocus);
          this.triggerElement.removeEventListener("blur", this.handleBlur);
        }
createPopover() {
          this.destroyPopover();
          const popover = document.createElement("div");
          popover.className = "video-info-popover";
          popover.style.position = "fixed";
          popover.style.zIndex = "9999";
          popover.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
          popover.style.color = "#fff";
          popover.style.padding = "12px";
          popover.style.borderRadius = "6px";
          popover.style.fontSize = "14px";
          popover.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
          popover.style.pointerEvents = "none";
          popover.style.opacity = "0";
          popover.style.transition = "opacity 0.2s ease";
          popover.style.minWidth = "200px";
          popover.innerHTML = this.options.content;
          document.body.appendChild(popover);
          this.popoverElement = popover;
        }
updateContent(content) {
          this.options.content = content;
          if (this.popoverElement) {
            this.popoverElement.innerHTML = content;
          }
        }
toggle() {
          if (this.isVisible) {
            this.hide();
          } else {
            this.show();
          }
        }
show() {
          if (!this.popoverElement || this.isVisible) return;
          this.positionPopover();
          this.popoverElement.style.opacity = "1";
          this.isVisible = true;
          if (this.options.trigger === "click") {
            setTimeout(() => {
              document.addEventListener("click", this.handleClickOutside);
            }, 100);
          }
        }
hide() {
          if (!this.popoverElement || !this.isVisible) return;
          this.popoverElement.style.opacity = "0";
          this.isVisible = false;
          document.removeEventListener("click", this.handleClickOutside);
        }
positionPopover() {
          if (!this.popoverElement || !this.triggerElement) return;
          const collapseHeader = this.triggerElement.closest(".bui-collapse-header");
          const baseElement = collapseHeader || this.triggerElement;
          const baseRect = baseElement.getBoundingClientRect();
          const popoverRect = this.popoverElement.getBoundingClientRect();
          let top, left;
          left = baseRect.left;
          top = baseRect.bottom + this.options.offset;
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          if (left < 0) left = 10;
          if (left + popoverRect.width > viewportWidth) {
            left = viewportWidth - popoverRect.width - 10;
          }
          if (top < 0) top = 10;
          if (top + popoverRect.height > viewportHeight) {
            top = viewportHeight - popoverRect.height - 10;
          }
          this.popoverElement.style.top = `${top}px`;
          this.popoverElement.style.left = `${left}px`;
        }
handleMouseEnter() {
          this.show();
        }
handleMouseLeave() {
          this.hide();
        }
handleClick(event) {
          event.stopPropagation();
          this.toggle();
        }
handleFocus() {
          this.show();
        }
handleBlur() {
          this.hide();
        }
handleClickOutside(event) {
          if (!this.triggerElement.contains(event.target) && this.popoverElement && !this.popoverElement.contains(event.target)) {
            this.hide();
          }
        }
destroyPopover() {
          if (this.popoverElement && document.body.contains(this.popoverElement)) {
            document.body.removeChild(this.popoverElement);
            this.popoverElement = null;
          }
        }
destroy() {
          this.unbindEvents();
          this.destroyPopover();
          document.removeEventListener("click", this.handleClickOutside);
        }
      }
      class RightContainerController {
constructor() {
          this.popover = null;
          this.dropdownNameElement = null;
          this.unsubscribeSpeed = null;
          this.init = this.init.bind(this);
          this.findDropdownNameElement = this.findDropdownNameElement.bind(this);
          this.updateDropdownName = this.updateDropdownName.bind(this);
          this.createPopover = this.createPopover.bind(this);
          this.updatePopoverContent = this.updatePopoverContent.bind(this);
          this.calculateAndUpdateDuration = this.calculateAndUpdateDuration.bind(this);
          this.init();
        }
init() {
          this.setupObserver();
          this.findDropdownNameElement();
          this.subscribeToGlobalVariables();
          this.calculateAndUpdateDuration();
          console.log("RightContainerController 初始化完成");
        }
subscribeToGlobalVariables() {
          this.unsubscribeSpeed = globalVariables.subscribe("currentPageSpeed", () => {
            this.updatePopoverContent();
          });
        }
setupObserver() {
          this.findDropdownNameElement();
          domObserverManager.register(".bui-dropdown-name", () => {
            this.findDropdownNameElement();
          });
          domObserverManager.register(".stat-item.duration", () => {
            this.calculateAndUpdateDuration();
          });
        }
calculateAndUpdateDuration() {
          const totalSeconds = calculateTotalDuration();
          if (totalSeconds > 0) {
            globalVariables.totalDuration = totalSeconds;
            this.updateDropdownName();
            this.updatePopoverContent();
          }
        }
findDropdownNameElement() {
          const element = document.querySelector(".bui-dropdown-name");
          if (element && element !== this.dropdownNameElement) {
            this.dropdownNameElement = element;
            this.updateDropdownName();
            this.createPopover();
          }
        }
updateDropdownName() {
          if (!this.dropdownNameElement) return;
          const totalDurationText = formatSeconds(globalVariables.totalDuration);
          this.dropdownNameElement.textContent = totalDurationText;
          console.log("已更新 .bui-dropdown-name 为总时长:", totalDurationText);
        }
createPopover() {
          if (!this.dropdownNameElement) return;
          if (this.popover) {
            this.popover.destroy();
          }
          this.popover = new Popover(this.dropdownNameElement, {
            content: this.getPopoverContent(),
            placement: "bottom",
            offset: 8
          });
          console.log("已创建弹出框");
        }
getPopoverContent() {
          const totalDuration2 = formatSeconds(globalVariables.totalDuration);
          const watchedDuration2 = formatSeconds(globalVariables.watchedDuration);
          const remainingDuration2 = formatSeconds(globalVariables.remainingDuration);
          const currentSpeed = globalVariables.currentPageSpeed.toFixed(2) + "x";
          return `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="font-weight: bold; margin-bottom: 4px;">视频信息</div>
                <div style="display: flex; justify-content: space-between;">
                    <span>合集总时长:</span>
                    <span>${totalDuration2}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>已看时长:</span>
                    <span>${watchedDuration2}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>剩余时长:</span>
                    <span>${remainingDuration2}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>当前播放速度:</span>
                    <span>${currentSpeed}</span>
                </div>
            </div>
        `;
        }
updatePopoverContent() {
          if (this.popover) {
            this.popover.updateContent(this.getPopoverContent());
          }
        }
destroy() {
          if (this.unsubscribeSpeed) {
            this.unsubscribeSpeed();
            this.unsubscribeSpeed = null;
          }
          if (this.popover) {
            this.popover.destroy();
            this.popover = null;
          }
          domObserverManager.unregister(".bui-dropdown-name");
          domObserverManager.unregister(".stat-item.duration");
          console.log("RightContainerController 已销毁");
        }
      }
      class Toast {
constructor(options = {}) {
          this.message = options.message || "";
          this.duration = options.duration || 2e3;
          this.position = options.position || "center";
          this.element = null;
          this.timer = null;
        }
create() {
          const toast = document.createElement("div");
          toast.className = `toast toast-${this.position}`;
          toast.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.6);
            color: rgba(255, 255, 255, 0.9);
            font-size: 48px;
            font-weight: bold;
            padding: 20px 40px;
            border-radius: 12px;
            z-index: 1000;
            animation: speedToastFadeIn 0.3s ease-out, speedToastFadeOut 0.3s ease-out 1.7s;
            pointer-events: none;
            backdrop-filter: blur(10px);
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        `;
          toast.textContent = this.message;
          this.addAnimationStyles();
          this.element = toast;
          return toast;
        }
addAnimationStyles() {
          if (!document.getElementById("toast-animations")) {
            const style = document.createElement("style");
            style.id = "toast-animations";
            style.textContent = `
                @keyframes speedToastFadeIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.8);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }
                @keyframes speedToastFadeOut {
                    from {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.8);
                    }
                }
            `;
            document.head.appendChild(style);
          }
        }
show(container) {
          if (!container) return;
          if (!this.element) {
            this.create();
          }
          container.appendChild(this.element);
          this.timer = setTimeout(() => {
            this.hide();
          }, this.duration);
          return this;
        }
hide() {
          if (!this.element) return;
          if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
          }
          setTimeout(() => {
            if (this.element && this.element.parentNode) {
              this.element.parentNode.removeChild(this.element);
              this.element = null;
            }
          }, 300);
        }
static info(message, options = {}) {
          const toast = new Toast({ ...options, message });
          const container = toast.findVideoContainer();
          if (container) {
            toast.show(container);
          }
          return toast;
        }
findVideoContainer() {
          const normalContainer = document.querySelector(".bpx-player-video-wrap");
          if (normalContainer) {
            return normalContainer;
          }
          const miniContainer = document.querySelector(".bpx-player-mini-warp");
          if (miniContainer) {
            return miniContainer;
          }
          return null;
        }
      }
      class LeftContainerController {
constructor() {
          this.unsubscribeSpeed = null;
          this.init();
        }
init() {
          this.subscribeToGlobalVariables();
        }
subscribeToGlobalVariables() {
          this.unsubscribeSpeed = globalVariables.subscribe("currentPageSpeed", (speed) => {
            Toast.info(`${speed.toFixed(2)}x`, {
              duration: 2e3,
              position: "center"
            });
          });
        }
destroy() {
          if (this.unsubscribeSpeed) {
            this.unsubscribeSpeed();
          }
        }
      }
      let videoController = null;
      let rightContainerController = null;
      let leftContainerController = null;
      function initVideoSpeedController(options) {
        if (!videoController) {
          globalVariables.initGlobalVariables();
          videoController = new VideoSpeedController(options);
          rightContainerController = new RightContainerController();
          leftContainerController = new LeftContainerController();
        }
        return videoController;
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          initVideoSpeedController();
        });
      } else {
        initVideoSpeedController();
      }
      window.VideoSpeedController = VideoSpeedController;
      window.RightContainerController = RightContainerController;
      window.LeftContainerController = LeftContainerController;
      window.videoController = videoController;
      window.rightContainerController = rightContainerController;
      window.leftContainerController = leftContainerController;

    })
  };
}));

System.register("./card-DqbZNWO2-DCjoBVAn.js", ['./button-CSGNcTaj-CviXCN8B.js'], (function (exports, module) {
  'use strict';
  var Button;
  return {
    setters: [module => {
      Button = module.default;
    }],
    execute: (function () {

      class Card {
constructor(options = {}) {
          this.title = options.title || "";
          this.content = options.content || "";
          this.buttons = options.buttons || [];
          this.className = options.className || "";
          this.element = null;
        }
create() {
          const card = document.createElement("div");
          card.className = `card ${this.className}`;
          card.style.cssText = `
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            padding: 20px;
            max-width: 400px;
            margin: 0 auto;
            position: relative;
        `;
          if (this.title) {
            const titleElement = document.createElement("h3");
            titleElement.textContent = this.title;
            titleElement.style.cssText = `
                margin-top: 0;
                margin-bottom: 15px;
                color: #18191c;
                font-size: 16px;
                font-weight: bold;
            `;
            card.appendChild(titleElement);
          }
          if (this.content) {
            const contentElement = document.createElement("div");
            contentElement.innerHTML = this.content;
            contentElement.style.cssText = `
                margin-bottom: 20px;
                color: #61666d;
                font-size: 14px;
                line-height: 1.5;
            `;
            card.appendChild(contentElement);
          }
          if (this.buttons.length > 0) {
            const buttonContainer = document.createElement("div");
            buttonContainer.style.cssText = `
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            `;
            this.buttons.forEach((buttonConfig) => {
              const button = new Button(buttonConfig).create();
              buttonContainer.appendChild(button);
            });
            card.appendChild(buttonContainer);
          }
          this.element = card;
          return card;
        }
show(container = document.body) {
          if (!this.element) {
            this.create();
          }
          const overlay = document.createElement("div");
          overlay.className = "card-overlay";
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
          overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
              this.hide();
            }
          });
          overlay.appendChild(this.element);
          container.appendChild(overlay);
          this.overlay = overlay;
        }
hide() {
          if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
            this.overlay = null;
          }
        }
      } exports("default", Card);

    })
  };
}));

System.register("./button-CSGNcTaj-CviXCN8B.js", [], (function (exports, module) {
  'use strict';
  return {
    execute: (function () {

      class Button {
constructor(options = {}) {
          this.text = options.text || "按钮";
          this.onClick = options.onClick || null;
          this.type = options.type || "primary";
          this.className = options.className || "";
        }
create() {
          const button = document.createElement("button");
          button.textContent = this.text;
          button.className = `button ${this.type} ${this.className}`;
          const styles = {
            primary: {
              backgroundColor: "#00aeec",
              color: "white",
              border: "none"
            },
            secondary: {
              backgroundColor: "#f1f2f3",
              color: "#18191c",
              border: "1px solid #e5e6eb"
            },
            danger: {
              backgroundColor: "#f25d50",
              color: "white",
              border: "none"
            }
          };
          const style = styles[this.type] || styles.primary;
          button.style.cssText = `
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
            ${Object.entries(style).map(([prop, value]) => `${prop}: ${value};`).join(" ")}
        `;
          if (this.onClick) {
            button.addEventListener("click", this.onClick);
          }
          button.addEventListener("mouseenter", () => {
            button.style.opacity = "0.8";
          });
          button.addEventListener("mouseleave", () => {
            button.style.opacity = "1";
          });
          return button;
        }
      } exports("default", Button);

    })
  };
}));

System.import("./__entry.js", "./");