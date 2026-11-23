// ==UserScript==
// @name         Git空仓库提示清洗器 (Gitee / GitCode)
// @namespace    http://tampermonkey.net/
// @version      1.1.1
// @description  修改空仓库页的克隆提示：main↔master、删 --global、自定义删减，支持HTTPS/SSH动态切换
// @author       Y小明
// @match        https://gitee.com/*
// @match        https://gitcode.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    /* ========= 1. 在这里改你的偏好 ========= */
    const CONFIG = {
        // 把页面里的 DEFAULT_BRANCH 换成这个
        branch: 'master',          // 想用 main 就改回 'main'

        // 是否把 git config --global 里的 --global 删掉
        removeGlobalFlag: true,

        // 任意额外“查找→替换”规则（支持正则）
        // 如果只想删除，把 replace 设为 ''
        extraRules: [
            // 示例：把 Gitee 的英文提示句删掉一句
            // [/To ensure that your submitted code identity[\s\S]*?config\./i, ''],

            // 示例：删除 "git config --global user.name" 整行（按需打开）
            // [/^git config --global user\.(name|email).*$/m, ''],
        ],
    };
    /* ====================================== */

    // 只替换“独立出现”的分支名：
    // 前后不能是单词字符、点、斜杠或连字符，
    // 因此 main.go / master.md / feature/main / main-branch 都会原样保留。
    const branchNameRe = /(^|[^\w.\/-])(main|master)(?=$|[^\w.\/-])/gi;

    // 只有命令/提示语境里才替换分支名，
    // 避免把文件列表、目录名、源码（如 func main()）里的 main 当成默认分支改掉。
    const branchContextRe =
        /\bgit\s+(?:clone|checkout|switch|branch|push|pull|fetch|merge|rebase|reset|remote)\b|\b(?:origin|upstream)\s+(?:main|master)\b|\bDEFAULT_BRANCH\b|默认分支|default\s+branch/i;

    const SKIP_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION'];

    function formatBranch(name) {
        const target = CONFIG.branch;
        if (name === name.toUpperCase()) return target.toUpperCase();
        if (name[0] === name[0].toUpperCase()) {
            return target[0].toUpperCase() + target.slice(1);
        }
        return target;
    }

    function rewriteBranchNames(str, force) {
        return str
            .split('\n')
            .map((line) => {
                // force：所在代码块已被判定为命令语境（例如语法高亮把命令切成多段）
                if (!force && !branchContextRe.test(line)) return line;
                return line.replace(branchNameRe, (match, prefix, name) => prefix + formatBranch(name));
            })
            .join('\n');
    }

    function rewriteText(str, force) {
        if (!str || typeof str !== 'string') return str;

        let out = str;

        // 1) 分支名替换：保留原大小写风格
        out = rewriteBranchNames(out, force);

        // 2) 删除 --global（只在 git config 后面删，避免误伤）
        if (CONFIG.removeGlobalFlag) {
            out = out.replace(/(git config)\s+--global\b/g, '$1');
        }

        // 3) 额外规则
        CONFIG.extraRules.forEach(([from, to]) => {
            out = out.replace(from, to);
        });

        return out;
    }

    function patchNode(node, force) {
        // 只处理文本节点，避免把 <script> 搞坏
        if (node.nodeType === Node.TEXT_NODE) {
            const oldText = node.textContent;
            const newText = rewriteText(oldText, force);
            if (newText !== oldText) {
                node.textContent = newText;
            }
            return;
        }

        // 元素节点：跳过输入框/脚本/样式
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tag = node.tagName;
        if (SKIP_TAGS.includes(tag)) return;

        // 链接里一般是文件名、目录名、仓库名，一律不动
        if (tag === 'A') return;

        // 有些站点把命令放在 <code>/<pre>，可能带语法高亮
        if (tag === 'CODE' || tag === 'PRE') {
            const raw = node.textContent || '';
            const isCommandBlock = branchContextRe.test(raw);

            if (!node.children.length) {
                // 纯文本代码块：逐行判断，避免误伤块里的文件名
                const newText = rewriteText(raw, false);
                if (newText !== raw) {
                    node.textContent = newText;
                }
                return;
            }

            // 带高亮的代码块：命令被拆成多个节点，
            // 整块共享“命令语境”，文本节点各自替换（文件名仍受 branchNameRe 保护）
            node.childNodes.forEach((child) => patchNode(child, isCommandBlock));
            return;
        }

        node.childNodes.forEach((child) => patchNode(child, force));
    }

    function scanWholePage() {
        if (document.body) patchNode(document.body, false);
        //去广告模块
        document.querySelector('.atomcode-dock-center-wrapper')?.remove();
    }

    /* ========= 动态页面支持 ========= */
    // Gitee / GitCode 切 HTTPS<->SSH 时是局部重绘，不是整页刷新
    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const m of mutations) {
            if (m.addedNodes.length) {
                shouldScan = true;
                break;
            }
            // 有些站只改 textContent，监听字符变化
            if (m.type === 'characterData') {
                shouldScan = true;
                break;
            }
        }
        if (shouldScan) {
            // 用微任务合并，避免频繁重排
            queueMicrotask(scanWholePage);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    // 首次执行
    window.addEventListener('load', () => {
        setTimeout(scanWholePage, 300);
    });
    scanWholePage();
})();
