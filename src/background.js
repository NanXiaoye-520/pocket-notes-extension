/**
 * Pocket Notes - Background Service Worker
 * 管理独立弹窗：点击图标打开/聚焦/恢复窗口
 */

const POPUP_URL = chrome.runtime.getURL('popup/popup.html');

chrome.action.onClicked.addListener(async () => {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const existing = windows.find(
      (w) => w.tabs && w.tabs.length > 0 && w.tabs[0].url === POPUP_URL
    );
    if (existing) {
      // 已存在 → 恢复并聚焦（处理最小化状态）
      chrome.windows.update(existing.id, {
        focused: true,
        state: 'normal',
      });
    } else {
      // 不存在 → 创建
      chrome.windows.create({
        url: 'popup/popup.html',
        type: 'popup',
        width: 336,
        height: 340,
      });
    }
  } catch (e) {
    console.error('[Pocket Notes] 窗口管理失败:', e);
  }
});
