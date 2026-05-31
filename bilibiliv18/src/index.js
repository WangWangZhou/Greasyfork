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
// @require      https://cdn.jsdelivr.net/npm/quill@2.0.0/dist/quill.min.js
// ==/UserScript==

(function () {
    'use strict';

    // 模块引入（按依赖顺序）
    // MODULE_INJECTION_POINT

    // 启动应用
    App.start();
})();