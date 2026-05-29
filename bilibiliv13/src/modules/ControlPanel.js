/**
 * ControlPanel - 控制面板模块
 */
const ControlPanel = (() => {
    let panelEl = null;
    let dragCleanup = null;

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
            Utils.multiClick(panelTitle, 5, () => {
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
                Config.data.step = 0.05;
                Config.data.minRate = 0.5;
                Config.data.maxRate = 4.0;
                Config.data.defaultRate = 1.0;
                Config.data.keyReset = 'z';
                Config.data.keyUp = 'x';
                Config.data.keyDown = 'c';
                panelEl.querySelector('#key-reset').value = 'Z';
                panelEl.querySelector('#key-up').value = 'X';
                panelEl.querySelector('#key-down').value = 'C';
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
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelEl) panelEl.remove();
            panelEl = null;
        }
    };
})();