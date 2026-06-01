const AddGroup = (() => {
    function create(onSubmit) {
        const container = document.createElement('div');
        container.className = 'add-group';
        container.style.cssText = `
            display: flex;
            gap: 0;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
        `;

        const form = document.createElement('form');
        form.className = 'input-group';
        form.style.cssText = `
            display: flex;
            width: 100%;
        `;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = form.querySelector('input');
            const name = input.value.trim();
            if (name && onSubmit) {
                await onSubmit(name);
                input.value = '';
            }
        });

        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 20;
        input.placeholder = '最多可输入20个字';
        input.style.cssText = `
            flex: 1;
            padding: 10px 12px;
            border: none;
            outline: none;
            font-size: 14px;
        `;
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const name = input.value.trim();
                if (name && onSubmit) {
                    onSubmit(name);
                    input.value = '';
                }
            }
        });

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'submit';
        submitBtn.textContent = '新建';
        submitBtn.style.cssText = `
            padding: 10px 20px;
            border: none;
            background: #00a1d6;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
        `;

        form.appendChild(input);
        form.appendChild(submitBtn);
        container.appendChild(form);

        return container;
    }

    return {
        create
    };
})();