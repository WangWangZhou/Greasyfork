/**
 * ControlPanel - 控制面板视图
 * 视图层 - 使用Card组件渲染设置面板
 * 提供左侧菜单导航（系统菜单/倍速设置/收藏夹/笔记），支持主题切换
 */
const ControlPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let multiClickCleanup = null;
    let currentMenu = 'speed';

    function applyTheme(theme) {
        if (!panelInstance) return;
        const panelEl = panelInstance.element;
        
        panelEl.classList.remove('theme-light', 'theme-dark');
        panelEl.classList.add(`theme-${theme}`);
        
        const themeBtn = panelEl.querySelector('.theme-toggle-btn');
        if (themeBtn) {
            themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
            themeBtn.title = theme === 'dark' ? '切换到浅色主题' : '切换到深色主题';
        }
    }

    function toggleTheme() {
        const currentTheme = Config.data.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        Config.data.theme = newTheme;
        applyTheme(newTheme);
        EventBus.emit('theme:changed', newTheme);
        Toast.show(`已切换到${newTheme === 'dark' ? '深色' : '浅色'}主题`);
    }

    async function switchMenu(menuName) {
        if (!panelInstance) return;
        
        currentMenu = menuName;
        const panelEl = panelInstance.element;
        
        panelEl.querySelectorAll('.bili-speed-panel-menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.menu === menuName);
        });

        const contentEl = panelEl.querySelector('.bili-speed-panel-content');
        if (!contentEl) return;

        switch (menuName) {
            case 'system':
                SystemMenu.render(contentEl);
                break;
            case 'speed':
                SpeedMenu.render(contentEl);
                break;
            case 'favorites':
                await FavoritesMenu.render(contentEl);
                break;
            case 'notes':
                await NotesMenu.render(contentEl);
                break;
        }
    }

    function isValidPosition(pos) {
        if (!pos || typeof pos.left === 'undefined') return false;
        const left = parseFloat(pos.left);
        const top = pos.top ? parseFloat(pos.top) : NaN;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (isNaN(left) || left < -200 || left >= vw) return false;
        if (!isNaN(top) && (top < -200 || top >= vh + 200)) return false;
        return true;
    }

    function createPanel() {
        if (multiClickCleanup) {
            multiClickCleanup();
            multiClickCleanup = null;
        }

        let savedPosition = Config.data.panelPosition;
        let useSavedPosition = false;
        const currentTheme = Config.data.theme || 'light';

        if (savedPosition) {
            if (isValidPosition(savedPosition)) {
                useSavedPosition = true;
            } else {
                Config.data.panelPosition = null;
            }
        }

        panelInstance = Card.create({
            className: `bili-speed-panel theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: '⚙️ 控制面板'
            },
            footer: { visible: false },
            styles: {
                width: '420px',
                display: Config.data.panelVisible ? 'block' : 'none',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 9999,
                ...(useSavedPosition ? {
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

                dragCleanup = Draggable.make(headerEl.parentElement, 'panelPosition', `[class*="-header"]`);

                let advancedVisible = false;
                multiClickCleanup = Utils.multiClick(titleEl, 5, () => {
                    advancedVisible = !advancedVisible;
                    const contentEl = panelInstance.element.querySelector('.bili-speed-panel-content');
                    if (contentEl) {
                        contentEl.querySelectorAll('.advanced-option').forEach(item => {
                            item.style.display = advancedVisible ? 'block' : 'none';
                        });
                    }
                    Toast.show(advancedVisible ? '已显示高级选项' : '已隐藏高级选项');
                });
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-panel-body';
                bodyEl.style.cssText = 'padding: 0; display: flex;';

                bodyEl.innerHTML = `
                    <div class="bili-speed-panel-menu" style="width: 120px; border-right: 1px solid #ddd; padding: 8px 0; flex-shrink: 0;">
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'system' ? 'active' : ''}" data-menu="system" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            🔧 系统菜单
                        </div>
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'speed' ? 'active' : ''}" data-menu="speed" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            ⚡ 倍速设置
                        </div>
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'favorites' ? 'active' : ''}" data-menu="favorites" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            ⭐ 收藏夹
                        </div>
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'notes' ? 'active' : ''}" data-menu="notes" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            📝 笔记
                        </div>
                    </div>
                    <div class="bili-speed-panel-content" style="flex: 1; min-height: 300px;"></div>
                `;

                const menuItems = bodyEl.querySelectorAll('.bili-speed-panel-menu-item');
                menuItems.forEach(item => {
                    item.addEventListener('click', () => {
                        void switchMenu(item.dataset.menu);
                    });

                    item.addEventListener('mouseenter', () => {
                        if (!item.classList.contains('active')) {
                            item.style.background = '#f0f0f0';
                        }
                    });

                    item.addEventListener('mouseleave', () => {
                        if (!item.classList.contains('active')) {
                            item.style.background = '';
                        }
                    });
                });

                const contentEl = bodyEl.querySelector('.bili-speed-panel-content');
                void switchMenu(currentMenu);
            }
        });

        const panelStyle = document.createElement('style');
        panelStyle.textContent = `
            .bili-speed-panel button {
                transition: all 0.2s;
            }
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
            .bili-speed-panel .editor-btn,
            .bili-speed-panel .vditor-mode-btn,
            .bili-speed-panel .editor-size-btn {
                padding: 4px 12px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background: #fff;
                color: #000;
                cursor: pointer;
                transition: all 0.2s;
            }
            .bili-speed-panel .editor-btn:hover,
            .bili-speed-panel .vditor-mode-btn:hover,
            .bili-speed-panel .editor-size-btn:hover {
                background: #e0e0e0;
            }
            .bili-speed-panel .editor-btn.active,
            .bili-speed-panel .vditor-mode-btn.active,
            .bili-speed-panel .editor-size-btn.active {
                background: #00AEEC;
                color: #fff;
                border-color: #00AEEC;
            }
            .bili-speed-panel #reset-btn:hover {
                background: #888 !important;
            }
            .bili-speed-panel #save-btn:hover {
                background: #0099d6 !important;
            }
            .bili-speed-panel #export-favorites-btn:hover,
            .bili-speed-panel #import-favorites-btn:hover,
            .bili-speed-panel #export-notes-btn:hover,
            .bili-speed-panel #import-notes-btn:hover,
            .bili-speed-panel .quill-size-save:hover,
            .bili-speed-panel .quill-size-restore:hover,
            .bili-speed-panel .vditor-size-save:hover,
            .bili-speed-panel .vditor-size-restore:hover {
                background: #e0e0e0;
            }
            .bili-speed-panel #open-favorites-panel-btn:hover,
            .bili-speed-panel #open-notes-panel-btn:hover {
                background: #0099d6 !important;
            }
            .bili-speed-panel #clear-favorites-btn:hover,
            .bili-speed-panel #clear-notes-btn:hover {
                background: #ffe0e0;
            }
            .bili-speed-panel-menu-item.active {
                background: #e6f7ff;
                border-left-color: #00AEEC;
                color: #00AEEC;
            }
            .bili-speed-panel.theme-dark {
                background: #1f1f1f;
                color: #fff;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu {
                border-right-color: #333;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu-item {
                color: #ccc;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu-item:hover {
                background: #333;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu-item.active {
                background: #333;
                border-left-color: #00AEEC;
                color: #00AEEC;
            }
            .bili-speed-panel.theme-dark button {
                color: #fff;
                border-color: #444;
                background: #333;
            }
            .bili-speed-panel.theme-dark button:hover {
                background: #444;
            }
            .bili-speed-panel.theme-dark button.active {
                background: #00AEEC;
                border-color: #00AEEC;
            }
            .bili-speed-panel.theme-dark #reset-btn:hover {
                background: #555 !important;
            }
            .bili-speed-panel.theme-dark #save-btn:hover,
            .bili-speed-panel.theme-dark #open-favorites-panel-btn:hover,
            .bili-speed-panel.theme-dark #open-notes-panel-btn:hover {
                background: #0088b3 !important;
            }
            .bili-speed-panel.theme-dark #export-favorites-btn:hover,
            .bili-speed-panel.theme-dark #import-favorites-btn:hover,
            .bili-speed-panel.theme-dark #export-notes-btn:hover,
            .bili-speed-panel.theme-dark #import-notes-btn:hover,
            .bili-speed-panel.theme-dark .quill-size-save:hover,
            .bili-speed-panel.theme-dark .quill-size-restore:hover,
            .bili-speed-panel.theme-dark .vditor-size-save:hover,
            .bili-speed-panel.theme-dark .vditor-size-restore:hover {
                background: #444 !important;
            }
            .bili-speed-panel.theme-dark #clear-favorites-btn:hover,
            .bili-speed-panel.theme-dark #clear-notes-btn:hover {
                background: #553333 !important;
                border-color: #ff6b6b !important;
            }
            .bili-speed-panel.theme-dark input {
                background: #333;
                color: #fff;
                border-color: #444;
            }
            .bili-speed-panel.theme-dark .bili-speed-close {
                color: #fff;
            }
        `;
        if (!document.querySelector('#bili-speed-panel-style')) {
            panelStyle.id = 'bili-speed-panel-style';
            document.head.appendChild(panelStyle);
        }

        SystemMenu.setToggleThemeCallback(toggleTheme);
        FavoritesMenu.setRenderCallback(FavoritesMenu.render);
        NotesMenu.setRenderCallback(NotesMenu.render);
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

        switchMenu(menuName) {
            void switchMenu(menuName);
        },

        applyTheme(theme) {
            applyTheme(theme);
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
