const fs = require('fs');
const path = require('path');

const moduleOrder = [
    { name: 'EventBus', path: 'modules' },
    { name: 'Logger', path: 'modules' },
    { name: 'Utils', path: 'modules' },
    { name: 'Config', path: 'modules' },
    { name: 'PageGuard', path: 'modules' },
    { name: 'Draggable', path: 'ui/behaviors' },
    { name: 'Resizable', path: 'ui/behaviors' },
    { name: 'Toast', path: 'ui/components' },
    { name: 'Card', path: 'ui/components' },
    { name: 'Progress', path: 'ui/components' },
    { name: 'VideoController', path: 'modules' },
    { name: 'Favorites', path: 'modules' },
    { name: 'Notes', path: 'modules' },
    { name: 'CardPanel', path: 'ui/views' },
    { name: 'ControlPanel', path: 'ui/views' },
    { name: 'FavoritesPanel', path: 'ui/views' },
    { name: 'NotesPanel', path: 'ui/views' },
    { name: 'QuillEditorPanel', path: 'ui/views' },
    { name: 'VditorEditorPanel', path: 'ui/views' },
    { name: 'KeyboardHandler', path: 'modules' },
    { name: 'ScreenModeManager', path: 'modules' }
];

const template = fs.readFileSync(path.join(__dirname, 'src/index.js'), 'utf-8');

const modules = [];
moduleOrder.forEach(({ name, path: modulePath }) => {
    const content = fs.readFileSync(
        path.join(__dirname, `src/${modulePath}/${name}.js`),
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
console.log('');
console.log('📁 模块加载顺序:');
moduleOrder.forEach(({ name, path: modulePath }, index) => {
    console.log(`   ${index + 1}. src/${modulePath}/${name}.js`);
});