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
let panelElement = null;
let currentConfig = null;

// 模块实例引用（用于动态启停）
let speedController = null;       // 倍速模块 init 返回的控制器
let adObserver = null;            // 广告屏蔽 observer
let loginObserver = null;         // 免登录 observer

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
    if (panelElement) {
        panelElement.style.display = 'flex';
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'bili-helper-panel';
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

    // 样式
    Object.assign(panel.style, {
        position: 'fixed',
        top: '100px',
        left: '100px',
        width: '300px',
        backgroundColor: '#ecf0f1',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: '10000',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        display: 'flex',
        flexDirection: 'column'
    });

    document.body.appendChild(panel);
    panelElement = panel;

    // 填充当前配置到表单
    function fillForm() {
        const s = currentConfig.speed;
        document.getElementById('step').value = s.step;
        document.getElementById('minSpeed').value = s.minSpeed;
        document.getElementById('maxSpeed').value = s.maxSpeed;
        document.getElementById('initialSpeed').value = s.initialSpeed;
        document.getElementById('keyReset').value = s.keys.reset;
        document.getElementById('keyInc').value = s.keys.inc;
        document.getElementById('keyDec').value = s.keys.dec;
        document.getElementById('tipDuration').value = s.tipDuration;
        document.getElementById('showTip').checked = s.showTip;
        document.getElementById('adBlockSwitch').checked = currentConfig.switches.adBlock;
        document.getElementById('noLoginSwitch').checked = currentConfig.switches.noLogin;
        document.getElementById('titleSwitch').checked = currentConfig.switches.simplifyTitle;
    }

    // 从表单读取配置
    function readForm() {
        const newConfig = {
            speed: {
                step: parseFloat(document.getElementById('step').value),
                minSpeed: parseFloat(document.getElementById('minSpeed').value),
                maxSpeed: parseFloat(document.getElementById('maxSpeed').value),
                initialSpeed: parseFloat(document.getElementById('initialSpeed').value),
                keys: {
                    reset: document.getElementById('keyReset').value || 'z',
                    inc: document.getElementById('keyInc').value || 'x',
                    dec: document.getElementById('keyDec').value || 'c'
                },
                tipDuration: parseInt(document.getElementById('tipDuration').value),
                showTip: document.getElementById('showTip').checked
            },
            switches: {
                adBlock: document.getElementById('adBlockSwitch').checked,
                noLogin: document.getElementById('noLoginSwitch').checked,
                simplifyTitle: document.getElementById('titleSwitch').checked
            }
        };
        // 有效性修正
        if (isNaN(newConfig.speed.step)) newConfig.speed.step = 0.05;
        if (isNaN(newConfig.speed.minSpeed)) newConfig.speed.minSpeed = 0.125;
        if (isNaN(newConfig.speed.maxSpeed)) newConfig.speed.maxSpeed = 16;
        if (isNaN(newConfig.speed.initialSpeed)) newConfig.speed.initialSpeed = 0;
        if (newConfig.speed.minSpeed < 0) newConfig.speed.minSpeed = 0.125;
        if (newConfig.speed.maxSpeed < newConfig.speed.minSpeed) newConfig.speed.maxSpeed = newConfig.speed.minSpeed + 1;
        return newConfig;
    }

    // 保存并应用
    function saveAndApply() {
        const newConfig = readForm();
        currentConfig = newConfig;
        saveConfig(currentConfig);
        applyAllConfig();
        // 标题简化需要刷新才能看到效果，可提示
        if (newConfig.switches.simplifyTitle) {
            // 主动执行一次（不依赖刷新）
            applySimplifyTitle(true);
        }
        alert('设置已保存并应用');
    }

    function resetToDefault() {
        currentConfig = mergeDeep({}, DEFAULT_CONFIG);
        fillForm();
        saveAndApply();
    }

    // 事件绑定
    document.getElementById('closePanel').onclick = () => {
        panel.style.display = 'none';
    };
    document.getElementById('saveConfigBtn').onclick = saveAndApply;
    document.getElementById('resetDefaultBtn').onclick = resetToDefault;

    // 使面板可拖拽
    let drag = false;
    let offsetX, offsetY;
    const header = panel.querySelector('.panel-header');
    header.onmousedown = (e) => {
        drag = true;
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
        document.onmousemove = (moveEvent) => {
            if (drag) {
                panel.style.left = (moveEvent.clientX - offsetX) + 'px';
                panel.style.top = (moveEvent.clientY - offsetY) + 'px';
            }
        };
        document.onmouseup = () => {
            drag = false;
            document.onmousemove = null;
        };
    };

    fillForm();
}

// 显示面板（如果已创建则显示，否则创建）
function showPanel() {
    if (!panelElement) {
        createPanel();
    } else {
        panelElement.style.display = 'flex';
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