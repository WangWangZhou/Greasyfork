/**
 * FavoritesPanel - 收藏夹面板视图
 * 视图层 - 使用Card组件渲染收藏夹面板
 */
const FavoritesPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;

    function getCurrentVideoInfo() {
        const url = location.href;
        const match = url.match(/BV[\w]+/);
        if (!match) return null;

        const bvid = match[0];
        const video = VideoController.getVideo();
        
        let title = document.querySelector('h1.video-title, .video-title-href, h1[class*="title"]')?.textContent?.trim() || '未知标题';
        let author = document.querySelector('.up-name, a.up-name, [class*="up-name"]')?.textContent?.trim() || '未知UP主';
        let cover = document.querySelector('meta[property="og:image"]')?.content || '';
        
        return {
            id: bvid,
            bvid: bvid,
            title: title,
            author: author,
            duration: video ? video.duration : 0,
            cover: cover,
            url: url,
            addedAt: Date.now()
        };
    }

    function renderFavoriteItem(item, containerEl) {
        const itemEl = document.createElement('div');
        itemEl.className = 'bili-speed-favorite-item';
        itemEl.dataset.id = item.id;
        itemEl.style.cssText = `
            display: flex;
            gap: 12px;
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
            position: relative;
        `;

        const coverEl = document.createElement('img');
        coverEl.src = item.cover || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect fill="%23ddd" width="60" height="60"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">暂无</text></svg>';
        coverEl.style.cssText = `
            width: 60px;
            height: 60px;
            border-radius: 4px;
            object-fit: cover;
            flex-shrink: 0;
        `;
        coverEl.onerror = () => {
            coverEl.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect fill="%23ddd" width="60" height="60"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">暂无</text></svg>';
        };

        const infoEl = document.createElement('div');
        infoEl.style.cssText = `
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
        `;

        const titleEl = document.createElement('div');
        titleEl.className = 'bili-speed-favorite-title';
        titleEl.textContent = item.title;
        titleEl.style.cssText = `
            font-size: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;

        const metaEl = document.createElement('div');
        metaEl.style.cssText = `
            font-size: 12px;
            color: #999;
            display: flex;
            gap: 8px;
        `;

        const authorEl = document.createElement('span');
        authorEl.textContent = item.author;

        const durationEl = document.createElement('span');
        durationEl.textContent = Utils.formatTime(item.duration);

        metaEl.appendChild(authorEl);
        metaEl.appendChild(durationEl);

        infoEl.appendChild(titleEl);
        infoEl.appendChild(metaEl);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'bili-speed-favorite-delete';
        deleteBtn.textContent = '×';
        deleteBtn.style.cssText = `
            position: absolute;
            right: 4px;
            top: 4px;
            background: rgba(255, 0, 0, 0.8);
            color: #fff;
            border: none;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            font-size: 12px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        itemEl.appendChild(coverEl);
        itemEl.appendChild(infoEl);
        itemEl.appendChild(deleteBtn);

        itemEl.addEventListener('mouseenter', () => {
            deleteBtn.style.opacity = '1';
            itemEl.style.background = '#f5f5f5';
        });

        itemEl.addEventListener('mouseleave', () => {
            deleteBtn.style.opacity = '0';
            itemEl.style.background = '';
        });

        itemEl.addEventListener('click', (e) => {
            if (e.target === deleteBtn) return;
            window.open(item.url, '_blank');
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            Favorites.remove(item.id);
            renderFavoritesList(containerEl);
        });

        return itemEl;
    }

    function renderFavoritesList(containerEl) {
        containerEl.innerHTML = '';
        
        const favorites = Favorites.getAll();
        
        if (favorites.length === 0) {
            containerEl.innerHTML = `
                <div style="text-align: center; padding: 40px 0; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 8px;">📭</div>
                    <div>暂无收藏</div>
                </div>
            `;
            return;
        }

        favorites.forEach(item => {
            containerEl.appendChild(renderFavoriteItem(item, containerEl));
        });
    }

    function createPanel() {
        let savedPosition = Config.data.favoritesPanelPosition;

        panelInstance = Card.create({
            className: 'bili-speed-favorites-panel',
            header: {
                visible: true,
                draggable: true,
                title: '⭐ 收藏夹'
            },
            footer: { visible: false },
            styles: {
                width: '320px',
                display: Config.data.favoritesPanelVisible ? 'block' : 'none',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 9999,
                ...(savedPosition ? {
                    left: savedPosition.left,
                    top: savedPosition.top,
                    transform: 'none'
                } : {})
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.bili-speed-favorites-panel-actions');
                
                const exportBtn = document.createElement('button');
                exportBtn.className = 'bili-speed-favorites-export';
                exportBtn.title = '导出收藏数据';
                exportBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;';
                exportBtn.textContent = '📤';
                exportBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    Favorites.downloadExport();
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-favorites-close';
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    EventBus.emit('favorites:toggle');
                });

                actionsEl.appendChild(exportBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'favoritesPanelPosition', `[class*="-header"]`);
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-favorites-panel-body';
                bodyEl.style.cssText = 'padding: 8px; max-height: 400px; overflow-y: auto;';

                renderFavoritesList(bodyEl);

                EventBus.on('favorites:updated', () => {
                    if (panelInstance && bodyEl) {
                        renderFavoritesList(bodyEl);
                    }
                });
            }
        });
    }

    return {
        create() {
            if (panelInstance) panelInstance.destroy();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;

            createPanel();
        },

        toggle() {
            Config.data.favoritesPanelVisible = !Config.data.favoritesPanelVisible;
            if (panelInstance) {
                panelInstance.element.style.display = Config.data.favoritesPanelVisible ? 'block' : 'none';
            }
        },

        show() {
            Config.data.favoritesPanelVisible = true;
            if (panelInstance) {
                panelInstance.element.style.display = 'block';
            }
        },

        hide() {
            Config.data.favoritesPanelVisible = false;
            if (panelInstance) {
                panelInstance.element.style.display = 'none';
            }
        },

        addCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }
            return Favorites.add(videoInfo);
        },

        removeCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }
            return Favorites.remove(videoInfo.id);
        },

        toggleCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }
            
            if (Favorites.has(videoInfo.id)) {
                return Favorites.remove(videoInfo.id);
            } else {
                return Favorites.add(videoInfo);
            }
        },

        isCurrentVideoFavorited() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) return false;
            return Favorites.has(videoInfo.id);
        },

        destroy() {
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
        }
    };
})();
