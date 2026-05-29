/**
 * ScreenModeManager - 屏幕模式管理模块
 */
const ScreenModeManager = (() => {
    let observer = null;
    let checkInterval = null;
    let clickHandler = null;

    function updateByScreenMode(screenMode) {
        if (screenMode === 'wide' || screenMode === 'web') {
            CardPanel.hide();
        } else {
            CardPanel.show();
        }
    }

    return {
        init() {
            clickHandler = (e) => {
                const target = e.target;
                const wideBtn = target.closest('.bpx-player-ctrl-wide');
                const webBtn = target.closest('.bpx-player-ctrl-web');

                if (wideBtn || webBtn) {
                    Logger.info('点击了宽屏/网页全屏按钮');
                    CardPanel.hide();
                }
            };
            document.addEventListener('click', clickHandler, true);
        },

        setupMutationObserver() {
            if (observer) observer.disconnect();

            const playerContainer = document.querySelector('.bpx-player-container');
            if (!playerContainer) return;

            observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'data-screen') {
                        const screenMode = playerContainer.getAttribute('data-screen');
                        Logger.info(`播放器模式变化: ${screenMode}`);
                        updateByScreenMode(screenMode);
                    }
                });
            });

            observer.observe(playerContainer, {
                attributes: true,
                attributeFilter: ['data-screen']
            });
        },

        setupIntervalCheck() {
            if (checkInterval) clearInterval(checkInterval);

            let lastScreenMode = '';
            checkInterval = setInterval(() => {
                const playerContainer = document.querySelector('.bpx-player-container');
                if (!playerContainer) return;

                const screenMode = playerContainer.getAttribute('data-screen') || '';
                if (screenMode !== lastScreenMode) {
                    lastScreenMode = screenMode;
                    Logger.info(`播放器模式变化(定时检测): ${screenMode}`);
                    updateByScreenMode(screenMode);
                }
            }, 500);
        },

        destroy() {
            if (clickHandler) {
                document.removeEventListener('click', clickHandler, true);
                clickHandler = null;
            }
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
            }
        }
    };
})();