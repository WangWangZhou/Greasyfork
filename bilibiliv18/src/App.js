/**
 * App - 主控模块
 * 负责初始化、生命周期管理、模块编排与URL变化检测
 */
const App = (() => {
    let lastUrl = location.href;

    function init() {
        if (PageGuard.isNotAllowedPage()) {
            Logger.info('当前页面不启用脚本');
            return;
        }

        if (!VideoController.init()) {
            setTimeout(init, 1000);
            return;
        }

        Toast.create();
        CardPanel.create();
        ControlPanel.create();
        FavoritesPanel.create();
        ScreenModeManager.init();
        KeyboardHandler.register();

        GM_registerMenuCommand('打开信息卡片', () => EventBus.emit('card:toggle'));
        GM_registerMenuCommand('打开控制面板', () => EventBus.emit('panel:toggle'));
        GM_registerMenuCommand('打开收藏面板', () => EventBus.emit('favorites:toggle'));

        EventBus.on('panel:toggle', ControlPanel.toggle);
        EventBus.on('card:toggle', CardPanel.toggle);
        EventBus.on('favorites:toggle', FavoritesPanel.toggle);

        EventBus.on('theme:changed', (theme) => {
            CardPanel.applyTheme(theme);
            ControlPanel.applyTheme(theme);
        });

        Logger.info('脚本初始化完成');
    }

    function cleanup() {
        Toast.destroy();
        CardPanel.destroy();
        ControlPanel.destroy();
        FavoritesPanel.destroy();
        ScreenModeManager.destroy();
        KeyboardHandler.unregister();
        EventBus.clear();
        VideoController.reset();
    }

    function checkUrlChange() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            Logger.info('URL 变化');
            cleanup();
            setTimeout(init, 500);
        }
    }

    return {
        start() {
            setInterval(checkUrlChange, 500);

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else {
                init();
            }

            Logger.info('脚本已加载');
        }
    };
})();
