/**
 * Draggable - 拖拽行为模块
 * UI行为模块 - 负责为元素添加拖拽交互功能
 */
const Draggable = (() => {
    return {
        make(el, saveKey, headerSelector) {
            let isDragging = false;
            let startX, startY, startLeft, startTop;
            const cleanupFns = new Set();

            const header = headerSelector ? el.querySelector(headerSelector) : el;
            if (!header) return () => {};

            const onMouseDown = (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.classList.contains('bili-speed-drag-text')) return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = el.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                el.style.cursor = 'grabbing';
                e.preventDefault();
            };

            const onMouseMove = (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + dx));
                const newTop = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + dy));
                el.style.left = newLeft + 'px';
                el.style.top = newTop + 'px';
                el.style.right = 'auto';
                el.style.bottom = 'auto';
            };

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    el.style.cursor = '';
                    Config.data[saveKey] = { left: el.style.left, top: el.style.top };
                }
            };

            header.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            const cleanup = () => {
                header.removeEventListener('mousedown', onMouseDown);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                cleanupFns.clear();
            };

            cleanupFns.add(cleanup);
            return cleanup;
        },

        cleanupAll() {
            Logger.warn('Draggable.cleanupAll() 已弃用');
        }
    };
})();