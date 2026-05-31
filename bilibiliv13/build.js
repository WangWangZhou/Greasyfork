const fs = require('fs');
const path = require('path');

const moduleOrder = [
    'EventBus',
    'Logger',
    'Utils',
    'Config',
    'PageGuard',
    'Draggable',
    'Toast',
    'VideoController',
    'CardPanel',
    'ControlPanel',
    'KeyboardHandler',
    'ScreenModeManager'
];

const template = fs.readFileSync(path.join(__dirname, 'src/index.js'), 'utf-8');

const modules = [];
moduleOrder.forEach(name => {
    const content = fs.readFileSync(
        path.join(__dirname, `src/modules/${name}.js`),
        'utf-8'
    );
    modules.push(content);
});

const appContent = fs.readFileSync(path.join(__dirname, 'src/App.js'), 'utf-8');

let result = template;
result = result.replace(
    '// MODULE_INJECTION_POINT',
    modules.join('\n\n') + '\n\n' + appContent
);

if (!fs.existsSync(path.join(__dirname, 'dist'))) {
    fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
}

fs.writeFileSync(path.join(__dirname, 'dist/bbb.js'), result);

console.log('✅ 构建完成！输出文件: dist/bbb.js');