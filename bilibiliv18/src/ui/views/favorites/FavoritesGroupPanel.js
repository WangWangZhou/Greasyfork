const FavoritesGroupPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let paginationInstance = null;
    let currentPage = 1;
    let groupsUpdateHandler = null;
    const pageSize = 10;

    async function renderGroupsList(containerEl) {
        containerEl.innerHTML = '';

        const allGroups = await FavoritesGroups.getAll();
        const total = allGroups.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const start = (currentPage - 1) * pageSize;
        const pageGroups = allGroups.slice(start, start + pageSize);

        if (pageGroups.length === 0) {
            containerEl.innerHTML = `
                <div style="text-align: center; padding: 40px 0; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 8px;">📁</div>
                    <div>暂无分组</div>
                </div>
            `;
        } else {
            const totalGroups = allGroups.length;
            pageGroups.forEach((group, pageIndex) => {
                const globalIndex = (currentPage - 1) * pageSize + pageIndex;
                containerEl.appendChild(renderGroupItem(group, containerEl, globalIndex, totalGroups));
            });
        }

        if (paginationInstance) {
            paginationInstance.setTotal(total);
            paginationInstance.setCurrentPage(currentPage);
        }
    }

    function renderGroupItem(group, containerEl, index, total) {
        const isFirst = index === 0;
        const isLast = index === total - 1;
        const itemEl = document.createElement('div');
        itemEl.className = 'group-management-item';
        itemEl.style.cssText = `
            display: flex;
            align-items: center;
            padding: 12px 8px;
            border-bottom: 1px solid #eee;
        `;

        const nameEl = document.createElement('div');
        nameEl.style.cssText = `
            flex: 1;
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        const imageContainer = document.createElement('div');
        imageContainer.className = 'group-image-container';
        imageContainer.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 6px;
            overflow: hidden;
            flex-shrink: 0;
            background: #f0f0f0;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        if (group.image) {
            const img = document.createElement('img');
            img.src = group.image;
            img.className = 'group-thumbnail';
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;
            img.onerror = () => {
                imageContainer.innerHTML = '<span style="font-size: 20px;">📁</span>';
            };
            imageContainer.appendChild(img);
        } else {
            const defaultIcon = document.createElement('span');
            defaultIcon.style.cssText = 'font-size: 20px;';
            defaultIcon.textContent = '📁';
            imageContainer.appendChild(defaultIcon);
        }

        const nameTextEl = document.createElement('span');
        nameTextEl.style.cssText = `
            font-size: 14px;
            color: #333;
        `;
        nameTextEl.textContent = group.name;

        nameEl.appendChild(imageContainer);
        nameEl.appendChild(nameTextEl);

        const statusEl = document.createElement('span');
        statusEl.style.cssText = `
            font-size: 12px;
            color: ${group.isVisible ? '#52c41a' : '#999'};
            margin-right: 12px;
        `;
        statusEl.textContent = group.isVisible ? '显示中' : '已隐藏';

        const actionsEl = document.createElement('div');
        actionsEl.style.cssText = `
            display: flex;
            gap: 4px;
        `;

        if (!group.isDefault) {
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '删除';
            deleteBtn.style.cssText = `
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #fff;
                cursor: pointer;
                font-size: 12px;
            `;
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`确定要删除分组「${group.name}」吗？该分组下的收藏不会被删除。`)) {
                    await FavoritesGroups.remove(group.id);
                }
            });

            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = group.isVisible ? '隐藏' : '显示';
            toggleBtn.style.cssText = `
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #fff;
                cursor: pointer;
                font-size: 12px;
            `;
            toggleBtn.addEventListener('click', async () => {
                await FavoritesGroups.setVisible(group.id, !group.isVisible);
            });

            actionsEl.appendChild(deleteBtn);
            actionsEl.appendChild(toggleBtn);
        }

        const publicBtn = document.createElement('button');
        publicBtn.textContent = group.isPublic ? '公开' : '私密';
        publicBtn.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fff;
            color: #333;
            cursor: pointer;
            font-size: 12px;
        `;
        publicBtn.addEventListener('click', async () => {
            const newIsPublic = !group.isPublic;
            await FavoritesGroups.update(group.id, { isPublic: newIsPublic });
            publicBtn.textContent = newIsPublic ? '公开' : '私密';
        });
        actionsEl.appendChild(publicBtn);

        const editBtn = document.createElement('button');
        editBtn.textContent = '编辑';
        editBtn.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fff;
            cursor: pointer;
            font-size: 12px;
        `;
        editBtn.addEventListener('click', () => {
            FavoritesGroupFormPanel.show({
                group: group,
                onSubmit: async (formData) => {
                    try {
                        await FavoritesGroups.update(group.id, {
                            name: formData.name,
                            image: formData.image,
                            description: formData.description,
                            isPublic: formData.isPublic
                        });
                        Toast.show('分组信息已保存');
                    } catch (error) {
                        Logger.error('更新分组失败:', error);
                        Toast.show('保存失败，请重试');
                    }
                }
            });
        });
        actionsEl.appendChild(editBtn);

        const upBtn = document.createElement('button');
        upBtn.textContent = '↑';
        upBtn.title = isFirst ? '已是第一位' : '上移';
        upBtn.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: ${isFirst ? '#f5f5f5' : '#fff'};
            color: ${isFirst ? '#999' : '#333'};
            cursor: ${isFirst ? 'not-allowed' : 'pointer'};
            font-size: 12px;
        `;
        if (!isFirst) {
            upBtn.addEventListener('click', async () => {
                await FavoritesGroups.moveUp(group.id);
            });
        }

        const downBtn = document.createElement('button');
        downBtn.textContent = '↓';
        downBtn.title = isLast ? '已是最后一位' : '下移';
        downBtn.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: ${isLast ? '#f5f5f5' : '#fff'};
            color: ${isLast ? '#999' : '#333'};
            cursor: ${isLast ? 'not-allowed' : 'pointer'};
            font-size: 12px;
        `;
        if (!isLast) {
            downBtn.addEventListener('click', async () => {
                await FavoritesGroups.moveDown(group.id);
            });
        }

        actionsEl.appendChild(upBtn);
        actionsEl.appendChild(downBtn);

        itemEl.appendChild(nameEl);
        itemEl.appendChild(statusEl);
        itemEl.appendChild(actionsEl);

        return itemEl;
    }

    async function createPanel() {
        panelInstance = Card.create({
            className: 'favorites-group-panel',
            header: {
                visible: true,
                draggable: true,
                title: '分组管理'
            },
            footer: { visible: false },
            styles: {
                width: '450px',
                display: 'block',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 99999
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.favorites-group-panel-actions');

                const closeBtn = document.createElement('button');
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    destroy();
                });

                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, null, '[class*="-header"]');
            },
            onBodyReady: async (bodyEl) => {
                bodyEl.style.cssText = 'padding: 16px;';

                const hintEl = document.createElement('div');
                hintEl.style.cssText = `
                    font-size: 12px;
                    color: #999;
                    margin-bottom: 12px;
                    padding: 8px;
                    background: #f5f5f5;
                    border-radius: 4px;
                `;
                hintEl.innerHTML = `
                    💡 <strong>提示</strong>：<br>
                    • 默认分组不可删除<br>
                    • 「添加到收藏夹」弹窗最多显示10个分组（1个默认+9个可见分组）
                `;
                bodyEl.appendChild(hintEl);

                const addBtn = document.createElement('button');
                addBtn.textContent = '+ 新建分组';
                addBtn.style.cssText = `
                    width: 100%;
                    padding: 10px;
                    border: 1px dashed #ddd;
                    border-radius: 4px;
                    background: #fff;
                    color: #666;
                    cursor: pointer;
                    margin-bottom: 12px;
                    font-size: 14px;
                `;
                addBtn.addEventListener('click', () => {
                    FavoritesGroupFormPanel.show({
                        onSubmit: async (formData) => {
                            try {
                                await FavoritesGroups.create(formData.name, {
                                    isPublic: formData.isPublic,
                                    description: formData.description,
                                    image: formData.image
                                });
                                Toast.show('分组创建成功');
                            } catch (error) {
                                Logger.error('创建分组失败:', error);
                                Toast.show('创建失败，请重试');
                            }
                        }
                    });
                });
                bodyEl.appendChild(addBtn);

                const listContainer = document.createElement('div');
                listContainer.style.cssText = `
                    max-height: 300px;
                    overflow-y: auto;
                `;
                bodyEl.appendChild(listContainer);

                const paginationContainer = document.createElement('div');
                paginationContainer.style.cssText = 'margin-top: 12px;';
                bodyEl.appendChild(paginationContainer);

                currentPage = 1;
                paginationInstance = Pagination.create({
                    container: paginationContainer,
                    total: 0,
                    pageSize: pageSize,
                    currentPage: 1,
                    onChange: async (page) => {
                        currentPage = page;
                        await renderGroupsList(listContainer);
                    }
                });

                await renderGroupsList(listContainer);

                groupsUpdateHandler = async () => {
                    await renderGroupsList(listContainer);
                };
                EventBus.on('favoriteGroups:updated', groupsUpdateHandler);
            }
        });
    }

    function show() {
        if (panelInstance) {
            destroy();
        }
        createPanel();
    }

    function destroy() {
        if (groupsUpdateHandler) {
            EventBus.off('favoriteGroups:updated', groupsUpdateHandler);
            groupsUpdateHandler = null;
        }
        if (paginationInstance) {
            paginationInstance.destroy();
            paginationInstance = null;
        }
        if (dragCleanup) {
            dragCleanup();
            dragCleanup = null;
        }
        if (panelInstance) {
            panelInstance.destroy();
            panelInstance = null;
        }
        currentPage = 1;
    }

    return {
        show,
        destroy
    };
})();
