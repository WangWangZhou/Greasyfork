const QuillEditorPanel = (() => {
    let panelInstance = null;
    let dragCleanup = null;
    let resizeCleanup = null;
    let quillInstance = null;
    let currentNoteId = null;
    let tags = [];
    let videoTimestamp = 0;

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

    function getQuill() {
        return (typeof unsafeWindow !== 'undefined' && unsafeWindow.Quill) ? unsafeWindow.Quill : window.Quill;
    }

    function loadQuillResources() {
        return new Promise((resolve, reject) => {
            const Quill = getQuill();
            console.log('[QuillEditorPanel] loadQuillResources called, Quill:', !!Quill);
            if (Quill) {
                console.log('[QuillEditorPanel] Quill already loaded');
                resolve();
                return;
            }

            const existingScript = document.getElementById('quill-js');
            if (existingScript) {
                console.log('[QuillEditorPanel] Script exists, loading:', existingScript.dataset.loading);
                if (existingScript.dataset.loading === 'true') {
                    const checkInterval = setInterval(() => {
                        const Q = getQuill();
                        console.log('[QuillEditorPanel] Checking Quill...', !!Q);
                        if (Q) {
                            clearInterval(checkInterval);
                            console.log('[QuillEditorPanel] Quill loaded via interval');
                            resolve();
                        }
                    }, 100);

                    setTimeout(() => {
                        clearInterval(checkInterval);
                        console.log('[QuillEditorPanel] Quill load timeout');
                        reject(new Error('Quill 资源加载超时'));
                    }, 30000);
                    return;
                } else {
                    console.log('[QuillEditorPanel] Removing existing script');
                    existingScript.remove();
                }
            }

            console.log('[QuillEditorPanel] Creating new script tag');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.min.js';
            script.id = 'quill-js';
            script.dataset.loading = 'true';
            script.onload = () => {
                console.log('[QuillEditorPanel] Script onload fired, Quill:', !!getQuill());
                const waitForQuill = (retries = 0) => {
                    const Q = getQuill();
                    if (Q) {
                        console.log('[QuillEditorPanel] Quill loaded after', retries, 'retries');
                        resolve();
                    } else if (retries < 50) {
                        setTimeout(() => waitForQuill(retries + 1), 100);
                    } else {
                        console.log('[QuillEditorPanel] Quill load timeout after onload');
                        reject(new Error('Quill 加载超时'));
                    }
                };
                waitForQuill();
            };
            script.onerror = (e) => {
                console.log('[QuillEditorPanel] Script onerror', e);
                script.dataset.loading = 'false';
                reject(new Error('Quill 资源加载失败'));
            };
            document.head.appendChild(script);
            console.log('[QuillEditorPanel] Script appended to head');
        });
    }

    function injectQuillCSS() {
        if (document.getElementById('quill-snow-css')) return;

        const cssUrl = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css';

        if (typeof GM_addStyle !== 'undefined') {
            fetch(cssUrl)
                .then(res => res.text())
                .then(css => GM_addStyle(css))
                .catch(() => {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = cssUrl;
                    link.id = 'quill-snow-css';
                    document.head.appendChild(link);
                });
        } else {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssUrl;
            link.id = 'quill-snow-css';
            document.head.appendChild(link);
        }
    }

    function initQuillEditor(containerEl, height) {
        const Quill = getQuill();
        if (!Quill) return;

        const editorContainer = containerEl.querySelector('#quill-editor-container');
        if (!editorContainer) return;

        quillInstance = new Quill(editorContainer, {
            theme: 'snow',
            placeholder: '开始记录笔记...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'strike', 'underline'],
                    [{ header: 2 }],
                    ['blockquote'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['link'],
                    ['clean']
                ]
            }
        });

        requestAnimationFrame(() => {
            adjustQuillEditorHeight(height);

            const qlContainer = editorContainer.querySelector('.ql-container');
            if (qlContainer) {
                qlContainer.style.borderRadius = '0 0 4px 4px';
                qlContainer.style.borderLeft = '1px solid #ddd';
                qlContainer.style.borderRight = '1px solid #ddd';
                qlContainer.style.borderBottom = '1px solid #ddd';
                qlContainer.style.borderTop = 'none';
                qlContainer.style.background = '#FFFFFF';
            }

            const qlToolbar = editorContainer.previousElementSibling?.classList.contains('ql-toolbar')
                ? editorContainer.previousElementSibling
                : editorContainer.parentElement?.querySelector('.ql-toolbar');
            if (qlToolbar) {
                qlToolbar.style.borderRadius = '4px 4px 0 0';
                qlToolbar.style.borderLeft = '1px solid #ddd';
                qlToolbar.style.borderRight = '1px solid #ddd';
                qlToolbar.style.borderTop = '1px solid #ddd';
                qlToolbar.style.borderBottom = 'none';
                qlToolbar.style.marginBottom = '0';
                qlToolbar.style.background = '#FFFFFF';
            }

            const qlEditor = editorContainer.querySelector('.ql-editor');
            if (qlEditor) {
                qlEditor.style.background = '#FFFFFF';
            }
        });
    }

    function adjustQuillEditorHeight(panelHeight) {
        const editorContainer = document.querySelector('#quill-editor-container');
        if (!editorContainer || !quillInstance) return;

        const headerHeight = 50;
        const bodyPadding = 24;
        const titleInputHeight = 40;
        const tagsHeight = 40;
        const timestampEl = document.querySelector('.bili-speed-editor-mark-time')?.parentElement;
        const timestampHeight = timestampEl ? timestampEl.offsetHeight || 30 : 0;
        const footerHeight = 30;
        const resizeHandleHeight = 16;

        const availableHeight = panelHeight - headerHeight - bodyPadding - titleInputHeight - tagsHeight - timestampHeight - footerHeight - resizeHandleHeight;
        const minHeight = 150;
        const finalHeight = Math.max(minHeight, availableHeight);

        const qlContainer = editorContainer.querySelector('.ql-container');
        if (qlContainer) {
            qlContainer.style.height = finalHeight + 'px';
        }

        const qlEditor = editorContainer.querySelector('.ql-editor');
        if (qlEditor) {
            qlEditor.style.minHeight = finalHeight + 'px';
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

        const charCount = quillInstance ? quillInstance.getLength() - 1 : 0;
        const selection = quillInstance ? quillInstance.getSelection() : null;
        const selectedCount = selection ? selection.length : 0;

        footerEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #666;">
                <span class="bili-speed-quill-footer-status"></span>
                <span>字数: ${charCount} | 已选中: ${selectedCount}</span>
            </div>
        `;
    }

    function showSaveStatus(message, isError = false) {
        const footerEl = panelInstance?.getFooter();
        if (!footerEl) return;

        const statusEl = footerEl.querySelector('.bili-speed-quill-footer-status');
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

    function saveNote() {
        const panelEl = panelInstance?.element;
        if (!panelEl) return;

        const titleInput = panelEl.querySelector('.bili-speed-editor-title-input');
        const title = titleInput ? titleInput.value.trim() : '';
        if (!title) {
            Toast.show('请输入笔记标题');
            return;
        }

        const content = quillInstance ? quillInstance.root.innerHTML : '';
        const contentDelta = quillInstance ? JSON.stringify(quillInstance.getContents()) : '';

        const videoInfo = getCurrentVideoInfo();
        const noteType = videoInfo.hasVideo ? 'videoNote' : 'normalNote';

        if (currentNoteId) {
            Notes.update(currentNoteId, {
                title: title,
                content: content,
                contentDelta: contentDelta,
                tags: [...tags],
                videoTimestamp: videoTimestamp,
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
                editorType: 'quill',
                title: title,
                content: content,
                contentDelta: contentDelta,
                tags: [...tags],
                videoTimestamp: videoTimestamp,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            Notes.add(note);
            currentNoteId = note.id;
            showSaveStatus('✓ 笔记已保存');
        }
    }

    function createPanel(note) {
        injectQuillCSS();

        let savedPosition = Config.data.editorPanelPosition;
        const currentTheme = Config.data.theme || 'light';

        currentNoteId = note ? note.id : null;
        tags = note ? [...(note.tags || [])] : [];
        videoTimestamp = note ? (note.videoTimestamp || 0) : 0;

        const videoInfo = getCurrentVideoInfo();
        const noteTitle = note ? note.title : '';
        const isEdit = !!note;
        const headerTitle = videoInfo.hasVideo
            ? `✏️ ${isEdit ? '编辑笔记' : '新建笔记'} - Quill`
            : `✏️ ${isEdit ? '编辑笔记' : '新建普通笔记'} - Quill`;

        panelInstance = Card.create({
            className: `bili-speed-quill-panel theme-${currentTheme}`,
            header: {
                visible: true,
                draggable: true,
                title: headerTitle
            },
            footer: { visible: true },
            styles: {
                width: Config.data.quillEditorWidth || '520px',
                height: Config.data.quillEditorHeight || '500px',
                display: 'block',
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
                const actionsEl = headerEl.querySelector('.bili-speed-quill-panel-actions');
                if (actionsEl) {
                    actionsEl.style.pointerEvents = 'auto';
                    actionsEl.style.position = 'relative';
                    actionsEl.style.zIndex = '1001';
                }

                const listBtn = document.createElement('button');
                listBtn.className = 'bili-speed-editor-list';
                listBtn.title = '打开笔记列表';
                listBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; position: relative; z-index: 1001; pointer-events: auto; transition: transform 0.15s ease;';
                listBtn.textContent = '📋';
                listBtn.addEventListener('mouseenter', () => { listBtn.style.transform = 'scale(1.2)'; });
                listBtn.addEventListener('mouseleave', () => { listBtn.style.transform = 'scale(1)'; });
                listBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    NotesPanel.show();
                });

                const saveBtn = document.createElement('button');
                saveBtn.className = 'bili-speed-editor-save';
                saveBtn.title = '保存笔记';
                saveBtn.style.cssText = 'background: #F0F1F2; color: #333; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; position: relative; z-index: 1001; pointer-events: auto; transition: transform 0.15s ease;';
                saveBtn.textContent = '💾 保存';
                saveBtn.addEventListener('mouseenter', () => { saveBtn.style.transform = 'scale(1.1)'; });
                saveBtn.addEventListener('mouseleave', () => { saveBtn.style.transform = 'scale(1)'; });
                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    saveNote();
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'bili-speed-editor-close';
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; position: relative; z-index: 1001; pointer-events: auto; transition: transform 0.15s ease;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('mouseenter', () => { closeBtn.style.transform = 'scale(1.2)'; });
                closeBtn.addEventListener('mouseleave', () => { closeBtn.style.transform = 'scale(1)'; });
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    QuillEditorPanel.close();
                });

                actionsEl.appendChild(listBtn);
                actionsEl.appendChild(saveBtn);
                actionsEl.appendChild(closeBtn);

                dragCleanup = Draggable.make(headerEl.parentElement, 'editorPanelPosition', `[class*="-header"]`);
            },
            onBodyReady: (bodyEl) => {
                bodyEl.className = 'bili-speed-quill-panel-body';
                bodyEl.style.cssText = 'padding: 12px;';

                bodyEl.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <input type="text" class="bili-speed-editor-title-input" placeholder="输入笔记标题..." value="${noteTitle}" style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; outline: none;">
                    </div>
                    <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <div class="bili-speed-editor-tags" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
                        <input type="text" class="bili-speed-editor-tag-input" placeholder="添加标签..." style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 100px; outline: none;">
                        <button class="bili-speed-editor-tag-add" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer; font-size: 12px;">+</button>
                    </div>
                    ${videoInfo.hasVideo ? `
                    <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 12px; color: #999;">时间点:</span>
                        <span class="bili-speed-editor-timestamp" style="font-size: 12px; color: #00AEEC;">${videoTimestamp > 0 ? Utils.formatTime(videoTimestamp) : '未标记'}</span>
                        <button class="bili-speed-editor-mark-time" style="padding: 2px 8px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer; font-size: 11px;">📍标记当前时间</button>
                    </div>
                    ` : ''}
                    <div id="quill-editor-container"></div>
                    <div class="bili-speed-editor-loading" style="text-align: center; padding: 40px 0; color: #999; display: none;">
                        <div>正在加载编辑器资源...</div>
                    </div>
                `;

                renderTags(bodyEl);

                const titleInput = bodyEl.querySelector('.bili-speed-editor-title-input');
                const tagInput = bodyEl.querySelector('.bili-speed-editor-tag-input');
                const tagAddBtn = bodyEl.querySelector('.bili-speed-editor-tag-add');
                tagAddBtn.addEventListener('click', () => addTag(bodyEl, tagInput));
                tagInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(bodyEl, tagInput);
                    }
                });

                const markTimeBtn = bodyEl.querySelector('.bili-speed-editor-mark-time');
                if (markTimeBtn) {
                    markTimeBtn.addEventListener('click', () => {
                        const video = VideoController.getVideo();
                        if (video) {
                            videoTimestamp = video.currentTime;
                            const tsEl = bodyEl.querySelector('.bili-speed-editor-timestamp');
                            if (tsEl) tsEl.textContent = Utils.formatTime(videoTimestamp);
                            Toast.show(`已标记时间点: ${Utils.formatTime(videoTimestamp)}`);
                        } else {
                            Toast.show('未找到视频元素');
                        }
                    });
                }

                const editorContainer = bodyEl.querySelector('#quill-editor-container');
                const loadingEl = bodyEl.querySelector('.bili-speed-editor-loading');
                const panelEl = bodyEl.parentElement;

                resizeCleanup = Resizable.make(panelEl, {
                    minWidth: 400,
                    minHeight: 350,
                    onResize: (newWidth, newHeight) => {
                        if (quillInstance) {
                            adjustQuillEditorHeight(newHeight);
                        }
                    },
                    saveKey: 'editorPanelSize'
                });

                if (getQuill()) {
                    requestAnimationFrame(() => {
                        initQuillEditor(bodyEl, panelEl.getBoundingClientRect().height);
                        if (quillInstance) {
                            quillInstance.root?.blur();
                            quillInstance.on('text-change', () => {
                                updateFooterStatus();
                            });
                            quillInstance.on('selection-change', () => {
                                updateFooterStatus();
                            });
                        }
                        if (note && note.content) {
                            if (note.contentDelta) {
                                try {
                                    quillInstance.setContents(JSON.parse(note.contentDelta));
                                } catch {
                                    quillInstance.clipboard.dangerouslyPasteHTML(note.content);
                                }
                            } else {
                                quillInstance.clipboard.dangerouslyPasteHTML(note.content);
                            }
                        }
                        updateFooterStatus();

                        if (titleInput) {
                            titleInput.addEventListener('focus', () => {
                                if (quillInstance) quillInstance.root?.blur();
                            });
                        }
                        if (tagInput) {
                            tagInput.addEventListener('focus', () => {
                                if (quillInstance) quillInstance.root?.blur();
                            });
                        }
                    });
                } else {
                    editorContainer.style.display = 'none';
                    loadingEl.style.display = 'block';

                    loadQuillResources().then(() => {
                        editorContainer.style.display = 'block';
                        loadingEl.style.display = 'none';
                        requestAnimationFrame(() => {
                            initQuillEditor(bodyEl, panelEl.getBoundingClientRect().height);
                            if (quillInstance) {
                                quillInstance.root?.blur();
                                quillInstance.on('text-change', () => {
                                    updateFooterStatus();
                                });
                                quillInstance.on('selection-change', () => {
                                    updateFooterStatus();
                                });
                            }
                            if (note && note.content) {
                                if (note.contentDelta) {
                                    try {
                                        quillInstance.setContents(JSON.parse(note.contentDelta));
                                    } catch {
                                        quillInstance.clipboard.dangerouslyPasteHTML(note.content);
                                    }
                                } else {
                                    quillInstance.clipboard.dangerouslyPasteHTML(note.content);
                                }
                            }
                            updateFooterStatus();

                            if (titleInput) {
                                titleInput.addEventListener('focus', () => {
                                    if (quillInstance) quillInstance.root?.blur();
                                });
                            }
                            if (tagInput) {
                                tagInput.addEventListener('focus', () => {
                                    if (quillInstance) quillInstance.root?.blur();
                                });
                            }
                        });
                    }).catch(() => {
                        loadingEl.innerHTML = '<div style="color: #ff6b6b;">编辑器加载失败，使用简易编辑模式</div>';
                        loadingEl.style.display = 'none';
                        editorContainer.innerHTML = `<textarea class="bili-speed-editor-fallback" style="width: 100%; min-height: 200px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical; outline: none; box-sizing: border-box;">${note ? note.content : ''}</textarea>`;
                    });
                }
            }
        });
    }

    return {
        create() {
            if (panelInstance) panelInstance.destroy();
            if (dragCleanup) dragCleanup();
            if (resizeCleanup) resizeCleanup();
            dragCleanup = null;
            resizeCleanup = null;
            if (quillInstance) {
                quillInstance = null;
            }
        },

        open(note) {
            if (panelInstance) {
                QuillEditorPanel.close();
            }

            if (VditorEditorPanel && typeof VditorEditorPanel.close === 'function') {
                VditorEditorPanel.close();
            }

            createPanel(note || null);
        },

        close() {
            if (quillInstance) {
                try {
                    quillInstance = null;
                } catch {}
            }
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
            if (panelInstance) panelInstance.destroy();
            panelInstance = null;
            currentNoteId = null;
            tags = [];
            videoTimestamp = 0;
        },

        applyTheme(theme) {
            if (!panelInstance) return;
            const el = panelInstance.element;
            el.classList.remove('theme-light', 'theme-dark');
            el.classList.add(`theme-${theme}`);
        },

        isOpen() {
            return panelInstance !== null;
        },

        destroy() {
            QuillEditorPanel.close();
        }
    };
})();
