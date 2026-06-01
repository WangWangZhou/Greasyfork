/**
 * CardPanel - 信息卡片模块
 */
const CardPanel = (() => {
    let cardEl = null;
    let dragCleanup = null;
    const cleanupFns = new Set();

    function updateCard() {
        const video = VideoController.getVideo();
        if (!video || !cardEl) return;

        const rateEl = cardEl.querySelector('.bili-speed-rate');
        const timeEl = cardEl.querySelector('.bili-speed-time');
        const progressBar = cardEl.querySelector('.bili-speed-progress-bar');
        const collectionEl = cardEl.querySelector('.bili-speed-collection');

        if (rateEl) rateEl.textContent = `${video.playbackRate}x`;

        if (timeEl) {
            const remaining = video.duration - video.currentTime;
            timeEl.textContent = `${Utils.formatTime(remaining)} / ${Utils.formatTime(video.duration)}`;
        }

        if (progressBar && video.duration) {
            progressBar.style.width = `${(video.currentTime / video.duration) * 100}%`;
        }

        if (collectionEl) {
            const isCollection = Utils.isCollection();
            const totalDuration = Utils.getCollectionDuration();
            if (isCollection && totalDuration > 0) {
                collectionEl.textContent = `📚 合集总时长: ${Utils.formatTime(totalDuration)}`;
                collectionEl.style.display = 'block';
            } else {
                collectionEl.style.display = 'none';
            }
        }
    }

    function updatePlayBtn(video, playBtn) {
        if (!video) return;
        playBtn.textContent = video.paused ? '▶' : '⏸';
    }

    function initProgressBar(progressWrapper, progressBar, tooltip) {
        const video = VideoController.getVideo();
        let isDraggingProgress = false;

        const getTimeFromPosition = (clientX) => {
            const rect = progressWrapper.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return percent * video.duration;
        };

        const updateTooltip = (clientX) => {
            if (!video || !video.duration) return;
            const time = getTimeFromPosition(clientX);
            const rect = progressWrapper.getBoundingClientRect();
            const percent = (clientX - rect.left) / rect.width;
            tooltip.textContent = Utils.formatTime(time);
            tooltip.style.left = `${percent * 100}%`;
            tooltip.style.display = 'block';
        };

        const seekVideo = Utils.throttle((time) => {
            if (video) video.currentTime = time;
        }, 100);

        const onMouseEnter = (e) => updateTooltip(e.clientX);
        const onMouseMove = (e) => { if (!isDraggingProgress) updateTooltip(e.clientX); };
        const onMouseLeave = () => { if (!isDraggingProgress) tooltip.style.display = 'none'; };

        const onClick = (e) => {
            if (!video || !video.duration) return;
            video.currentTime = getTimeFromPosition(e.clientX);
        };

        const onDragStart = (e) => {
            if (!video || !video.duration) return;
            isDraggingProgress = true;
            e.preventDefault();
        };

        const onDragMove = (e) => {
            if (!isDraggingProgress) return;
            updateTooltip(e.clientX);
            const time = getTimeFromPosition(e.clientX);
            seekVideo(time);
            progressBar.style.width = `${(time / video.duration) * 100}%`;
        };

        const onDragEnd = () => {
            if (isDraggingProgress) {
                isDraggingProgress = false;
                tooltip.style.display = 'none';
            }
        };

        progressWrapper.addEventListener('mouseenter', onMouseEnter);
        progressWrapper.addEventListener('mousemove', onMouseMove);
        progressWrapper.addEventListener('mouseleave', onMouseLeave);
        progressWrapper.addEventListener('click', onClick);
        progressWrapper.addEventListener('mousedown', onDragStart);
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);

        const cleanupDrag = () => {
            progressWrapper.removeEventListener('mouseenter', onMouseEnter);
            progressWrapper.removeEventListener('mousemove', onMouseMove);
            progressWrapper.removeEventListener('mouseleave', onMouseLeave);
            progressWrapper.removeEventListener('click', onClick);
            progressWrapper.removeEventListener('mousedown', onDragStart);
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
        };
        cleanupFns.add(cleanupDrag);
    }

    return {
        create() {
            if (cardEl) cardEl.remove();

            const danmukuBox = document.getElementById('danmukuBox');
            const panelWidth = danmukuBox ? danmukuBox.offsetWidth + 'px' : '260px';

            cardEl = document.createElement('div');
            cardEl.className = 'bili-speed-card';
            cardEl.style.cssText = `
                position: fixed;
                width: ${panelWidth};
                background: #F0F1F2;
                color: #000;
                border-radius: 8px;
                z-index: 9998;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                font-size: 14px;
                display: ${Config.data.cardVisible ? 'block' : 'none'};
                box-sizing: border-box;
            `;

            if (Config.data.cardPosition) {
                cardEl.style.left = Config.data.cardPosition.left;
                cardEl.style.top = Config.data.cardPosition.top;
            } else {
                if (danmukuBox) {
                    const rect = danmukuBox.getBoundingClientRect();
                    cardEl.style.left = rect.left + 'px';
                    cardEl.style.top = rect.top + 'px';
                } else {
                    cardEl.style.right = '20px';
                    cardEl.style.bottom = '100px';
                }
            }

            cardEl.innerHTML = `
                <div class="bili-speed-card-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 12px 8px 12px; cursor: move;">
                    <div class="bili-speed-drag-text" style="font-weight: bold; cursor: default;">⚡ 倍速: <span class="bili-speed-rate">1.0x</span></div>
                    <div class="bili-speed-card-btns" style="visibility: hidden; gap: 4px; display: flex;">
                        <button class="bili-speed-panel-btn" title="快捷键: ${Config.data.keyReset.toUpperCase()}重置 | ${Config.data.keyUp.toUpperCase()}加速 | ${Config.data.keyDown.toUpperCase()}减速" style="background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;">⚙️</button>
                        <button class="bili-speed-close-btn" style="background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">X</button>
                    </div>
                </div>
                <div class="bili-speed-card-main" style="padding: 0 12px 8px 12px;">
                    <div>⏱️ 剩余: <span class="bili-speed-time">00:00 / 00:00</span></div>
                    <div class="bili-speed-collection" style="display: none;"></div>
                </div>
                <div class="bili-speed-card-footer" style="padding: 0 12px 12px 12px; position: relative;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="bili-speed-play-btn" title='播放/暂停' style="color: #fff; border: none; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">▶</button>
                        <div class="bili-speed-progress-wrapper" style="flex: 1; height: 5px; background: #ddd; border-radius: 2px; cursor: pointer; position: relative;">
                            <div class="bili-speed-progress-bar" style="height: 100%; background: #00AEEC; border-radius: 2px; width: 0%;"></div>
                            <div class="bili-speed-progress-tooltip" style="position: absolute; bottom: 12px; left: 0; background: rgba(0,0,0,0.8); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 12px; display: none; white-space: nowrap; transform: translateX(-50%);"></div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(cardEl);

            const btnsContainer = cardEl.querySelector('.bili-speed-card-btns');
            btnsContainer.style.visibility = 'visible';
            setTimeout(() => {
                btnsContainer.style.visibility = 'hidden';
            }, 5000);

            cardEl.addEventListener('mouseenter', () => {
                btnsContainer.style.visibility = 'visible';
            });
            cardEl.addEventListener('mouseleave', () => {
                btnsContainer.style.visibility = 'hidden';
            });

            cardEl.querySelector('.bili-speed-panel-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                EventBus.emit('panel:toggle');
            });

            cardEl.querySelector('.bili-speed-close-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                EventBus.emit('card:toggle');
            });

            dragCleanup = Draggable.make(cardEl, 'cardPosition', '.bili-speed-card-header');

            const video = VideoController.getVideo();
            const playBtn = cardEl.querySelector('.bili-speed-play-btn');

            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!video) return;
                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                }
            });

            const progressWrapper = cardEl.querySelector('.bili-speed-progress-wrapper');
            const progressBar = cardEl.querySelector('.bili-speed-progress-bar');
            const tooltip = cardEl.querySelector('.bili-speed-progress-tooltip');
            initProgressBar(progressWrapper, progressBar, tooltip);

            if (video) {
                const onRateChange = () => updateCard();
                const onTimeUpdate = () => updateCard();
                const onPlay = () => updatePlayBtn(video, playBtn);
                const onPause = () => updatePlayBtn(video, playBtn);

                video.addEventListener('ratechange', onRateChange);
                video.addEventListener('timeupdate', onTimeUpdate);
                video.addEventListener('play', onPlay);
                video.addEventListener('pause', onPause);

                cleanupFns.add(() => {
                    video.removeEventListener('ratechange', onRateChange);
                    video.removeEventListener('timeupdate', onTimeUpdate);
                    video.removeEventListener('play', onPlay);
                    video.removeEventListener('pause', onPause);
                });

                updateCard();
                updatePlayBtn(video, playBtn);
                setTimeout(updateCard, 500);
            }
        },

        toggle() {
            Config.data.cardVisible = !Config.data.cardVisible;
            if (cardEl) {
                cardEl.style.display = Config.data.cardVisible ? 'block' : 'none';
            }
        },

        hide() {
            if (cardEl && Config.data.cardVisible) {
                cardEl.style.display = 'none';
            }
        },

        show() {
            if (cardEl && Config.data.cardVisible) {
                cardEl.style.display = 'block';
            }
        },

        destroy() {
            cleanupFns.forEach(fn => fn());
            cleanupFns.clear();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (cardEl) cardEl.remove();
            cardEl = null;
        }
    };
})();