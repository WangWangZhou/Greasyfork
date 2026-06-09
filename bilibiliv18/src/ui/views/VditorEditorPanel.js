/**
 * VditorEditorPanel - Vditor Markdown编辑器面板视图
 * 视图层 - 使用Card和Resizable组件渲染基于Vditor的Markdown笔记编辑器
 * 支持所见即所得(wysiwyg)/即时渲染(ir)/分屏预览(sv)三种编辑模式
 */
const VditorEditorPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let resizeCleanup = null;
    let vditorInstance = null;
    let currentNoteId = null;
    let isResourcesLoaded = false;
    let isLoadingResources = false;
    let tags = [];
    let pendingContent = '';

    function getCurrentVideoInfo() {
        const url = location.href;
        const match = url.match(/BV[\w]+/);
        const video = VideoController.getVideo();
        const title = document.querySelector('h1.video-title, .video-title-href, h1[class*="title"]')?.textContent?.trim() || '未知标题';

        return {
            bvid: match ? match[0] : '',
            videoTitle: title,
            videoUrl: url,
            currentTime: video ? video.currentTime : 0,
            hasVideo: !!video
        };
    }

    // 获取 Vditor 构造函数（兼容沙箱环境）
    function getVditor() {
        return (typeof unsafeWindow !== 'undefined' && unsafeWindow.Vditor)
            ? unsafeWindow.Vditor
            : window.Vditor;
    }

    function loadVditorResources() {
        return new Promise((resolve, reject) => {
            if (getVditor()) {
                isResourcesLoaded = true;
                resolve();
                return;
            }

            if (isLoadingResources) {
                const checkInterval = setInterval(() => {
                    if (getVditor()) {
                        clearInterval(checkInterval);
                        isResourcesLoaded = true;
                        resolve();
                    }
                }, 100);

                setTimeout(() => {
                    clearInterval(checkInterval);
                    reject(new Error('Vditor 资源加载超时'));
                }, 15000);
                return;
            }

            isLoadingResources = true;

            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = Config.data.vditorCdnCss;
            css.id = 'vditor-css';
            document.head.appendChild(css);

            const script = document.createElement('script');
            script.src = Config.data.vditorCdnJs;
            script.id = 'vditor-script';
            script.onload = () => {
                isResourcesLoaded = true;
                isLoadingResources = false;
                EventBus.emit('editor:vditor:loaded');
                resolve();
            };
            script.onerror = () => {
                isLoadingResources = false;
                reject(new Error('Vditor 资源加载失败'));
            };
            document.head.appendChild(script);
        });
    }

    function initVditorEditor(containerEl, content, theme, height) {
        const Vditor = getVditor();
        if (!Vditor) return;

        const editorContainer = containerEl.querySelector('#vditor-editor-container');
        if (!editorContainer) return;

        const vditorMode = Config.data.vditorEditorMode || 'ir';
        vditorInstance = new Vditor('vditor-editor-container', {
            height: '100%',
            mode: vditorMode,
            theme: theme === 'dark' ? 'dark' : 'classic',
            toolbar: ['headings', 'bold', 'italic', 'strike', 'link', 'code', 'table'],
            placeholder: '开始记录笔记（Markdown格式）...',
            cache: { enable: false },
            after: () => {
                if (content) {
                    vditorInstance.setValue(content);
                }
                setTimeout(() => adjustVditorEditorHeight(), 100);
            }
        });
    }

    function adjustVditorEditorHeight() {
        if (!vditorInstance) return;
        const container = document.getElementById('vditor-editor-container');
        if (!container) return;

        const containerHeight = container.clientHeight;
        if (containerHeight <= 0) return;

        const vditorRoot = container.querySelector('.vditor');
        if (vditorRoot) {
            vditorRoot.style.height = containerHeight + 'px';
        }

        const toolbar = container.querySelector('.vditor-toolbar');
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 40;
        const contentHeight = Math.max(50, containerHeight - toolbarHeight);

        const vditorContent = container.querySelector('.vditor-content');
        if (vditorContent) vditorContent.style.height = contentHeight + 'px';

        const wysiwyg = container.querySelector('.vditor-wysiwyg');
        if (wysiwyg) wysiwyg.style.height = contentHeight + 'px';
        const ir = container.querySelector('.vditor-ir');
        if (ir) ir.style.height = contentHeight + 'px';
        const sv = container.querySelector('.vditor-sv');
        if (sv) sv.style.height = contentHeight + 'px';
        const preview = container.querySelector('.vditor-preview');
        if (preview) preview.style.height = contentHeight + 'px';

        const reset = container.querySelector('.vditor-reset');
        if (reset) reset.style.height = contentHeight + 'px';
    }

    function switchMode(newMode) {
        if (!vditorInstance) return;

        const currentContent = vditorInstance.getValue();

        Config.data.vditorEditorMode = newMode;

        if (typeof vditorInstance.setMode === 'function') {
            try {
                vditorInstance.setMode(newMode);
                setTimeout(() => adjustVditorEditorHeight(), 50);
                setTimeout(() => updateFooterStatus(), 100);
                return;
            } catch (e) {
                console.warn('[VditorEditorPanel] setMode 失败，降级为重建:', e);
            }
        }

        try { vditorInstance.destroy(); } catch {}
        vditorInstance = null;

        const container = document.getElementById('vditor-editor-container');
        if (container) container.innerHTML = '';

        const bodyEl = panelInstance?.element?.querySelector('.bili-speed-vditor-panel-body');
        if (bodyEl) {
            const currentTheme = Config.data.theme || 'light';
            initVditorEditor(bodyEl, currentContent, currentTheme,
                panelInstance.element.getBoundingClientRect().height);
            setTimeout(() => updateFooterStatus(), 500);
        }
    }

    function renderTags(containerEl) {
        const tagsContainer = containerEl.querySelector('.bili-speed-editor-tags');
        if (!tagsContainer) return;

        tagsContainer.innerHTML = '';
        tags.forEach((tag, index) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'bili-speed-editor-tag';
            tagEl.innerHTML = `${tag} <span class="bili-speed-editor-tag-remove" data-index="${index}">×</span>`;
            tagsContainer.appendChild(tagEl);
        });

        tagsContainer.querySelectorAll('.bili-speed-editor-tag-remove').forEach(removeBtn => {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(removeBtn.dataset.index);
                tags.splice(idx, 1);
                renderTags(containerEl);
            });
        });
    }

    function addTag(containerEl, tagInput) {
        const tag = tagInput.value.trim();
        if (!tag) return;
        if (tags.length >= 10) {
            Toast.show('标签数量已达上限');
            return;
        }
        if (tags.includes(tag)) {
            Toast.show('标签已存在');
            return;
        }
        tags.push(tag);
        tagInput.value = '';
        renderTags(containerEl);
    }

    function updateFooterStatus() {
        const footerEl = panelInstance?.getFooter();
        if (!footerEl) return;

        let charCount = 0;
        let selectedCount = 0;

        if (vditorInstance) {
            const content = vditorInstance.getValue();
            charCount = content.length;
            const textarea = vditorInstance.element?.querySelector('textarea');
            if (textarea) {
                selectedCount = textarea.selectionEnd - textarea.selectionStart;
            }
        }

        footerEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #666;">
                <span class="bili-speed-vditor-footer-status"></span>
                <span>字数: ${charCount} | 已选中: ${selectedCount}</span>
            </div>
        `;
    }

    function showSaveStatus(message, isError = false) {
        const footerEl = panelInstance?.getFooter();
        if (!footerEl) return;

        const statusEl = footerEl.querySelector('.bili-speed-vditor-footer-status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = isError ? '#ff4d4f' : '#52c41a';
            statusEl.style.fontWeight = 'bold';
        }

        setTimeout(() => {
            if (statusEl) {
                statusEl.textContent = '';
                updateFooterStatus();
            }
        }, 3000);
    }

    async function saveNote() {
        const panelEl = panelInstance?.element;
        if (!panelEl) return;

        const titleInput = panelEl.querySelector('.bili-speed-editor-title-input');
        const title = titleInput ? titleInput.value.trim() : '';
        if (!title) {
            Toast.show('请输入笔记标题');
            return;
        }

        let content = '';
        if (vditorInstance) {
            content = vditorInstance.getValue();
        } else {
            const fallback = panelEl.querySelector('.bili-speed-editor-fallback');
            if (fallback) content = fallback.value;
        }

        const videoInfo = getCurrentVideoInfo();
        const noteType = videoInfo.hasVideo ? 'videoNote' : 'normalNote';

        if (currentNoteId) {
            await Notes.update(currentNoteId, {
                title: title,
                content: content,
                contentDelta: '',
                tags: [...tags],
                videoTitle: videoInfo.videoTitle,
                videoUrl: videoInfo.videoUrl
            });
            showSaveStatus('✓ 笔记已更新');
        } else {
            const note = {
                id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                noteType: noteType,
                bvid: videoInfo.bvid,
                videoTitle: videoInfo.videoTitle,
                videoUrl: videoInfo.videoUrl,
                editorType: 'vditor',
                title: title,
                content: content,
                contentDelta: '',
                tags: [...tags],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await Notes.add(note);
            currentNoteId = note.id;
            showSaveStatus('✓ 笔记已保存');
        }
    }

    function createPanel(note) {
        let savedPosition = Config.data.editorPanelPosition;
        const savedSize = Config.data.vditorEditorPanelSize;
        const currentTheme = Config.data.theme || 'light';

        currentNoteId = note ? note.id : null;
        tags = note ? [...(note.tags || [])] : [];
        pendingContent = note ? (note.content || '') : '';

        const noteTitle = note ? note.title : '';
        const isEdit = !!note;
        const videoInfo = getCurrentVideoInfo();
        const vditorMode = Config.data.vditorEditorMode || 'ir';
        const headerTitle = videoInfo.hasVideo
            ? `✏️ ${isEdit ? '编辑笔记' : '新建笔记'} - Vditor`
            : `✏️ ${isEdit ? '编辑笔记' : '新建普通笔记'} - Vditor`;

        const vditorWidthKey = 'vditorWidth_' + vditorMode;
        const vditorHeightKey = 'vditorHeight_' + vditorMode;
        const panelWidth = savedSize ? savedSize.width : (Config.data[vditorWidthKey] || '560px');
        const panelHeight = savedSize ? savedSize.height : (Config.data[vditorHeightKey] || '550px');

        panelInstance = Card.create({
            className: `bili-speed-vditor-panel theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: headerTitle
            },
            footer: { visible: true },
            styles: {
                width: panelWidth,
                height: panelHeight,
                display: 'flex',
                flexDirection: 'column',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10000,
                ...(savedPosition ? {
                    left: savedPosition.left,
                    top: savedPosition.top,
                    transform: 'none'
                } : {})
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.bili-speed-vditor-panel-actions');
                if (actionsEl) {
                    actionsEl.style.pointerEvents = 'auto';
                    actionsEl.style.position = 'relative';
                    actionsEl.style.zIndex = '1001';
                }

                const listBtn = document.createElement('button');
                listBtn.className = 'bili-speed-editor-list';
                listBtn.title = '打开笔记列表';
                listBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; position: relative; z-index: 1001; pointer-events: auto;';
                listBtn.textContent = '📋';
                listBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    NotesPanel.show();
                });

                const saveBtn = document.createElement('button');
                saveBtn.className = 'bili-speed-editor-save';
                saveBtn.title = '保存笔记';
                saveBtn.style.cssText = 'background: #F0F1F2; color: #333; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; position: relative; z-index: 1001; pointer-events: auto;';
                saveBtn.textContent = '💾 保存';
                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    saveNote();
                });

                const vditorMode = Config.data.vditorEditorMode || 'ir';
                const modeConfigs = [
                    { mode: 'wysiwyg', label: '所见' },
                    { mode: 'ir', label: '即显' },
                    { mode: 'sv', label: '分屏' }
                ];
                const modeButtons = [];
                modeConfigs.forEach(({ mode, label }) => {
                    const btn = document.createElement('button');
                    btn.className = 'bili-speed-editor-mode';
                    btn.title = `切换到${mode === 'wysiwyg' ? '所见即所得' : mode === 'ir' ? '即时渲染' : '分屏预览'}模式`;
                    const isActive = mode === vditorMode;
                    btn.style.cssText = `background: ${isActive ? '#00AEEC' : 'transparent'}; color: ${isActive ? '#fff' : '#000'}; border: ${isActive ? '1px solid #00AEEC' : '1px solid #ddd'}; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 12px; position: relative; z-index: 1001; pointer-events: auto;`;
                    btn.textContent = label;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (Config.data.vditorEditorMode !== mode) {
                            modeButtons.forEach(b => {
                                b.style.background = 'transparent';
                                b.style.color = '#000';
                                b.style.border = '1px solid #ddd';
                            });
                            btn.style.background = '#00AEEC';
                            btn.style.color = '#fff';
                            btn.style.border = '1px solid #00AEEC';
                            Config.data.vditorEditorMode = mode;
                            if (vditorInstance) {
                                switchMode(mode);
                            }
                        }
                    });
                    modeButtons.push(btn);
                    actionsEl.appendChild(btn);
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-editor-close';
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; position: relative; z-index: 1001; pointer-events: auto;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    VditorEditorPanel.close();
                });

                actionsEl.appendChild(listBtn);
                actionsEl.appendChild(saveBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'editorPanelPosition', `[class*="-header"]`);
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-vditor-panel-body';
                bodyEl.style.cssText = 'padding: 12px; flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;';

                bodyEl.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <input type="text" class="bili-speed-editor-title-input" placeholder="输入笔记标题..." value="${noteTitle}" style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; outline: none;">
                    </div>
                    <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <div class="bili-speed-editor-tags" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
                        <input type="text" class="bili-speed-editor-tag-input" placeholder="添加标签..." style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 100px; outline: none;">
                        <button class="bili-speed-editor-tag-add" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer; font-size: 12px;">+</button>
                    </div>
                    <div id="vditor-editor-container"></div>
                    <div class="bili-speed-editor-loading" style="text-align: center; padding: 40px 0; color: #999; display: none;">
                        <div>正在加载编辑器资源...</div>
                    </div>
                `;

                const editorContainer = document.getElementById('vditor-editor-container');
                if (editorContainer) {
                    editorContainer.style.flex = '1';
                    editorContainer.style.minHeight = '0';
                    editorContainer.style.height = '100%';
                }

                const style = document.createElement('style');
                style.textContent = `
                    #vditor-editor-container {
                        display: flex;
                        flex-direction: column;
                    }
                    #vditor-editor-container .vditor {
                        height: 100% !important;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }
                    #vditor-editor-container .vditor-content {
                        flex: 1;
                        min-height: 0;
                    }
                `;
                document.head.appendChild(style);

                renderTags(bodyEl);

                const tagInput = bodyEl.querySelector('.bili-speed-editor-tag-input');
                const tagAddBtn = bodyEl.querySelector('.bili-speed-editor-tag-add');
                tagAddBtn.addEventListener('click', () => addTag(bodyEl, tagInput));
                tagInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(bodyEl, tagInput);
                    }
                });

                const loadingEl = bodyEl.querySelector('.bili-speed-editor-loading');
                const panelEl = bodyEl.parentElement;

                const vditorMode = Config.data.vditorEditorMode || 'ir';
                const minWidthKey = 'vditorEditorMinWidth_' + vditorMode;
                const minHeightKey = 'vditorEditorMinHeight_' + vditorMode;

                resizeCleanup = Resizable.make(panelEl, {
                    minWidth: parseInt(Config.data[minWidthKey]) || 400,
                    minHeight: parseInt(Config.data[minHeightKey]) || 400,
                    onResize: (newWidth, newHeight) => {
                        if (vditorInstance) {
                            adjustVditorEditorHeight();
                        }
                    },
                    saveKey: 'vditorEditorPanelSize'
                });

                if (isResourcesLoaded && getVditor()) {
                    initVditorEditor(bodyEl, pendingContent, currentTheme, panelEl.getBoundingClientRect().height);
                    setTimeout(() => updateFooterStatus(), 500);
                } else {
                    loadingEl.style.display = 'block';

                    loadVditorResources().then(() => {
                        loadingEl.style.display = 'none';
                        initVditorEditor(bodyEl, pendingContent, currentTheme, panelEl.getBoundingClientRect().height);
                        setTimeout(() => updateFooterStatus(), 500);
                    }).catch(() => {
                        loadingEl.innerHTML = '<div style="color: #ff6b6b;">编辑器加载失败，使用简易编辑模式</div>';
                        setTimeout(() => { loadingEl.style.display = 'none'; }, 2000);
                        const editorContainer = bodyEl.querySelector('#vditor-editor-container');
                        if (editorContainer) {
                            editorContainer.innerHTML = `<textarea class="bili-speed-editor-fallback" style="width: 100%; min-height: 200px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical; outline: none; box-sizing: border-box;">${pendingContent}</textarea>`;
                        }
                    });
                }
            }
        });
    }

    EventBus.on('vditor:mode:change', (mode) => {
        if (panelInstance && vditorInstance) {
            switchMode(mode);
        }
    });

    return {
        create() {
            if (panelInstance) panelInstance.destroy();
            if (dragCleanup) dragCleanup();
            if (resizeCleanup) resizeCleanup();
            dragCleanup = null;
            resizeCleanup = null;
            if (vditorInstance) {
                try { vditorInstance.destroy(); } catch {}
                vditorInstance = null;
            }
        },

        open(note) {
            if (panelInstance) {
                VditorEditorPanel.close();
            }

            if (QuillEditorPanel && typeof QuillEditorPanel.close === 'function') {
                QuillEditorPanel.close();
            }

            createPanel(note || null);
        },

        close() {
            if (vditorInstance) {
                try { vditorInstance.destroy(); } catch {}
                vditorInstance = null;
            }
            if (dragCleanup) dragCleanup();
            if (resizeCleanup) resizeCleanup();
            dragCleanup = null;
            resizeCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
            currentNoteId = null;
            tags = [];
            pendingContent = '';
        },

        applyTheme(theme) {
            if (!panelInstance) return;
            const el = panelInstance.element;
            el.classList.remove('theme-light', 'theme-dark');
            el.classList.add(`theme-${theme}`);
            
            // 更新 Vditor 编辑器自身的主题
            if (vditorInstance) {
                const Vditor = getVditor();
                if (Vditor && vditorInstance.element) {
                    const vditorRoot = vditorInstance.element.querySelector('.vditor');
                    if (vditorRoot) {
                        vditorRoot.classList.remove('vditor-classic', 'vditor-dark');
                        vditorRoot.classList.add(theme === 'dark' ? 'vditor-dark' : 'vditor-classic');
                    }
                }
            }
        },

        isOpen() {
            return panelInstance !== null;
        },

        destroy() {
            VditorEditorPanel.close();
        }
    };
})();
