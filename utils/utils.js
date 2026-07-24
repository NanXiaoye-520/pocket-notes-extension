/**
 * Pocket Notes - 通用工具函数
 */

const Utils = (() => {
  /**
   * 防抖函数
   * @param {Function} fn
   * @param {number} delay - 毫秒
   * @returns {Function}
   */
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * 获取今日日期字符串 YYYY-MM-DD
   */
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * 转义 HTML 特殊字符（防止 XSS）
   */
  function escapeHTML(str) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return str.replace(/[&<>"']/g, (c) => map[c]);
  }

  return {
    debounce,
    today,
    escapeHTML,
  };
})();
