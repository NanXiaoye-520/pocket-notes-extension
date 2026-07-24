# Pocket Notes v2.2

## v2.0 → v2.1 已完成

- [x] 浮窗 → 独立弹窗（chrome.windows.create type:popup）
- [x] 原生标题栏
- [x] ESC 最小化窗口
- [x] 置顶按钮（📌），失焦自动弹回
- [x] ESC 最小化时跳过置顶（防闪烁）
- [x] 点击图标恢复最小化窗口
- [x] CSS 内容自适应窗口大小
- [x] 删除了 content script（不再注入页面）
- [x] 持久累积存储（不按日期分 key）
- [x] 导出标题改为摘录/写作

## 当前架构

独立弹窗（popup/popup.html），336×340 起始尺寸，可调整大小。
扩展图标点击 → 窗口管理（创建/聚焦/恢复最小化）。
所有数据仍通过 chrome.storage.local 存储，跨天累积，导出后清空。

## v2.2 待处理

- [x] Markdown 导出优化
  - [x] 取消创建日期文件夹，直接导出 .md 文件
  - [x] 文件名改为 YYYY-MM-DD.md
  - [x] 同一天重复导出：YYYY-MM-DD-1.md、YYYY-MM-DD-2.md ……
  - [x] 导出后只清空已导出的内容，不清空全部数据

## 已知问题

- [ ] 修复 Tab 切换问题（可选）
