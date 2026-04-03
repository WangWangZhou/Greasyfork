import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    open: true,
    browser: 'chrome'
  },
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        icon: 'chrome://favicon/https://www.bilibili.com',
        name: 'Bilibili自定义播放速度小助手',
        namespace: 'bilibili-speed-assistant',
        description: 'Bilibili自定义播放速度小助手,通过z,x,c控制播放速度',
        version: 'v0.0.1',
        author: '小明',
        license: 'MIT',
        match: ['https://www.bilibili.com/video/*'],
        grant: ['GM_addStyle', 'GM_registerMenuCommand','GM_unregisterMenuCommand'],
        'run-at': 'document-end'
      },
        build: {
        fileName: 'bilibiliAssistantSpeed.user.js',
        outDir: 'dist',
      },
    }),
  ],
});
