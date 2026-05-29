/**
 * Logger - 日志模块
 * 统一的调试日志输出
 */
const Logger = (() => {
    const DEBUG = false;
    const PREFIX = '[BiliSpeed]';

    return {
        info(msg) {
            if (DEBUG) console.log(`${PREFIX} ${msg}`);
        },

        warn(msg) {
            if (DEBUG) console.warn(`${PREFIX} ${msg}`);
        },

        error(msg) {
            console.error(`${PREFIX} ${msg}`);
        }
    };
})();