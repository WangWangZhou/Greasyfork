/**
 * NoLoginMenu - 免登录菜单
 * 控制面板子菜单：免登录总开关 + 试看弹窗开关
 */
const NoLoginMenu = (() => {
    function renderNoLoginMenu(contentEl) {
        contentEl.innerHTML = `
            <div class="bili-speed-panel-noLogin-menu">
                <div class="bili-speed-panel-menu-container">
                    <div class="bili-speed-panel-menu-section">
                        <div class="bili-speed-panel-menu-title">🚫 免登录守卫</div>
                        <div class="bili-speed-panel-switch-row">
                            <span class="bili-speed-panel-switch-label">启用免登录:</span>
                            <span class="no-login-switch-wrapper"></span>
                            <span class="bili-speed-panel-switch-status no-login-switch-status">
                                ${Config.data.noLoginEnabled ? '已启用' : '已禁用'}
                            </span>
                        </div>
                        <div class="bili-speed-panel-tip">
                            阻止未登录时的登录弹窗及其副作用（暂停视频、退出全屏）
                        </div>
                    </div>

                    <div class="bili-speed-panel-menu-section" style="margin-top: 16px;">
                        <div class="bili-speed-panel-menu-title">🎬 试看弹窗</div>
                        <div class="bili-speed-panel-switch-row">
                            <span class="bili-speed-panel-switch-label">关闭试看结束弹窗:</span>
                            <span class="trial-popup-switch-wrapper"></span>
                            <span class="bili-speed-panel-switch-status trial-switch-status">
                                ${Config.data.noLoginBlockTrialEnd ? '已开启' : '已关闭'}
                            </span>
                        </div>
                        <div class="bili-speed-panel-tip">
                            阻止 30 秒高清试看结束后弹出的登录提示<br>
                            ⚠️ 仅阻止弹窗，画质仍会降为 360P
                        </div>
                    </div>
                </div>
            </div>
        `;

        // ===== 开关 1: 免登录总开关 =====
        const switchWrapper = contentEl.querySelector('.no-login-switch-wrapper');
        const statusEl = contentEl.querySelector('.no-login-switch-status');

        const switchInstance = Switch.create({
            checked: Config.data.noLoginEnabled,
            onChange: (checked) => {
                if (checked) {
                    NoLoginGuard.enable();
                    statusEl.textContent = '已启用';
                } else {
                    NoLoginGuard.disable();
                    statusEl.textContent = '已禁用';
                }
            }
        });
        switchWrapper.appendChild(switchInstance.element);

        // ===== 开关 2: 试看弹窗关闭 =====
        const trialSwitchWrapper = contentEl.querySelector('.trial-popup-switch-wrapper');
        const trialStatusEl = contentEl.querySelector('.trial-switch-status');

        const trialSwitchInstance = Switch.create({
            checked: Config.data.noLoginBlockTrialEnd,
            onChange: (checked) => {
                Config.data.noLoginBlockTrialEnd = checked;
                trialStatusEl.textContent = checked ? '已开启' : '已关闭';
                if (checked) {
                    NoLoginGuard.sweep();
                    Toast.show('试看弹窗拦截已开启');
                } else {
                    Toast.show('试看弹窗拦截已关闭');
                }
            }
        });
        trialSwitchWrapper.appendChild(trialSwitchInstance.element);
    }

    return {
        render: renderNoLoginMenu
    };
})();
