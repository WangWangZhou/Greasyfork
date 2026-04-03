/**
 * 控制面板UI组件
 * 功能：
 *   - 创建和管理设置面板UI
 *   - 提供表单交互功能
 *   - 支持拖拽移动
 */

import logger from '../loggerModule.js';

export class ControlPanelUI {
    constructor(config, callbacks) {
        this.config = config;
        this.callbacks = callbacks || {};
        this.panelElement = null;
        this.drag = false;
        this.offsetX = 0;
        this.offsetY = 0;
    }
    
    createPanel() {
        if (this.panelElement) {
            this.panelElement.style.display = 'flex';
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
        this.panelElement = panel;
        this.bindEvents();
        this.fillForm();
    }
    
    fillForm() {
        const s = this.config.speed;
        document.getElementById('step').value = s.step;
        document.getElementById('minSpeed').value = s.minSpeed;
        document.getElementById('maxSpeed').value = s.maxSpeed;
        document.getElementById('initialSpeed').value = s.initialSpeed;
        document.getElementById('keyReset').value = s.keys.reset;
        document.getElementById('keyInc').value = s.keys.inc;
        document.getElementById('keyDec').value = s.keys.dec;
        document.getElementById('tipDuration').value = s.tipDuration;
        document.getElementById('showTip').checked = s.showTip;
        document.getElementById('adBlockSwitch').checked = this.config.switches.adBlock;
        document.getElementById('noLoginSwitch').checked = this.config.switches.noLogin;
        document.getElementById('titleSwitch').checked = this.config.switches.simplifyTitle;
    }
    
    readForm() {
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
        
        if (isNaN(newConfig.speed.step)) newConfig.speed.step = 0.05;
        if (isNaN(newConfig.speed.minSpeed)) newConfig.speed.minSpeed = 0.125;
        if (isNaN(newConfig.speed.maxSpeed)) newConfig.speed.maxSpeed = 16;
        if (isNaN(newConfig.speed.initialSpeed)) newConfig.speed.initialSpeed = 0;
        if (newConfig.speed.minSpeed < 0) newConfig.speed.minSpeed = 0.125;
        if (newConfig.speed.maxSpeed < newConfig.speed.minSpeed) newConfig.speed.maxSpeed = newConfig.speed.minSpeed + 1;
        
        return newConfig;
    }
    
    bindEvents() {
        document.getElementById('closePanel').onclick = () => {
            this.panelElement.style.display = 'none';
        };
        
        document.getElementById('saveConfigBtn').onclick = () => {
            const newConfig = this.readForm();
            if (this.callbacks.onSave) {
                this.callbacks.onSave(newConfig);
            }
        };
        
        document.getElementById('resetDefaultBtn').onclick = () => {
            if (this.callbacks.onReset) {
                this.callbacks.onReset();
            }
        };
        
        const header = this.panelElement.querySelector('.panel-header');
        header.onmousedown = (e) => {
            this.drag = true;
            this.offsetX = e.clientX - this.panelElement.offsetLeft;
            this.offsetY = e.clientY - this.panelElement.offsetTop;
            document.onmousemove = (moveEvent) => {
                if (this.drag) {
                    this.panelElement.style.left = (moveEvent.clientX - this.offsetX) + 'px';
                    this.panelElement.style.top = (moveEvent.clientY - this.offsetY) + 'px';
                }
            };
            document.onmouseup = () => {
                this.drag = false;
                document.onmousemove = null;
            };
        };
    }
    
    show() {
        if (!this.panelElement) {
            this.createPanel();
        } else {
            this.panelElement.style.display = 'flex';
        }
    }
    
    hide() {
        if (this.panelElement) {
            this.panelElement.style.display = 'none';
        }
    }
    
    updateConfig(newConfig) {
        this.config = newConfig;
        this.fillForm();
    }
    
    destroy() {
        if (this.panelElement && this.panelElement.parentNode) {
            this.panelElement.parentNode.removeChild(this.panelElement);
            this.panelElement = null;
        }
    }
}

export default ControlPanelUI;