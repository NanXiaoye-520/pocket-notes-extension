/**
 * Pocket Notes - 数据存储模块
 * 基于 chrome.storage.local，数据跨天累积，仅导出时清空
 *
 * Key 格式：
 *   quotes_current     → {text, category, time}[]  待办条目（持久累积）
 *   writing_current    → {[category]: string}       已处理内容（持久累积，按分类）
 *   quotes_categories  → string[]                   待办分类列表
 *   writing_categories → string[]                   已处理分类列表
 *   work_tasks         → {name, status}[]           伪装任务列表
 *   window_pos         → {left, top}                窗口位置
 */

const Storage = (() => {
  const STORAGE = chrome.storage.local;

  /** 默认待办分类 */
  const DEFAULT_QUOTES_CATEGORIES = [
    '好词', '生词', '诗句', '场景描写', '对话', '小说设定', '其它'
  ];

  /** 默认已处理分类 */
  const DEFAULT_WRITING_CATEGORIES = [
    '小说', '灵感', '日记', '大纲', '世界观', '人设', '其它'
  ];

  /** 默认伪装任务 */
  const DEFAULT_WORK_TASKS = [
    { name: '液压接头', status: 'pending' },
    { name: 'PU气管', status: 'done' },
    { name: '快速接头', status: 'pending' },
  ];

  // ===================== 待办 =====================

  /**
   * 读取待办列表（持久累积，不按日期区分）
   * @returns {Promise<{text: string, category: string, time: number}[]>}
   */
  async function getQuotes() {
    const data = await STORAGE.get('quotes_current');
    return data.quotes_current || [];
  }

  /**
   * 保存待办列表
   * @param {{text: string, category: string, time: number}[]} quotes
   */
  async function setQuotes(quotes) {
    await STORAGE.set({ quotes_current: quotes });
  }

  // ===================== 待办分类 =====================

  /**
   * 读取待办分类列表（首次自动初始化默认值）
   * @returns {Promise<string[]>}
   */
  async function getQuotesCategories() {
    const data = await STORAGE.get('quotes_categories');
    if (data.quotes_categories) return data.quotes_categories;
    // 首次使用，写入默认分类
    await STORAGE.set({ quotes_categories: DEFAULT_QUOTES_CATEGORIES });
    return [...DEFAULT_QUOTES_CATEGORIES];
  }

  /**
   * 保存待办分类列表
   * @param {string[]} cats
   */
  async function setQuotesCategories(cats) {
    await STORAGE.set({ quotes_categories: cats });
  }

  // ===================== 已处理 =====================

  /**
   * 读取已处理内容（持久累积，按分类的映射）
   * @returns {Promise<{[category: string]: string}>}
   */
  async function getWriting() {
    const data = await STORAGE.get('writing_current');
    return data.writing_current || {};
  }

  /**
   * 保存已处理内容
   * @param {{[category: string]: string}} content - 按分类的内容映射
   */
  async function setWriting(content) {
    await STORAGE.set({ writing_current: content });
  }

  // ===================== 已处理分类 =====================

  /**
   * 读取已处理分类列表（首次自动初始化默认值）
   * @returns {Promise<string[]>}
   */
  async function getWritingCategories() {
    const data = await STORAGE.get('writing_categories');
    if (data.writing_categories) return data.writing_categories;
    // 首次使用，写入默认分类
    await STORAGE.set({ writing_categories: DEFAULT_WRITING_CATEGORIES });
    return [...DEFAULT_WRITING_CATEGORIES];
  }

  /**
   * 保存已处理分类列表
   * @param {string[]} cats
   */
  async function setWritingCategories(cats) {
    await STORAGE.set({ writing_categories: cats });
  }

  // ===================== 伪装任务 =====================

  /**
   * 读取伪装任务列表（首次自动初始化默认值）
   * @returns {Promise<{name: string, status: 'pending'|'done'}[]>}
   */
  async function getWorkTasks() {
    const data = await STORAGE.get('work_tasks');
    if (data.work_tasks) return data.work_tasks;
    await STORAGE.set({ work_tasks: DEFAULT_WORK_TASKS });
    return [...DEFAULT_WORK_TASKS];
  }

  /**
   * 保存伪装任务列表
   * @param {{name: string, status: 'pending'|'done'}[]} tasks
   */
  async function setWorkTasks(tasks) {
    await STORAGE.set({ work_tasks: tasks });
  }

  // ===================== 数据清空（导出后） =====================

  /**
   * 清空当前累积的待办和已处理数据（导出后调用）
   */
  async function clearCurrentData() {
    await STORAGE.remove(['quotes_current', 'writing_current']);
  }

  // ===================== 导出计数器 =====================

  /**
   * 获取某一天的导出次数（用于重复导出时自动编号）
   * @param {string} dateStr - 日期 YYYY-MM-DD
   * @returns {Promise<number>}
   */
  async function getExportCounter(dateStr) {
    const data = await STORAGE.get('export_counters');
    const counters = data.export_counters || {};
    return counters[dateStr] || 0;
  }

  /**
   * 递增某一天的导出次数
   * @param {string} dateStr - 日期 YYYY-MM-DD
   */
  async function incrementExportCounter(dateStr) {
    const data = await STORAGE.get('export_counters');
    const counters = data.export_counters || {};
    counters[dateStr] = (counters[dateStr] || 0) + 1;
    await STORAGE.set({ export_counters: counters });
  }

  // ===================== 窗口位置 =====================

  /**
   * 保存窗口位置
   * @param {{left: number, top: number}} pos
   */
  async function setWindowPos(pos) {
    await STORAGE.set({ window_pos: pos });
  }

  /**
   * 读取窗口位置
   * @returns {Promise<{left: number, top: number} | null>}
   */
  async function getWindowPos() {
    const data = await STORAGE.get('window_pos');
    return data.window_pos || null;
  }

  // 公开 API
  return {
    getQuotes,
    setQuotes,
    getQuotesCategories,
    setQuotesCategories,
    getWriting,
    setWriting,
    getWritingCategories,
    setWritingCategories,
    getWorkTasks,
    setWorkTasks,
    clearCurrentData,
    getExportCounter,
    incrementExportCounter,
    setWindowPos,
    getWindowPos,
  };
})();
