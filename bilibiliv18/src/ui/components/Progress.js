/**
 * Progress - 进度条组件
 * UI组件 - 提供可复用的进度条功能
 *
 * @module UI/Components
 *
 * @example
 * const progress = Progress.create({
 *   container: document.body,
 *   className: 'bili-speed-progress',
 *   formatTime: Utils.formatTime,
 *   onSeek: (time) => { video.currentTime = time; }
 * });
 *
 * progress.setProgress(50);
 * progress.setDuration(120);
 * progress.destroy();
 */
const Progress = (() => {
    let instanceCounter = 0;

    return {
        /**
         * 创建进度条实例
         * @param {Object} options - 配置选项
         * @param {HTMLElement} options.container - 父容器元素
         * @param {string} [options.className='bili-speed-progress'] - 自定义类名前缀
         * @param {number} [options.duration=0] - 视频总时长（秒）
         * @param {number} [options.currentTime=0] - 当前播放时间（秒）
         * @param {Function} [options.formatTime] - 时间格式化函数
         * @param {Function} [options.onSeek] - 跳转回调，接收目标时间（秒）参数
         * @param {Function} [options.onChange] - 进度变化回调，接收当前进度百分比
         * @returns {Object} 进度条实例
         */
        create(options = {}) {
            const {
                container = document.body,
                className = 'bili-speed-progress',
                duration = 0,
                currentTime = 0,
                formatTime = (seconds) => {
                    if (!seconds || isNaN(seconds)) return '00:00';
                    const h = Math.floor(seconds / 3600);
                    const m = Math.floor((seconds % 3600) / 60);
                    const s = Math.floor(seconds % 60);
                    if (h > 0) {
                        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                    }
                    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                },
                onSeek,
                onChange
            } = options;

            const instanceId = ++instanceCounter;
            const progressId = `${className}-instance-${instanceId}`;

            let wrapperEl = null;
            let barEl = null;
            let tooltipEl = null;
            let isDragging = false;
            let currentDuration = duration;
            let currentPosition = currentTime;
            let cleanupFns = [];

            function render() {
                wrapperEl = document.createElement('div');
                wrapperEl.className = `${className}-wrapper`;
                wrapperEl.style.cssText = `
                    flex: 1;
                    height: 5px;
                    background: #ddd;
                    border-radius: 2px;
                    cursor: pointer;
                    position: relative;
                `;

                barEl = document.createElement('div');
                barEl.className = `${className}-bar`;
                barEl.style.cssText = `
                    height: 100%;
                    background: #00AEEC;
                    border-radius: 2px;
                    width: 0%;
                    transition: width 0.1s ease;
                `;

                tooltipEl = document.createElement('div');
                tooltipEl.className = `${className}-tooltip`;
                tooltipEl.style.cssText = `
                    position: absolute;
                    bottom: 12px;
                    left: 0;
                    background: rgba(0,0,0,0.8);
                    color: #fff;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 12px;
                    display: none;
                    white-space: nowrap;
                    transform: translateX(-50%);
                `;

                wrapperEl.appendChild(barEl);
                wrapperEl.appendChild(tooltipEl);
                container.appendChild(wrapperEl);

                bindEvents();
                updateProgress(currentPosition);
            }

            function bindEvents() {
                const onMouseEnter = (e) => updateTooltip(e.clientX);
                const onMouseMove = (e) => {
                    if (!isDragging) updateTooltip(e.clientX);
                };
                const onMouseLeave = () => {
                    if (!isDragging) tooltipEl.style.display = 'none';
                };
                const onClick = (e) => {
                    if (!currentDuration) return;
                    const time = getTimeFromPosition(e.clientX);
                    if (onSeek) onSeek(time);
                };
                const onDragStart = (e) => {
                    if (!currentDuration) return;
                    isDragging = true;
                    e.preventDefault();
                };
                const onDragMove = (e) => {
                    if (!isDragging) return;
                    updateTooltip(e.clientX);
                    const time = getTimeFromPosition(e.clientX);
                    updateProgress(time);
                    if (onSeek) onSeek(time);
                };
                const onDragEnd = () => {
                    if (isDragging) {
                        isDragging = false;
                        tooltipEl.style.display = 'none';
                    }
                };

                wrapperEl.addEventListener('mouseenter', onMouseEnter);
                wrapperEl.addEventListener('mousemove', onMouseMove);
                wrapperEl.addEventListener('mouseleave', onMouseLeave);
                wrapperEl.addEventListener('click', onClick);
                wrapperEl.addEventListener('mousedown', onDragStart);
                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('mouseup', onDragEnd);

                cleanupFns.push(() => {
                    wrapperEl.removeEventListener('mouseenter', onMouseEnter);
                    wrapperEl.removeEventListener('mousemove', onMouseMove);
                    wrapperEl.removeEventListener('mouseleave', onMouseLeave);
                    wrapperEl.removeEventListener('click', onClick);
                    wrapperEl.removeEventListener('mousedown', onDragStart);
                    document.removeEventListener('mousemove', onDragMove);
                    document.removeEventListener('mouseup', onDragEnd);
                });
            }

            function getTimeFromPosition(clientX) {
                const rect = wrapperEl.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return percent * currentDuration;
            }

            function updateTooltip(clientX) {
                if (!currentDuration) return;
                const time = getTimeFromPosition(clientX);
                const rect = wrapperEl.getBoundingClientRect();
                const percent = (clientX - rect.left) / rect.width;
                tooltipEl.textContent = formatTime(time);
                tooltipEl.style.left = `${percent * 100}%`;
                tooltipEl.style.display = 'block';
            }

            function updateProgress(time) {
                currentPosition = time;
                if (currentDuration > 0) {
                    const percent = (time / currentDuration) * 100;
                    barEl.style.width = `${percent}%`;
                    currentPosition = Math.min(time, currentDuration);
                    if (onChange) onChange(percent);
                }
            }

            render();

            return {
                id: progressId,
                element: wrapperEl,
                barElement: barEl,
                tooltipElement: tooltipEl,

                setDuration(duration) {
                    currentDuration = duration || 0;
                    return this;
                },

                setProgress(time) {
                    updateProgress(time);
                    return this;
                },

                getProgress() {
                    return currentPosition;
                },

                getDuration() {
                    return currentDuration;
                },

                getPercent() {
                    if (currentDuration <= 0) return 0;
                    return (currentPosition / currentDuration) * 100;
                },

                destroy() {
                    cleanupFns.forEach(fn => fn());
                    cleanupFns = [];
                    if (wrapperEl) {
                        wrapperEl.remove();
                        wrapperEl = null;
                        barEl = null;
                        tooltipEl = null;
                    }
                }
            };
        }
    };
})();