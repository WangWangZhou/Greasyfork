/**
 * Resizable - 拖拽调整大小行为模块
 * UI行为模块 - 负责为面板元素提供拖拽调整大小的功能
 */
const Resizable = (() => {
    return {
        /**
         * 为元素添加拖拽调整大小功能
         * @param {HTMLElement} el - 目标元素
         * @param {Object} options - 配置选项
         * @param {number} [options.minWidth=400] - 最小宽度
         * @param {number} [options.minHeight=300] - 最小高度
         * @param {number} [options.maxWidth] - 最大宽度（可选）
         * @param {number} [options.maxHeight] - 最大高度（可选）
         * @param {Function} [options.onResize] - 调整大小时的回调函数
         * @param {string} [options.saveKey] - 保存到 Config 的键名（可选）
         * @returns {Function} 清理函数
         */
        make(el, options = {}) {
            const {
                minWidth = 400,
                minHeight = 300,
                maxWidth = window.innerWidth - 50,
                maxHeight = window.innerHeight - 50,
                onResize,
                saveKey
            } = options;

            let isResizing = false;
            let startX, startY, startWidth, startHeight;
            let rafId = null;
            let handleEl = null;

            // 创建拖拽手柄
            handleEl = document.createElement('div');
            handleEl.className = 'bili-speed-resize-handle';
            handleEl.style.cssText = `
                position: absolute;
                right: 0;
                bottom: 0;
                width: 16px;
                height: 16px;
                cursor: nwse-resize;
                z-index: 10001;
                pointer-events: auto;
            `;

            // 添加视觉指示器（小三角）
            handleEl.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 12 12" style="position: absolute; right: 2px; bottom: 2px; pointer-events: none;">
                    <path d="M10 2 L10 10 L2 10" stroke="#999" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                </svg>
            `;

            // 确保父元素有相对定位
            if (getComputedStyle(el).position === 'static') {
                el.style.position = 'relative';
            }

            el.appendChild(handleEl);

            const onMouseDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = el.getBoundingClientRect();
                startWidth = rect.width;
                startHeight = rect.height;
                el.style.cursor = 'nwse-resize';
                el.style.userSelect = 'none';
            };

            const onMouseMove = (e) => {
                if (!isResizing) return;

                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + dx));
                const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + dy));

                el.style.width = newWidth + 'px';
                el.style.height = newHeight + 'px';

                if (onResize && !rafId) {
                    const latestWidth = newWidth;
                    const latestHeight = newHeight;
                    rafId = requestAnimationFrame(() => {
                        rafId = null;
                        onResize(latestWidth, latestHeight);
                    });
                }
            };

            const onMouseUp = () => {
                if (isResizing) {
                    isResizing = false;
                    el.style.cursor = '';
                    el.style.userSelect = '';

                    if (rafId) {
                        cancelAnimationFrame(rafId);
                        rafId = null;
                    }

                    if (saveKey) {
                        const rect = el.getBoundingClientRect();
                        Config.data[saveKey] = {
                            width: rect.width + 'px',
                            height: rect.height + 'px'
                        };
                    }
                }
            };

            handleEl.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            // 返回清理函数
            return () => {
                handleEl.removeEventListener('mousedown', onMouseDown);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                if (handleEl && handleEl.parentNode) {
                    handleEl.remove();
                }
                handleEl = null;
            };
        }
    };
})();
