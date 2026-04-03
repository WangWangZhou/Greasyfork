// ==UserScript==
// @name         Bilibili自定义播放速度小助手
// @namespace    bilibili-speed-assistant
// @version      v0.0.1
// @author       小明
// @description  Bilibili自定义播放速度小助手,通过z,x,c控制播放速度
// @license      MIT
// @icon         chrome://favicon/https://www.bilibili.com
// @match        https://www.bilibili.com/video/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
  };
  const DEFAULT_CONFIG$1 = {
    enabled: false,
level: LogLevel.DEBUG,
showTimestamp: true,
showModule: true,
debugMode: false
};
  let config = { ...DEFAULT_CONFIG$1 };
  const moduleNames = {
    "speed": "倍速模块",
    "ad": "广告模块",
    "login": "免登录模块",
    "title": "标题简化模块",
    "control": "控制面板模块",
    "main": "主程序"
  };
  function formatTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
  function getModuleName(moduleKey) {
    return moduleNames[moduleKey] || moduleKey;
  }
  function buildPrefix(moduleKey, level) {
    const parts = [];
    if (config.showTimestamp) {
      parts.push(`[${formatTimestamp()}]`);
    }
    if (config.showModule && moduleKey) {
      parts.push(`[${getModuleName(moduleKey)}]`);
    }
    if (level) {
      parts.push(`[${level}]`);
    }
    return parts.join(" ");
  }
  function shouldLog(level) {
    if (!config.enabled) return false;
    return level >= config.level;
  }
  function log(moduleKey, level, levelValue, ...args) {
    if (!shouldLog(levelValue)) return;
    const prefix = buildPrefix(moduleKey, level);
    console.log(prefix, ...args);
  }
  function setConfig(newConfig) {
    config = { ...config, ...newConfig };
  }
  function getConfig() {
    return { ...config };
  }
  function enable() {
    config.enabled = true;
  }
  function disable() {
    config.enabled = false;
  }
  function setLevel(level) {
    config.level = level;
  }
  function setDebugMode(enabled) {
    config.debugMode = enabled;
  }
  function debug(moduleKey, ...args) {
    if (!config.debugMode) return;
    log(moduleKey, "DEBUG", LogLevel.DEBUG, ...args);
  }
  function info(moduleKey, ...args) {
    log(moduleKey, "INFO", LogLevel.INFO, ...args);
  }
  function warn(moduleKey, ...args) {
    log(moduleKey, "WARN", LogLevel.WARN, ...args);
  }
  function error(moduleKey, ...args) {
    log(moduleKey, "ERROR", LogLevel.ERROR, ...args);
  }
  function logMessage(moduleKey, ...args) {
    log(moduleKey, "LOG", LogLevel.INFO, ...args);
  }
  const logger = {
    setConfig,
    getConfig,
    enable,
    disable,
    setLevel,
    setDebugMode,
    debug,
    info,
    warn,
    error,
    log: logMessage,
    LogLevel
  };
  class VideoTipUI {
    constructor(options = {}) {
      this.options = {
        containerSelector: ".bpx-player-video-wrap, .bpx-player-mini-wrap",
        className: "bili-custom-speed-tip",
        tipDuration: 500,
        ...options
      };
      this.currentTip = null;
      this.hideTimer = null;
    }
findContainer() {
      const selectors = this.options.containerSelector.split(",");
      for (const selector of selectors) {
        const container = document.querySelector(selector.trim());
        if (container) return container;
      }
      return null;
    }
removeExistingTip() {
      const existingTip = document.querySelector(`.${this.options.className}`);
      if (existingTip) {
        existingTip.remove();
      }
      if (this.currentTip) {
        this.currentTip = null;
      }
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
    }
createTipElement(rate) {
      const container = this.findContainer();
      if (!container) return null;
      this.removeExistingTip();
      const tip = document.createElement("div");
      tip.className = this.options.className;
      tip.textContent = `${rate.toFixed(2)}x`;
      Object.assign(tip.style, {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        color: "#fff",
        fontSize: "2rem",
        fontWeight: "bold",
        padding: "12px 24px",
        borderRadius: "8px",
        fontFamily: "system-ui, sans-serif",
        zIndex: "9999",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
      });
      container.style.position = "relative";
      container.appendChild(tip);
      this.currentTip = tip;
      return tip;
    }
show(rate, duration) {
      const tipDuration = duration || this.options.tipDuration;
      const tip = this.createTipElement(rate);
      if (!tip) return false;
      this.hideTimer = setTimeout(() => {
        this.hide();
      }, tipDuration);
      return true;
    }
hide() {
      if (this.currentTip && this.currentTip.parentNode) {
        this.currentTip.remove();
      }
      this.currentTip = null;
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
    }
destroy() {
      this.hide();
    }
  }
  function throttle(func, delay) {
    let lastCall = 0;
    let timer = null;
    return function(...args) {
      const now = Date.now();
      const remaining = delay - (now - lastCall);
      if (remaining <= 0) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        lastCall = now;
        return func.apply(this, args);
      } else {
        if (!timer) {
          timer = setTimeout(() => {
            lastCall = Date.now();
            timer = null;
            return func.apply(this, args);
          }, remaining);
        }
      }
    };
  }
  const DEFAULT_CONFIG = {
step: 0.05,
minSpeed: 0.5,
maxSpeed: 4,
initialSpeed: 0,
keys: {
      reset: "z",
inc: "x",
dec: "c"
},
tipDuration: 500,
showTip: true,
debug: false
  };
  function isLivePage() {
    if (location.pathname.includes("/live/")) return true;
    const liveEl = document.querySelector(".live-player, .bpx-player-live");
    if (liveEl) return true;
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.videoData) {
      return window.__INITIAL_STATE__.videoData.is_live === true;
    }
    return false;
  }
  function getVideoElement() {
    return document.querySelector("video");
  }
  let tipUI = null;
  function showSpeedTip(rate, config2) {
    if (!config2.showTip) return;
    if (!tipUI) {
      tipUI = new VideoTipUI({
        tipDuration: config2.tipDuration
      });
    }
    tipUI.show(rate, config2.tipDuration);
  }
  function setPlaybackRate(rate, config2, fromUser = true) {
    const video = getVideoElement();
    if (!video) return video ? video.playbackRate : 1;
    let newRate = rate;
    if (newRate < config2.minSpeed) newRate = config2.minSpeed;
    if (newRate > config2.maxSpeed) newRate = config2.maxSpeed;
    newRate = Math.round(newRate * 100) / 100;
    if (video.playbackRate !== newRate) {
      video.playbackRate = newRate;
      if (fromUser && config2.showTip) {
        showSpeedTip(newRate, config2);
      }
    } else if (fromUser && config2.showTip) {
      showSpeedTip(newRate, config2);
    }
    return newRate;
  }
  function createKeydownHandler(config2) {
    const { keys, step } = config2;
    const throttledSetPlaybackRate = throttle((rate) => {
      setPlaybackRate(rate, config2, true);
    }, 500);
    return function onKeyDown(e) {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable);
      if (isInputActive) return;
      const key = e.key.toLowerCase();
      let video = getVideoElement();
      if (!video) return;
      let currentRate = video.playbackRate;
      let targetRate = null;
      if (key === keys.reset) {
        targetRate = 1;
      } else if (key === keys.inc) {
        targetRate = currentRate + step;
      } else if (key === keys.dec) {
        targetRate = currentRate - step;
      } else {
        return;
      }
      throttledSetPlaybackRate(targetRate);
      e.preventDefault();
      e.stopPropagation();
    };
  }
  function applyInitialSpeed(config2) {
    if (!config2.initialSpeed || config2.initialSpeed <= 0) return;
    const checkVideo = () => {
      const video = getVideoElement();
      if (video) {
        setPlaybackRate(config2.initialSpeed, config2, false);
        if (config2.debug) logger.debug("speed", `初始倍速已设置为 ${config2.initialSpeed}x`);
      } else {
        setTimeout(checkVideo, 200);
      }
    };
    checkVideo();
  }
  function init(userConfig = {}) {
    const config2 = { ...DEFAULT_CONFIG, ...userConfig };
    if (userConfig.keys) {
      config2.keys = { ...DEFAULT_CONFIG.keys, ...userConfig.keys };
    }
    if (isLivePage()) {
      if (config2.debug) logger.debug("speed", "检测到直播页面，已自动禁用");
      return { active: false, reason: "live_page" };
    }
    const keydownHandler = createKeydownHandler(config2);
    window.addEventListener("keydown", keydownHandler, true);
    applyInitialSpeed(config2);
    if (config2.debug) {
      logger.debug("speed", "已启用，配置：", {
        step: config2.step,
        minSpeed: config2.minSpeed,
        maxSpeed: config2.maxSpeed,
        initialSpeed: config2.initialSpeed || "未设置",
        keys: config2.keys,
        tipDuration: config2.tipDuration
      });
    }
    return {
      active: true,
      setSpeed: (rate, showTip = true) => setPlaybackRate(rate, config2, showTip),
      getSpeed: () => {
        const v = getVideoElement();
        return v ? v.playbackRate : 1;
      },
      destroy: () => {
        window.removeEventListener("keydown", keydownHandler, true);
        if (tipUI) {
          tipUI.destroy();
          tipUI = null;
        }
        if (config2.debug) logger.debug("speed", "已销毁");
      }
    };
  }
  const videoSpeedModule = { init };
  const DEFAULT_SELECTORS = [
    ".video-card-ad-small",
    ".right-bottom-banner"
  ];
  function hideAds(selectors = DEFAULT_SELECTORS) {
    let hiddenCount = 0;
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (el.style.display !== "none") {
          el.style.display = "none";
          hiddenCount++;
        }
      });
    }
    return hiddenCount;
  }
  function initAdBlocker(selectors = DEFAULT_SELECTORS, options = {}) {
    const {
      immediate = true,
      targetNode = document.body
    } = options;
    if (immediate) {
      hideAds(selectors);
    }
    const observer = new MutationObserver((mutations) => {
      let needHide = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          needHide = true;
          break;
        }
      }
      if (needHide) {
        hideAds(selectors);
      }
    });
    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
    return observer;
  }
  const CLOSE_SELECTOR = ".bili-mini-close-icon";
  const LIMIT_MASK_SELECTOR = "#limit-mask";
  function removeLimitMask() {
    const limitMasks = document.querySelectorAll(LIMIT_MASK_SELECTOR);
    let removedCount = 0;
    limitMasks.forEach((mask) => {
      if (mask && mask.parentNode) {
        mask.remove();
        removedCount++;
      }
    });
    if (removedCount > 0) {
      logger.log("login", `已移除 ${removedCount} 个限制遮罩层`);
    }
    return removedCount;
  }
  function closeLoginModal() {
    const closeButtons = document.querySelectorAll(CLOSE_SELECTOR);
    let clickedCount = 0;
    closeButtons.forEach((btn) => {
      if (btn && typeof btn.click === "function") {
        btn.click();
        clickedCount++;
      }
    });
    if (clickedCount > 0) {
      logger.log("login", `已关闭 ${clickedCount} 个登录弹窗`);
    }
    removeLimitMask();
    return clickedCount;
  }
  function keepLoginModalClosed(options = {}) {
    const {
      immediate = true,
      targetNode = document.body
    } = options;
    if (immediate) {
      closeLoginModal();
    }
    const observer = new MutationObserver((mutations) => {
      let hasAddedNodes = mutations.some((mutation) => mutation.addedNodes.length > 0);
      if (hasAddedNodes) {
        closeLoginModal();
      }
    });
    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
    logger.log("login", "已启动监听，将自动关闭登录弹窗");
    return observer;
  }
  function trimLeadingNumberAndDelimiter(str) {
    const regex = /^\d+(\s+|\-|\-\s+|\s+\-)/;
    return str.replace(regex, "");
  }
  function extractNumberPrefix(str) {
    const regex = /^\d+(\s+|\-|\-\s+|\s+\-)/;
    const match = str.match(regex);
    return match ? match[0] : "";
  }
  function longestCommonPrefix(strs) {
    if (!strs.length) return "";
    let prefix = strs[0];
    for (let i = 1; i < strs.length; i++) {
      while (strs[i].indexOf(prefix) !== 0) {
        prefix = prefix.slice(0, -1);
        if (prefix === "") return "";
      }
    }
    return prefix;
  }
  function randomSample(arr, n) {
    if (n > arr.length) n = arr.length;
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, n);
  }
  function simplifyTitles(options = {}) {
    const {
      elements: providedElements,
      selector = ".title-txt",
      minCount = 10,
      minAvgLength = 15,
      sampleSize = 3,
      debug: debug2 = false
    } = options;
    let titleElements;
    if (providedElements) {
      titleElements = Array.from(providedElements);
    } else {
      titleElements = Array.from(document.querySelectorAll(selector));
    }
    const totalCount = titleElements.length;
    if (debug2) logger.debug("title", `找到 ${totalCount} 个标题元素`);
    if (totalCount < minCount) {
      if (debug2) logger.debug("title", `视频数量 ${totalCount} < ${minCount}，不启动功能`);
      return { simplified: false, count: totalCount, avgLength: 0, commonPrefix: "", modifiedCount: 0 };
    }
    const originalTitles = titleElements.map((el) => el.textContent.trim());
    const totalLength = originalTitles.reduce((sum, t) => sum + t.length, 0);
    const avgLength = totalLength / totalCount;
    if (debug2) logger.debug("title", `平均标题长度: ${avgLength.toFixed(2)}`);
    if (avgLength < minAvgLength) {
      if (debug2) logger.debug("title", `平均长度 ${avgLength.toFixed(2)} < ${minAvgLength}，不启动功能`);
      return { simplified: false, count: totalCount, avgLength, commonPrefix: "", modifiedCount: 0 };
    }
    const processedTitles = originalTitles.map((title) => trimLeadingNumberAndDelimiter(title));
    const samples = randomSample(processedTitles, sampleSize);
    if (debug2) logger.debug("title", "随机样本:", samples);
    const commonPrefix = longestCommonPrefix(samples);
    if (!commonPrefix) {
      if (debug2) logger.debug("title", "未检测到公共前缀，不进行简化");
      return { simplified: false, count: totalCount, avgLength, commonPrefix: "", modifiedCount: 0 };
    }
    if (debug2) logger.debug("title", `检测到公共前缀: "${commonPrefix}"`);
    let modifiedCount = 0;
    titleElements.forEach((element, idx) => {
      const original = originalTitles[idx];
      const processed = processedTitles[idx];
      let individualPart = processed;
      if (processed.startsWith(commonPrefix)) {
        individualPart = processed.slice(commonPrefix.length);
      }
      const numberPrefix = extractNumberPrefix(original);
      let newTitle = numberPrefix + individualPart;
      if (!newTitle.trim()) {
        newTitle = original;
      }
      if (element.textContent !== newTitle) {
        element.textContent = newTitle;
        modifiedCount++;
        if (debug2 && modifiedCount <= 5) logger.debug("title", `"${original}" → "${newTitle}"`);
      }
    });
    if (debug2) logger.debug("title", `完成，共修改 ${modifiedCount} 个标题`);
    return {
      simplified: true,
      count: totalCount,
      avgLength,
      commonPrefix,
      modifiedCount
    };
  }
  function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    } else {
      return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
  }
  function calculateTotalDuration() {
    let totalDuration = 0;
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.videoData) {
      const pages = window.__INITIAL_STATE__.videoData.pages;
      if (Array.isArray(pages)) {
        pages.forEach((page) => {
          if (page && typeof page.duration === "number") {
            totalDuration += page.duration;
          }
        });
      }
    }
    return totalDuration;
  }
  function getRemainingTime() {
    let remainingTime = 0;
    const video = document.querySelector("video");
    if (video) {
      remainingTime = video.duration - video.currentTime;
    }
    return remainingTime;
  }
  class ProgressBar {
    constructor(options = {}) {
      this.options = {
        height: "4px",
        backgroundColor: "rgba(0, 0, 0, 0.1)",
        progressColor: "#1E88E5",
        borderRadius: "2px",
        ...options
      };
      this.container = null;
      this.progressFill = null;
      this.progressText = null;
    }
    create() {
      const container = document.createElement("div");
      container.className = "video-progress-container";
      container.style.cssText = `
            width: 100%;
            height: ${this.options.height};
            background-color: ${this.options.backgroundColor};
            border-radius: ${this.options.borderRadius};
            overflow: hidden;
            position: relative;
        `;
      this.progressFill = document.createElement("div");
      this.progressFill.className = "video-progress-fill";
      this.progressFill.style.cssText = `
            height: 100%;
            width: 0%;
            background-color: ${this.options.progressColor};
            transition: width 0.3s ease;
        `;
      this.progressText = document.createElement("div");
      this.progressText.className = "video-progress-text";
      this.progressText.style.cssText = `
            display: none;
        `;
      container.appendChild(this.progressFill);
      container.appendChild(this.progressText);
      this.container = container;
      return container;
    }
    update(percentage, text) {
      if (this.progressFill) {
        this.progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
      }
      if (this.progressText) {
        this.progressText.textContent = text || "";
      }
    }
    destroy() {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
      this.progressFill = null;
      this.progressText = null;
    }
  }
  class VideoInfoPanel {
    constructor(options = {}) {
      this.options = {
        containerSelector: "#danmukuBox",
        ...options
      };
      this.container = null;
      this.panelElement = null;
      this.headerElement = null;
      this.bodyElement = null;
      this.footElement = null;
      this.progressBar = null;
      this.videoElement = null;
      this.updateInterval = null;
      this.styles = {
        width: "411px",
        backgroundColor: "#F9F9F9",
        fontSize: "16px",
        fontFamily: "system-ui, sans-serif"
      };
    }
    getStylesFromDanmakuBox() {
      const danmakuBox = document.querySelector(this.options.containerSelector);
      if (danmakuBox) {
        const computedStyle = getComputedStyle(danmakuBox);
        this.styles = {
          width: computedStyle.width || "411px",
          backgroundColor: "#F9F9F9",
          fontSize: computedStyle.fontSize || "16px",
          fontFamily: computedStyle.fontFamily || "system-ui, sans-serif"
        };
      }
    }
    createPanel() {
      const panel = document.createElement("div");
      panel.className = "video-info-display-panel";
      panel.style.cssText = `
            width: ${this.styles.width};
            background-color: ${this.styles.backgroundColor};
            border-radius: 8px;
            padding: 12px;
            font-family: ${this.styles.fontFamily};
            font-size: ${this.styles.fontSize};
            color: #000000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: ${this.styles.zIndex || "1000"};
            position: ${this.styles.position || "relative"};
            top: ${this.styles.top || "auto"};
            left: ${this.styles.left || "auto"};
        `;
      this.panelElement = panel;
      return panel;
    }
    createHeader() {
      const header = document.createElement("div");
      header.className = "video-info-header";
      header.style.cssText = `
            font-weight: bold;
            font-size: 18px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(0,0,0,0.1);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
      header.innerHTML = `
            <span>📊</span>
            <span>视频信息</span>
        `;
      this.headerElement = header;
      return header;
    }
    createBody() {
      const body = document.createElement("div");
      body.className = "video-info-body";
      body.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
        `;
      body.innerHTML = `
            <div class="info-row info-labels">
                <span class="info-label">⏳ 剩余时长</span>
                <span class="info-label">📅 总时长</span>
                <span class="info-label">⚡ 倍速</span>
            </div>
            <div class="info-row info-values">
                <span class="info-value" id="remainingTime">--:--</span>
                <span class="info-value" id="totalTime">--:--</span>
                <span class="info-value" id="playbackSpeed">1.00x</span>
            </div>
        `;
      const style = document.createElement("style");
      style.textContent = `
            .info-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .info-labels {
                opacity: 0.7;
                font-size: 14px;
            }
            .info-values {
                font-weight: 500;
                font-family: monospace;
                font-size: 16px;
            }
            .info-row > span {
                flex: 1;
                text-align: center;
            }
        `;
      body.appendChild(style);
      this.bodyElement = body;
      return body;
    }
    createFoot() {
      const foot = document.createElement("div");
      foot.className = "video-info-foot";
      foot.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
        `;
      const progressBar = new ProgressBar({
        height: "6px",
        backgroundColor: "rgba(0,0,0,0.1)",
        progressColor: "#1E88E5"
      });
      this.progressBar = progressBar;
      foot.appendChild(progressBar.create());
      this.footElement = foot;
      return foot;
    }
    getVideoElement() {
      return document.querySelector("video");
    }
    getTotalDuration() {
      return calculateTotalDuration();
    }
    updateRemainingTime() {
      if (!this.bodyElement) return;
      const remaining = getRemainingTime() || 0;
      const remainingSpan = this.bodyElement.querySelector("#remainingTime");
      if (remainingSpan) {
        remainingSpan.textContent = formatTime(remaining);
      }
    }
    updateTotalTime() {
      if (!this.bodyElement) return;
      const total = this.getTotalDuration();
      const totalSpan = this.bodyElement.querySelector("#totalTime");
      if (totalSpan) {
        totalSpan.textContent = formatTime(total);
      }
    }
    updatePlaybackSpeed() {
      if (!this.videoElement || !this.bodyElement) return;
      const speed = this.videoElement.playbackRate || 1;
      const speedSpan = this.bodyElement.querySelector("#playbackSpeed");
      if (speedSpan) {
        speedSpan.textContent = `${speed.toFixed(2)}x`;
      }
    }
    updateProgress() {
      if (!this.videoElement || !this.progressBar) return;
      const duration = this.videoElement.duration || 0;
      const currentTime = this.videoElement.currentTime || 0;
      if (duration > 0) {
        const percentage = currentTime / duration * 100;
        const remaining = getRemainingTime();
        const text = `${Math.floor(percentage)}% (-${formatTime(remaining)})`;
        this.progressBar.update(percentage, text);
      }
    }
    updateAll() {
      this.updateRemainingTime();
      this.updateTotalTime();
      this.updatePlaybackSpeed();
      this.updateProgress();
    }
    bindVideoEvents() {
      if (!this.videoElement) return;
      const handler = {
        timeupdate: () => {
          this.updateRemainingTime();
          this.updateProgress();
        },
        ratechange: () => {
          this.updatePlaybackSpeed();
        },
        loadedmetadata: () => {
          this.updateTotalTime();
          this.updateAll();
        }
      };
      this._eventHandlers = handler;
      this.videoElement.addEventListener("timeupdate", handler.timeupdate);
      this.videoElement.addEventListener("ratechange", handler.ratechange);
      this.videoElement.addEventListener("loadedmetadata", handler.loadedmetadata);
    }
    unbindVideoEvents() {
      if (!this.videoElement || !this._eventHandlers) return;
      this.videoElement.removeEventListener("timeupdate", this._eventHandlers.timeupdate);
      this.videoElement.removeEventListener("ratechange", this._eventHandlers.ratechange);
      this.videoElement.removeEventListener("loadedmetadata", this._eventHandlers.loadedmetadata);
      this._eventHandlers = null;
    }
    startAutoUpdate() {
      this.stopAutoUpdate();
      this.updateInterval = setInterval(() => {
        const currentVideo = this.getVideoElement();
        if (currentVideo !== this.videoElement) {
          this.unbindVideoEvents();
          this.videoElement = currentVideo;
          if (this.videoElement) {
            this.bindVideoEvents();
          }
        }
        this.updateAll();
      }, 500);
    }
    stopAutoUpdate() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    }
    initialize(container) {
      if (!container) {
        console.warn("[视频信息面板] 容器元素不存在");
        return false;
      }
      this.getStylesFromDanmakuBox();
      const danmakuWrap = document.querySelector(".danmaku-wrap");
      if (danmakuWrap) {
        const wrapRect = danmakuWrap.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = wrapRect.top - containerRect.top;
        const relativeLeft = wrapRect.left - containerRect.left;
        this.styles.width = `${wrapRect.width}px`;
        this.styles.position = "absolute";
        this.styles.top = `${relativeTop}px`;
        this.styles.left = `${relativeLeft}px`;
        this.styles.zIndex = "1000";
      }
      this.container = container;
      const panel = this.createPanel();
      panel.appendChild(this.createHeader());
      panel.appendChild(this.createBody());
      panel.appendChild(this.createFoot());
      this.videoElement = this.getVideoElement();
      if (this.videoElement) {
        this.bindVideoEvents();
        this.updateAll();
      }
      this.startAutoUpdate();
      container.appendChild(panel);
      return true;
    }
    destroy() {
      this.stopAutoUpdate();
      this.unbindVideoEvents();
      if (this.progressBar) {
        this.progressBar.destroy();
        this.progressBar = null;
      }
      if (this.panelElement && this.panelElement.parentNode) {
        this.panelElement.parentNode.removeChild(this.panelElement);
      }
      this.container = null;
      this.panelElement = null;
      this.headerElement = null;
      this.bodyElement = null;
      this.footElement = null;
      this.videoElement = null;
    }
  }
  function initVideoInfoDisplay(options = {}) {
    let panel = null;
    let observer = null;
    let currentContainer = null;
    function createPanel(container) {
      if (!container) return null;
      if (currentContainer === container && panel) {
        return panel;
      }
      if (panel) {
        panel.destroy();
      }
      const newPanel = new VideoInfoPanel(options);
      const success = newPanel.initialize(container);
      if (success) {
        currentContainer = container;
        return newPanel;
      }
      return null;
    }
    function init2() {
      const container = document.querySelector("#danmukuBox");
      if (container) {
        panel = createPanel(container);
      } else {
        if (currentContainer) {
          if (panel) {
            panel.destroy();
            panel = null;
          }
          currentContainer = null;
        }
      }
    }
    function startObserver() {
      if (observer) observer.disconnect();
      observer = new MutationObserver(() => {
        init2();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    init2();
    startObserver();
    window.addEventListener("popstate", () => {
      setTimeout(init2, 200);
    });
    return panel;
  }
  function initSpeedModule() {
    const speedInstance = videoSpeedModule.init({
      step: 0.05,
      minSpeed: 0.5,
      maxSpeed: 4,
      initialSpeed: 0,
      keys: {
        reset: "z",
        inc: "x",
        dec: "c"
      },
      tipDuration: 500,
      showTip: true,
      debug: false
    });
    if (speedInstance.active) {
      logger.log("main", "[倍速模块] 已启用");
    } else {
      logger.log("main", "[倍速模块]", speedInstance.reason === "live_page" ? "直播页面，已禁用" : "未启用");
    }
  }
  function initAdModule() {
    initAdBlocker(
      [
        ".video-card-ad-small",
        ".right-bottom-banner"
      ],
      {
        immediate: true,
        targetNode: document.body
      }
    );
    logger.log("main", "[广告屏蔽模块] 已启动");
  }
  function initLoginModule() {
    keepLoginModalClosed({
      immediate: true,
      targetNode: document.body
    });
    logger.log("main", "[免登录模块] 已启动");
  }
  function initTitleModule() {
    const result = simplifyTitles({
      selector: ".title-txt",
      minCount: 10,
      minAvgLength: 15,
      sampleSize: 3,
      debug: false
    });
    if (result.simplified) {
      logger.log("main", `[标题简化模块] 已简化 ${result.modifiedCount} 个标题，公共前缀: "${result.commonPrefix}"`);
    } else {
      logger.log("main", "[标题简化模块] 未执行简化", result.count < 10 ? "(视频数量不足)" : "(平均长度不足)");
    }
  }
  function initialize() {
    logger.log("main", "=".repeat(50));
    logger.log("main", "Bilibili 自定义播放速度小助手 - 初始化中...");
    logger.log("main", "=".repeat(50));
    try {
      initSpeedModule();
    } catch (error2) {
      logger.error("main", "[倍速模块] 初始化失败:", error2);
    }
    try {
      initAdModule();
    } catch (error2) {
      logger.error("main", "[广告屏蔽模块] 初始化失败:", error2);
    }
    try {
      initLoginModule();
    } catch (error2) {
      logger.error("main", "[免登录模块] 初始化失败:", error2);
    }
    try {
      initTitleModule();
    } catch (error2) {
      logger.error("main", "[标题简化模块] 初始化失败:", error2);
    }
    try {
      initVideoInfoDisplay();
    } catch (error2) {
      logger.error("main", "[视频信息面板模块] 初始化失败:", error2);
    }
    logger.log("main", "=".repeat(50));
    logger.log("main", "Bilibili 自定义播放速度小助手 - 初始化完成");
    logger.log("main", "=".repeat(50));
  }
  initialize();

})();