import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: 'Rust Wiki 阅读小助手',
        namespace: 'http://tampermonkey.net/',
        version: 'v0.0.2',
        description: '添加返回顶部、直到底部、暗黑模式按钮和目录导航等功能',
        author: '小明',
        license: 'MIT',
        match: [
          'https://www.rustwiki.org.cn/zh-CN/*',
          'https://www.rustwiki.org.cn/en/*',
          'https://rustwiki.org/zh-CN/*',
          'https://rustwiki.org/en/*',
        ],
        icon: 'chrome://favicon/https://rustwiki.org.cn',
        grant: 'GM_addStyle',
      },
      build: {
        fileName: 'rustwiki-tools.user.js',
        outDir: 'dist',
      },
    }),
  ],
});
