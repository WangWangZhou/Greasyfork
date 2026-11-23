# Git空仓库提示清洗器 (Gitee / GitCode)

油猴脚本，用于清洗 Gitee / GitCode 空仓库页面的克隆提示：切换默认分支、去掉 `--global`、按需删减提示文字。

## 功能特性

- **默认分支切换**：把页面里的 `main` / `master` 改成配置的分支名（保留原大小写风格）
- **删除 `--global`**：去掉 `git config --global` 中的 `--global`，配置只作用于当前仓库
- **自定义替换**：支持按正则追加“查找 → 替换”规则，可整段删除提示
- **动态页面支持**：切换 HTTPS / SSH 标签时局部重绘也能生效
- **去广告**：移除 GitCode 右侧的广告容器

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) / Violentmonkey / ScriptCat
2. 新建脚本，粘贴 [bbb.js](./bbb.js) 的内容并保存
3. 打开 Gitee / GitCode 的空仓库页面即可生效

## 适配站点

| 站点 | 匹配规则 |
|------|----------|
| Gitee | `https://gitee.com/*` |
| GitCode | `https://gitcode.com/*` |

## 配置

脚本顶部的 `CONFIG` 对象：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `branch` | `string` | `'master'` | 把页面默认分支改成这个值，想用 `main` 就改回 `'main'` |
| `removeGlobalFlag` | `boolean` | `true` | 是否删除 `git config --global` 中的 `--global` |
| `extraRules` | `Array<[RegExp, string]>` | `[]` | 额外替换规则，`replace` 传 `''` 表示删除 |

`extraRules` 示例：

```js
extraRules: [
    // 删除 Gitee 的一句英文提示
    [/To ensure that your submitted code identity[\s\S]*?config\./i, ''],

    // 删除 "git config --global user.name" 整行
    [/^git config --global user\.(name|email).*$/m, ''],
],
```

## 替换规则

为了避免误伤仓库内容，分支名只在**命令 / 提示语境**中替换，并且必须是**独立单词**：

- 只在 `git clone/checkout/switch/branch/push/pull/fetch/merge/rebase/reset/remote`、`origin main`、`默认分支`、`default branch`、`DEFAULT_BRANCH` 等语境中处理；
- `main.go`、`master.md`、`feature/main`、`main-branch` 这类文件名 / 路径原样保留；
- `<a>` 链接里的文本（文件名、目录名等）不处理。

| 页面文本 | 替换为 `master` 后 |
|----------|--------------------|
| `git push -u origin main` | `git push -u origin master` |
| `git branch -M main` | `git branch -M master` |
| `默认分支：main` | `默认分支：master` |
| `main.go` | `main.go`（不变） |
| `git add main.go` | `git add main.go`（不变） |
| `func main() {` | `func main() {`（不变） |

## 更新日志

### v1.1.1

- 修复：上传代码后，仓库里的 `main.go` 等文件名被误改成 `master.go`
- 分支名替换改为按命令语境逐行判断，并跳过文件名、路径和链接文本
- 修复删除 `--global` 后残留多余空格的问题
- 修复广告容器不存在时 `.remove()` 抛错导致整页扫描中断的问题

### v1.1.0

- 初始版本：空仓库页默认分支 `main` ↔ `master` 切换
- 支持删除 `--global`、自定义替换规则、HTTPS / SSH 动态切换
