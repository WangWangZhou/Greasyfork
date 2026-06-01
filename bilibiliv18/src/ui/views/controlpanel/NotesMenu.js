const NotesMenu = (() => {
    let renderCallback = null;

    function setRenderCallback(callback) {
        renderCallback = callback;
    }

    function updateEditorBtnState(contentEl, editor) {
        contentEl.querySelectorAll('.editor-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.editor === editor);
        });
        const quillSettings = contentEl.querySelector('.quill-settings');
        const vditorSettings = contentEl.querySelector('.vditor-settings');
        if (quillSettings) quillSettings.style.display = editor === 'quill' ? 'block' : 'none';
        if (vditorSettings) vditorSettings.style.display = editor === 'vditor' ? 'block' : 'none';
    }

    function updateVditorModeState(contentEl, mode) {
        contentEl.querySelectorAll('.vditor-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    async function renderNotesMenu(contentEl) {
        const currentEditor = Config.data.defaultEditor || 'quill';
        const noteCount = await Notes.count();
        const url = location.href;
        const match = url.match(/BV[\w]+/);
        const currentNoteCount = match ? await Notes.countByBvid(match[0]) : 0;

        const currentVditorMode = Config.data.vditorEditorMode || 'ir';
        const currentQuillWidth = Config.data.quillEditorWidth || '520px';
        const currentQuillHeight = Config.data.quillEditorHeight || '500px';
        const currentQuillMinWidth = Config.data.quillEditorMinWidth || '400px';
        const currentQuillMinHeight = Config.data.quillEditorMinHeight || '350px';
        const vditorWidthKey = 'vditorWidth_' + currentVditorMode;
        const vditorHeightKey = 'vditorHeight_' + currentVditorMode;
        const currentVditorWidth = Config.data[vditorWidthKey] || '560px';
        const currentVditorHeight = Config.data[vditorHeightKey] || '550px';
        const currentVditorMinWidth = Config.data['vditorEditorMinWidth_' + currentVditorMode] || '400px';
        const currentVditorMinHeight = Config.data['vditorEditorMinHeight_' + currentVditorMode] || '400px';

        contentEl.innerHTML = `
            <div style="padding: 16px; overflow-y: auto; max-height: 440px;">
                <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 14px; font-weight: bold;">📝 笔记管理</div>
                    <div style="font-size: 12px; color: #999;">共 ${noteCount} 条笔记</div>
                </div>
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 13px; margin-bottom: 8px;">默认编辑器:</div>
                    <div style="display: flex; gap: 8px;">
                        <button class="editor-btn ${currentEditor === 'quill' ? 'active' : ''}" data-editor="quill">Quill 富文本</button>
                        <button class="editor-btn ${currentEditor === 'vditor' ? 'active' : ''}" data-editor="vditor">Vditor Markdown</button>
                    </div>
                </div>
                <div class="quill-settings" style="margin-bottom: 16px; ${currentEditor === 'quill' ? 'display: block;' : 'display: none;'}">
                    <div style="font-size: 13px; margin-bottom: 8px;">📐 Quill 面板尺寸:</div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">宽度:</span>
                        <input type="text" class="quill-width-input" value="${currentQuillWidth}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">高度:</span>
                        <input type="text" class="quill-height-input" value="${currentQuillHeight}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">最小宽度:</span>
                        <input type="text" class="quill-min-width-input" value="${currentQuillMinWidth}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">最小高度:</span>
                        <input type="text" class="quill-min-height-input" value="${currentQuillMinHeight}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button class="quill-size-save" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; cursor: pointer; font-size: 12px;">💾 保存</button>
                        <button class="quill-size-restore" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 12px;">↩️ 恢复默认</button>
                    </div>
                </div>
                <div class="vditor-settings" style="margin-bottom: 16px; ${currentEditor === 'vditor' ? 'display: block;' : 'display: none;'}">
                    <div style="font-size: 13px; margin-bottom: 8px;">Vditor 编辑模式:</div>
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <button class="vditor-mode-btn ${currentVditorMode === 'wysiwyg' ? 'active' : ''}" data-mode="wysiwyg">所见即所得</button>
                        <button class="vditor-mode-btn ${currentVditorMode === 'ir' ? 'active' : ''}" data-mode="ir">即时渲染</button>
                        <button class="vditor-mode-btn ${currentVditorMode === 'sv' ? 'active' : ''}" data-mode="sv">分屏预览</button>
                    </div>
                    <div style="font-size: 13px; margin-bottom: 8px;">📐 Vditor 面板尺寸 (${currentVditorMode === 'wysiwyg' ? '所见即所得' : currentVditorMode === 'ir' ? '即时渲染' : '分屏预览'}):</div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">宽度:</span>
                        <input type="text" class="vditor-width-input" value="${currentVditorWidth}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">高度:</span>
                        <input type="text" class="vditor-height-input" value="${currentVditorHeight}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">最小宽度:</span>
                        <input type="text" class="vditor-min-width-input" value="${currentVditorMinWidth}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #666;">最小高度:</span>
                        <input type="text" class="vditor-min-height-input" value="${currentVditorMinHeight}" style="width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; outline: none; margin-left: 8px;">
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button class="vditor-size-save" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; cursor: pointer; font-size: 12px;">💾 保存</button>
                        <button class="vditor-size-restore" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 12px;">↩️ 恢复默认</button>
                    </div>
                </div>
                <div style="margin-bottom: 16px; padding-top: 12px; border-top: 1px solid #eee;">
                    <div style="font-size: 12px; color: #999; margin-bottom: 8px;">当前视频笔记: ${currentNoteCount} 条</div>
                    <button id="open-notes-panel-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: none; background: #00AEEC; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>📝</span>
                        <span>打开笔记面板</span>
                    </button>
                </div>
                <div style="margin-bottom: 16px; display: flex; gap: 8px;">
                    <button id="export-notes-btn" style="flex: 1; padding: 10px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>📤</span>
                        <span>导出</span>
                    </button>
                    <button id="import-notes-btn" style="flex: 1; padding: 10px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>📥</span>
                        <span>导入</span>
                    </button>
                    <input type="file" id="import-notes-file" accept=".json" style="display: none;">
                </div>
                ${noteCount > 0 ? `
                <div style="padding-top: 12px; border-top: 1px solid #eee;">
                    <button id="clear-notes-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ff6b6b; background: #fff; color: #ff6b6b; cursor: pointer;">
                        🗑️ 清空所有笔记
                    </button>
                </div>
                ` : ''}
            </div>
        `;

        contentEl.querySelector('.quill-size-save').addEventListener('click', () => {
            const width = contentEl.querySelector('.quill-width-input').value.trim();
            const height = contentEl.querySelector('.quill-height-input').value.trim();
            const minWidth = contentEl.querySelector('.quill-min-width-input').value.trim();
            const minHeight = contentEl.querySelector('.quill-min-height-input').value.trim();
            if (width) Config.data.quillEditorWidth = width;
            if (height) Config.data.quillEditorHeight = height;
            if (minWidth) Config.data.quillEditorMinWidth = minWidth;
            if (minHeight) Config.data.quillEditorMinHeight = minHeight;
            Toast.show('Quill 面板尺寸已保存');
        });

        contentEl.querySelector('.quill-size-restore').addEventListener('click', () => {
            Config.data.quillEditorWidth = Config.DEFAULTS.quillEditorWidth;
            Config.data.quillEditorHeight = Config.DEFAULTS.quillEditorHeight;
            Config.data.quillEditorMinWidth = Config.DEFAULTS.quillEditorMinWidth;
            Config.data.quillEditorMinHeight = Config.DEFAULTS.quillEditorMinHeight;
            contentEl.querySelector('.quill-width-input').value = Config.DEFAULTS.quillEditorWidth;
            contentEl.querySelector('.quill-height-input').value = Config.DEFAULTS.quillEditorHeight;
            contentEl.querySelector('.quill-min-width-input').value = Config.DEFAULTS.quillEditorMinWidth;
            contentEl.querySelector('.quill-min-height-input').value = Config.DEFAULTS.quillEditorMinHeight;
            Toast.show('Quill 面板尺寸已恢复默认');
        });

        contentEl.querySelectorAll('.editor-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const editor = btn.dataset.editor;
                Config.data.defaultEditor = editor;
                updateEditorBtnState(contentEl, editor);
                Toast.show(`默认编辑器已切换为 ${editor === 'quill' ? 'Quill 富文本' : 'Vditor Markdown'}`);
            });
        });

        contentEl.querySelectorAll('.vditor-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                Config.data.vditorEditorMode = mode;
                updateVditorModeState(contentEl, mode);

                const widthKey = 'vditorWidth_' + mode;
                const heightKey = 'vditorHeight_' + mode;
                const widthVal = Config.data[widthKey] || '560px';
                const heightVal = Config.data[heightKey] || '550px';
                const minWidthKey = 'vditorEditorMinWidth_' + mode;
                const minHeightKey = 'vditorEditorMinHeight_' + mode;
                const minWidthVal = Config.data[minWidthKey] || '400px';
                const minHeightVal = Config.data[minHeightKey] || '400px';

                const vWidthInput = contentEl.querySelector('.vditor-width-input');
                const vHeightInput = contentEl.querySelector('.vditor-height-input');
                if (vWidthInput) vWidthInput.value = widthVal;
                if (vHeightInput) vHeightInput.value = heightVal;
                const vMinWidthInput = contentEl.querySelector('.vditor-min-width-input');
                const vMinHeightInput = contentEl.querySelector('.vditor-min-height-input');
                if (vMinWidthInput) vMinWidthInput.value = minWidthVal;
                if (vMinHeightInput) vMinHeightInput.value = minHeightVal;

                const sizeLabel = contentEl.querySelector('.vditor-settings div:nth-child(3)');
                if (sizeLabel) {
                    const modeNames = { wysiwyg: '所见即所得', ir: '即时渲染', sv: '分屏预览' };
                    sizeLabel.textContent = `📐 Vditor 面板尺寸 (${modeNames[mode] || mode}):`;
                }

                EventBus.emit('vditor:mode:change', mode);

                Toast.show(`Vditor 编辑模式已切换为 ${mode === 'wysiwyg' ? '所见即所得' : mode === 'ir' ? '即时渲染' : '分屏预览'}`);
            });
        });

        contentEl.querySelector('.vditor-size-save').addEventListener('click', () => {
            const mode = Config.data.vditorEditorMode || 'ir';
            const widthKey = 'vditorWidth_' + mode;
            const heightKey = 'vditorHeight_' + mode;
            const minWidthKey = 'vditorEditorMinWidth_' + mode;
            const minHeightKey = 'vditorEditorMinHeight_' + mode;
            const width = contentEl.querySelector('.vditor-width-input').value.trim();
            const height = contentEl.querySelector('.vditor-height-input').value.trim();
            const minWidth = contentEl.querySelector('.vditor-min-width-input').value.trim();
            const minHeight = contentEl.querySelector('.vditor-min-height-input').value.trim();
            if (width) Config.data[widthKey] = width;
            if (height) Config.data[heightKey] = height;
            if (minWidth) Config.data[minWidthKey] = minWidth;
            if (minHeight) Config.data[minHeightKey] = minHeight;
            Toast.show('Vditor 面板尺寸已保存');
        });

        contentEl.querySelector('.vditor-size-restore').addEventListener('click', () => {
            const mode = Config.data.vditorEditorMode || 'ir';
            const widthKey = 'vditorWidth_' + mode;
            const heightKey = 'vditorHeight_' + mode;
            const minWidthKey = 'vditorEditorMinWidth_' + mode;
            const minHeightKey = 'vditorEditorMinHeight_' + mode;
            Config.data[widthKey] = Config.DEFAULTS[widthKey];
            Config.data[heightKey] = Config.DEFAULTS[heightKey];
            Config.data[minWidthKey] = Config.DEFAULTS[minWidthKey];
            Config.data[minHeightKey] = Config.DEFAULTS[minHeightKey];
            contentEl.querySelector('.vditor-width-input').value = Config.DEFAULTS[widthKey];
            contentEl.querySelector('.vditor-height-input').value = Config.DEFAULTS[heightKey];
            contentEl.querySelector('.vditor-min-width-input').value = Config.DEFAULTS[minWidthKey];
            contentEl.querySelector('.vditor-min-height-input').value = Config.DEFAULTS[minHeightKey];
            Toast.show('Vditor 面板尺寸已恢复默认');
        });

        contentEl.querySelector('#open-notes-panel-btn').addEventListener('click', () => {
            EventBus.emit('notes:toggle');
        });

        contentEl.querySelector('#export-notes-btn').addEventListener('click', () => {
            EventBus.emit('notes:export');
        });

        const importBtn = contentEl.querySelector('#import-notes-btn');
        const importFile = contentEl.querySelector('#import-notes-file');

        importBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                await Notes.importData(event.target.result);
                if (renderCallback) await renderCallback(contentEl);
            };
            reader.readAsText(file);
        });

        const clearBtn = contentEl.querySelector('#clear-notes-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (confirm('确定要清空所有笔记吗？此操作不可恢复。')) {
                    EventBus.emit('notes:clearAll');
                }
            });
        }
    }

    return {
        render: renderNotesMenu,
        setRenderCallback
    };
})();
