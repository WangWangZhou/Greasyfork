const SpeedMenu = (() => {
    function updateButtonStateLocal(contentEl) {
        const buttonGroups = [
            { selector: '.step-btn', dataAttr: 'step', configKey: 'step' },
            { selector: '.default-btn', dataAttr: 'rate', configKey: 'defaultRate' },
            { selector: '.min-rate-btn', dataAttr: 'rate', configKey: 'minRate' },
            { selector: '.max-rate-btn', dataAttr: 'rate', configKey: 'maxRate' }
        ];

        buttonGroups.forEach(({ selector, dataAttr, configKey }) => {
            contentEl.querySelectorAll(selector).forEach(btn => {
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
        const input = document.getElementById(inputId);
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

    function renderSpeedMenu(contentEl) {
        contentEl.innerHTML = `
            <div class="bili-speed-panel-speed-menu">
                <div class="bili-speed-panel-option-group">
                    <div class="bili-speed-panel-option-label">📏 步进值:</div>
                    <div class="bili-speed-panel-button-group">
                        <button class="step-btn" data-step="0.02">0.02</button>
                        <button class="step-btn" data-step="0.05">0.05</button>
                        <button class="step-btn" data-step="0.10">0.10</button>
                    </div>
                </div>
                <div class="bili-speed-panel-option-group">
                    <div class="bili-speed-panel-option-label">🎯 初始倍速:</div>
                    <div class="bili-speed-panel-button-group">
                        <button class="default-btn" data-rate="0.8">0.8x</button>
                        <button class="default-btn" data-rate="0.9">0.9x</button>
                        <button class="default-btn" data-rate="1.0">1.0x</button>
                        <button class="default-btn" data-rate="1.1">1.1x</button>
                        <button class="default-btn" data-rate="1.25">1.25x</button>
                    </div>
                </div>
                <div class="bili-speed-panel-option-group advanced-option" style="display: none;">
                    <div class="bili-speed-panel-option-label">⬇️ 最小倍速:</div>
                    <div class="bili-speed-panel-button-group">
                        <button class="min-rate-btn" data-rate="0.3">0.3x</button>
                        <button class="min-rate-btn" data-rate="0.5">0.5x</button>
                        <button class="min-rate-btn" data-rate="0.6">0.6x</button>
                        <button class="min-rate-btn" data-rate="0.7">0.7x</button>
                    </div>
                </div>
                <div class="bili-speed-panel-option-group advanced-option" style="display: none;">
                    <div class="bili-speed-panel-option-label">⬆️ 最大倍速:</div>
                    <div class="bili-speed-panel-button-group">
                        <button class="max-rate-btn" data-rate="2">2x</button>
                        <button class="max-rate-btn" data-rate="3">3x</button>
                        <button class="max-rate-btn" data-rate="4">4x</button>
                        <button class="max-rate-btn" data-rate="5">5x</button>
                    </div>
                </div>
                <div class="bili-speed-panel-option-group advanced-option" style="display: none;">
                    <div class="bili-speed-panel-option-label">⌨️ 快捷键设置:</div>
                    <div class="bili-speed-panel-keybind-group">
                        <div class="bili-speed-panel-keybind-item">
                            <span>🔄 重置:</span>
                            <input type="text" id="key-reset" maxlength="1" value="${Config.data.keyReset.toUpperCase()}">
                        </div>
                        <div class="bili-speed-panel-keybind-item">
                            <span>⏩ 加速:</span>
                            <input type="text" id="key-up" maxlength="1" value="${Config.data.keyUp.toUpperCase()}">
                        </div>
                        <div class="bili-speed-panel-keybind-item">
                            <span>⏪ 减速:</span>
                            <input type="text" id="key-down" maxlength="1" value="${Config.data.keyDown.toUpperCase()}">
                        </div>
                    </div>
                    <div class="bili-speed-panel-keybind-tip">* 快捷键修改后需刷新网页生效，不支持F键</div>
                </div>
                <div class="bili-speed-panel-action-buttons">
                    <button id="reset-btn">🔄 重置</button>
                    <button id="save-btn">💾 保存</button>
                </div>
            </div>
        `;

        updateButtonStateLocal(contentEl);

        contentEl.querySelectorAll('.step-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.step = parseFloat(btn.dataset.step);
                updateButtonStateLocal(contentEl);
            });
        });

        contentEl.querySelectorAll('.default-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.defaultRate = parseFloat(btn.dataset.rate);
                updateButtonStateLocal(contentEl);
            });
        });

        contentEl.querySelectorAll('.min-rate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.minRate = parseFloat(btn.dataset.rate);
                updateButtonStateLocal(contentEl);
            });
        });

        contentEl.querySelectorAll('.max-rate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.maxRate = parseFloat(btn.dataset.rate);
                updateButtonStateLocal(contentEl);
            });
        });

        handleKeyInput('key-reset', 'keyReset');
        handleKeyInput('key-up', 'keyUp');
        handleKeyInput('key-down', 'keyDown');

        contentEl.querySelector('#reset-btn').addEventListener('click', () => {
            Config.batchUpdate({
                step: Config.DEFAULTS.step,
                minRate: Config.DEFAULTS.minRate,
                maxRate: Config.DEFAULTS.maxRate,
                defaultRate: Config.DEFAULTS.defaultRate,
                keyReset: Config.DEFAULTS.keyReset,
                keyUp: Config.DEFAULTS.keyUp,
                keyDown: Config.DEFAULTS.keyDown
            });
            contentEl.querySelector('#key-reset').value = Config.DEFAULTS.keyReset.toUpperCase();
            contentEl.querySelector('#key-up').value = Config.DEFAULTS.keyUp.toUpperCase();
            contentEl.querySelector('#key-down').value = Config.DEFAULTS.keyDown.toUpperCase();
            updateButtonStateLocal(contentEl);
            EventBus.emit('config:reset');
        });

        contentEl.querySelector('#save-btn').addEventListener('click', () => {
            Config.data.keyReset = contentEl.querySelector('#key-reset').value.toLowerCase() || 'z';
            Config.data.keyUp = contentEl.querySelector('#key-up').value.toLowerCase() || 'x';
            Config.data.keyDown = contentEl.querySelector('#key-down').value.toLowerCase() || 'c';
            const video = VideoController.getVideo();
            if (video && video.playbackRate === Config.data.defaultRate) {
                VideoController.setRate(Config.data.defaultRate);
            }
            EventBus.emit('panel:toggle');
            EventBus.emit('config:saved');
            Toast.show('配置已保存，刷新后生效');
        });
    }

    return {
        render: renderSpeedMenu
    };
})();
