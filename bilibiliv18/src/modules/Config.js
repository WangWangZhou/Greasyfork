/**
 * Config - 配置管理模块
 * 响应式持久化配置
 */
const Config = (() => {
    const DEFAULTS = {
        step: 0.05,
        minRate: 0.5,
        maxRate: 2.0,
        defaultRate: 1.0,
        cardVisible: true,
        panelVisible: false,
        cardPosition: null,
        panelPosition: null,
        keyReset: 'z',
        keyUp: 'c',
        keyDown: 'x',
        theme: 'light',
        favoritesPanelVisible: false,
        favoritesPanelPosition: null,
        notesPanelVisible: false,
        notesPanelPosition: null,
        editorPanelPosition: null,
        quillEditorPanelSize: null,
        vditorEditorPanelSize: null,
        defaultEditor: 'quill',
        quillEditorWidth: '520px',
        quillEditorHeight: '500px',
        quillEditorMinWidth: '400px',
        quillEditorMinHeight: '350px',
        vditorEditorMode: 'ir',
        vditorWidth_wysiwyg: '560px',
        vditorHeight_wysiwyg: '550px',
        vditorWidth_ir: '560px',
        vditorHeight_ir: '550px',
        vditorWidth_sv: '640px',
        vditorHeight_sv: '600px',
        vditorEditorMinWidth_wysiwyg: '400px',
        vditorEditorMinHeight_wysiwyg: '400px',
        vditorEditorMinWidth_ir: '400px',
        vditorEditorMinHeight_ir: '400px',
        vditorEditorMinWidth_sv: '640px',
        vditorEditorMinHeight_sv: '400px',
        quillCdnJs: 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.min.js',
        quillCdnCss: 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css',
        vditorCdnJs: 'https://cdn.jsdelivr.net/npm/vditor/dist/index.min.js',
        vditorCdnCss: 'https://cdn.jsdelivr.net/npm/vditor/dist/index.css'
    };

    const proxy = new Proxy({}, {
        get(_, key) {
            if (!(key in DEFAULTS)) {
                Logger.warn(`配置项 "${key}" 不存在`);
                return undefined;
            }
            const value = GM_getValue(key);
            return value !== undefined ? value : DEFAULTS[key];
        },
        set(_, key, value) {
            if (!(key in DEFAULTS)) {
                Logger.warn(`无法设置不存在的配置项 "${key}"`);
                return false;
            }
            GM_setValue(key, value);
            return true;
        }
    });

    return {
        data: proxy,
        DEFAULTS,
        reset() {
            Object.keys(DEFAULTS).forEach(key => GM_setValue(key, DEFAULTS[key]));
            EventBus.emit('config:reset');
        },
        batchUpdate(updates) {
            Object.entries(updates).forEach(([key, value]) => {
                proxy[key] = value;
            });
        }
    };
})();
