/**
 * OtherMenu - 其它设置菜单
 * 控制面板子菜单：面板层级等杂项设置
 */
const OtherMenu = (() => {
    function renderOtherMenu(contentEl) {
        contentEl.innerHTML = `
            <div class="bili-speed-panel-menu-container">
                <div class="bili-speed-panel-menu-section">
                    <div class="bili-speed-panel-menu-title">🎨 面板层级</div>
                    <div class="bili-speed-panel-switch-row">
                        <span class="bili-speed-panel-switch-label">面板在弹出层之上:</span>
                        <span class="panel-zindex-switch-wrapper"></span>
                        <span class="bili-speed-panel-switch-status panel-zindex-status">
                            ${Config.data.panelAbovePopups ? '已开启' : '已关闭'}
                        </span>
                    </div>
                    <div class="bili-speed-panel-tip">
                        开启后脚本面板显示在 B 站右上角弹出层之上<br>
                        关闭后 B 站弹出层显示在脚本面板之上
                    </div>
                </div>
            </div>
        `;

        const switchWrapper = contentEl.querySelector('.panel-zindex-switch-wrapper');
        const statusEl = contentEl.querySelector('.panel-zindex-status');

        const switchInstance = Switch.create({
            checked: Config.data.panelAbovePopups,
            onChange: (checked) => {
                Config.data.panelAbovePopups = checked;
                statusEl.textContent = checked ? '已开启' : '已关闭';
                Config.applyPanelZIndex();
                Toast.show(checked ? '面板层级：在弹出层之上' : '面板层级：在弹出层之下');
            }
        });
        switchWrapper.appendChild(switchInstance.element);
    }

    return {
        render: renderOtherMenu
    };
})();
