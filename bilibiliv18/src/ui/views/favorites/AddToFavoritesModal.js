const AddToFavoritesModal = (() => {
    let panelInstance = null;
    let currentVideoInfo = null;
    let selectedGroups = [];
    let confirmBtn = null;

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

    function updateConfirmButtonState() {
        if (!confirmBtn) return;

        if (selectedGroups.length > 0) {
            confirmBtn.disabled = false;
            confirmBtn.style.background = '#00a1d6';
            confirmBtn.style.cursor = 'pointer';
        } else {
            confirmBtn.disabled = true;
            confirmBtn.style.background = '#CCCECF';
            confirmBtn.style.cursor = 'not-allowed';
        }
    }

    function createAddGroupForm(container, onComplete) {
        const form = document.createElement('form');
        form.className = 'input-group';
        form.style.cssText = `
            display: flex;
            gap: 0;
            border: 1px dashed #ddd;
            border-radius: 4px;
            overflow: hidden;
        `;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = form.querySelector('input');
            const name = input.value.trim();
            if (name && onComplete) {
                try {
                    await FavoritesGroups.create(name, {
                        isPublic: false,
                        description: '',
                        image: ''
                    });
                    Toast.show('分组创建成功');
                    await onComplete();
                } catch (error) {
                    Logger.error('创建分组失败:', error);
                    Toast.show('创建失败，请重试');
                }
            }
        });

        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 20;
        input.placeholder = '最多可输入20个字';
        input.style.cssText = `
            flex: 1;
            padding: 10px 12px;
            border: none;
            outline: none;
            font-size: 14px;
            background: transparent;
        `;

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'submit';
        submitBtn.textContent = '新建';
        submitBtn.style.cssText = `
            padding: 10px 20px;
            border: none;
            background: #00a1d6;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
        `;

        form.appendChild(input);
        form.appendChild(submitBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            padding: 10px 16px;
            border: none;
            background: transparent;
            color: #999;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelBtn.addEventListener('click', () => {
            onComplete();
        });

        const rowEl = document.createElement('div');
        rowEl.style.cssText = `
            display: flex;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        `;
        rowEl.appendChild(form);
        rowEl.appendChild(cancelBtn);

        container.innerHTML = '';
        container.appendChild(rowEl);

        input.focus();
    }

    function createAddButton(container, onClick) {
        const addBtn = document.createElement('button');
        addBtn.className = 'group-item add-group-btn';
        addBtn.style.cssText = `
            width: 100%;
            display: flex;
            align-items: center;
            padding: 10px 0;
            border: none;
            border-bottom: 1px solid #eee;
            background: transparent;
            color: #999;
            cursor: pointer;
            font-size: 14px;
            justify-content: flex-start;
            gap: 6px;
        `;
        addBtn.innerHTML = '<span style="font-size: 16px;">+</span> 新建收藏夹';
        addBtn.addEventListener('click', onClick);
        container.innerHTML = '';
        container.appendChild(addBtn);
    }

    async function renderGroupsList(bodyEl) {
        const container = bodyEl.querySelector('.groups-container');
        if (!container) return;

        container.innerHTML = '';

        const groups = await FavoritesGroups.getVisibleForModal();
        const existingItem = currentVideoInfo ? await Favorites.get(currentVideoInfo.id) : null;
        const existingGroups = existingItem ? (existingItem.groups || ['default']) : [];

        selectedGroups = [...existingGroups];
        updateConfirmButtonState();

        groups.forEach(group => {
            const itemEl = document.createElement('div');
            itemEl.className = 'group-item';
            itemEl.style.cssText = `
                display: flex;
                align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid #eee;
                cursor: pointer;
            `;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.cssText = `
                width: 18px;
                height: 18px;
                margin-right: 10px;
                cursor: pointer;
            `;
            checkbox.checked = selectedGroups.includes(group.id);

            const nameEl = document.createElement('span');
            nameEl.style.cssText = `
                flex: 1;
                font-size: 14px;
                color: #333;
            `;
            nameEl.textContent = group.name;

            if (group.isDefault) {
                const badgeEl = document.createElement('span');
                badgeEl.style.cssText = `
                    background: #00a1d6;
                    color: #fff;
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    margin-left: 8px;
                `;
                badgeEl.textContent = '默认';
                nameEl.appendChild(badgeEl);
            }

            itemEl.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
                handleCheckboxChange(group.id, checkbox.checked);
            });

            checkbox.addEventListener('change', () => {
                handleCheckboxChange(group.id, checkbox.checked);
            });

            itemEl.appendChild(checkbox);
            itemEl.appendChild(nameEl);
            container.appendChild(itemEl);
        });

        const addContainer = document.createElement('div');
        addContainer.className = 'add-group-container';
        container.appendChild(addContainer);

        createAddButton(addContainer, () => {
            createAddGroupForm(addContainer, async () => {
                await renderGroupsList(bodyEl);
            });
        });
    }

    function handleCheckboxChange(groupId, checked) {
        if (checked) {
            if (!selectedGroups.includes(groupId)) {
                selectedGroups.push(groupId);
            }
        } else {
            selectedGroups = selectedGroups.filter(id => id !== groupId);
        }
        updateConfirmButtonState();
    }

    async function createPanel(videoInfo) {
        currentVideoInfo = videoInfo || getCurrentVideoInfo();

        panelInstance = Card.create({
            className: 'add-to-favorites-modal',
            header: {
                visible: true,
                draggable: true,
                title: '添加到收藏夹'
            },
            footer: { visible: false },
            styles: {
                width: '380px',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 99999
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.add-to-favorites-modal-actions');

                const closeBtn = document.createElement('button');
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    destroy();
                });

                actionsEl.appendChild(closeBtn);
            },
            onBodyReady: async (bodyEl) => {
                bodyEl.style.cssText = 'padding: 16px;';

                const titleEl = document.createElement('div');
                titleEl.style.cssText = `
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 12px;
                    text-align: center;
                `;
                titleEl.textContent = currentVideoInfo ? `收藏：${currentVideoInfo.title}` : '请选择分组';
                bodyEl.appendChild(titleEl);

                const hintEl = document.createElement('div');
                hintEl.style.cssText = `
                    font-size: 12px;
                    color: #999;
                    margin-bottom: 12px;
                    text-align: center;
                    padding: 8px;
                    background: #f5f5f5;
                    border-radius: 4px;
                `;
                hintEl.textContent = '提示：最多显示10个分组，支持多选';
                bodyEl.appendChild(hintEl);

                const container = document.createElement('div');
                container.className = 'groups-container';
                container.style.cssText = `
                    max-height: 300px;
                    overflow-y: auto;
                `;
                bodyEl.appendChild(container);

                const btnContainer = document.createElement('div');
                btnContainer.style.cssText = `
                    display: flex;
                    margin-top: 16px;
                `;

                confirmBtn = document.createElement('button');
                confirmBtn.textContent = '确认';
                confirmBtn.style.cssText = `
                    flex: 1;
                    padding: 10px 16px;
                    border: none;
                    border-radius: 4px;
                    background: #CCCECF;
                    color: #fff;
                    cursor: not-allowed;
                `;
                confirmBtn.disabled = true;
                confirmBtn.addEventListener('click', async () => {
                    if (currentVideoInfo && selectedGroups.length > 0) {
                        await Favorites.add(currentVideoInfo, selectedGroups);
                    }
                    destroy();
                });

                btnContainer.appendChild(confirmBtn);
                bodyEl.appendChild(btnContainer);

                await renderGroupsList(bodyEl);
            }
        });
    }

    function show(videoInfo) {
        if (panelInstance) {
            destroy();
        }
        createPanel(videoInfo);
    }

    function destroy() {
        if (panelInstance) {
            panelInstance.destroy();
            panelInstance = null;
        }
        currentVideoInfo = null;
        selectedGroups = [];
        confirmBtn = null;
    }

    return {
        show,
        destroy
    };
})();