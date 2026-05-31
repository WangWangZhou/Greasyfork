/**
 * Card - 通用卡片组件
 * UI基础组件 - 提供可复用的卡片结构（header/body/footer）
 *
 * @module UI/Components
 *
 * @example
 * const card = Card.create({
 *   className: 'my-card',
 *   header: { visible: true, draggable: true },
 *   footer: { visible: true },
 *   onHeaderReady: (headerEl) => { /* 添加header内容 *\/ },
 *   onBodyReady: (bodyEl) => { /* 添加body内容 *\/ },
 *   onFooterReady: (footerEl) => { /* 添加footer内容 *\/ },
 *   onReady: (cardEl) => { /* 卡片就绪 *\/ }
 * });
 *
 * card.show();
 * card.hide();
 * card.destroy();
 */
const Card = (() => {
    let instanceCounter = 0;

    return {
        /**
         * 创建卡片实例
         * @param {Object} options - 配置选项
         * @param {string} [options.className='bili-speed-card'] - 自定义类名
         * @param {Object} [options.header={visible:true}] - header配置
         * @param {boolean} [options.header.visible=true] - 是否显示header
         * @param {boolean} [options.header.draggable=false] - header是否可拖拽
         * @param {string} [options.header.title='Card'] - header标题
         * @param {Object} [options.footer={visible:false}] - footer配置
         * @param {boolean} [options.footer.visible=false] - 是否显示footer
         * @param {Object} [options.styles={}] - 自定义样式
         * @param {Function} [options.onHeaderReady] - header就绪回调
         * @param {Function} [options.onBodyReady] - body就绪回调
         * @param {Function} [options.onFooterReady] - footer就绪回调
         * @param {Function} [options.onReady] - 整个卡片就绪回调
         * @returns {Object} 卡片实例
         */
        create(options = {}) {
            const {
                className = 'bili-speed-card',
                header = { visible: true, draggable: false, title: 'Card' },
                footer = { visible: false },
                styles = {},
                onHeaderReady,
                onBodyReady,
                onFooterReady,
                onReady
            } = options;

            const instanceId = ++instanceCounter;
            const cardId = `${className}-instance-${instanceId}`;

            let cardEl = null;
            let headerEl = null;
            let bodyEl = null;
            let footerEl = null;
            let isVisible = true;

            function render() {
                if (cardEl) cardEl.remove();

                cardEl = document.createElement('div');
                cardEl.id = cardId;
                cardEl.className = className;

                const baseStyles = {
                    position: 'fixed',
                    background: '#F0F1F2',
                    color: '#000',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    zIndex: styles.zIndex || 9998
                };

                Object.assign(cardEl.style, baseStyles, styles);

                if (header.visible) {
                    headerEl = document.createElement('div');
                    headerEl.className = `${className}-header`;
                    headerEl.style.cssText = `
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 12px 12px 8px 12px;
                        ${header.draggable ? 'cursor: move;' : ''}
                    `;

                    const titleEl = document.createElement('div');
                    titleEl.className = `${className}-drag-text`;
                    titleEl.style.cssText = 'font-weight: bold; cursor: default;';
                    titleEl.innerHTML = header.title;

                    const actionsEl = document.createElement('div');
                    const baseClassName = className.split(' ')[0];
                    actionsEl.className = `${baseClassName}-actions`;
                    actionsEl.style.cssText = 'visibility: visible; gap: 4px; display: flex;';

                    headerEl.appendChild(titleEl);
                    headerEl.appendChild(actionsEl);
                    cardEl.appendChild(headerEl);
                }

                bodyEl = document.createElement('div');
                bodyEl.className = `${className}-body`;
                bodyEl.style.cssText = 'padding: 0 12px 8px 12px;';
                cardEl.appendChild(bodyEl);

                if (footer.visible) {
                    footerEl = document.createElement('div');
                    footerEl.className = `${className}-footer`;
                    footerEl.style.cssText = 'padding: 0 12px 12px 12px; position: relative;';
                    cardEl.appendChild(footerEl);
                }

                document.body.appendChild(cardEl);

                if (onHeaderReady && headerEl) {
                    onHeaderReady(headerEl);
                }
                if (onBodyReady && bodyEl) {
                    onBodyReady(bodyEl);
                }
                if (onFooterReady && footerEl) {
                    onFooterReady(footerEl);
                }
                if (onReady) {
                    onReady(cardEl);
                }

                setupAutoHideActions();
            }

            function setupAutoHideActions() {
                if (!cardEl) return;
                
                const baseClassName = className.split(' ')[0];
                const actionsEl = cardEl.querySelector(`.${baseClassName}-actions`);
                if (!actionsEl) return;
                
                // 让按钮始终可见
                actionsEl.style.visibility = 'visible';
            }

            render();

            return {
                id: cardId,
                element: cardEl,

                getHeader() {
                    return headerEl;
                },

                getBody() {
                    return bodyEl;
                },

                getFooter() {
                    return footerEl;
                },

                getActions() {
                    const baseClassName = className.split(' ')[0];
                    return cardEl.querySelector(`.${baseClassName}-actions`);
                },

                show() {
                    if (cardEl) {
                        cardEl.style.display = 'block';
                        isVisible = true;
                    }
                    return this;
                },

                hide() {
                    if (cardEl) {
                        cardEl.style.display = 'none';
                        isVisible = false;
                    }
                    return this;
                },

                toggle() {
                    if (isVisible) {
                        this.hide();
                    } else {
                        this.show();
                    }
                    return this;
                },

                isVisible() {
                    return isVisible;
                },

                setPosition(left, top) {
                    if (cardEl) {
                        cardEl.style.left = left;
                        cardEl.style.top = top;
                        cardEl.style.right = 'auto';
                        cardEl.style.bottom = 'auto';
                    }
                    return this;
                },

                setStyles(newStyles) {
                    if (cardEl) {
                        Object.assign(cardEl.style, newStyles);
                    }
                    return this;
                },

                setBodyContent(html) {
                    if (bodyEl) {
                        bodyEl.innerHTML = html;
                    }
                    return this;
                },

                destroy() {
                    if (cardEl) {
                        cardEl.remove();
                        cardEl = null;
                        headerEl = null;
                        bodyEl = null;
                        footerEl = null;
                    }
                }
            };
        }
    };
})();