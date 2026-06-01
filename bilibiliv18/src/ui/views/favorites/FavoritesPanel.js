const FavoritesPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let currentPage = 1;
    let paginationInstance = null;
    let currentGroupId = null;
    const pageSize = 10;

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

    function renderFavoriteItem(item, containerEl, groupMap) {
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
            flex-wrap: wrap;
        `;

        const authorEl = document.createElement('span');
        authorEl.textContent = item.author;

        const durationEl = document.createElement('span');
        durationEl.textContent = Utils.formatTime(item.duration);

        const groupsContainer = document.createElement('div');
        groupsContainer.style.cssText = `
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        `;
        if (item.groups && item.groups.length > 0) {
            item.groups.forEach(groupId => {
                const groupBadge = document.createElement('span');
                groupBadge.style.cssText = `
                    background: #e6f7ff;
                    color: #1890ff;
                    padding: 0 4px;
                    border-radius: 2px;
                    font-size: 10px;
                `;
                const groupName = groupMap.get(groupId) || (groupId === 'default' ? '默认' : groupId);
                groupBadge.textContent = groupName;
                groupsContainer.appendChild(groupBadge);
            });
        }

        metaEl.appendChild(authorEl);
        metaEl.appendChild(durationEl);
        metaEl.appendChild(groupsContainer);

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

        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await Favorites.remove(item.id);
        });

        return itemEl;
    }

    async function renderFavoritesList(containerEl) {
        containerEl.innerHTML = '';

        const allFavorites = await Favorites.getAll(currentGroupId);
        const total = allFavorites.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const start = (currentPage - 1) * pageSize;
        const pageData = allFavorites.slice(start, start + pageSize);

        const groups = await FavoritesGroups.getAll();
        const groupMap = new Map();
        groups.forEach(group => {
            groupMap.set(group.id, group.name);
        });

        if (pageData.length === 0) {
            containerEl.innerHTML = `
                <div style="text-align: center; padding: 40px 0; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 8px;">📭</div>
                    <div>暂无收藏</div>
                </div>
            `;
        } else {
            pageData.forEach(item => {
                containerEl.appendChild(renderFavoriteItem(item, containerEl, groupMap));
            });
        }

        if (paginationInstance) {
            paginationInstance.setTotal(total);
        }
    }

    async function createPanel() {
        let savedPosition = Config.data.favoritesPanelPosition;
        const currentTheme = Config.data.theme || 'light';

        panelInstance = Card.create({
            className: `bili-speed-favorites-panel theme-${currentTheme}`,
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

                const manageBtn = document.createElement('button');
                manageBtn.title = '管理分组';
                manageBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;';
                manageBtn.textContent = '📁';
                manageBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    FavoritesGroupPanel.show();
                });

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

                actionsEl.appendChild(manageBtn);
                actionsEl.appendChild(exportBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'favoritesPanelPosition', `[class*="-header"]`);
            },
            onBodyReady: async (bodyEl) => {
                bodyEl.className = 'bili-speed-favorites-panel-body';
                bodyEl.style.cssText = 'padding: 8px; max-height: 400px; overflow-y: auto; display: flex; flex-direction: column;';

                const filterContainer = document.createElement('div');
                filterContainer.style.cssText = `
                    display: flex;
                    gap: 4px;
                    flex-wrap: wrap;
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #eee;
                `;

                const allBtn = document.createElement('button');
                allBtn.textContent = '全部';
                allBtn.style.cssText = `
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    background: ${!currentGroupId ? '#00a1d6' : '#fff'};
                    color: ${!currentGroupId ? '#fff' : '#666'};
                    cursor: pointer;
                    font-size: 12px;
                `;
                allBtn.addEventListener('click', async () => {
                    currentGroupId = null;
                    currentPage = 1;
                    await renderGroupsFilter(filterContainer);
                    await renderFavoritesList(listEl);
                });

                filterContainer.appendChild(allBtn);

                const listEl = document.createElement('div');
                listEl.className = 'bili-speed-favorites-list';
                bodyEl.appendChild(filterContainer);
                bodyEl.appendChild(listEl);

                const paginationContainer = document.createElement('div');
                paginationContainer.className = 'bili-speed-favorites-pagination';
                bodyEl.appendChild(paginationContainer);

                currentPage = 1;
                if (paginationInstance) {
                    paginationInstance.destroy();
                    paginationInstance = null;
                }

                paginationInstance = Pagination.create({
                    container: paginationContainer,
                    total: 0,
                    pageSize: pageSize,
                    currentPage: 1,
                    theme: Config.data.theme || 'light',
                    onChange: async (page) => {
                        currentPage = page;
                        const list = bodyEl.querySelector('.bili-speed-favorites-list');
                        if (list) await renderFavoritesList(list);
                    }
                });

                async function renderGroupsFilter(container) {
                    const existingButtons = container.querySelectorAll('button:not(:first-child)');
                    existingButtons.forEach(btn => btn.remove());

                    const groups = await FavoritesGroups.getAll();
                    groups.forEach(group => {
                        const btn = document.createElement('button');
                        btn.textContent = group.name;
                        btn.style.cssText = `
                            padding: 4px 8px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            background: ${currentGroupId === group.id ? '#00a1d6' : '#fff'};
                            color: ${currentGroupId === group.id ? '#fff' : '#666'};
                            cursor: pointer;
                            font-size: 12px;
                        `;
                        btn.addEventListener('click', async () => {
                            currentGroupId = group.id;
                            currentPage = 1;
                            await renderGroupsFilter(container);
                            await renderFavoritesList(listEl);
                        });
                        container.appendChild(btn);
                    });

                    const allButton = container.querySelector('button:first-child');
                    if (allButton) {
                        allButton.style.background = !currentGroupId ? '#00a1d6' : '#fff';
                        allButton.style.color = !currentGroupId ? '#fff' : '#666';
                    }
                }

                await renderGroupsFilter(filterContainer);
                await renderFavoritesList(listEl);

                EventBus.on('favorites:updated', async () => {
                    if (panelInstance && bodyEl) {
                        currentPage = 1;
                        const list = bodyEl.querySelector('.bili-speed-favorites-list');
                        if (list) await renderFavoritesList(list);
                    }
                });

                EventBus.on('favoriteGroups:updated', async () => {
                    if (panelInstance && bodyEl) {
                        await renderGroupsFilter(filterContainer);
                        await renderFavoritesList(listEl);
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

        applyTheme(theme) {
            if (!panelInstance) return;
            const el = panelInstance.element;
            el.classList.remove('theme-light', 'theme-dark');
            el.classList.add(`theme-${theme}`);
            if (paginationInstance) {
                paginationInstance.setTheme(theme);
            }
        },

        async addCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }
            return await Favorites.add(videoInfo);
        },

        async removeCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }
            return await Favorites.remove(videoInfo.id);
        },

        async toggleCurrentVideo() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) {
                Toast.show('无法获取当前视频信息');
                return false;
            }

            if (await Favorites.has(videoInfo.id)) {
                return await Favorites.remove(videoInfo.id);
            } else {
                return await Favorites.add(videoInfo);
            }
        },

        async isCurrentVideoFavorited() {
            const videoInfo = getCurrentVideoInfo();
            if (!videoInfo) return false;
            return await Favorites.has(videoInfo.id);
        },

        destroy() {
            if (paginationInstance) {
                paginationInstance.destroy();
                paginationInstance = null;
            }
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
        }
    };
})();
