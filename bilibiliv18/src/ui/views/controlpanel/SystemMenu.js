const SystemMenu = (() => {
    let toggleThemeLocal = null;

    function setToggleThemeCallback(callback) {
        toggleThemeLocal = callback;
    }

    function renderSystemMenu(contentEl) {
        const currentTheme = Config.data.theme || 'light';
        contentEl.innerHTML = `
            <div class="bili-speed-panel-menu-container">
                <div class="bili-speed-panel-menu-section">
                    <div class="bili-speed-panel-menu-title">🎨 主题设置</div>
                    <div class="bili-speed-panel-theme-row">
                        <span class="bili-speed-panel-theme-label">当前主题:</span>
                        <button class="theme-toggle-btn">
                            ${currentTheme === 'dark' ? '🌙' : '☀️'}
                        </button>
                        <span class="bili-speed-panel-theme-status">${currentTheme === 'dark' ? '深色模式' : '浅色模式'}</span>
                    </div>
                </div>
                <div class="bili-speed-panel-tip">
                    💡 提示: 主题设置会应用到所有面板组件
                </div>
                <div class="bili-speed-panel-menu-section bili-speed-panel-export-section">
                    <div class="bili-speed-panel-menu-title">📤 数据导出</div>
                    <div class="bili-speed-panel-export-group">
                        <div class="bili-speed-panel-export-category">⭐ 收藏夹数据</div>
                        <div class="bili-speed-panel-export-buttons">
                            <button class="export-favorites-json">📄 导出为 JSON</button>
                        </div>
                    </div>
                    <div class="bili-speed-panel-export-group">
                        <div class="bili-speed-panel-export-category">📝 笔记数据</div>
                        <div class="bili-speed-panel-export-buttons">
                            <button class="export-notes-json">📄 导出为 JSON</button>
                        </div>
                    </div>
                </div>
                <div class="bili-speed-panel-menu-section bili-speed-panel-cdn-section">
                    <div class="bili-speed-panel-menu-title">📦 编辑器 CDN 资源</div>
                    <div class="bili-speed-panel-cdn-row">
                        <span class="bili-speed-panel-cdn-label">Quill JS:</span>
                        <input type="text" class="cdn-quill-js" value="${Config.data.quillCdnJs}">
                    </div>
                    <div class="bili-speed-panel-cdn-row">
                        <span class="bili-speed-panel-cdn-label">Quill CSS:</span>
                        <input type="text" class="cdn-quill-css" value="${Config.data.quillCdnCss}">
                    </div>
                    <div class="bili-speed-panel-cdn-row">
                        <span class="bili-speed-panel-cdn-label">Vditor JS:</span>
                        <input type="text" class="cdn-vditor-js" value="${Config.data.vditorCdnJs}">
                    </div>
                    <div class="bili-speed-panel-cdn-row">
                        <span class="bili-speed-panel-cdn-label">Vditor CSS:</span>
                        <input type="text" class="cdn-vditor-css" value="${Config.data.vditorCdnCss}">
                    </div>
                    <div class="bili-speed-panel-cdn-buttons">
                        <button class="cdn-save">💾 保存 CDN 配置</button>
                        <button class="cdn-restore">↩️ 恢复默认</button>
                    </div>
                </div>
            </div>
        `;

        const themeBtn = contentEl.querySelector('.theme-toggle-btn');
        themeBtn.addEventListener('click', () => {
            if (toggleThemeLocal) toggleThemeLocal();
        });

        contentEl.querySelector('.export-favorites-json').addEventListener('click', () => {
            EventBus.emit('favorites:export');
        });

        contentEl.querySelector('.export-notes-json').addEventListener('click', () => {
            EventBus.emit('notes:export');
        });

        contentEl.querySelector('.cdn-save').addEventListener('click', () => {
            const quillJs = contentEl.querySelector('.cdn-quill-js').value.trim();
            const quillCss = contentEl.querySelector('.cdn-quill-css').value.trim();
            const vditorJs = contentEl.querySelector('.cdn-vditor-js').value.trim();
            const vditorCss = contentEl.querySelector('.cdn-vditor-css').value.trim();
            if (quillJs) Config.data.quillCdnJs = quillJs;
            if (quillCss) Config.data.quillCdnCss = quillCss;
            if (vditorJs) Config.data.vditorCdnJs = vditorJs;
            if (vditorCss) Config.data.vditorCdnCss = vditorCss;
            Toast.show('CDN 配置已保存，刷新后生效');
        });

        contentEl.querySelector('.cdn-restore').addEventListener('click', () => {
            Config.data.quillCdnJs = Config.DEFAULTS.quillCdnJs;
            Config.data.quillCdnCss = Config.DEFAULTS.quillCdnCss;
            Config.data.vditorCdnJs = Config.DEFAULTS.vditorCdnJs;
            Config.data.vditorCdnCss = Config.DEFAULTS.vditorCdnCss;
            contentEl.querySelector('.cdn-quill-js').value = Config.DEFAULTS.quillCdnJs;
            contentEl.querySelector('.cdn-quill-css').value = Config.DEFAULTS.quillCdnCss;
            contentEl.querySelector('.cdn-vditor-js').value = Config.DEFAULTS.vditorCdnJs;
            contentEl.querySelector('.cdn-vditor-css').value = Config.DEFAULTS.vditorCdnCss;
            Toast.show('CDN 配置已恢复默认');
        });
    }

    return {
        render: renderSystemMenu,
        setToggleThemeCallback
    };
})();
