/**
 * CardPanel - 信息卡片视图
 * 视图层 - 使用Card和Progress组件渲染悬浮信息卡片
 */
const CardPanel = (() => {
    let cardInstance = null;
    let progressInstance = null;
    let playBtn = null;
    let rateEl = null;
    let timeEl = null;
    let collectionEl = null;
    let dragCleanup = null;
    let favoriteBtn = null;
    const cleanupFns = new Set();

    function updateCard() {
        const video = VideoController.getVideo();
        if (!video || !cardInstance) return;

        if (rateEl) rateEl.textContent = `${video.playbackRate}x`;

        if (timeEl) {
            const remaining = video.duration - video.currentTime;
            timeEl.textContent = `${Utils.formatTime(remaining)} / ${Utils.formatTime(video.duration)}`;
        }

        if (progressInstance) {
            progressInstance.setDuration(video.duration);
            progressInstance.setProgress(video.currentTime);
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

        updateFavoriteBtn();
    }

    function updatePlayBtn(video) {
        if (!video || !playBtn) return;
        playBtn.textContent = video.paused ? '▶' : '⏸';
    }

    function updateFavoriteBtn() {
        if (!favoriteBtn) return;
        const isFavorited = FavoritesPanel.isCurrentVideoFavorited();
        favoriteBtn.textContent = isFavorited ? '★' : '☆';
        favoriteBtn.classList.toggle('favorited', isFavorited);
        favoriteBtn.title = isFavorited ? '取消收藏' : '添加收藏';
    }

    function createCard() {
        const danmukuBox = document.getElementById('danmukuBox');
        const panelWidth = danmukuBox ? danmukuBox.offsetWidth + 'px' : '260px';

        let savedPosition = Config.data.cardPosition;
        let initialPosition = { left: '20px', bottom: '100px' };

        if (danmukuBox) {
            const rect = danmukuBox.getBoundingClientRect();
            initialPosition = { left: rect.left + 'px', top: rect.top + 'px' };
        }

        if (savedPosition) {
            initialPosition = savedPosition;
        }

        const currentTheme = Config.data.theme || 'light';

        cardInstance = Card.create({
            className: `bili-speed-card theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: `⚡ 倍速: <span class="bili-speed-rate">1.0x</span>`
            },
            footer: { visible: true },
            styles: {
                width: panelWidth,
                display: Config.data.cardVisible ? 'block' : 'none',
                ...(savedPosition ? {
                    left: savedPosition.left,
                    top: savedPosition.top,
                    right: 'auto',
                    bottom: 'auto'
                } : initialPosition)
            },
            onHeaderReady: (headerEl) => {
                rateEl = headerEl.querySelector('.bili-speed-rate');

                const actionsEl = headerEl.querySelector('.bili-speed-card-actions');
                if (!actionsEl) {
                    console.error('actionsEl is null');
                    return;
                }
                
                // 确保 actionsEl 可以点击
                actionsEl.style.zIndex = '1000';
                actionsEl.style.pointerEvents = 'auto';
                actionsEl.style.visibility = 'visible';

                favoriteBtn = document.createElement('button');
                favoriteBtn.className = 'bili-speed-favorite-btn';
                favoriteBtn.title = '添加收藏';
                favoriteBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; position: relative; z-index: 1000; pointer-events: auto;';
                favoriteBtn.textContent = '☆';
                favoriteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    FavoritesPanel.toggleCurrentVideo();
                    updateFavoriteBtn();
                });

                const settingsBtn = document.createElement('button');
                settingsBtn.className = 'bili-speed-panel-btn';
                settingsBtn.title = `快捷键: ${Config.data.keyReset.toUpperCase()}重置 | ${Config.data.keyUp.toUpperCase()}加速 | ${Config.data.keyDown.toUpperCase()}减速`;
                settingsBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; position: relative; z-index: 1000; pointer-events: auto;';
                settingsBtn.textContent = '⚙️';
                settingsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (EventBus) {
                        EventBus.emit('panel:toggle');
                    }
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-close-btn';
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; position: relative; z-index: 1000; pointer-events: auto;';
                closeBtn.textContent = 'X';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (EventBus) {
                        EventBus.emit('card:toggle');
                    }
                });

                actionsEl.appendChild(favoriteBtn);
                actionsEl.appendChild(settingsBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'cardPosition', `.bili-speed-card-header`);

                updateFavoriteBtn();
            },
            onBodyReady: (bodyEl) => {
                bodyEl.innerHTML = `
                    <div>⏱️ 剩余: <span class="bili-speed-time">00:00 / 00:00</span></div>
                    <div class="bili-speed-collection" style="display: none;"></div>
                `;

                timeEl = bodyEl.querySelector('.bili-speed-time');
                collectionEl = bodyEl.querySelector('.bili-speed-collection');
            },
            onFooterReady: (footerEl) => {
                footerEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="bili-speed-play-btn" title="播放/暂停" style="color: #fff; border: none; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">▶</button>
                        <div class="bili-speed-progress-wrapper" style="flex: 1; height: 5px; background: #ddd; border-radius: 2px; cursor: pointer; position: relative;">
                            <div class="bili-speed-progress-bar" style="height: 100%; background: #00AEEC; border-radius: 2px; width: 0%;"></div>
                            <div class="bili-speed-progress-tooltip" style="position: absolute; bottom: 12px; left: 0; background: rgba(0,0,0,0.8); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 12px; display: none; white-space: nowrap; transform: translateX(-50%);"></div>
                        </div>
                    </div>
                `;

                playBtn = footerEl.querySelector('.bili-speed-play-btn');
                const progressWrapper = footerEl.querySelector('.bili-speed-progress-wrapper');
                const progressBar = footerEl.querySelector('.bili-speed-progress-bar');
                const tooltip = footerEl.querySelector('.bili-speed-progress-tooltip');

                const video = VideoController.getVideo();
                updatePlayBtn(video);

                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!video) return;
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                });

                let isDraggingProgress = false;
                const getTimeFromPosition = (clientX) => {
                    if (!video || !video.duration) return 0;
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

                const cleanupProgress = () => {
                    progressWrapper.removeEventListener('mouseenter', onMouseEnter);
                    progressWrapper.removeEventListener('mousemove', onMouseMove);
                    progressWrapper.removeEventListener('mouseleave', onMouseLeave);
                    progressWrapper.removeEventListener('click', onClick);
                    progressWrapper.removeEventListener('mousedown', onDragStart);
                    document.removeEventListener('mousemove', onDragMove);
                    document.removeEventListener('mouseup', onDragEnd);
                };
                cleanupFns.add(cleanupProgress);

                const updateProgress = () => {
                    if (!video || !video.duration) return;
                    progressBar.style.width = `${(video.currentTime / video.duration) * 100}%`;
                };

                if (video) {
                    video.addEventListener('timeupdate', updateProgress);
                    cleanupFns.add(() => video.removeEventListener('timeupdate', updateProgress));
                    updateProgress();
                }
            }
        });

        const video = VideoController.getVideo();
        if (video) {
            const onRateChange = () => updateCard();
            const onTimeUpdate = () => updateCard();
            const onPlay = () => updatePlayBtn(video);
            const onPause = () => updatePlayBtn(video);

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
            updatePlayBtn(video);
            setTimeout(updateCard, 500);
        }

        EventBus.on('favorites:updated', updateFavoriteBtn);
    }

    return {
        create() {
            if (cardInstance) cardInstance.destroy();
            cleanupFns.forEach(fn => fn());
            cleanupFns.clear();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            progressInstance = null;

            createCard();
        },

        toggle() {
            Config.data.cardVisible = !Config.data.cardVisible;
            if (cardInstance) {
                cardInstance.element.style.display = Config.data.cardVisible ? 'block' : 'none';
            }
        },

        hide() {
            if (cardInstance && Config.data.cardVisible) {
                cardInstance.element.style.display = 'none';
            }
        },

        show() {
            if (cardInstance && Config.data.cardVisible) {
                cardInstance.element.style.display = 'block';
            }
        },

        applyTheme(theme) {
            if (!cardInstance) return;
            const cardEl = cardInstance.element;
            cardEl.classList.remove('theme-light', 'theme-dark');
            cardEl.classList.add(`theme-${theme}`);
        },

        destroy() {
            cleanupFns.forEach(fn => fn());
            cleanupFns.clear();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (progressInstance) progressInstance.destroy();
            progressInstance = null;
            if (cardInstance) cardInstance.destroy();
            cardInstance = null;
            rateEl = null;
            timeEl = null;
            collectionEl = null;
            playBtn = null;
            favoriteBtn = null;
        }
    };
})();
