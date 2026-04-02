import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: 'Bilibili自定义倍速播放',
        namespace: 'http://tampermonkey.net/',
        version: '0.8',
        description: '添加类似 Potplayer 的功能，默认倍速和记忆倍速，方便用户快速切换播放速度；2.修复了某些情况下倍速失效的问题。',
        author: '小明',
        license: 'MIT',
        match: ['https://www.bilibili.com/*'],
        icon: 'chrome://favicon/http://www.bilibili.com/',
        grant: ['GM_registerMenuCommand', 'GM_setValue', 'GM_getValue'],
        'run-at': 'document-end',
      },
      build: {
        fileName: 'bilibili-speed-play.user.js',
        outDir: 'dist',
      },
    }),
  ],
});
