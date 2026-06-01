const Storage = (() => {
    const DB_NAME = 'BiliSpeedDB';
    const DB_VERSION = 2;
    const NOTES_STORE = 'notes';
    const FAVORITES_STORE = 'favorites';
    const FAVORITE_GROUPS_STORE = 'favoriteGroups';
    const SETTINGS_STORE = 'settings';

    let db = null;
    let isInitialized = false;

    function openDB() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                Logger.error('打开 IndexedDB 失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                db = request.result;
                Logger.info('IndexedDB 已打开');
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
        const database = event.target.result;
        const oldVersion = event.oldVersion || 0;

        if (oldVersion < 1) {
            if (!database.objectStoreNames.contains(NOTES_STORE)) {
                const notesStore = database.createObjectStore(NOTES_STORE, { keyPath: 'id' });
                notesStore.createIndex('bvid', 'bvid', { unique: false });
                notesStore.createIndex('noteType', 'noteType', { unique: false });
                notesStore.createIndex('createdAt', 'createdAt', { unique: false });
                notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }

            if (!database.objectStoreNames.contains(FAVORITES_STORE)) {
                const favoritesStore = database.createObjectStore(FAVORITES_STORE, { keyPath: 'id' });
                favoritesStore.createIndex('bvid', 'bvid', { unique: false });
                favoritesStore.createIndex('addedAt', 'addedAt', { unique: false });
            }

            if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
                database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
            }
        }

        if (oldVersion < 2) {
            if (!database.objectStoreNames.contains(FAVORITE_GROUPS_STORE)) {
                const groupsStore = database.createObjectStore(FAVORITE_GROUPS_STORE, { keyPath: 'id' });
                groupsStore.createIndex('order', 'order', { unique: false });
                groupsStore.createIndex('isVisible', 'isVisible', { unique: false });
                groupsStore.createIndex('isDefault', 'isDefault', { unique: false });
            }
        }
    };
        });
    }

    async function ensureDB() {
        if (!isInitialized) {
            await openDB();
            isInitialized = true;
        }
        return db;
    }

    function transaction(storeName, mode = 'readonly') {
        return new Promise((resolve, reject) => {
            ensureDB().then(database => {
                const tx = database.transaction(storeName, mode);
                const store = tx.objectStore(storeName);
                resolve({ tx, store });
            }).catch(reject);
        });
    }

    async function getAll(storeName) {
        const { store } = await transaction(storeName, 'readonly');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function get(storeName, id) {
        const { store } = await transaction(storeName, 'readonly');
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function put(storeName, data) {
        const { store } = await transaction(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function remove(storeName, id) {
        const { store } = await transaction(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async function clear(storeName) {
        const { store } = await transaction(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async function count(storeName) {
        const { store } = await transaction(storeName, 'readonly');
        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function getByIndex(storeName, indexName, value) {
        const { store } = await transaction(storeName, 'readonly');
        const index = store.index(indexName);
        return new Promise((resolve, reject) => {
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function getSettings(key) {
        const { store } = await transaction(SETTINGS_STORE, 'readonly');
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    async function setSettings(key, value) {
        const { store } = await transaction(SETTINGS_STORE, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put({ key, value });
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async function migrateFromGM() {
        try {
            const notesData = GM_getValue('notes');
            if (notesData && Array.isArray(notesData)) {
                for (const note of notesData) {
                    await put(NOTES_STORE, note);
                }
                Logger.info(`从 GM 迁移了 ${notesData.length} 条笔记到 IndexedDB`);
            }

            const favoritesData = GM_getValue('favorites');
            if (favoritesData && Array.isArray(favoritesData)) {
                for (const item of favoritesData) {
                    await put(FAVORITES_STORE, item);
                }
                Logger.info(`从 GM 迁移了 ${favoritesData.length} 条收藏到 IndexedDB`);
            }
            return true;
        } catch (err) {
            Logger.error('数据迁移失败:', err);
            return false;
        }
    }

    async function exportData() {
    const notes = await getAll(NOTES_STORE);
    const favorites = await getAll(FAVORITES_STORE);
    return {
        version: '2.0',
        exportedAt: Date.now(),
        notes,
        favorites
    };
}

async function exportFavoritesAsJSON() {
    const favorites = await getAll(FAVORITES_STORE);
    const data = {
        version: '2.0',
        exportedAt: Date.now(),
        type: 'favorites',
        data: favorites
    };
    return downloadJSON(data, `bili-speed-favorites-${Date.now()}.json`);
}

async function exportFavoritesAsCSV() {
    const favorites = await getAll(FAVORITES_STORE);
    const headers = ['id', 'bvid', 'title', 'addedAt'];
    const rows = favorites.map(fav => [
        fav.id,
        fav.bvid,
        `"${(fav.title || '').replace(/"/g, '""')}"`,
        fav.addedAt
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return downloadCSV(csvContent, `bili-speed-favorites-${Date.now()}.csv`);
}

async function exportNotesAsJSON() {
    const notes = await getAll(NOTES_STORE);
    const data = {
        version: '2.0',
        exportedAt: Date.now(),
        type: 'notes',
        data: notes
    };
    return downloadJSON(data, `bili-speed-notes-${Date.now()}.json`);
}

async function exportNotesAsCSV() {
    const notes = await getAll(NOTES_STORE);
    const headers = ['id', 'bvid', 'title', 'noteType', 'content', 'createdAt', 'updatedAt'];
    const rows = notes.map(note => [
        note.id,
        note.bvid,
        `"${(note.title || '').replace(/"/g, '""')}"`,
        note.noteType,
        `"${(note.content || '').replace(/"/g, '""')}"`,
        note.createdAt,
        note.updatedAt
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return downloadCSV(csvContent, `bili-speed-notes-${Date.now()}.csv`);
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    return downloadBlob(blob, filename);
}

function downloadCSV(content, filename) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' });
    return downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
}

    async function importNotes(notesArray) {
        let importedCount = 0;
        for (const note of notesArray) {
            try {
                await put(NOTES_STORE, note);
                importedCount++;
            } catch (err) {
                Logger.warn('导入笔记失败:', note.id, err);
            }
        }
        return importedCount;
    }

    async function importFavorites(favoritesArray) {
        let importedCount = 0;
        for (const item of favoritesArray) {
            try {
                await put(FAVORITES_STORE, item);
                importedCount++;
            } catch (err) {
                Logger.warn('导入收藏失败:', item.id, err);
            }
        }
        return importedCount;
    }

    return {
        init: openDB,
        ensureDB,

        notes: {
            getAll: () => getAll(NOTES_STORE),
            get: (id) => get(NOTES_STORE, id),
            put: (note) => put(NOTES_STORE, note),
            remove: (id) => remove(NOTES_STORE, id),
            clear: () => clear(NOTES_STORE),
            count: () => count(NOTES_STORE),
            getByBvid: (bvid) => getByIndex(NOTES_STORE, 'bvid', bvid),
            getByType: (type) => getByIndex(NOTES_STORE, 'noteType', type)
        },

        favorites: {
            getAll: () => getAll(FAVORITES_STORE),
            get: (id) => get(FAVORITES_STORE, id),
            put: (item) => put(FAVORITES_STORE, item),
            remove: (id) => remove(FAVORITES_STORE, id),
            clear: () => clear(FAVORITES_STORE),
            count: () => count(FAVORITES_STORE),
            getByBvid: (bvid) => getByIndex(FAVORITES_STORE, 'bvid', bvid)
        },

        favoriteGroups: {
            getAll: () => getAll(FAVORITE_GROUPS_STORE),
            get: (id) => get(FAVORITE_GROUPS_STORE, id),
            put: (group) => put(FAVORITE_GROUPS_STORE, group),
            remove: (id) => remove(FAVORITE_GROUPS_STORE, id),
            clear: () => clear(FAVORITE_GROUPS_STORE),
            count: () => count(FAVORITE_GROUPS_STORE),
            getByOrder: (order) => getByIndex(FAVORITE_GROUPS_STORE, 'order', order),
            getByIsVisible: (isVisible) => getByIndex(FAVORITE_GROUPS_STORE, 'isVisible', isVisible),
            getByIsDefault: (isDefault) => getByIndex(FAVORITE_GROUPS_STORE, 'isDefault', isDefault)
        },

        settings: {
            get: getSettings,
            set: setSettings
        },

        migrateFromGM,
        exportData,
        exportFavoritesAsJSON,
        exportFavoritesAsCSV,
        exportNotesAsJSON,
        exportNotesAsCSV,
        importNotes,
        importFavorites
    };
})();