const FavoritesMenu = (() => {
    let renderCallback = null;

    function setRenderCallback(callback) {
        renderCallback = callback;
    }

    async function renderFavoritesMenu(contentEl) {
        const favorites = await Favorites.getAll();
        const count = favorites.length;
        
        contentEl.innerHTML = `
            <div class="bili-speed-panel-favorites-menu">
                <div class="bili-speed-panel-favorites-header">
                    <div class="bili-speed-panel-favorites-title">📚 收藏管理</div>
                    <div class="bili-speed-panel-favorites-count">共 ${count} 条收藏</div>
                </div>
                <div class="bili-speed-panel-favorites-action">
                    <button id="export-favorites-btn">
                        <span>📤</span>
                        <span>导出收藏数据</span>
                    </button>
                </div>
                <div class="bili-speed-panel-favorites-action">
                    <button id="import-favorites-btn">
                        <span>📥</span>
                        <span>导入收藏数据</span>
                    </button>
                    <input type="file" id="import-favorites-file" accept=".json">
                </div>
                <div class="bili-speed-panel-favorites-action bili-speed-panel-favorites-action-primary">
                    <button id="open-favorites-panel-btn">
                        <span>⭐</span>
                        <span>打开收藏面板</span>
                    </button>
                </div>
                ${count > 0 ? `
                <div class="bili-speed-panel-favorites-action bili-speed-panel-favorites-action-danger">
                    <button id="clear-favorites-btn">
                        🗑️ 清空所有收藏
                    </button>
                </div>
                ` : ''}
            </div>
        `;

        contentEl.querySelector('#export-favorites-btn').addEventListener('click', () => {
            Favorites.downloadExport();
        });

        const importBtn = contentEl.querySelector('#import-favorites-btn');
        const importFile = contentEl.querySelector('#import-favorites-file');
        
        importBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                await Favorites.importData(event.target.result);
                if (renderCallback) await renderCallback(contentEl);
            };
            reader.readAsText(file);
        });

        contentEl.querySelector('#open-favorites-panel-btn').addEventListener('click', () => {
            EventBus.emit('favorites:toggle');
        });

        const clearBtn = contentEl.querySelector('#clear-favorites-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (confirm('确定要清空所有收藏吗？此操作不可恢复。')) {
                    await Favorites.clear();
                    if (renderCallback) await renderCallback(contentEl);
                }
            });
        }
    }

    return {
        render: renderFavoritesMenu,
        setRenderCallback
    };
})();
