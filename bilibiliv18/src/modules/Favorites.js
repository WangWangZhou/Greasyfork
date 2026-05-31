/**
 * Favorites - 收藏夹存储模块
 * 提供视频收藏的增删改查及数据导出功能
 */
const Favorites = (() => {
    const STORAGE_KEY = 'favorites';
    const MAX_FAVORITES = 1000;

    function getFavorites() {
        try {
            const data = GM_getValue(STORAGE_KEY);
            return Array.isArray(data) ? data : [];
        } catch (err) {
            Logger.error('读取收藏数据失败:', err);
            return [];
        }
    }

    function saveFavorites(favorites) {
        try {
            GM_setValue(STORAGE_KEY, favorites);
            EventBus.emit('favorites:updated');
            return true;
        } catch (err) {
            Logger.error('保存收藏数据失败:', err);
            return false;
        }
    }

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
            addedAt: parseInt(item.addedAt) || Date.now()
        };
    }

    return {
        add(item) {
            if (!validateItem(item)) {
                Logger.warn('无效的收藏项');
                return false;
            }

            const favorites = getFavorites();
            
            if (favorites.length >= MAX_FAVORITES) {
                Toast.show(`收藏数量已达上限 (${MAX_FAVORITES})`);
                return false;
            }

            const existingIndex = favorites.findIndex(f => f.id === item.id);
            if (existingIndex !== -1) {
                Logger.info('视频已在收藏夹中');
                return false;
            }

            const sanitizedItem = sanitizeItem(item);
            favorites.push(sanitizedItem);
            
            if (saveFavorites(favorites)) {
                EventBus.emit('favorites:add', sanitizedItem);
                Toast.show('已添加到收藏夹');
                return true;
            }
            return false;
        },

        remove(id) {
            if (!id) return false;

            const favorites = getFavorites();
            const index = favorites.findIndex(f => f.id === id);
            
            if (index === -1) {
                Logger.warn('未找到要删除的收藏项');
                return false;
            }

            const removed = favorites.splice(index, 1)[0];
            
            if (saveFavorites(favorites)) {
                EventBus.emit('favorites:remove', removed);
                Toast.show('已从收藏夹移除');
                return true;
            }
            return false;
        },

        get(id) {
            if (!id) return null;
            const favorites = getFavorites();
            return favorites.find(f => f.id === id) || null;
        },

        getAll() {
            return getFavorites();
        },

        has(id) {
            if (!id) return false;
            const favorites = getFavorites();
            return favorites.some(f => f.id === id);
        },

        clear() {
            saveFavorites([]);
            EventBus.emit('favorites:clear');
            Toast.show('收藏夹已清空');
        },

        count() {
            return getFavorites().length;
        },

        exportData() {
            const data = {
                version: "1.0",
                exportedAt: Date.now(),
                count: this.count(),
                data: this.getAll()
            };
            return JSON.stringify(data, null, 2);
        },

        downloadExport() {
            const json = this.exportData();
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

        importData(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                
                if (!data.data || !Array.isArray(data.data)) {
                    throw new Error('无效的数据格式');
                }

                const validItems = data.data.filter(item => validateItem(item))
                    .map(item => sanitizeItem(item));

                if (validItems.length === 0) {
                    Toast.show('没有有效的收藏数据');
                    return false;
                }

                const favorites = getFavorites();
                let addedCount = 0;

                validItems.forEach(item => {
                    if (favorites.length >= MAX_FAVORITES) return;
                    if (!favorites.some(f => f.id === item.id)) {
                        favorites.push(item);
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    saveFavorites(favorites);
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
        }
    };
})();
