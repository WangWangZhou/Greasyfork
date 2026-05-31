/**
 * KeyboardHandler - 键盘快捷键模块
 */
const KeyboardHandler = (() => {
    let boundHandler = null;

    return {
        register() {
            boundHandler = (e) => {
                if (PageGuard.isNotAllowedPage() || PageGuard.isInputFocused()) return;

                const key = e.key.toLowerCase();
                if (key === Config.data.keyReset) {
                    e.preventDefault();
                    VideoController.resetRate();
                } else if (key === Config.data.keyUp) {
                    e.preventDefault();
                    VideoController.adjustRate(Config.data.step);
                } else if (key === Config.data.keyDown) {
                    e.preventDefault();
                    VideoController.adjustRate(-Config.data.step);
                }
            };
            document.addEventListener('keydown', boundHandler);
        },

        unregister() {
            if (boundHandler) {
                document.removeEventListener('keydown', boundHandler);
                boundHandler = null;
            }
        }
    };
})();