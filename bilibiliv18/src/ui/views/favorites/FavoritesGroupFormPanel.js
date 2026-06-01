/**
 * FavoritesGroupFormPanel - 收藏夹分组表单面板
 * 提供新建/编辑收藏夹分组的表单界面
 *
 * @module UI/Views
 *
 * @example
 * // 新建模式
 * FavoritesGroupFormPanel.show({
 *   onSubmit: (formData) => {
 *     console.log('Form submitted:', formData);
 *   }
 * });
 *
 * // 编辑模式
 * FavoritesGroupFormPanel.show({
 *   group: { id: 'xxx', name: '分组1', image: '', description: '', isPublic: false },
 *   onSubmit: (formData) => {
 *     console.log('Form updated:', formData);
 *   }
 * });
 */
const FavoritesGroupFormPanel = (() => {
    let panelInstance = null;
    let onSubmitCallback = null;
    let currentEditGroup = null;

    function createFormPanel(options = {}) {
        const { onSubmit, group } = options;
        onSubmitCallback = onSubmit;
        currentEditGroup = group || null;

        const isEditMode = !!group;
        const panelTitle = isEditMode ? '编辑收藏夹分组' : '新建收藏夹分组';

        panelInstance = Card.create({
            className: 'favorites-group-form-panel',
            header: {
                visible: true,
                draggable: true,
                title: panelTitle
            },
            footer: { visible: false },
            styles: {
                width: '420px',
                display: 'block',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 99999
            },
            onHeaderReady: (headerEl) => {
                const actionsEl = headerEl.querySelector('.favorites-group-form-panel-actions');

                const closeBtn = document.createElement('button');
                closeBtn.style.cssText = 'background: transparent; color: #000; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', () => {
                    destroy();
                });
                actionsEl.appendChild(closeBtn);

                Draggable.make(headerEl.parentElement, null, '[class*="-header"]');
            },
            onBodyReady: (bodyEl) => {
                bodyEl.style.cssText = 'padding: 20px;';

                const formContainer = document.createElement('div');
                formContainer.className = 'favorites-group-form-container';
                formContainer.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                `;

                const nameGroup = createNameGroup();
                const imageGroup = createImageGroup();
                const descriptionGroup = createDescriptionGroup();
                const publicGroup = createPublicGroup();
                const buttonGroup = createButtonGroup(onSubmit, isEditMode);

                formContainer.appendChild(nameGroup);
                formContainer.appendChild(imageGroup);
                formContainer.appendChild(descriptionGroup);
                formContainer.appendChild(publicGroup);
                formContainer.appendChild(buttonGroup);

                bodyEl.appendChild(formContainer);

                if (isEditMode) {
                    populateFormData(group);
                }
            }
        });
    }

    function populateFormData(group) {
        const formContainer = document.querySelector('.favorites-group-form-container');
        if (!formContainer || !group) return;

        const nameInput = formContainer.querySelector('.group-name-input');
        const imageInput = formContainer.querySelector('.group-image-input');
        const descriptionInput = formContainer.querySelector('.group-description-input');

        if (nameInput) {
            nameInput.value = group.name || '';
        }

        if (imageInput) {
            imageInput.value = group.image || '';
            if (group.image) {
                const previewContainer = formContainer.querySelector('.image-preview-container');
                if (previewContainer) {
                    previewContainer.innerHTML = '';
                    const img = document.createElement('img');
                    img.className = 'preview-image';
                    img.src = group.image;
                    img.style.cssText = `
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: cover;
                    `;
                    img.onload = () => {
                        previewContainer.innerHTML = '';
                        previewContainer.appendChild(img);
                    };
                    img.onerror = () => {
                        previewContainer.innerHTML = '';
                        const placeholder = document.createElement('div');
                        placeholder.className = 'preview-placeholder';
                        placeholder.style.cssText = 'color: #999; font-size: 14px;';
                        placeholder.textContent = '图片加载失败';
                        previewContainer.appendChild(placeholder);
                    };
                }
            }
        }

        if (descriptionInput) {
            descriptionInput.value = group.description || '';
        }

        const publicGroupEl = formContainer.querySelector('.form-group:has(.form-buttons)');
        if (publicGroupEl && publicGroupEl.switchInstance) {
            publicGroupEl.switchInstance.setValue(group.isPublic || false);
        }
    }

    function createNameGroup() {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = '分组名称';
        label.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            color: #333;
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'group-name-input';
        input.placeholder = '请输入分组名称';
        input.required = true;
        input.style.cssText = `
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        `;

        input.addEventListener('focus', () => {
            input.style.borderColor = '#00aeec';
        });

        input.addEventListener('blur', () => {
            input.style.borderColor = '#ddd';
        });

        group.appendChild(label);
        group.appendChild(input);

        return group;
    }

    function createImageGroup() {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = '封面图片';
        label.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            color: #333;
        `;

        const inputRow = document.createElement('div');
        inputRow.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: center;
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'group-image-input';
        input.placeholder = '输入图片URL（可选）';
        input.style.cssText = `
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        `;

        input.addEventListener('focus', () => {
            input.style.borderColor = '#00aeec';
        });

        input.addEventListener('blur', () => {
            input.style.borderColor = '#ddd';
        });

        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.textContent = '预览';
        previewBtn.style.cssText = `
            padding: 10px 16px;
            border: 1px solid #00aeec;
            border-radius: 4px;
            background: #fff;
            color: #00aeec;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        `;

        previewBtn.addEventListener('mouseenter', () => {
            previewBtn.style.background = '#e6f7ff';
        });

        previewBtn.addEventListener('mouseleave', () => {
            previewBtn.style.background = '#fff';
        });

        inputRow.appendChild(input);
        inputRow.appendChild(previewBtn);

        const previewContainer = document.createElement('div');
        previewContainer.className = 'image-preview-container';
        previewContainer.style.cssText = `
            width: 100%;
            height: 160px;
            border: 1px dashed #ddd;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fafafa;
            overflow: hidden;
            margin-top: 8px;
        `;

        const previewPlaceholder = document.createElement('div');
        previewPlaceholder.className = 'preview-placeholder';
        previewPlaceholder.style.cssText = `
            color: #999;
            font-size: 14px;
        `;
        previewPlaceholder.textContent = '暂无预览图片';

        previewContainer.appendChild(previewPlaceholder);

        previewBtn.addEventListener('click', () => {
            const imageUrl = input.value.trim();
            if (!imageUrl) {
                Toast.show('请先输入图片URL');
                return;
            }

            const existingImg = previewContainer.querySelector('.preview-image');
            if (existingImg) {
                existingImg.remove();
            }

            previewPlaceholder.style.display = 'none';

            const img = document.createElement('img');
            img.className = 'preview-image';
            img.src = imageUrl;
            img.style.cssText = `
                max-width: 100%;
                max-height: 100%;
                object-fit: cover;
            `;

            img.onload = () => {
                previewContainer.innerHTML = '';
                previewContainer.appendChild(img);
            };

            img.onerror = () => {
                previewContainer.innerHTML = '';
                previewContainer.appendChild(previewPlaceholder);
                previewPlaceholder.textContent = '图片加载失败，请检查URL';
                Toast.show('图片加载失败');
            };
        });

        group.appendChild(label);
        group.appendChild(inputRow);
        group.appendChild(previewContainer);

        return group;
    }

    function createDescriptionGroup() {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = '简介';
        label.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            color: #333;
        `;

        const textarea = document.createElement('textarea');
        textarea.className = 'group-description-input';
        textarea.placeholder = '可以简单描述下你的收藏夹';
        textarea.style.cssText = `
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            resize: vertical;
            min-height: 80px;
            max-height: 160px;
            outline: none;
            transition: border-color 0.2s;
            font-family: inherit;
        `;

        textarea.addEventListener('focus', () => {
            textarea.style.borderColor = '#00aeec';
        });

        textarea.addEventListener('blur', () => {
            textarea.style.borderColor = '#ddd';
        });

        group.appendChild(label);
        group.appendChild(textarea);

        return group;
    }

    function createPublicGroup() {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: #f5f5f5;
            border-radius: 4px;
        `;

        const labelContainer = document.createElement('div');
        labelContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
        `;

        const label = document.createElement('label');
        label.textContent = '公开';
        label.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            color: #333;
        `;

        const hint = document.createElement('small');
        hint.textContent = '开启后其他用户可以查看此分组';
        hint.style.cssText = `
            font-size: 12px;
            color: #999;
        `;

        labelContainer.appendChild(label);
        labelContainer.appendChild(hint);

        const switchInstance = Switch.create({
            checked: false,
            onChange: (isChecked) => {
                console.log('Public status changed:', isChecked);
            }
        });

        group.appendChild(labelContainer);
        group.appendChild(switchInstance.element);

        group.switchInstance = switchInstance;

        return group;
    }

    function createButtonGroup(onSubmit, isEditMode = false) {
        const group = document.createElement('div');
        group.className = 'form-buttons';
        group.style.cssText = `
            display: flex;
            gap: 12px;
            margin-top: 8px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fff;
            color: #666;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        `;

        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = '#f5f5f5';
        });

        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = '#fff';
        });

        cancelBtn.addEventListener('click', () => {
            destroy();
        });

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button';
        submitBtn.textContent = isEditMode ? '保存' : '创建';
        submitBtn.className = 'submit-btn';
        submitBtn.style.cssText = `
            flex: 1;
            padding: 12px;
            border: 1px solid #00aeec;
            border-radius: 4px;
            background: #00aeec;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        `;

        submitBtn.addEventListener('mouseenter', () => {
            submitBtn.style.background = '#0097d6';
        });

        submitBtn.addEventListener('mouseleave', () => {
            submitBtn.style.background = '#00aeec';
        });

        submitBtn.addEventListener('click', () => {
            const formData = collectFormData();

            if (!validateForm(formData)) {
                return;
            }

            if (onSubmit && typeof onSubmit === 'function') {
                if (isEditMode && currentEditGroup) {
                    formData.id = currentEditGroup.id;
                }
                onSubmit(formData);
            }

            destroy();
        });

        group.appendChild(cancelBtn);
        group.appendChild(submitBtn);

        return group;
    }

    function collectFormData() {
        const formContainer = document.querySelector('.favorites-group-form-container');
        if (!formContainer) return null;

        const name = formContainer.querySelector('.group-name-input').value.trim();
        const image = formContainer.querySelector('.group-image-input').value.trim();
        const description = formContainer.querySelector('.group-description-input').value.trim();
        const publicGroupEl = formContainer.querySelector('.form-group:has(.form-buttons)');
        const switchEl = publicGroupEl ? publicGroupEl.querySelector('.bili-speed-switch-container') : null;
        const isPublic = switchEl && switchEl.querySelector('.bili-speed-switch') ?
            switchEl.querySelector('.bili-speed-switch').classList.contains('checked') : false;

        return {
            name,
            image,
            description,
            isPublic
        };
    }

    function validateForm(data) {
        if (!data.name) {
            Toast.show('请输入分组名称');
            return false;
        }

        if (data.name.length > 50) {
            Toast.show('分组名称不能超过50个字符');
            return false;
        }

        if (data.image && !isValidUrl(data.image)) {
            Toast.show('请输入有效的图片URL');
            return false;
        }

        if (data.description && data.description.length > 200) {
            Toast.show('简介不能超过200个字符');
            return false;
        }

        return true;
    }

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    function show(options = {}) {
        destroy();
        createFormPanel(options);
    }

    function destroy() {
        if (panelInstance) {
            panelInstance.destroy();
            panelInstance = null;
        }
        onSubmitCallback = null;
        currentEditGroup = null;
    }

    return {
        show,
        destroy
    };
})();
