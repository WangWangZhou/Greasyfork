const App = (() => {
    let lastUrl = location.href;

    function init() {
        if (PageGuard.isNotAllowedPage()) {
            Logger.info('当前页面不启用脚本');
            return;
        }

        Toast.create();
        CardPanel.create();
        ControlPanel.create();
        FavoritesPanel.create();
        NotesPanel.create();
        QuillEditorPanel.create();
        VditorEditorPanel.create();
        ScreenModeManager.init();
        KeyboardHandler.register();

        GM_registerMenuCommand('打开信息卡片', () => EventBus.emit('card:toggle'));
        GM_registerMenuCommand('打开控制面板', () => EventBus.emit('panel:toggle'));
        GM_registerMenuCommand('打开收藏面板', () => EventBus.emit('favorites:toggle'));
        GM_registerMenuCommand('打开笔记面板', () => EventBus.emit('notes:toggle'));

        EventBus.on('panel:toggle', ControlPanel.toggle);
        EventBus.on('card:toggle', CardPanel.toggle);
        EventBus.on('favorites:toggle', FavoritesPanel.toggle);
        EventBus.on('notes:toggle', NotesPanel.toggle);

        EventBus.on('notes:edit', (note) => {
            if (note.editorType === 'vditor') {
                VditorEditorPanel.open(note);
            } else {
                QuillEditorPanel.open(note);
            }
        });

        EventBus.on('notes:new', () => {
            const editorType = Config.data.defaultEditor || 'quill';
            if (editorType === 'vditor') {
                VditorEditorPanel.open(null);
            } else {
                QuillEditorPanel.open(null);
            }
        });

        EventBus.on('theme:changed', (theme) => {
            CardPanel.applyTheme(theme);
            ControlPanel.applyTheme(theme);
            NotesPanel.applyTheme(theme);
            QuillEditorPanel.applyTheme(theme);
            VditorEditorPanel.applyTheme(theme);
        });

        Logger.info('脚本初始化完成');
    }

    function cleanup() {
        Toast.destroy();
        CardPanel.destroy();
        ControlPanel.destroy();
        FavoritesPanel.destroy();
        NotesPanel.destroy();
        QuillEditorPanel.destroy();
        VditorEditorPanel.destroy();
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
