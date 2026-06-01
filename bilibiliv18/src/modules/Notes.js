const Notes = (() => {
    const MAX_CONTENT_SIZE = 51200;

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

    function generateId() {
        return 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }

    function validateNote(note) {
        if (!note || typeof note !== 'object') return false;
        if (!note.id || typeof note.id !== 'string') return false;
        if (!note.noteType || !['videoNote', 'normalNote'].includes(note.noteType)) return false;
        if (note.noteType === 'videoNote' && !note.bvid) return false;
        if (!note.editorType || !['quill', 'vditor'].includes(note.editorType)) return false;
        if (typeof note.title !== 'string') return false;
        if (typeof note.content !== 'string') return false;
        return true;
    }

    function sanitizeNote(note) {
        return {
            id: escapeHtml(String(note.id)),
            noteType: note.noteType === 'normalNote' ? 'normalNote' : 'videoNote',
            bvid: escapeHtml(String(note.bvid || '')),
            videoTitle: escapeHtml(String(note.videoTitle || '未知视频')),
            videoUrl: escapeHtml(String(note.videoUrl || '')),
            editorType: note.editorType === 'vditor' ? 'vditor' : 'quill',
            title: String(note.title || '').substring(0, 200),
            content: String(note.content || ''),
            contentDelta: String(note.contentDelta || ''),
            tags: Array.isArray(note.tags)
                ? note.tags.filter(t => typeof t === 'string').map(t => escapeHtml(t.substring(0, 20))).slice(0, 10)
                : [],
            videoTimestamp: Math.max(0, parseFloat(note.videoTimestamp) || 0),
            createdAt: parseInt(note.createdAt) || Date.now(),
            updatedAt: parseInt(note.updatedAt) || Date.now()
        };
    }

    function checkContentSize(content) {
        try {
            return new Blob([content]).size <= MAX_CONTENT_SIZE;
        } catch {
            return content.length <= MAX_CONTENT_SIZE;
        }
    }

    return {
        async add(note) {
            if (!validateNote(note)) {
                Logger.warn('无效的笔记数据');
                return false;
            }

            if (!checkContentSize(note.content)) {
                Toast.show('笔记内容超出大小限制');
                return false;
            }

            const existing = await Storage.notes.get(note.id);
            if (existing) {
                Logger.info('笔记ID已存在');
                return false;
            }

            const sanitizedNote = sanitizeNote(note);
            
            try {
                await Storage.notes.put(sanitizedNote);
                EventBus.emit('notes:add', sanitizedNote);
                EventBus.emit('notes:updated');
                Toast.show('笔记已保存');
                return true;
            } catch (err) {
                Logger.error('保存笔记失败:', err);
                Toast.show('保存笔记失败');
                return false;
            }
        },

        async update(id, updates) {
            if (!id) return false;

            const existingNote = await Storage.notes.get(id);
            if (!existingNote) {
                Logger.warn('未找到要更新的笔记');
                return false;
            }

            if (updates.content && !checkContentSize(updates.content)) {
                Toast.show('笔记内容超出大小限制');
                return false;
            }

            const updatedNote = { ...existingNote };

            if (updates.title !== undefined) updatedNote.title = String(updates.title).substring(0, 200);
            if (updates.content !== undefined) updatedNote.content = String(updates.content);
            if (updates.contentDelta !== undefined) updatedNote.contentDelta = String(updates.contentDelta);
            if (updates.tags !== undefined) {
                updatedNote.tags = Array.isArray(updates.tags)
                    ? updates.tags.filter(t => typeof t === 'string').map(t => escapeHtml(t.substring(0, 20))).slice(0, 10)
                    : [];
            }
            if (updates.videoTimestamp !== undefined) updatedNote.videoTimestamp = Math.max(0, parseFloat(updates.videoTimestamp) || 0);
            if (updates.videoTitle !== undefined) updatedNote.videoTitle = escapeHtml(String(updates.videoTitle));
            if (updates.videoUrl !== undefined) updatedNote.videoUrl = escapeHtml(String(updates.videoUrl));

            updatedNote.updatedAt = Date.now();

            const sanitizedNote = sanitizeNote(updatedNote);

            try {
                await Storage.notes.put(sanitizedNote);
                EventBus.emit('notes:update', sanitizedNote);
                EventBus.emit('notes:updated');
                Toast.show('笔记已更新');
                return true;
            } catch (err) {
                Logger.error('更新笔记失败:', err);
                Toast.show('更新笔记失败');
                return false;
            }
        },

        async remove(id) {
            if (!id) return false;

            const existingNote = await Storage.notes.get(id);
            if (!existingNote) {
                Logger.warn('未找到要删除的笔记');
                return false;
            }

            try {
                await Storage.notes.remove(id);
                EventBus.emit('notes:remove', existingNote);
                EventBus.emit('notes:updated');
                Toast.show('笔记已删除');
                return true;
            } catch (err) {
                Logger.error('删除笔记失败:', err);
                Toast.show('删除笔记失败');
                return false;
            }
        },

        async get(id) {
            if (!id) return null;
            try {
                return await Storage.notes.get(id);
            } catch (err) {
                Logger.error('获取笔记失败:', err);
                return null;
            }
        },

        async getAll() {
            try {
                return await Storage.notes.getAll();
            } catch (err) {
                Logger.error('获取所有笔记失败:', err);
                return [];
            }
        },

        async getByBvid(bvid) {
            if (!bvid) return [];
            try {
                return await Storage.notes.getByBvid(bvid);
            } catch (err) {
                Logger.error('获取视频笔记失败:', err);
                return [];
            }
        },

        async search(keyword) {
            if (!keyword || typeof keyword !== 'string') {
                return await this.getAll();
            }
            
            const lowerKeyword = keyword.toLowerCase();
            const notes = await this.getAll();
            
            return notes.filter(n =>
                n.title.toLowerCase().includes(lowerKeyword) ||
                n.content.toLowerCase().includes(lowerKeyword) ||
                n.videoTitle.toLowerCase().includes(lowerKeyword) ||
                (n.tags && n.tags.some(t => t.toLowerCase().includes(lowerKeyword)))
            );
        },

        async getByTag(tag) {
            if (!tag) return [];
            const notes = await this.getAll();
            return notes.filter(n => n.tags && n.tags.includes(tag));
        },

        async getAllTags() {
            const notes = await this.getAll();
            const tagSet = new Set();
            notes.forEach(n => {
                if (Array.isArray(n.tags)) {
                    n.tags.forEach(t => tagSet.add(t));
                }
            });
            return Array.from(tagSet).sort();
        },

        async count() {
            try {
                return await Storage.notes.count();
            } catch (err) {
                Logger.error('获取笔记数量失败:', err);
                return 0;
            }
        },

        async countByBvid(bvid) {
            if (!bvid) return 0;
            const notes = await this.getByBvid(bvid);
            return notes.length;
        },

        async countByType(type) {
            if (!type) return 0;
            try {
                const notes = await Storage.notes.getByType(type);
                return notes ? notes.length : 0;
            } catch (err) {
                Logger.error('按类型统计笔记失败:', err);
                return 0;
            }
        },

        async getByType(type) {
            if (!type) return [];
            try {
                return await Storage.notes.getByType(type);
            } catch (err) {
                Logger.error('按类型获取笔记失败:', err);
                return [];
            }
        },

        async clear() {
            try {
                await Storage.notes.clear();
                if (typeof GM_setValue === 'function') {
                    GM_setValue('notes', null);
                }
                EventBus.emit('notes:clear');
                EventBus.emit('notes:updated');
                Toast.show('所有笔记已清空');
            } catch (err) {
                Logger.error('清空笔记失败:', err);
                Toast.show('清空笔记失败');
            }
        },

        async exportData() {
            const data = {
                version: "2.0",
                exportedAt: Date.now(),
                count: await this.count(),
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
            a.download = `bili-notes-${new Date().toISOString().slice(0, 10)}.json`;
            const target = document.body || document.documentElement;
            target.appendChild(a);
            a.click();
            target.removeChild(a);
            URL.revokeObjectURL(url);
            Toast.show('笔记数据已导出');
        },

        async importData(jsonString) {
            try {
                const data = JSON.parse(jsonString);

                if (!data.data || !Array.isArray(data.data)) {
                    throw new Error('无效的数据格式');
                }

                const validItems = data.data.filter(item => validateNote(item))
                    .map(item => sanitizeNote(item));

                if (validItems.length === 0) {
                    Toast.show('没有有效的笔记数据');
                    return false;
                }

                let addedCount = 0;

                for (const item of validItems) {
                    const existing = await Storage.notes.get(item.id);
                    if (!existing) {
                        await Storage.notes.put(item);
                        addedCount++;
                    }
                }

                if (addedCount > 0) {
                    EventBus.emit('notes:updated');
                    Toast.show(`成功导入 ${addedCount} 条笔记`);
                    return true;
                } else {
                    Toast.show('没有新的笔记数据可导入');
                    return false;
                }
            } catch (err) {
                Logger.error('导入笔记数据失败:', err);
                Toast.show('导入失败：数据格式错误');
                return false;
            }
        }
    };
})();