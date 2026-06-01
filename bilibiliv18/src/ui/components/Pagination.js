/**
 * Pagination - 通用分页组件
 * UI基础组件 - 提供分页控制功能
 */
const Pagination = (() => {
    let styleInjected = false;

    function injectStyles() {
        if (styleInjected) return;
        styleInjected = true;

        const style = document.createElement('style');
        style.id = 'bili-pagination-style';
        style.textContent = `
            .bili-pagination {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 8px 0;
                font-size: 13px;
                user-select: none;
            }
            .bili-pagination-btn {
                padding: 4px 10px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background: #fff;
                color: #000;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
                transition: all 0.2s;
                min-width: 28px;
                text-align: center;
            }
            .bili-pagination-btn:hover:not(:disabled) {
                background: #e0e0e0;
            }
            .bili-pagination-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            .bili-pagination-info {
                color: #666;
                min-width: 60px;
                text-align: center;
                font-size: 13px;
            }
            .bili-pagination-input {
                width: 50px;
                padding: 3px 6px;
                border-radius: 4px;
                border: 1px solid #ccc;
                background: #fff;
                color: #000;
                font-size: 13px;
                text-align: center;
                outline: none;
                transition: border-color 0.2s;
            }
            .bili-pagination-input:focus {
                border-color: #00AEEC;
            }
            .bili-pagination-input::-webkit-inner-spin-button,
            .bili-pagination-input::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            .bili-pagination-input[type=number] {
                -moz-appearance: textfield;
            }
            .bili-pagination-total {
                color: #999;
                font-size: 12px;
                margin-left: 4px;
            }
            .bili-pagination-hidden {
                display: none !important;
            }
            .theme-dark .bili-pagination-btn {
                background: #333;
                border-color: #555;
                color: #fff;
            }
            .theme-dark .bili-pagination-btn:hover:not(:disabled) {
                background: #444;
            }
            .theme-dark .bili-pagination-info {
                color: #aaa;
            }
            .theme-dark .bili-pagination-input {
                background: #333;
                color: #fff;
                border-color: #555;
            }
            .theme-dark .bili-pagination-input:focus {
                border-color: #00AEEC;
            }
            .theme-dark .bili-pagination-total {
                color: #777;
            }
        `;
        document.head.appendChild(style);
    }

    return {
        create(options = {}) {
            const {
                container,
                total = 0,
                pageSize = 10,
                currentPage: initialPage = 1,
                onChange,
                theme = 'light'
            } = options;

            if (!container) {
                console.warn('Pagination: container is required');
                return null;
            }

            injectStyles();

            let currentPage = initialPage;
            let currentTotal = total;
            let paginationEl = null;

            function getTotalPages() {
                return Math.max(1, Math.ceil(currentTotal / pageSize));
            }

            function render() {
                if (paginationEl) {
                    paginationEl.remove();
                }

                const totalPages = getTotalPages();
                const showPagination = currentTotal > pageSize;

                paginationEl = document.createElement('div');
                paginationEl.className = 'bili-pagination';

                if (!showPagination) {
                    paginationEl.classList.add('bili-pagination-hidden');
                }

                const prevBtn = document.createElement('button');
                prevBtn.className = 'bili-pagination-btn';
                prevBtn.textContent = '‹';
                prevBtn.title = '上一页';
                prevBtn.disabled = currentPage <= 1;

                const pageInfo = document.createElement('span');
                pageInfo.className = 'bili-pagination-info';
                pageInfo.textContent = `${currentPage} / ${totalPages}`;

                const pageInput = document.createElement('input');
                pageInput.className = 'bili-pagination-input';
                pageInput.type = 'number';
                pageInput.min = 1;
                pageInput.max = totalPages;
                pageInput.value = currentPage;

                const nextBtn = document.createElement('button');
                nextBtn.className = 'bili-pagination-btn';
                nextBtn.textContent = '›';
                nextBtn.title = '下一页';
                nextBtn.disabled = currentPage >= totalPages;

                const totalInfo = document.createElement('span');
                totalInfo.className = 'bili-pagination-total';
                totalInfo.textContent = `共 ${currentTotal}`;

                prevBtn.addEventListener('click', () => {
                    if (currentPage > 1) {
                        goToPage(currentPage - 1);
                    }
                });

                nextBtn.addEventListener('click', () => {
                    if (currentPage < totalPages) {
                        goToPage(currentPage + 1);
                    }
                });

                pageInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const val = parseInt(pageInput.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                            goToPage(val);
                        } else {
                            pageInput.value = currentPage;
                        }
                    }
                });
                pageInput.addEventListener('blur', () => {
                    pageInput.value = currentPage;
                });

                paginationEl.appendChild(prevBtn);
                paginationEl.appendChild(pageInfo);
                paginationEl.appendChild(pageInput);
                paginationEl.appendChild(nextBtn);
                paginationEl.appendChild(totalInfo);

                container.appendChild(paginationEl);

                if (theme === 'dark') {
                    applyThemeToUI('dark');
                }
            }

            function applyThemeToUI(newTheme) {
                if (!paginationEl) return;

                if (newTheme === 'dark') {
                    paginationEl.classList.add('theme-dark');
                } else {
                    paginationEl.classList.remove('theme-dark');
                }
            }

            function goToPage(page) {
                const totalPages = getTotalPages();
                if (page < 1 || page > totalPages || page === currentPage) return;

                currentPage = page;

                if (onChange) {
                    onChange(currentPage);
                }

                render();
            }

            function setTotal(newTotal) {
                currentTotal = newTotal;
                const totalPages = getTotalPages();

                if (currentPage > totalPages) {
                    currentPage = totalPages;
                }

                render();
            }

            function setCurrentPage(page) {
                const totalPages = getTotalPages();
                if (page < 1) page = 1;
                if (page > totalPages) page = totalPages;
                if (page === currentPage) return;

                currentPage = page;
                render();
            }

            function setTheme(newTheme) {
                applyThemeToUI(newTheme);
            }

            function destroy() {
                if (paginationEl) {
                    paginationEl.remove();
                    paginationEl = null;
                }
            }

            function getCurrentPage() {
                return currentPage;
            }

            function getTotal() {
                return currentTotal;
            }

            render();

            return {
                goToPage,
                setTotal,
                setCurrentPage,
                setTheme,
                destroy,
                getCurrentPage,
                getTotal,
                getTotalPages
            };
        }
    };
})();
