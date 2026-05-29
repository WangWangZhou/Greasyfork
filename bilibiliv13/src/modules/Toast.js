/**
 * Toast - 消息提示模块
 */
const Toast = (() => {
    let toastEl = null;
    let toastTimer = null;

    return {
        create() {
            toastEl = document.createElement('div');
            toastEl.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.7);
                color: #fff;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 24px;
                font-weight: bold;
                opacity: 0;
                transition: opacity 0.3s;
                z-index: 9999;
                pointer-events: none;
            `;
            const container = document.querySelector('.bpx-player-video-wrap') ||
                             document.querySelector('.bilibili-player-video-wrap') ||
                             document.body;
            container.appendChild(toastEl);
        },

        show(text) {
            if (!toastEl) return;
            toastEl.textContent = text;
            toastEl.style.opacity = '1';
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(() => {
                toastEl.style.opacity = '0';
            }, 1500);
        },

        destroy() {
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = null;
            if (toastEl) toastEl.remove();
            toastEl = null;
        }
    };
})();