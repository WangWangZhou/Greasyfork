const NotesPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let currentFilter = 'all';
    let currentSearchKeyword = '';
    let currentTagFilter = '';
    let currentTypeFilter = 'all';
    let currentPage = 1;
    let paginationInstance = null;
    const pageSize = 10;

    function getCurrentBvid() {
        const match = location.href.match(/BV[\w]+/);
        return match ? match[0] : '';
    }

    function formatDate(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}`;
    }

    async function getFilteredNotes() {
        let notes = await Notes.getAll();

        if (currentTypeFilter === 'videoNote') {
            notes = notes.filter(n => n.noteType === 'videoNote');
        } else if (currentTypeFilter === 'normalNote') {
            notes = notes.filter(n => n.noteType === 'normalNote');
        }

        if (currentFilter === 'current') {
            const bvid = getCurrentBvid();
            if (bvid) {
                notes = notes.filter(n => n.bvid === bvid);
            }
        }

        if (currentTagFilter) {
            notes = notes.filter(n => n.tags && n.tags.includes(currentTagFilter));
        }

        if (currentSearchKeyword) {
            const kw = currentSearchKeyword.toLowerCase();
            notes = notes.filter(n =>
                n.title.toLowerCase().includes(kw) ||
                n.content.toLowerCase().includes(kw) ||
                n.videoTitle.toLowerCase().includes(kw)
            );
        }

        notes.sort((a, b) => b.updatedAt - a.updatedAt);

        return notes;
    }

    function renderNoteItem(note, containerEl) {
        const itemEl = document.createElement('div');
        itemEl.className = 'bili-speed-note-item';
        itemEl.dataset.id = note.id;

        const tagsHtml = (note.tags && note.tags.length > 0)
            ? note.tags.map(t => `<span class="bili-speed-note-tag">${t}</span>`).join('')
            : '';

        const timestampHtml = note.videoTimestamp > 0
            ? `<span class="bili-speed-note-timestamp" data-timestamp="${note.videoTimestamp}">📍 ${Utils.formatTime(note.videoTimestamp)}</span>`
            : '';

        const editorLabel = note.editorType === 'vditor' ? 'Md' : '富文本';
        const typeLabel = note.noteType === 'normalNote' ? '📄 普通' : '🎬 视频';

        itemEl.innerHTML = `
            <div class="bili-speed-note-item-title">${note.title || '无标题'}</div>
            <div class="bili-speed-note-item-meta">
                <span class="bili-speed-note-type-badge">${typeLabel}</span>
                ${note.noteType === 'videoNote' ? `
                <span class="bili-speed-note-bvid" data-url="${note.videoUrl}" title="${note.videoTitle}">${note.bvid}</span>
                <span>${formatDate(note.updatedAt)}</span>
                ${timestampHtml}
                ` : `
                <span>${formatDate(note.updatedAt)}</span>
                `}
                <span class="bili-speed-note-editor-type">${editorLabel}</span>
            </div>
            <div class="bili-speed-note-item-tags">${tagsHtml}</div>
            <div class="bili-speed-note-item-actions">
                <button class="bili-speed-note-edit-btn" title="编辑笔记">✏️</button>
                <button class="bili-speed-note-delete-btn" title="删除笔记">🗑️</button>
            </div>
        `;

        if (note.noteType === 'videoNote') {
            const bvidEl = itemEl.querySelector('.bili-speed-note-bvid');
            if (bvidEl) {
                bvidEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (note.videoUrl) {
                        window.open(note.videoUrl, '_blank');
                    }
                });
            }

            const timestampEl = itemEl.querySelector('.bili-speed-note-timestamp');
            if (timestampEl) {
                timestampEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const video = VideoController.getVideo();
                    if (video) {
                        video.currentTime = note.videoTimestamp;
                        Toast.show(`跳转到 ${Utils.formatTime(note.videoTimestamp)}`);
                    }
                });
            }
        }

        const editBtn = itemEl.querySelector('.bili-speed-note-edit-btn');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            EventBus.emit('notes:edit', note);
        });

        const deleteBtn = itemEl.querySelector('.bili-speed-note-delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('确定要删除这条笔记吗？')) {
                await Notes.remove(note.id);
            }
        });

        itemEl.addEventListener('mouseenter', () => {
            const actions = itemEl.querySelector('.bili-speed-note-item-actions');
            if (actions) actions.style.opacity = '1';
            itemEl.style.background = '#f5f5f5';
        });

        itemEl.addEventListener('mouseleave', () => {
            const actions = itemEl.querySelector('.bili-speed-note-item-actions');
            if (actions) actions.style.opacity = '0';
            itemEl.style.background = '';
        });

        return itemEl;
    }

    async function renderNotesList(containerEl) {
        containerEl.innerHTML = '';

        const allNotes = await getFilteredNotes();
        const total = allNotes.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const start = (currentPage - 1) * pageSize;
        const pageData = allNotes.slice(start, start + pageSize);

        if (pageData.length === 0) {
            containerEl.innerHTML = `
                <div style="text-align: center; padding: 40px 0; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 8px;">📭</div>
                    <div>${currentSearchKeyword || currentTagFilter || currentFilter === 'current' ? '没有匹配的笔记' : '暂无笔记'}</div>
                </div>
            `;
        } else {
            pageData.forEach(note => {
                containerEl.appendChild(renderNoteItem(note, containerEl));
            });
        }

        if (paginationInstance) {
            paginationInstance.setTotal(total);
        }
    }

    async function renderFilterBar(bodyEl) {
        const bvid = getCurrentBvid();
        const allTags = await Notes.getAllTags();
        const currentNoteCount = bvid ? await Notes.countByBvid(bvid) : 0;
        const videoNoteCount = await Notes.countByType('videoNote');
        const normalNoteCount = await Notes.countByType('normalNote');

        const filterBar = document.createElement('div');
        filterBar.className = 'bili-speed-notes-filter';
        filterBar.innerHTML = `
            <div class="bili-speed-notes-search">
                <input type="text" class="bili-speed-notes-search-input" placeholder="搜索笔记..." value="${currentSearchKeyword}">
            </div>
            <div class="bili-speed-notes-filter-tabs">
                <button class="bili-speed-notes-filter-btn ${currentTypeFilter === 'all' ? 'active' : ''}" data-type="all">全部</button>
                <button class="bili-speed-notes-filter-btn ${currentTypeFilter === 'videoNote' ? 'active' : ''}" data-type="videoNote">🎬 视频笔记${videoNoteCount > 0 ? `(${videoNoteCount})` : ''}</button>
                <button class="bili-speed-notes-filter-btn ${currentTypeFilter === 'normalNote' ? 'active' : ''}" data-type="normalNote">📄 普通笔记${normalNoteCount > 0 ? `(${normalNoteCount})` : ''}</button>
            </div>
            <div class="bili-speed-notes-filter-tabs">
                <button class="bili-speed-notes-filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">全部视频</button>
                <button class="bili-speed-notes-filter-btn ${currentFilter === 'current' ? 'active' : ''}" data-filter="current">当前视频${currentNoteCount > 0 ? `(${currentNoteCount})` : ''}</button>
                ${allTags.length > 0 ? `
                <select class="bili-speed-notes-tag-select">
                    <option value="">全部标签</option>
                    ${allTags.map(t => `<option value="${t}" ${currentTagFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                ` : ''}
            </div>
        `;

        async function onFilterChange() {
            currentPage = 1;
            const listEl = bodyEl.querySelector('.bili-speed-notes-list');
            if (listEl) await renderNotesList(listEl);
        }

        const searchInput = filterBar.querySelector('.bili-speed-notes-search-input');
        let searchTimer = null;
        searchInput.addEventListener('input', (e) => {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(async () => {
                currentSearchKeyword = e.target.value.trim();
                await onFilterChange();
            }, 300);
        });

        filterBar.querySelectorAll('[data-type]').forEach(btn => {
            btn.addEventListener('click', async () => {
                currentTypeFilter = btn.dataset.type;
                filterBar.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await onFilterChange();
            });
        });

        filterBar.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', async () => {
                currentFilter = btn.dataset.filter;
                filterBar.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await onFilterChange();
            });
        });

        const tagSelect = filterBar.querySelector('.bili-speed-notes-tag-select');
        if (tagSelect) {
            tagSelect.addEventListener('change', async (e) => {
                currentTagFilter = e.target.value;
                await onFilterChange();
            });
        }

        bodyEl.appendChild(filterBar);
    }

    async function createPanel() {
        let savedPosition = Config.data.notesPanelPosition;
        const currentTheme = Config.data.theme || 'light';

        const noteCount = await Notes.count();

        panelInstance = Card.create({
            className: `bili-speed-notes-panel theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: '📝 视频笔记'
            },
            footer: { visible: false },
            styles: {
                width: '380px',
                display: Config.data.notesPanelVisible ? 'block' : 'none',
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
                const actionsEl = headerEl.querySelector('.bili-speed-notes-panel-actions');

                const exportBtn = document.createElement('button');
                exportBtn.className = 'bili-speed-notes-export';
                exportBtn.title = '导出笔记数据';
                exportBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;';
                exportBtn.textContent = '📤';
                exportBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    Notes.downloadExport();
                });

                const addBtn = document.createElement('button');
                addBtn.className = 'bili-speed-notes-add';
                addBtn.title = '新建笔记';
                addBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;';
                addBtn.textContent = '➕';
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    EventBus.emit('notes:new');
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-notes-close';
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    EventBus.emit('notes:toggle');
                });

                actionsEl.appendChild(exportBtn);
                actionsEl.appendChild(addBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'notesPanelPosition', `[class*="-header"]`);
            },
            onBodyReady: async (bodyEl) => {
                bodyEl.className = 'bili-speed-notes-panel-body';
                bodyEl.style.cssText = 'padding: 8px; max-height: 500px; overflow-y: auto; display: flex; flex-direction: column;';

                await renderFilterBar(bodyEl);

                const listEl = document.createElement('div');
                listEl.className = 'bili-speed-notes-list';
                bodyEl.appendChild(listEl);

                const paginationContainer = document.createElement('div');
                paginationContainer.className = 'bili-speed-notes-pagination';
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
                        const list = bodyEl.querySelector('.bili-speed-notes-list');
                        if (list) await renderNotesList(list);
                    }
                });

                await renderNotesList(listEl);

                const countEl = document.createElement('div');
                countEl.className = 'bili-speed-notes-count';
                countEl.style.cssText = 'text-align: center; padding: 8px 0; font-size: 12px; color: #999;';
                countEl.textContent = `共 ${noteCount} 条笔记`;
                bodyEl.appendChild(countEl);

                EventBus.on('notes:updated', async () => {
                    if (panelInstance && bodyEl) {
                        currentPage = 1;
                        const list = bodyEl.querySelector('.bili-speed-notes-list');
                        const count = bodyEl.querySelector('.bili-speed-notes-count');
                        if (list) await renderNotesList(list);
                        if (count) {
                            const newCount = await Notes.count();
                            count.textContent = `共 ${newCount} 条笔记`;
                        }
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

            currentFilter = 'all';
            currentSearchKeyword = '';
            currentTagFilter = '';
            currentTypeFilter = 'all';
            currentPage = 1;

            createPanel();
        },

        toggle() {
            Config.data.notesPanelVisible = !Config.data.notesPanelVisible;
            if (panelInstance) {
                panelInstance.element.style.display = Config.data.notesPanelVisible ? 'block' : 'none';
            }
        },

        show() {
            Config.data.notesPanelVisible = true;
            if (panelInstance) {
                panelInstance.element.style.display = 'block';
            }
        },

        hide() {
            Config.data.notesPanelVisible = false;
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
