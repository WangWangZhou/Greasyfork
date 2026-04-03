/**
 * Bilibili 小助手控制面板模块
 * 功能：
 *   - 提供可视化面板，调整倍速按键、步进、范围、初始倍速
 *   - 控制广告屏蔽、免登录、标题简化功能的开关
 *   - 配置自动保存（使用 GM_setValue / GM_getValue）
 *   - 通过油猴菜单命令（GM_registerMenuCommand）呼出面板
 *
 * 依赖：
 *   - 环境需支持 GM_registerMenuCommand, GM_setValue, GM_getValue
 *   - 需要传入已导入的各功能模块（倍速、广告、免登录、标题简化）
 *
 * 使用方法：
 *   import { initControlPanel } from './controlPanel.js';
 *   import * as speed from './biliSpeedCtrl.js';
 *   import * as ad from './adBlocker.js';
 *   import * as login from './biliNoLogin.js';
 *   import * as title from './simplifyTitles.js';
 *
 *   initControlPanel({
 *       speedModule: speed,
 *       adModule: ad,
 *       loginModule: login,
 *       titleModule: title
 *   });
 */

import logger from './loggerModule.js';
import { ControlPanelUI } from './component/controlPanelUI.js';

// ---------- 默认配置 ----------
const DEFAULT_CONFIG = {
    // 倍速设置
    speed: {
        step: 0.05,
        minSpeed: 0.125,
        maxSpeed: 16,
        initialSpeed: 0,
        keys: {
            reset: 'z',
            inc: 'x',
            dec: 'c'
        },
        tipDuration: 500,
        showTip: true
    },
    // 功能开关
    switches: {
        adBlock: true,      // 广告屏蔽
        noLogin: true,      // 免登录弹窗关闭
        simplifyTitle: false // 标题简化（默认关闭，避免意外修改）
    }
};

// ---------- 存储工具 ----------
function saveConfig(config) {
    if (typeof GM_setValue !== 'undefined') {
        GM_setValue('biliHelperConfig', JSON.stringify(config));
    } else {
        localStorage.setItem('biliHelperConfig', JSON.stringify(config));
    }
}

function loadConfig() {
    let raw = null;
    if (typeof GM_getValue !== 'undefined') {
        raw = GM_getValue('biliHelperConfig');
    } else {
        raw = localStorage.getItem('biliHelperConfig');
    }
    if (raw) {
        try {
            const saved = JSON.parse(raw);
            // 深度合并，确保新字段存在
            return mergeDeep(DEFAULT_CONFIG, saved);
        } catch (e) {}
    }
    return { ...DEFAULT_CONFIG };
}

// 简单深度合并
function mergeDeep(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = mergeDeep(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

// ---------- 面板 UI 相关 ----------
let panelUI = null;
let currentConfig = null;

// 模块实例引用（用于动态启停）
let speedController = null;
let adObserver = null;
let loginObserver = null;

// 外部模块引用
let modules = {};

// 应用倍速配置（销毁旧实例，用新配置重新初始化）
function applySpeedConfig(config) {
    if (speedController && speedController.destroy) {
        speedController.destroy();
    }
    // 调用倍速模块的 init
    const speedModule = modules.speedModule;
    if (speedModule && speedModule.init) {
        speedController = speedModule.init(config);
    }
}

// 应用广告屏蔽开关
function applyAdBlock(enabled) {
    const adModule = modules.adModule;
    if (!adModule) return;
    if (enabled) {
        if (!adObserver) {
            adObserver = adModule.initAdBlocker ? adModule.initAdBlocker() : null;
        }
    } else {
        if (adObserver && adObserver.disconnect) {
            adObserver.disconnect();
            adObserver = null;
        }
        // 可选：恢复已隐藏的广告（简单处理，不做恢复）
    }
}

// 应用免登录开关
function applyNoLogin(enabled) {
    const loginModule = modules.loginModule;
    if (!loginModule) return;
    if (enabled) {
        if (!loginObserver) {
            loginObserver = loginModule.keepLoginModalClosed ? loginModule.keepLoginModalClosed() : null;
        }
    } else {
        if (loginObserver && loginObserver.disconnect) {
            loginObserver.disconnect();
            loginObserver = null;
        }
    }
}

// 应用标题简化（一次性执行或重新执行）
function applySimplifyTitle(enabled) {
    const titleModule = modules.titleModule;
    if (!titleModule || !titleModule.simplifyTitles) return;
    if (enabled) {
        // 执行简化（使用默认选项，可扩展为读取面板中的配置）
        titleModule.simplifyTitles({ debug: false });
    }
    // 关闭时无法“恢复”原标题，因此仅控制是否在页面加载时执行；这里不处理恢复
    // 实际使用中，用户可刷新页面来恢复原始标题。
}

// 根据当前配置重新应用所有模块（保存后调用）
function applyAllConfig() {
    const speedConf = currentConfig.speed;
    applySpeedConfig(speedConf);
    applyAdBlock(currentConfig.switches.adBlock);
    applyNoLogin(currentConfig.switches.noLogin);
    applySimplifyTitle(currentConfig.switches.simplifyTitle);
}

// 创建并显示面板
function createPanel() {
    if (!panelUI) {
        panelUI = new ControlPanelUI(currentConfig, {
            onSave: (newConfig) => {
                currentConfig = newConfig;
                saveConfig(currentConfig);
                applyAllConfig();
                if (newConfig.switches.simplifyTitle) {
                    applySimplifyTitle(true);
                }
                alert('设置已保存并应用');
            },
            onReset: () => {
                currentConfig = mergeDeep({}, DEFAULT_CONFIG);
                panelUI.updateConfig(currentConfig);
                const newConfig = panelUI.readForm();
                currentConfig = newConfig;
                saveConfig(currentConfig);
                applyAllConfig();
                if (newConfig.switches.simplifyTitle) {
                    applySimplifyTitle(true);
                }
                alert('设置已恢复默认并应用');
            }
        });
    }
    
    panelUI.show();
}

// 显示面板（如果已创建则显示，否则创建）
function showPanel() {
    if (!panelUI) {
        createPanel();
    } else {
        panelUI.show();
    }
}

// ---------- 对外初始化函数 ----------
/**
 * 初始化控制面板
 * @param {Object} deps - 依赖的模块
 * @param {Object} deps.speedModule - 倍速模块（需有 init 方法，返回控制器）
 * @param {Object} deps.adModule - 广告模块（需有 initAdBlocker）
 * @param {Object} deps.loginModule - 免登录模块（需有 keepLoginModalClosed）
 * @param {Object} deps.titleModule - 标题简化模块（需有 simplifyTitles）
 */
export function initControlPanel(deps) {
    modules = deps;
    // 加载已保存配置
    currentConfig = loadConfig();
    // 立即应用配置（启动模块）
    applyAllConfig();

    // 注册油猴菜单命令
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('⚙️ 小助手控制面板', showPanel);
    } else {
        // 无油猴环境时，可通过快捷键（例如 Ctrl+Shift+P）调出面板
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                showPanel();
            }
        });
        logger.log('control', '未检测到 GM_registerMenuCommand，已注册 Ctrl+Shift+P 呼出面板');
    }

    // 可选：页面加载完成后如果标题简化开关打开，执行一次
    if (currentConfig.switches.simplifyTitle) {
        setTimeout(() => applySimplifyTitle(true), 1000);
    }
}

export default { initControlPanel };