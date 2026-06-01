const Favorites = (() => {
    const DEFAULT_VIDEO = {
        id: 'BV123456789x',
        bvid: 'BV123456789x',
        title: '默认视频',
        author: '默认UP主',
        duration: 0,
        cover: '',
        url: 'https://www.bilibili.com/video/BV123456789x',
        addedAt: new Date('2026-06-01').getTime(),
        groups: ['default']
    };

    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return str.replace(/[&<>"']/g, char => escapeMap[char]);
    }

    function validateItem(item) {
        if (!item || typeof item !== 'object') return false;
        if (!item.id || typeof item.id !== 'string') return false;
        if (!item.bvid || typeof item.bvid !== 'string') return false;
        if (!item.title || typeof item.title !== 'string') return false;
        if (!item.url || typeof item.url !== 'string') return false;
        return true;
    }

    function sanitizeItem(item) {
        return {
            id: escapeHtml(String(item.id)),
            bvid: escapeHtml(String(item.bvid)),
            title: escapeHtml(String(item.title)),
            author: escapeHtml(String(item.author || '未知')),
            duration: Math.max(0, parseInt(item.duration) || 0),
            cover: escapeHtml(String(item.cover || '')),
            url: escapeHtml(String(item.url)),
            addedAt: parseInt(item.addedAt) || Date.now(),
            groups: item.groups && Array.isArray(item.groups) ? item.groups : ['default']
        };
    }

    async function ensureGroupsInitialized() {
        await FavoritesGroups.ensureInitialized();
    }

    async function remove(id, groupId) {
        await ensureGroupsInitialized();
        if (!id) return false;

        const existing = await Storage.favorites.get(id);
        if (!existing) {
            Logger.warn('未找到要删除的收藏项');
            return false;
        }

        if (groupId) {
            const currentGroups = existing.groups || ['default'];
            const newGroups = currentGroups.filter(g => g !== groupId);
            
            if (newGroups.length === 0) {
                await Storage.favorites.remove(id);
                Toast.show('已从所有分组移除');
            } else {
                await Storage.favorites.put({ ...existing, groups: newGroups });
                Toast.show('已从分组移除');
            }
        } else {
            await Storage.favorites.remove(id);
            Toast.show('已从收藏夹移除');
        }
        
        EventBus.emit('favorites:remove', existing);
        EventBus.emit('favorites:updated');
        return true;
    }

    EventBus.on('favorites:removeVideo', async (bvid) => {
        try {
            await remove(bvid);
        } catch (err) {
            Logger.error('删除视频收藏失败:', err);
        }
    });

    return {
        async add(item, groupIds) {
            await ensureGroupsInitialized();
            if (!validateItem(item)) {
                Logger.warn('无效的收藏项');
                return false;
            }

            const existing = await Storage.favorites.get(item.id);
            
            const groupsToAdd = groupIds && groupIds.length > 0 ? groupIds : ['default'];
            
            if (existing) {
                const currentGroups = existing.groups || ['default'];
                const newGroups = [...new Set([...currentGroups, ...groupsToAdd])];
                const updatedItem = { ...existing, groups: newGroups };
                await Storage.favorites.put(updatedItem);
                EventBus.emit('favorites:updated');
                Toast.show('已更新收藏分组');
                return true;
            }

            const sanitizedItem = sanitizeItem({ ...item, groups: groupsToAdd });
            
            try {
                await Storage.favorites.put(sanitizedItem);
                EventBus.emit('favorites:add', sanitizedItem);
                EventBus.emit('favorites:updated');
                Toast.show('已添加到收藏夹');
                return true;
            } catch (err) {
                Logger.error('添加收藏失败:', err);
                Toast.show('添加收藏失败');
                return false;
            }
        },

        async remove(id, groupId) {
            return remove(id, groupId);
        },

        async get(id) {
            await ensureGroupsInitialized();
            if (!id) return null;
            try {
                return await Storage.favorites.get(id);
            } catch (err) {
                Logger.error('获取收藏失败:', err);
                return null;
            }
        },

        async getAll(groupId) {
            await ensureGroupsInitialized();
            try {
                const all = await Storage.favorites.getAll();
                if (!groupId) return all;
                return all.filter(item => (item.groups || ['default']).includes(groupId));
            } catch (err) {
                Logger.error('获取所有收藏失败:', err);
                return [];
            }
        },

        async has(id, groupId) {
            await ensureGroupsInitialized();
            if (!id) return false;
            const item = await this.get(id);
            if (!item) return false;
            
            if (!groupId) return true;
            return (item.groups || ['default']).includes(groupId);
        },

        async clear() {
            await ensureGroupsInitialized();
            try {
                await Storage.favorites.clear();
                if (typeof GM_setValue === 'function') {
                    GM_setValue('favorites', null);
                }
                EventBus.emit('favorites:clear');
                EventBus.emit('favorites:updated');
                Toast.show('收藏夹已清空');
            } catch (err) {
                Logger.error('清空收藏失败:', err);
                Toast.show('清空收藏失败');
            }
        },

        async count(groupId) {
            await ensureGroupsInitialized();
            try {
                const all = await Storage.favorites.getAll();
                if (!groupId) return all.length;
                return all.filter(item => (item.groups || ['default']).includes(groupId)).length;
            } catch (err) {
                Logger.error('获取收藏数量失败:', err);
                return 0;
            }
        },

        async exportData() {
            await ensureGroupsInitialized();
            const groups = await FavoritesGroups.getAll();
            const data = {
                version: "3.0",
                exportedAt: Date.now(),
                count: await this.count(),
                groups: groups,
                data: await this.getAll()
            };
            return JSON.stringify(data, null, 2);
        },

        async downloadExport() {
            const json = await this.exportData();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bili-favorites-${new Date().toISOString().slice(0, 10)}.json`;
            const target = document.body || document.documentElement;
            target.appendChild(a);
            a.click();
            target.removeChild(a);
            URL.revokeObjectURL(url);
            Toast.show('收藏数据已导出');
        },

        async importData(jsonString) {
            await ensureGroupsInitialized();
            try {
                const data = JSON.parse(jsonString);
                
                if (!data.data || !Array.isArray(data.data)) {
                    throw new Error('无效的数据格式');
                }

                if (data.groups && Array.isArray(data.groups)) {
                    for (const group of data.groups) {
                        const existing = await FavoritesGroups.get(group.id);
                        if (!existing) {
                            await Storage.favoriteGroups.put(group);
                        }
                    }
                }

                const validItems = data.data.filter(item => validateItem(item))
                    .map(item => sanitizeItem(item));

                if (validItems.length === 0) {
                    Toast.show('没有有效的收藏数据');
                    return false;
                }

                let addedCount = 0;

                for (const item of validItems) {
                    const existing = await Storage.favorites.get(item.id);
                    if (!existing) {
                        await Storage.favorites.put(item);
                        addedCount++;
                    }
                }

                if (addedCount > 0) {
                    EventBus.emit('favorites:updated');
                    EventBus.emit('favoriteGroups:updated');
                    Toast.show(`成功导入 ${addedCount} 条收藏`);
                    return true;
                } else {
                    Toast.show('没有新的收藏数据可导入');
                    return false;
                }
            } catch (err) {
                Logger.error('导入收藏数据失败:', err);
                Toast.show('导入失败：数据格式错误');
                return false;
            }
        },

        async removeFromGroup(id, groupId) {
            return this.remove(id, groupId);
        },

        getDefaultVideo() {
            return { ...DEFAULT_VIDEO };
        }
    };
})();