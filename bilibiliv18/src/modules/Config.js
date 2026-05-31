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
        favoritesPanelPosition: null
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
