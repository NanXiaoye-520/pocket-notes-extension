/**
 * Pocket Notes - Markdown 导出模块
 * 读取累积数据，按分类分组生成 Markdown 并触发下载
 * 导出后由 popup.js 负责清空数据
 */

const Exporter = (() => {
  /**
   * 统计中文字符数（仅汉字）
   */
  function countChineseChars(text) {
    const matches = text.match(/[一-鿿]/g);
    return matches ? matches.length : 0;
  }

  /**
   * 生成今日 Markdown 内容
   * @param {string} dateStr - 日期 YYYY-MM-DD
   * @param {{text: string, category: string, time: number}[]} quotes - 待办列表
   * @param {{[category: string]: string}} writing - 已处理内容（按分类）
   * @param {string[]} quotesCategories - 待办分类列表（用于排序）
   * @param {string[]} writingCategories - 已处理分类列表（用于排序）
   * @returns {string}
   */
  function generateMarkdown(dateStr, quotes, writing, quotesCategories, writingCategories) {
    const lines = [];

    lines.push(`# ${dateStr}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // ===== 摘录部分 =====
    lines.push('## 摘录');
    lines.push('');

    // 按分类分组
    const quotesByCat = {};
    quotes.forEach((q) => {
      const cat = q.category || '其它';
      if (!quotesByCat[cat]) quotesByCat[cat] = [];
      quotesByCat[cat].push(q.text);
    });

    // 按分类列表顺序输出（保证顺序稳定）
    const qCatOrder = quotesCategories || Object.keys(quotesByCat);
    let quotesTotal = 0;
    qCatOrder.forEach((cat) => {
      const items = quotesByCat[cat];
      if (!items || items.length === 0) return;
      lines.push(`### ${cat}`);
      lines.push('');
      items.forEach((text) => {
        lines.push(`- ${text}`);
        quotesTotal++;
      });
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    if (quotesTotal === 0) {
      lines.push('（无）');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // ===== 写作部分 =====
    lines.push('## 写作');
    lines.push('');

    const wCatOrder = writingCategories || Object.keys(writing);
    let writingTotalChars = 0;
    let hasWritingContent = false;

    wCatOrder.forEach((cat) => {
      const content = (writing[cat] || '').trim();
      if (!content) return;
      hasWritingContent = true;
      lines.push(`### ${cat}`);
      lines.push('');
      lines.push(content);
      lines.push('');
      lines.push('---');
      lines.push('');
      writingTotalChars += countChineseChars(content);
    });

    if (!hasWritingContent) {
      lines.push('（无）');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // ===== 统计 =====
    lines.push('## 今日统计');
    lines.push('');
    lines.push(`摘录：${quotesTotal} 条`);
    lines.push(`写作：${writingTotalChars} 字`);

    return lines.join('\n');
  }

  // 公开 API
  return {
    generateMarkdown,
  };
})();
