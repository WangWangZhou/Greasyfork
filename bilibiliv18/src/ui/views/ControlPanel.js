/**
 * ControlPanel - 控制面板视图
 * 视图层 - 使用Card组件渲染设置面板
 */
const ControlPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let multiClickCleanup = null;

    function updateButtonState() {
        if (!panelInstance) return;

        const panelEl = panelInstance.element;

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
        if (!panelInstance) return;
        const panelEl = panelInstance.element;
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

    function createPanel() {
        if (multiClickCleanup) {
            multiClickCleanup();
            multiClickCleanup = null;
        }

        let savedPosition = Config.data.panelPosition;

        panelInstance = Card.create({
            className: 'bili-speed-panel',
            header: {
                visible: true,
                draggable: true,
                title: '⚙️ 控制面板'
            },
            footer: { visible: false },
            styles: {
                width: '300px',
                display: Config.data.panelVisible ? 'block' : 'none',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 9999,
                ...(savedPosition ? {
                    left: savedPosition.left,
                    top: savedPosition.top,
                    transform: 'none'
                } : {})
            },
            onHeaderReady: (headerEl) => {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-close';
                closeBtn.style.cssText = 'background: none; border: none; color: #000; font-size: 20px; cursor: pointer;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', () => {
                    EventBus.emit('panel:toggle');
                });

                const titleEl = headerEl.querySelector('.bili-speed-panel-drag-text') || headerEl.querySelector('.bili-speed-drag-text');
                const actionsEl = headerEl.querySelector('.bili-speed-panel-actions');
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'panelPosition', `.bili-speed-panel-header`);

                let advancedVisible = false;
                multiClickCleanup = Utils.multiClick(titleEl, 5, () => {
                    advancedVisible = !advancedVisible;
                    const hiddenItems = headerEl.parentElement.querySelectorAll('.bili-speed-panel-body > div[style*="display: none"]');
                    hiddenItems.forEach(item => {
                        item.style.display = advancedVisible ? 'block' : 'none';
                    });
                    Toast.show(advancedVisible ? '已显示高级选项' : '已隐藏高级选项');
                });
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-panel-body';
                bodyEl.style.cssText = 'padding: 0 16px;';

                bodyEl.innerHTML = `
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
                    <div style="display: flex; gap: 8px; justify-content: flex-end; padding: 12px 0;">
                        <button id="reset-btn" style="padding: 8px 16px; border-radius: 4px; border: none; background: #999; color: #fff; cursor: pointer;">🔄 重置</button>
                        <button id="save-btn" style="padding: 8px 16px; border-radius: 4px; border: none; background: #00AEEC; color: #fff; cursor: pointer;">💾 保存</button>
                    </div>
                `;

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

                const updateButtonState = (el) => {
                    const buttonGroups = [
                        { selector: '.step-btn', dataAttr: 'step', configKey: 'step' },
                        { selector: '.default-btn', dataAttr: 'rate', configKey: 'defaultRate' },
                        { selector: '.min-rate-btn', dataAttr: 'rate', configKey: 'minRate' },
                        { selector: '.max-rate-btn', dataAttr: 'rate', configKey: 'maxRate' }
                    ];

                    buttonGroups.forEach(({ selector, dataAttr, configKey }) => {
                        el.querySelectorAll(selector).forEach(btn => {
                            const isActive = parseFloat(btn.dataset[dataAttr]) === Config.data[configKey];
                            btn.classList.toggle('active', isActive);
                        });
                    });
                };

                updateButtonState(bodyEl);

                bodyEl.querySelectorAll('.step-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.step = parseFloat(btn.dataset.step);
                        updateButtonState(bodyEl);
                    });
                });

                bodyEl.querySelectorAll('.default-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.defaultRate = parseFloat(btn.dataset.rate);
                        updateButtonState(bodyEl);
                    });
                });

                bodyEl.querySelectorAll('.min-rate-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.minRate = parseFloat(btn.dataset.rate);
                        updateButtonState(bodyEl);
                    });
                });

                bodyEl.querySelectorAll('.max-rate-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Config.data.maxRate = parseFloat(btn.dataset.rate);
                        updateButtonState(bodyEl);
                    });
                });

                handleKeyInput('key-reset', 'keyReset');
                handleKeyInput('key-up', 'keyUp');
                handleKeyInput('key-down', 'keyDown');

                bodyEl.querySelector('#reset-btn').addEventListener('click', () => {
                    Config.batchUpdate({
                        step: Config.DEFAULTS.step,
                        minRate: Config.DEFAULTS.minRate,
                        maxRate: Config.DEFAULTS.maxRate,
                        defaultRate: Config.DEFAULTS.defaultRate,
                        keyReset: Config.DEFAULTS.keyReset,
                        keyUp: Config.DEFAULTS.keyUp,
                        keyDown: Config.DEFAULTS.keyDown
                    });
                    bodyEl.querySelector('#key-reset').value = Config.DEFAULTS.keyReset.toUpperCase();
                    bodyEl.querySelector('#key-up').value = Config.DEFAULTS.keyUp.toUpperCase();
                    bodyEl.querySelector('#key-down').value = Config.DEFAULTS.keyDown.toUpperCase();
                    updateButtonState(bodyEl);
                    EventBus.emit('config:reset');
                });

                bodyEl.querySelector('#save-btn').addEventListener('click', () => {
                    Config.data.keyReset = bodyEl.querySelector('#key-reset').value.toLowerCase() || 'z';
                    Config.data.keyUp = bodyEl.querySelector('#key-up').value.toLowerCase() || 'x';
                    Config.data.keyDown = bodyEl.querySelector('#key-down').value.toLowerCase() || 'c';
                    const video = VideoController.getVideo();
                    if (video && video.playbackRate === Config.data.defaultRate) {
                        VideoController.setRate(Config.data.defaultRate);
                    }
                    EventBus.emit('panel:toggle');
                    EventBus.emit('config:saved');
                    Toast.show('配置已保存，刷新后生效');
                });
            }
        });
    }

    return {
        create() {
            if (panelInstance) panelInstance.destroy();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (multiClickCleanup) {
                multiClickCleanup();
                multiClickCleanup = null;
            }

            createPanel();
        },

        toggle() {
            Config.data.panelVisible = !Config.data.panelVisible;
            if (panelInstance) {
                panelInstance.element.style.display = Config.data.panelVisible ? 'block' : 'none';
            }
        },

        destroy() {
            if (multiClickCleanup) {
                multiClickCleanup();
                multiClickCleanup = null;
            }
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
        }
    };
})();