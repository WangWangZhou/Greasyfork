const FavoritesGroups = (() => {
    let isInitialized = false;
    const DEFAULT_GROUP_ID = 'default';

    function generateId() {
        return 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function createDefaultGroup() {
        return {
            id: DEFAULT_GROUP_ID,
            name: '默认收藏夹',
            order: 0,
            isDefault: true,
            isVisible: true,
            isPublic: false,
            description: '',
            image: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    }

    async function ensureInitialized() {
        if (isInitialized) return;

        const groups = await Storage.favoriteGroups.getAll();
        const hasDefault = groups.some(g => g.id === DEFAULT_GROUP_ID);

        if (!hasDefault) {
            const defaultGroup = createDefaultGroup();
            await Storage.favoriteGroups.put(defaultGroup);
            Logger.info('创建了默认收藏夹分组');
        }

        isInitialized = true;
    }

    async function getAll() {
        await ensureInitialized();
        const groups = await Storage.favoriteGroups.getAll();
        return groups.sort((a, b) => a.order - b.order);
    }

    async function getVisibleForModal() {
        await ensureInitialized();
        const groups = await getAll();

        const defaultGroup = groups.find(g => g.id === DEFAULT_GROUP_ID);
        const visibleCustomGroups = groups
            .filter(g => !g.isDefault && g.isVisible)
            .sort((a, b) => a.order - b.order)
            .slice(0, 9);

        const result = [defaultGroup, ...visibleCustomGroups].filter(Boolean);
        return result;
    }

    async function get(id) {
        await ensureInitialized();
        return Storage.favoriteGroups.get(id);
    }

    async function create(name, options = {}) {
        await ensureInitialized();

        const allGroups = await getAll();
        const nextOrder = allGroups.length > 0 
            ? Math.max(...allGroups.map(g => g.order)) + 1 
            : 1;

        const group = {
            id: generateId(),
            name: name || '新分组',
            order: nextOrder,
            isDefault: false,
            isVisible: true,
            isPublic: options.isPublic || false,
            description: options.description || '',
            image: options.image || '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await Storage.favoriteGroups.put(group);
        EventBus.emit('favoriteGroups:created', group);
        EventBus.emit('favoriteGroups:updated');
        Toast.show('分组创建成功');
        return group;
    }

    async function update(id, updates) {
        await ensureInitialized();
        const group = await Storage.favoriteGroups.get(id);

        if (!group) {
            Toast.show('分组不存在');
            return null;
        }

        if (group.isDefault) {
            if (updates.name !== undefined || updates.isDefault !== undefined || updates.isVisible !== undefined) {
                Toast.show('默认分组不可修改');
                return null;
            }
        }

        const updatedGroup = {
            ...group,
            ...updates,
            updatedAt: Date.now()
        };

        await Storage.favoriteGroups.put(updatedGroup);
        EventBus.emit('favoriteGroups:updated', updatedGroup);
        return updatedGroup;
    }

    async function remove(id) {
        await ensureInitialized();
        const group = await Storage.favoriteGroups.get(id);

        if (!group) {
            Toast.show('分组不存在');
            return false;
        }

        if (group.isDefault) {
            Toast.show('默认分组不可删除');
            return false;
        }

        const DEFAULT_GROUP_ID = 'default';

        const allFavorites = await Storage.favorites.getAll();
        let movedCount = 0;

        for (const item of allFavorites) {
            if (item.groups && item.groups.includes(id)) {
                const newGroups = item.groups.filter(g => g !== id);
                if (!newGroups.includes(DEFAULT_GROUP_ID)) {
                    newGroups.push(DEFAULT_GROUP_ID);
                }
                await Storage.favorites.put({ ...item, groups: newGroups });
                movedCount++;
            }
        }

        await Storage.favoriteGroups.remove(id);
        EventBus.emit('favoriteGroups:deleted', group);
        EventBus.emit('favoriteGroups:updated');
        EventBus.emit('favorites:updated');

        if (movedCount > 0) {
            Toast.show(`分组已删除，${movedCount}个收藏已移至默认分组`);
        } else {
            Toast.show('分组删除成功');
        }
        return true;
    }

    async function moveUp(id) {
        await ensureInitialized();
        const groups = await getAll();
        const index = groups.findIndex(g => g.id === id);

        if (index <= 0) {
            Toast.show('已经是第一个了');
            return false;
        }

        const current = groups[index];
        const prev = groups[index - 1];

        if (current.isDefault) {
            if (index >= 10) {
                Toast.show('默认分组不能移出前10位');
                return false;
            }
            [current.order, prev.order] = [prev.order, current.order];
            await Storage.favoriteGroups.put(current);
            await Storage.favoriteGroups.put(prev);
            EventBus.emit('favoriteGroups:updated');
            return true;
        } else {
            if (index < 10) {
                [current.order, prev.order] = [prev.order, current.order];
                await Storage.favoriteGroups.put(current);
                await Storage.favoriteGroups.put(prev);
                EventBus.emit('favoriteGroups:updated');
                return true;
            } else {
                Toast.show('前10个分组位置已固定');
                return false;
            }
        }
    }

    async function moveDown(id) {
        await ensureInitialized();
        const groups = await getAll();
        const index = groups.findIndex(g => g.id === id);

        if (index === -1) {
            Toast.show('分组不存在');
            return false;
        }

        const current = groups[index];
        const next = groups[index + 1];

        if (!next) {
            Toast.show('已经是最后一个了');
            return false;
        }

        if (current.isDefault) {
            if (index >= 9) {
                Toast.show('默认分组不能移出前10位');
                return false;
            }
            [current.order, next.order] = [next.order, current.order];
            await Storage.favoriteGroups.put(current);
            await Storage.favoriteGroups.put(next);
            EventBus.emit('favoriteGroups:updated');
            return true;
        } else {
            if (index < 9) {
                [current.order, next.order] = [next.order, current.order];
                await Storage.favoriteGroups.put(current);
                await Storage.favoriteGroups.put(next);
                EventBus.emit('favoriteGroups:updated');
                return true;
            } else {
                Toast.show('前10个分组位置已固定');
                return false;
            }
        }
    }

    async function setVisible(id, isVisible) {
        await ensureInitialized();
        const group = await Storage.favoriteGroups.get(id);

        if (!group) {
            Toast.show('分组不存在');
            return false;
        }

        if (group.isDefault) {
            Toast.show('默认分组始终可见');
            return false;
        }

        await update(id, { isVisible });
        Toast.show(isVisible ? '分组已显示' : '分组已隐藏');
        return true;
    }

    async function rename(id, newName) {
        await ensureInitialized();
        const group = await Storage.favoriteGroups.get(id);

        if (!group) {
            Toast.show('分组不存在');
            return false;
        }

        if (group.isDefault) {
            Toast.show('默认分组不可重命名');
            return false;
        }

        await update(id, { name: newName });
        Toast.show('分组重命名成功');
        return true;
    }

    return {
        ensureInitialized,
        getAll,
        getVisibleForModal,
        get,
        create,
        update,
        remove,
        moveUp,
        moveDown,
        setVisible,
        rename
    };
})();
