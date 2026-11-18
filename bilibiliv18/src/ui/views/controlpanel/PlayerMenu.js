/**
 * PlayerMenu - 播放器设置菜单
 * 控制面板子菜单：播放器倍速滑块开关
 */
const PlayerMenu = (() => {
    function renderPlayerMenu(contentEl) {
        contentEl.innerHTML = `
            <div class="bili-speed-panel-menu-container">
                <div class="bili-speed-panel-menu-section">
                    <div class="bili-speed-panel-menu-title">🎬 播放器倍速</div>
                    <div class="bili-speed-panel-switch-row">
                        <span class="bili-speed-panel-switch-label">倍速滚动条:</span>
                        <span class="player-slider-switch-wrapper"></span>
                        <span class="bili-speed-panel-switch-status player-slider-status">
                            ${Config.data.playerRateSliderEnabled ? '已开启' : '已关闭'}
                        </span>
                    </div>
                    <div class="bili-speed-panel-tip">
                        开启：在 B 站播放器倍速菜单内注入精细调节滑块和 +/- 按钮<br>
                        关闭：恢复 B 站原始倍速菜单样式（仅 6 个固定档位）
                    </div>
                </div>
            </div>
        `;

        const switchWrapper = contentEl.querySelector('.player-slider-switch-wrapper');
        const statusEl = contentEl.querySelector('.player-slider-status');

        const switchInstance = Switch.create({
            checked: Config.data.playerRateSliderEnabled,
            onChange: (checked) => {
                if (checked) {
                    PlayerModifier.enable();
                    statusEl.textContent = '已开启';
                } else {
                    PlayerModifier.disable();
                    statusEl.textContent = '已关闭';
                }
            }
        });
        switchWrapper.appendChild(switchInstance.element);
    }

    return {
        render: renderPlayerMenu
    };
})();
