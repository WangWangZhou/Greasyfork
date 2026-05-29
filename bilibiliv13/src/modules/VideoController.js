/**
 * VideoController - 视频倍速控制模块
 */
const VideoController = (() => {
    let video = null;
    const throttledSetRate = Utils.throttle(fn => fn(), 100);

    return {
        init() {
            video = document.querySelector('video');
            if (!video) {
                Logger.info('未找到视频元素');
                return false;
            }
            Logger.info('视频元素已找到');
            EventBus.emit('video:found', video);
            return true;
        },

        getVideo() {
            return video;
        },

        setRate(rate) {
            if (!video) return;
            const newRate = Math.min(Config.data.maxRate, Math.max(Config.data.minRate, Utils.round2(rate)));
            video.playbackRate = newRate;
            Toast.show(`${newRate}x`);
            Logger.info(`设置倍速: ${newRate}x`);
            EventBus.emit('rate:change', newRate);
        },

        adjustRate(delta) {
            if (!video || Config.data.panelVisible || PageGuard.isInputFocused()) return;
            throttledSetRate(() => this.setRate(video.playbackRate + delta));
        },

        resetRate() {
            if (!video || Config.data.panelVisible || PageGuard.isInputFocused()) return;
            throttledSetRate(() => this.setRate(Config.data.defaultRate));
        },

        reset() {
            video = null;
        }
    };
})();