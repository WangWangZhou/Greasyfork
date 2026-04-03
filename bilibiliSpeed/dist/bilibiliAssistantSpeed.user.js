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
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
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
  const DEFAULT_CONFIG$2 = {
    enabled: false,
level: LogLevel.DEBUG,
showTimestamp: true,
showModule: true,
debugMode: false
};
  let config = { ...DEFAULT_CONFIG$2 };
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
  const DEFAULT_OPTIONS = {
updateInterval: 250,
showTitle: true,
style: {
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      color: "#fff",
      fontSize: "14px",
      fontFamily: "system-ui, sans-serif",
      padding: "8px 12px",
      borderRadius: "8px",
      position: "absolute",
      top: "10px",
      right: "10px",
      zIndex: "1000",
      backdropFilter: "blur(4px)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
    }
  };
  function getTotalDuration() {
    let total = 0;
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.videoData) {
      const pages = window.__INITIAL_STATE__.videoData.pages;
      if (Array.isArray(pages)) {
        pages.forEach((page) => {
          if (page && typeof page.duration === "number") {
            total += page.duration;
          }
        });
      }
    }
    return total;
  }
  function createPanelElement(options) {
    const panel = document.createElement("div");
    panel.className = "video-info-panel";
    const styles = options.style;
    Object.assign(panel.style, styles);
    panel.style.position = styles.position || "absolute";
    let html = "";
    if (options.showTitle) {
      html += '<div style="font-weight:bold; margin-bottom:4px;">📊 视频信息</div>';
    }
    html += `
        <div>⏱️ 剩余: <span class="video-remaining">--:--</span></div>
        <div>📅 总长: <span class="video-total">--:--</span></div>
        <div>⚡ 速度: <span class="video-speed">1.00</span>x</div>
    `;
    panel.innerHTML = html;
    return panel;
  }
  function updateRemainingTime(panel, video) {
    if (!video || !panel) return;
    const remaining = video.duration - video.currentTime;
    const remainingFormatted = formatTime(remaining > 0 ? remaining : 0);
    const remainingSpan = panel.querySelector(".video-remaining");
    if (remainingSpan) remainingSpan.textContent = remainingFormatted;
  }
  function updateTotalDuration(panel) {
    const total = getTotalDuration();
    const totalFormatted = formatTime(total);
    const totalSpan = panel.querySelector(".video-total");
    if (totalSpan) totalSpan.textContent = totalFormatted;
  }
  function updatePlaybackRate(panel, video) {
    if (!video || !panel) return;
    const rate = video.playbackRate;
    const speedSpan = panel.querySelector(".video-speed");
    if (speedSpan) speedSpan.textContent = rate.toFixed(2);
  }
  function waitForElement(selector, timeout = 1e4) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);
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
        reject(new Error(`等待元素 ${selector} 超时`));
      }, timeout);
    });
  }
  async function init$1(userOptions = {}) {
    const options = { ...DEFAULT_OPTIONS, ...userOptions };
    if (userOptions.style) {
      options.style = { ...DEFAULT_OPTIONS.style, ...userOptions.style };
    }
    let danmakuContainer;
    try {
      danmakuContainer = await waitForElement(".danmaku-wrap", 15e3);
    } catch (err) {
      console.warn("[视频信息面板] 未找到 .danmaku-wrap，无法显示面板");
      return { destroy: () => {
      }, update: () => {
      } };
    }
    if (getComputedStyle(danmakuContainer).position === "static") {
      danmakuContainer.style.position = "relative";
    }
    const panel = createPanelElement(options);
    danmakuContainer.appendChild(panel);
    let video = document.querySelector("video");
    if (!video) {
      try {
        video = await waitForElement("video", 1e4);
      } catch (err) {
        console.warn("[视频信息面板] 未找到 video 元素，面板将无数据");
        panel.remove();
        return { destroy: () => {
        }, update: () => {
        } };
      }
    }
    updateTotalDuration(panel);
    const onTimeUpdate = () => updateRemainingTime(panel, video);
    const onRateChange = () => updatePlaybackRate(panel, video);
    const onLoadedMetadata = () => {
      updateTotalDuration(panel);
      updateRemainingTime(panel, video);
      updatePlaybackRate(panel, video);
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ratechange", onRateChange);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    onLoadedMetadata();
    let intervalId = setInterval(() => {
      if (video && video.duration && !isNaN(video.duration)) {
        updateRemainingTime(panel, video);
        updatePlaybackRate(panel, video);
      }
    }, options.updateInterval);
    const videoObserver = new MutationObserver(() => {
      const newVideo = document.querySelector("video");
      if (newVideo && newVideo !== video) {
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("ratechange", onRateChange);
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video = newVideo;
        video.addEventListener("timeupdate", onTimeUpdate);
        video.addEventListener("ratechange", onRateChange);
        video.addEventListener("loadedmetadata", onLoadedMetadata);
        onLoadedMetadata();
      }
    });
    videoObserver.observe(document.body, { childList: true, subtree: true });
    const destroy = () => {
      clearInterval(intervalId);
      videoObserver.disconnect();
      if (video) {
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("ratechange", onRateChange);
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
      }
      if (panel && panel.parentNode) panel.remove();
    };
    const update = () => {
      if (video) {
        updateRemainingTime(panel, video);
        updateTotalDuration(panel);
        updatePlaybackRate(panel, video);
      }
    };
    return { destroy, update };
  }
  const DEFAULT_CONFIG$1 = {
step: 0.05,
minSpeed: 0.125,
maxSpeed: 16,
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
  var totalSec = 0;
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
  function showSpeedTip(rate, config2) {
    if (!config2.showTip) return;
    const container = document.querySelector(".bpx-player-video-wrap") || document.querySelector(".bpx-player-mini-wrap");
    if (!container) return;
    const existingTip = document.querySelector(".bili-custom-speed-tip");
    if (existingTip) existingTip.remove();
    const tip = document.createElement("div");
    tip.className = "bili-custom-speed-tip";
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
    setTimeout(() => {
      if (tip.parentNode) tip.remove();
    }, config2.tipDuration);
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
      setPlaybackRate(targetRate, config2, true);
      e.preventDefault();
      e.stopPropagation();
    };
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
  function displayMessage() {
    const target = document.querySelector(".bui-dropdown-name");
    if (!target) return;
    totalSec = calculateTotalDuration();
    if (totalSec === 0) return;
    const formatted = formatTime(totalSec);
    target.textContent = formatted;
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
    const config2 = { ...DEFAULT_CONFIG$1, ...userConfig };
    if (userConfig.keys) {
      config2.keys = { ...DEFAULT_CONFIG$1.keys, ...userConfig.keys };
    }
    if (isLivePage()) {
      if (config2.debug) logger.debug("speed", "检测到直播页面，已自动禁用");
      return { active: false, reason: "live_page" };
    }
    const keydownHandler = createKeydownHandler(config2);
    window.addEventListener("keydown", keydownHandler, true);
    const tryDisplayDuration = () => {
      if (document.querySelector(".bui-dropdown-name")) {
        displayMessage();
        init$1();
      } else {
        setTimeout(tryDisplayDuration, 500);
      }
    };
    tryDisplayDuration();
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
        if (config2.debug) logger.debug("speed", "已销毁");
      }
    };
  }
  const speedModule = { init };
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
  const adModule = { hideAds, initAdBlocker };
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
  const loginModule = { closeLoginModal, keepLoginModalClosed, removeLimitMask };
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
  const DEFAULT_CONFIG = {
speed: {
      step: 0.05,
      minSpeed: 0.125,
      maxSpeed: 16,
      initialSpeed: 0,
      keys: {
        reset: "z",
        inc: "x",
        dec: "c"
      },
      tipDuration: 500,
      showTip: true
    },
switches: {
      adBlock: true,
noLogin: true,
simplifyTitle: false
}
  };
  function saveConfig(config2) {
    if (typeof GM_setValue !== "undefined") {
      GM_setValue("biliHelperConfig", JSON.stringify(config2));
    } else {
      localStorage.setItem("biliHelperConfig", JSON.stringify(config2));
    }
  }
  function loadConfig() {
    let raw = null;
    if (typeof GM_getValue !== "undefined") {
      raw = GM_getValue("biliHelperConfig");
    } else {
      raw = localStorage.getItem("biliHelperConfig");
    }
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        return mergeDeep(DEFAULT_CONFIG, saved);
      } catch (e) {
      }
    }
    return { ...DEFAULT_CONFIG };
  }
  function mergeDeep(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        result[key] = mergeDeep(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  let panelElement = null;
  let currentConfig = null;
  let speedController = null;
  let adObserver = null;
  let loginObserver = null;
  let modules = {};
  function applySpeedConfig(config2) {
    if (speedController && speedController.destroy) {
      speedController.destroy();
    }
    const speedModule2 = modules.speedModule;
    if (speedModule2 && speedModule2.init) {
      speedController = speedModule2.init(config2);
    }
  }
  function applyAdBlock(enabled) {
    const adModule2 = modules.adModule;
    if (!adModule2) return;
    if (enabled) {
      if (!adObserver) {
        adObserver = adModule2.initAdBlocker ? adModule2.initAdBlocker() : null;
      }
    } else {
      if (adObserver && adObserver.disconnect) {
        adObserver.disconnect();
        adObserver = null;
      }
    }
  }
  function applyNoLogin(enabled) {
    const loginModule2 = modules.loginModule;
    if (!loginModule2) return;
    if (enabled) {
      if (!loginObserver) {
        loginObserver = loginModule2.keepLoginModalClosed ? loginModule2.keepLoginModalClosed() : null;
      }
    } else {
      if (loginObserver && loginObserver.disconnect) {
        loginObserver.disconnect();
        loginObserver = null;
      }
    }
  }
  function applySimplifyTitle(enabled) {
    const titleModule = modules.titleModule;
    if (!titleModule || !titleModule.simplifyTitles) return;
    if (enabled) {
      titleModule.simplifyTitles({ debug: false });
    }
  }
  function applyAllConfig() {
    const speedConf = currentConfig.speed;
    applySpeedConfig(speedConf);
    applyAdBlock(currentConfig.switches.adBlock);
    applyNoLogin(currentConfig.switches.noLogin);
    applySimplifyTitle(currentConfig.switches.simplifyTitle);
  }
  function createPanel() {
    if (panelElement) {
      panelElement.style.display = "flex";
      return;
    }
    const panel = document.createElement("div");
    panel.id = "bili-helper-panel";
    panel.innerHTML = `
        <div class="panel-header" style="cursor: move; background:#2c3e50; padding:8px; color:white; border-radius:8px 8px 0 0;">
            B站小助手设置
            <button id="closePanel" style="float:right; background:none; border:none; color:white; cursor:pointer;">✕</button>
        </div>
        <div class="panel-body" style="padding:12px;">
            <h4>🎬 倍速控制</h4>
            <label>步进值: <input type="number" id="step" step="0.01" min="0.01" style="width:70px;"></label><br>
            <label>最小倍速: <input type="number" id="minSpeed" step="0.01" min="0" style="width:70px;"></label>
            <label>最大倍速: <input type="number" id="maxSpeed" step="0.01" min="0.125" style="width:70px;"></label><br>
            <label>初始倍速: <input type="number" id="initialSpeed" step="0.01" min="0" style="width:70px;"> (0=不设置)</label><br>
            <label>恢复1x按键: <input type="text" id="keyReset" maxlength="1" style="width:40px;"></label>
            <label>加速按键: <input type="text" id="keyInc" maxlength="1" style="width:40px;"></label>
            <label>减速按键: <input type="text" id="keyDec" maxlength="1" style="width:40px;"></label><br>
            <label>提示时长(ms): <input type="number" id="tipDuration" step="50" min="0" style="width:70px;"></label>
            <label><input type="checkbox" id="showTip"> 显示倍速提示</label>
            <hr>
            <h4>🔧 辅助功能</h4>
            <label><input type="checkbox" id="adBlockSwitch"> 屏蔽广告</label><br>
            <label><input type="checkbox" id="noLoginSwitch"> 自动关闭登录弹窗</label><br>
            <label><input type="checkbox" id="titleSwitch"> 简化视频标题（需刷新页面生效）</label>
            <hr>
            <button id="saveConfigBtn" style="background:#3498db; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">保存设置</button>
            <button id="resetDefaultBtn" style="margin-left:8px; background:#95a5a6; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">恢复默认</button>
        </div>
    `;
    Object.assign(panel.style, {
      position: "fixed",
      top: "100px",
      left: "100px",
      width: "300px",
      backgroundColor: "#ecf0f1",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      zIndex: "10000",
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      display: "flex",
      flexDirection: "column"
    });
    document.body.appendChild(panel);
    panelElement = panel;
    function fillForm() {
      const s = currentConfig.speed;
      document.getElementById("step").value = s.step;
      document.getElementById("minSpeed").value = s.minSpeed;
      document.getElementById("maxSpeed").value = s.maxSpeed;
      document.getElementById("initialSpeed").value = s.initialSpeed;
      document.getElementById("keyReset").value = s.keys.reset;
      document.getElementById("keyInc").value = s.keys.inc;
      document.getElementById("keyDec").value = s.keys.dec;
      document.getElementById("tipDuration").value = s.tipDuration;
      document.getElementById("showTip").checked = s.showTip;
      document.getElementById("adBlockSwitch").checked = currentConfig.switches.adBlock;
      document.getElementById("noLoginSwitch").checked = currentConfig.switches.noLogin;
      document.getElementById("titleSwitch").checked = currentConfig.switches.simplifyTitle;
    }
    function readForm() {
      const newConfig = {
        speed: {
          step: parseFloat(document.getElementById("step").value),
          minSpeed: parseFloat(document.getElementById("minSpeed").value),
          maxSpeed: parseFloat(document.getElementById("maxSpeed").value),
          initialSpeed: parseFloat(document.getElementById("initialSpeed").value),
          keys: {
            reset: document.getElementById("keyReset").value || "z",
            inc: document.getElementById("keyInc").value || "x",
            dec: document.getElementById("keyDec").value || "c"
          },
          tipDuration: parseInt(document.getElementById("tipDuration").value),
          showTip: document.getElementById("showTip").checked
        },
        switches: {
          adBlock: document.getElementById("adBlockSwitch").checked,
          noLogin: document.getElementById("noLoginSwitch").checked,
          simplifyTitle: document.getElementById("titleSwitch").checked
        }
      };
      if (isNaN(newConfig.speed.step)) newConfig.speed.step = 0.05;
      if (isNaN(newConfig.speed.minSpeed)) newConfig.speed.minSpeed = 0.125;
      if (isNaN(newConfig.speed.maxSpeed)) newConfig.speed.maxSpeed = 16;
      if (isNaN(newConfig.speed.initialSpeed)) newConfig.speed.initialSpeed = 0;
      if (newConfig.speed.minSpeed < 0) newConfig.speed.minSpeed = 0.125;
      if (newConfig.speed.maxSpeed < newConfig.speed.minSpeed) newConfig.speed.maxSpeed = newConfig.speed.minSpeed + 1;
      return newConfig;
    }
    function saveAndApply() {
      const newConfig = readForm();
      currentConfig = newConfig;
      saveConfig(currentConfig);
      applyAllConfig();
      if (newConfig.switches.simplifyTitle) {
        applySimplifyTitle(true);
      }
      alert("设置已保存并应用");
    }
    function resetToDefault() {
      currentConfig = mergeDeep({}, DEFAULT_CONFIG);
      fillForm();
      saveAndApply();
    }
    document.getElementById("closePanel").onclick = () => {
      panel.style.display = "none";
    };
    document.getElementById("saveConfigBtn").onclick = saveAndApply;
    document.getElementById("resetDefaultBtn").onclick = resetToDefault;
    let drag = false;
    let offsetX, offsetY;
    const header = panel.querySelector(".panel-header");
    header.onmousedown = (e) => {
      drag = true;
      offsetX = e.clientX - panel.offsetLeft;
      offsetY = e.clientY - panel.offsetTop;
      document.onmousemove = (moveEvent) => {
        if (drag) {
          panel.style.left = moveEvent.clientX - offsetX + "px";
          panel.style.top = moveEvent.clientY - offsetY + "px";
        }
      };
      document.onmouseup = () => {
        drag = false;
        document.onmousemove = null;
      };
    };
    fillForm();
  }
  function showPanel() {
    if (!panelElement) {
      createPanel();
    } else {
      panelElement.style.display = "flex";
    }
  }
  function initControlPanel(deps) {
    modules = deps;
    currentConfig = loadConfig();
    applyAllConfig();
    if (typeof GM_registerMenuCommand !== "undefined") {
      GM_registerMenuCommand("⚙️ 小助手控制面板", showPanel);
    } else {
      window.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === "P") {
          e.preventDefault();
          showPanel();
        }
      });
      logger.log("control", "未检测到 GM_registerMenuCommand，已注册 Ctrl+Shift+P 呼出面板");
    }
    if (currentConfig.switches.simplifyTitle) {
      setTimeout(() => applySimplifyTitle(true), 1e3);
    }
  }
  function initialize() {
    try {
      initControlPanel({
        speedModule,
        adModule,
        loginModule,
        titleModule: simplifyTitles
      });
      logger.log("main", "Bilibili自定义播放速度小助手已启动");
    } catch (error2) {
      logger.error("main", "Bilibili自定义播放速度小助手初始化失败:", error2);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

})();