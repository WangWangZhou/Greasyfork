/**
 * ControlPanel - 控制面板视图
 * 视图层 - 使用Card组件渲染设置面板
 * 支持左侧菜单导航和主题切换
 */
const ControlPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let multiClickCleanup = null;
    let currentMenu = 'speed';

    function updateButtonState() {
        if (!panelInstance) return;

        const panelEl = panelInstance.element;

        const buttonGroups = [
            { selector: '.step-btn', dataAttr: 'step', configKey: 'step' },
            { selector: '.default-btn', dataAttr: 'rate', configKey: 'defaultRate' },
            { selector: '.min-rate-btn', dataAttr: 'rate', configKey: 'minRate' },
            { selector: '.max-rate-btn', dataAttr: 'rate', configKey: 'maxRate' }
        ];

        buttonGroups.forEach(({ selector, dataAttr, configKey }) => {
            panelEl.querySelectorAll(selector).forEach(btn => {
                const isActive = parseFloat(btn.dataset[dataAttr]) === Config.data[configKey];
                btn.classList.toggle('active', isActive);
            });
        });
    }

    function validateKey(key) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'f') return false;
        return /^[a-z]$/.test(lowerKey);
    }

    function handleKeyInput(inputId, configKey) {
        if (!panelInstance) return;
        const panelEl = panelInstance.element;
        const input = panelEl.querySelector(`#${inputId}`);
        if (!input) return;

        input.addEventListener('input', (e) => {
            let value = e.target.value.toLowerCase();
            if (value === 'f') {
                e.target.value = Config.data[configKey].toUpperCase();
                Toast.show('不支持F键');
                return;
            }
            if (value && !validateKey(value)) {
                e.target.value = Config.data[configKey].toUpperCase();
                return;
            }
            Config.data[configKey] = value || Config.data[configKey];
            e.target.value = Config.data[configKey].toUpperCase();
        });
    }

    function applyTheme(theme) {
        if (!panelInstance) return;
        const panelEl = panelInstance.element;
        
        panelEl.classList.remove('theme-light', 'theme-dark');
        panelEl.classList.add(`theme-${theme}`);
        
        const themeBtn = panelEl.querySelector('.theme-toggle-btn');
        if (themeBtn) {
            themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
            themeBtn.title = theme === 'dark' ? '切换到浅色主题' : '切换到深色主题';
        }
    }

    function toggleTheme() {
        const currentTheme = Config.data.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        Config.data.theme = newTheme;
        applyTheme(newTheme);
        EventBus.emit('theme:changed', newTheme);
        Toast.show(`已切换到${newTheme === 'dark' ? '深色' : '浅色'}主题`);
    }

    function renderSystemMenu(contentEl) {
        const currentTheme = Config.data.theme || 'light';
        contentEl.innerHTML = `
            <div style="padding: 16px;">
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 14px; font-weight: bold; margin-bottom: 12px;">🎨 主题设置</div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 13px;">当前主题:</span>
                        <button class="theme-toggle-btn" style="padding: 8px 16px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 16px;">
                            ${currentTheme === 'dark' ? '🌙' : '☀️'}
                        </button>
                        <span style="font-size: 12px; color: #999;">${currentTheme === 'dark' ? '深色模式' : '浅色模式'}</span>
                    </div>
                </div>
                <div style="font-size: 12px; color: #999; padding: 8px; background: #f5f5f5; border-radius: 4px;">
                    💡 提示: 主题设置会应用到所有面板组件
                </div>
            </div>
        `;

        const themeBtn = contentEl.querySelector('.theme-toggle-btn');
        themeBtn.addEventListener('click', toggleTheme);
    }

    function renderSpeedMenu(contentEl) {
        contentEl.innerHTML = `
            <div style="padding: 0 16px;">
                <div style="margin-bottom: 12px;">
                    <div style="margin-bottom: 8px;">📏 步进值:</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="step-btn" data-step="0.02">0.02</button>
                        <button class="step-btn" data-step="0.05">0.05</button>
                        <button class="step-btn" data-step="0.10">0.10</button>
                    </div>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="margin-bottom: 8px;">🎯 初始倍速:</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="default-btn" data-rate="0.8">0.8x</button>
                        <button class="default-btn" data-rate="0.9">0.9x</button>
                        <button class="default-btn" data-rate="1.0">1.0x</button>
                        <button class="default-btn" data-rate="1.1">1.1x</button>
                        <button class="default-btn" data-rate="1.25">1.25x</button>
                    </div>
                </div>
                <div style="margin-bottom: 12px; display: none;" class="advanced-option">
                    <div style="margin-bottom: 8px;">⬇️ 最小倍速:</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="min-rate-btn" data-rate="0.3">0.3x</button>
                        <button class="min-rate-btn" data-rate="0.5">0.5x</button>
                        <button class="min-rate-btn" data-rate="0.6">0.6x</button>
                        <button class="min-rate-btn" data-rate="0.7">0.7x</button>
                    </div>
                </div>
                <div style="margin-bottom: 12px; display: none;" class="advanced-option">
                    <div style="margin-bottom: 8px;">⬆️ 最大倍速:</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="max-rate-btn" data-rate="2">2x</button>
                        <button class="max-rate-btn" data-rate="3">3x</button>
                        <button class="max-rate-btn" data-rate="4">4x</button>
                        <button class="max-rate-btn" data-rate="5">5x</button>
                    </div>
                </div>
                <div style="margin-bottom: 12px; display: none;" class="advanced-option">
                    <div style="margin-bottom: 8px;">⌨️ 快捷键设置:</div>
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 12px;">🔄 重置:</span>
                            <input type="text" id="key-reset" maxlength="1" value="${Config.data.keyReset.toUpperCase()}" style="width: 30px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; text-transform: uppercase;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 12px;">⏩ 加速:</span>
                            <input type="text" id="key-up" maxlength="1" value="${Config.data.keyUp.toUpperCase()}" style="width: 30px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; text-transform: uppercase;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 12px;">⏪ 减速:</span>
                            <input type="text" id="key-down" maxlength="1" value="${Config.data.keyDown.toUpperCase()}" style="width: 30px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; text-transform: uppercase;">
                        </div>
                    </div>
                    <div style="font-size: 11px; color: #999; margin-top: 4px;">* 快捷键修改后需刷新网页生效，不支持F键</div>
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end; padding: 12px 0;">
                    <button id="reset-btn" style="padding: 8px 16px; border-radius: 4px; border: none; background: #999; color: #fff; cursor: pointer;">🔄 重置</button>
                    <button id="save-btn" style="padding: 8px 16px; border-radius: 4px; border: none; background: #00AEEC; color: #fff; cursor: pointer;">💾 保存</button>
                </div>
            </div>
        `;

        const updateButtonStateLocal = (el) => {
            const buttonGroups = [
                { selector: '.step-btn', dataAttr: 'step', configKey: 'step' },
                { selector: '.default-btn', dataAttr: 'rate', configKey: 'defaultRate' },
                { selector: '.min-rate-btn', dataAttr: 'rate', configKey: 'minRate' },
                { selector: '.max-rate-btn', dataAttr: 'rate', configKey: 'maxRate' }
            ];

            buttonGroups.forEach(({ selector, dataAttr, configKey }) => {
                el.querySelectorAll(selector).forEach(btn => {
                    const isActive = parseFloat(btn.dataset[dataAttr]) === Config.data[configKey];
                    btn.classList.toggle('active', isActive);
                });
            });
        };

        updateButtonStateLocal(contentEl);

        contentEl.querySelectorAll('.step-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.step = parseFloat(btn.dataset.step);
                updateButtonStateLocal(contentEl);
            });
        });

        contentEl.querySelectorAll('.default-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.defaultRate = parseFloat(btn.dataset.rate);
                updateButtonStateLocal(contentEl);
            });
        });

        contentEl.querySelectorAll('.min-rate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.minRate = parseFloat(btn.dataset.rate);
                updateButtonStateLocal(contentEl);
            });
        });

        contentEl.querySelectorAll('.max-rate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Config.data.maxRate = parseFloat(btn.dataset.rate);
                updateButtonStateLocal(contentEl);
            });
        });

        handleKeyInput('key-reset', 'keyReset');
        handleKeyInput('key-up', 'keyUp');
        handleKeyInput('key-down', 'keyDown');

        contentEl.querySelector('#reset-btn').addEventListener('click', () => {
            Config.batchUpdate({
                step: Config.DEFAULTS.step,
                minRate: Config.DEFAULTS.minRate,
                maxRate: Config.DEFAULTS.maxRate,
                defaultRate: Config.DEFAULTS.defaultRate,
                keyReset: Config.DEFAULTS.keyReset,
                keyUp: Config.DEFAULTS.keyUp,
                keyDown: Config.DEFAULTS.keyDown
            });
            contentEl.querySelector('#key-reset').value = Config.DEFAULTS.keyReset.toUpperCase();
            contentEl.querySelector('#key-up').value = Config.DEFAULTS.keyUp.toUpperCase();
            contentEl.querySelector('#key-down').value = Config.DEFAULTS.keyDown.toUpperCase();
            updateButtonStateLocal(contentEl);
            EventBus.emit('config:reset');
        });

        contentEl.querySelector('#save-btn').addEventListener('click', () => {
            Config.data.keyReset = contentEl.querySelector('#key-reset').value.toLowerCase() || 'z';
            Config.data.keyUp = contentEl.querySelector('#key-up').value.toLowerCase() || 'x';
            Config.data.keyDown = contentEl.querySelector('#key-down').value.toLowerCase() || 'c';
            const video = VideoController.getVideo();
            if (video && video.playbackRate === Config.data.defaultRate) {
                VideoController.setRate(Config.data.defaultRate);
            }
            EventBus.emit('panel:toggle');
            EventBus.emit('config:saved');
            Toast.show('配置已保存，刷新后生效');
        });
    }

    function renderFavoritesMenu(contentEl) {
        const favorites = Favorites.getAll();
        const count = favorites.length;
        
        contentEl.innerHTML = `
            <div style="padding: 16px;">
                <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 14px; font-weight: bold;">📚 收藏管理</div>
                    <div style="font-size: 12px; color: #999;">共 ${count} 条收藏</div>
                </div>
                <div style="margin-bottom: 16px;">
                    <button id="export-favorites-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>📤</span>
                        <span>导出收藏数据</span>
                    </button>
                </div>
                <div style="margin-bottom: 16px;">
                    <button id="import-favorites-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>📥</span>
                        <span>导入收藏数据</span>
                    </button>
                    <input type="file" id="import-favorites-file" accept=".json" style="display: none;">
                </div>
                <div style="margin-bottom: 16px;">
                    <button id="open-favorites-panel-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: none; background: #00AEEC; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>⭐</span>
                        <span>打开收藏面板</span>
                    </button>
                </div>
                ${count > 0 ? `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">
                    <button id="clear-favorites-btn" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ff6b6b; background: #fff; color: #ff6b6b; cursor: pointer;">
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

        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                Favorites.importData(event.target.result);
                renderFavoritesMenu(contentEl);
            };
            reader.readAsText(file);
        });

        contentEl.querySelector('#open-favorites-panel-btn').addEventListener('click', () => {
            EventBus.emit('favorites:toggle');
        });

        const clearBtn = contentEl.querySelector('#clear-favorites-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('确定要清空所有收藏吗？此操作不可恢复。')) {
                    Favorites.clear();
                    renderFavoritesMenu(contentEl);
                }
            });
        }
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

    function renderSizeBtnGroup(container, configKey, sizes, currentVal) {
        sizes.forEach(size => {
            const btn = document.createElement('button');
            btn.className = 'editor-size-btn';
            btn.dataset.value = size;
            btn.textContent = size;
            btn.style.cssText = 'padding: 3px 10px; border-radius: 3px; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 12px; transition: all 0.2s;';
            if (currentVal === size || (!currentVal && size === sizes[2])) {
                btn.classList.add('active');
                btn.style.background = '#00AEEC';
                btn.style.color = '#fff';
                btn.style.borderColor = '#00AEEC';
            }
            btn.addEventListener('click', () => {
                container.querySelectorAll('.editor-size-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '#fff';
                    b.style.color = '#000';
                    b.style.borderColor = '#ccc';
                });
                btn.classList.add('active');
                btn.style.background = '#00AEEC';
                btn.style.color = '#fff';
                btn.style.borderColor = '#00AEEC';
                Config.data[configKey] = size;
            });
            container.appendChild(btn);
        });
    }

    function renderNotesMenu(contentEl) {
        const currentEditor = Config.data.defaultEditor || 'quill';
        const noteCount = Notes.count();
        const url = location.href;
        const match = url.match(/BV[\w]+/);
        const currentNoteCount = match ? Notes.countByBvid(match[0]) : 0;

        const currentVditorMode = Config.data.vditorEditorMode || 'ir';
        const currentQuillWidth = Config.data.quillEditorWidth || '520px';
        const currentQuillHeight = Config.data.quillEditorHeight || '500px';
        const vditorWidthKey = 'vditorWidth_' + currentVditorMode;
        const vditorHeightKey = 'vditorHeight_' + currentVditorMode;
        const currentVditorWidth = Config.data[vditorWidthKey] || '560px';
        const currentVditorHeight = Config.data[vditorHeightKey] || '550px';

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
                        <div class="quill-width-group" style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;"></div>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: #666;">高度:</span>
                        <div class="quill-height-group" style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;"></div>
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
                        <div class="vditor-width-group" style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;"></div>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: #666;">高度:</span>
                        <div class="vditor-height-group" style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;"></div>
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

        const sizeOptions = ['400px', '480px', '520px', '560px', '640px'];

        const quillWidthGroup = contentEl.querySelector('.quill-width-group');
        renderSizeBtnGroup(quillWidthGroup, 'quillEditorWidth', sizeOptions, currentQuillWidth);

        const quillHeightGroup = contentEl.querySelector('.quill-height-group');
        renderSizeBtnGroup(quillHeightGroup, 'quillEditorHeight', sizeOptions, currentQuillHeight);

        const vditorWidthGroup = contentEl.querySelector('.vditor-width-group');
        renderSizeBtnGroup(vditorWidthGroup, vditorWidthKey, sizeOptions, currentVditorWidth);

        const vditorHeightGroup = contentEl.querySelector('.vditor-height-group');
        renderSizeBtnGroup(vditorHeightGroup, vditorHeightKey, sizeOptions, currentVditorHeight);

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

                const vWidthGroup = contentEl.querySelector('.vditor-width-group');
                const vHeightGroup = contentEl.querySelector('.vditor-height-group');
                vWidthGroup.innerHTML = '';
                vHeightGroup.innerHTML = '';
                renderSizeBtnGroup(vWidthGroup, widthKey, sizeOptions, widthVal);
                renderSizeBtnGroup(vHeightGroup, heightKey, sizeOptions, heightVal);

                const sizeLabel = contentEl.querySelector('.vditor-settings div:nth-child(3)');
                if (sizeLabel) {
                    const modeNames = { wysiwyg: '所见即所得', ir: '即时渲染', sv: '分屏预览' };
                    sizeLabel.textContent = `📐 Vditor 面板尺寸 (${modeNames[mode] || mode}):`;
                }

                Toast.show(`Vditor 编辑模式已切换为 ${mode === 'wysiwyg' ? '所见即所得' : mode === 'ir' ? '即时渲染' : '分屏预览'}`);
            });
        });

        contentEl.querySelector('#open-notes-panel-btn').addEventListener('click', () => {
            EventBus.emit('notes:toggle');
        });

        contentEl.querySelector('#export-notes-btn').addEventListener('click', () => {
            Notes.downloadExport();
        });

        const importBtn = contentEl.querySelector('#import-notes-btn');
        const importFile = contentEl.querySelector('#import-notes-file');

        importBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                Notes.importData(event.target.result);
                renderNotesMenu(contentEl);
            };
            reader.readAsText(file);
        });

        const clearBtn = contentEl.querySelector('#clear-notes-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('确定要清空所有笔记吗？此操作不可恢复。')) {
                    Notes.clear();
                    renderNotesMenu(contentEl);
                }
            });
        }
    }

    function switchMenu(menuName) {
        if (!panelInstance) return;
        
        currentMenu = menuName;
        const panelEl = panelInstance.element;
        
        panelEl.querySelectorAll('.bili-speed-panel-menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.menu === menuName);
        });

        const contentEl = panelEl.querySelector('.bili-speed-panel-content');
        if (!contentEl) return;

        switch (menuName) {
            case 'system':
                renderSystemMenu(contentEl);
                break;
            case 'speed':
                renderSpeedMenu(contentEl);
                break;
            case 'favorites':
                renderFavoritesMenu(contentEl);
                break;
            case 'notes':
                renderNotesMenu(contentEl);
                break;
        }
    }

    function createPanel() {
        if (multiClickCleanup) {
            multiClickCleanup();
            multiClickCleanup = null;
        }

        let savedPosition = Config.data.panelPosition;
        const currentTheme = Config.data.theme || 'light';

        panelInstance = Card.create({
            className: `bili-speed-panel theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: '⚙️ 控制面板'
            },
            footer: { visible: false },
            styles: {
                width: '420px',
                display: Config.data.panelVisible ? 'block' : 'none',
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
                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-close';
                closeBtn.style.cssText = 'background: none; border: none; color: #000; font-size: 20px; cursor: pointer;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', () => {
                    EventBus.emit('panel:toggle');
                });

                const titleEl = headerEl.querySelector('.bili-speed-panel-drag-text') || headerEl.querySelector('.bili-speed-drag-text');
                const actionsEl = headerEl.querySelector('.bili-speed-panel-actions');
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'panelPosition', `[class*="-header"]`);

                let advancedVisible = false;
                multiClickCleanup = Utils.multiClick(titleEl, 5, () => {
                    advancedVisible = !advancedVisible;
                    const contentEl = panelInstance.element.querySelector('.bili-speed-panel-content');
                    if (contentEl) {
                        contentEl.querySelectorAll('.advanced-option').forEach(item => {
                            item.style.display = advancedVisible ? 'block' : 'none';
                        });
                    }
                    Toast.show(advancedVisible ? '已显示高级选项' : '已隐藏高级选项');
                });
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-panel-body';
                bodyEl.style.cssText = 'padding: 0; display: flex;';

                bodyEl.innerHTML = `
                    <div class="bili-speed-panel-menu" style="width: 120px; border-right: 1px solid #ddd; padding: 8px 0; flex-shrink: 0;">
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'system' ? 'active' : ''}" data-menu="system" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            🔧 系统菜单
                        </div>
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'speed' ? 'active' : ''}" data-menu="speed" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            ⚡ 倍速设置
                        </div>
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'favorites' ? 'active' : ''}" data-menu="favorites" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            ⭐ 收藏夹
                        </div>
                        <div class="bili-speed-panel-menu-item ${currentMenu === 'notes' ? 'active' : ''}" data-menu="notes" style="padding: 10px 12px; cursor: pointer; font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s;">
                            📝 笔记
                        </div>
                    </div>
                    <div class="bili-speed-panel-content" style="flex: 1; min-height: 300px;"></div>
                `;

                const menuItems = bodyEl.querySelectorAll('.bili-speed-panel-menu-item');
                menuItems.forEach(item => {
                    item.addEventListener('click', () => {
                        switchMenu(item.dataset.menu);
                    });

                    item.addEventListener('mouseenter', () => {
                        if (!item.classList.contains('active')) {
                            item.style.background = '#f0f0f0';
                        }
                    });

                    item.addEventListener('mouseleave', () => {
                        if (!item.classList.contains('active')) {
                            item.style.background = '';
                        }
                    });
                });

                const contentEl = bodyEl.querySelector('.bili-speed-panel-content');
                switchMenu(currentMenu);
            }
        });

        const panelStyle = document.createElement('style');
        panelStyle.textContent = `
            .bili-speed-panel .step-btn,
            .bili-speed-panel .default-btn,
            .bili-speed-panel .min-rate-btn,
            .bili-speed-panel .max-rate-btn {
                padding: 4px 12px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background: #fff;
                color: #000;
                cursor: pointer;
                transition: all 0.2s;
            }
            .bili-speed-panel .step-btn:hover,
            .bili-speed-panel .default-btn:hover,
            .bili-speed-panel .min-rate-btn:hover,
            .bili-speed-panel .max-rate-btn:hover {
                background: #e0e0e0;
            }
            .bili-speed-panel .step-btn.active,
            .bili-speed-panel .default-btn.active,
            .bili-speed-panel .min-rate-btn.active,
            .bili-speed-panel .max-rate-btn.active {
                background: #00AEEC;
                color: #fff;
                border-color: #00AEEC;
            }
            .bili-speed-panel .editor-btn,
            .bili-speed-panel .vditor-mode-btn,
            .bili-speed-panel .editor-size-btn {
                padding: 4px 12px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background: #fff;
                color: #000;
                cursor: pointer;
                transition: all 0.2s;
            }
            .bili-speed-panel .editor-btn:hover,
            .bili-speed-panel .vditor-mode-btn:hover,
            .bili-speed-panel .editor-size-btn:hover {
                background: #e0e0e0;
            }
            .bili-speed-panel .editor-btn.active,
            .bili-speed-panel .vditor-mode-btn.active,
            .bili-speed-panel .editor-size-btn.active {
                background: #00AEEC;
                color: #fff;
                border-color: #00AEEC;
            }
            .bili-speed-panel-menu-item.active {
                background: #e6f7ff;
                border-left-color: #00AEEC;
                color: #00AEEC;
            }
            .bili-speed-panel.theme-dark {
                background: #1f1f1f;
                color: #fff;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu {
                border-right-color: #333;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu-item {
                color: #ccc;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu-item:hover {
                background: #333;
            }
            .bili-speed-panel.theme-dark .bili-speed-panel-menu-item.active {
                background: #333;
                border-left-color: #00AEEC;
                color: #00AEEC;
            }
            .bili-speed-panel.theme-dark button {
                color: #fff;
                border-color: #444;
                background: #333;
            }
            .bili-speed-panel.theme-dark button:hover {
                background: #444;
            }
            .bili-speed-panel.theme-dark button.active {
                background: #00AEEC;
                border-color: #00AEEC;
            }
            .bili-speed-panel.theme-dark input {
                background: #333;
                color: #fff;
                border-color: #444;
            }
            .bili-speed-panel.theme-dark .bili-speed-close {
                color: #fff;
            }
        `;
        if (!document.querySelector('#bili-speed-panel-style')) {
            panelStyle.id = 'bili-speed-panel-style';
            document.head.appendChild(panelStyle);
        }
    }

    return {
        create() {
            if (panelInstance) panelInstance.destroy();
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (multiClickCleanup) {
                multiClickCleanup();
                multiClickCleanup = null;
            }

            createPanel();
        },

        toggle() {
            Config.data.panelVisible = !Config.data.panelVisible;
            if (panelInstance) {
                panelInstance.element.style.display = Config.data.panelVisible ? 'block' : 'none';
            }
        },

        switchMenu(menuName) {
            switchMenu(menuName);
        },

        applyTheme(theme) {
            applyTheme(theme);
        },

        destroy() {
            if (multiClickCleanup) {
                multiClickCleanup();
                multiClickCleanup = null;
            }
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
        }
    };
})();
