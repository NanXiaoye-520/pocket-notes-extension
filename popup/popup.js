/**
 * Pocket Notes - 独立弹窗脚本
 */

/* ============================
 *  状态
 * ============================ */
let activeTab = 'quotes';       // 'quotes' | 'writing'
let quotes = [];                // 今日待办列表 {text, category, time}[]
let saveTimer = null;           // 待办防抖计时器
let writingContent = {};        // 今日已处理内容 {[category]: string}
let writingSaveTimer = null;    // 已处理防抖计时器
let quotesCategories = [];      // 待办分类列表
let writingCategories = [];     // 已处理分类列表
let selectedQuoteCategory = ''; // 当前选中的待办分类
let selectedWritingCategory = ''; // 当前选中的已处理分类
let workMode = false;           // 伪装模式开关（仅内存，不持久化）
let workTasks = [];             // 伪装任务列表 {name, status}[]
let isPinned = false;           // 置顶状态
let isMinimizing = false;       // 正在最小化，忽略 blur

/* ============================
 *  DOM 引用
 * ============================ */
let titleTextEl = null;
let tabQuotesEl = null;
let tabWritingEl = null;
let btnExportEl = null;
let closeBtnEl = null;
let quotesPageEl = null;
let writingPageEl = null;
let quoteCategorySelect = null;
let quoteManageBtn = null;
let quoteInputEl = null;
let quoteListEl = null;
let writingCategorySelect = null;
let writingManageBtn = null;
let writingAreaEl = null;
let wordCountEl = null;
let workModeBtn = null;
let pinBtn = null;

/* ============================
 *  初始化
 * ============================ */

document.addEventListener('DOMContentLoaded', () => {
  // 缓存 DOM 引用
  titleTextEl = document.getElementById('title-text');
  tabQuotesEl = document.getElementById('tab-quotes');
  tabWritingEl = document.getElementById('tab-writing');
  btnExportEl = document.getElementById('btn-export');
  closeBtnEl = document.getElementById('btn-close');
  quotesPageEl = document.getElementById('page-quotes');
  writingPageEl = document.getElementById('page-writing');
  quoteCategorySelect = document.getElementById('quote-category-select');
  quoteManageBtn = document.getElementById('quote-manage-btn');
  quoteInputEl = document.getElementById('quote-input');
  quoteListEl = document.getElementById('quote-list');
  writingCategorySelect = document.getElementById('writing-category-select');
  writingManageBtn = document.getElementById('writing-manage-btn');
  writingAreaEl = document.getElementById('writing-area');
  wordCountEl = document.getElementById('word-count');
  workModeBtn = document.getElementById('btn-workmode');
  pinBtn = document.getElementById('btn-pin');

  bindEvents();
  initData();
});

/* ============================
 *  事件绑定
 * ============================ */

function bindEvents() {
  // 关闭按钮
  closeBtnEl.addEventListener('click', () => {
    window.close();
  });

  // 标题点击 → 切换伪装模式
  titleTextEl.addEventListener('click', () => {
    toggleWorkMode();
  });

  // 伪装任务编辑按钮
  workModeBtn.addEventListener('click', () => {
    openWorkTaskEditor();
  });

  // 置顶按钮
  pinBtn.addEventListener('click', () => {
    isPinned = !isPinned;
    if (isPinned) {
      pinBtn.classList.add('pinned');
    } else {
      pinBtn.classList.remove('pinned');
    }
  });

  // Tab 切换
  tabQuotesEl.addEventListener('click', () => switchTab('quotes'));
  tabWritingEl.addEventListener('click', () => {
    saveCurrentWritingCategory();
    scheduleWritingSaveNow();
    switchTab('writing');
  });

  // 待办分类下拉
  quoteCategorySelect.addEventListener('change', () => {
    selectedQuoteCategory = quoteCategorySelect.value;
    quoteInputEl.focus();
  });

  // 待办分类管理
  quoteManageBtn.addEventListener('click', () => {
    openCategoryManager('quotes');
  });

  // 已处理分类下拉
  writingCategorySelect.addEventListener('change', () => {
    switchWritingCategory(writingCategorySelect.value);
  });

  // 已处理分类管理
  writingManageBtn.addEventListener('click', () => {
    openCategoryManager('writing');
  });

  // 导出 Markdown
  btnExportEl.addEventListener('click', async () => {
    const dateStr = Utils.today();

    // 获取当天导出序号（0 = 首次，1+ = 重复导出）
    const exportCount = await Storage.getExportCounter(dateStr);
    const filename = exportCount === 0
      ? dateStr + '.md'
      : dateStr + '-' + exportCount + '.md';

    const md = Exporter.generateMarkdown(dateStr, quotes, writingContent, quotesCategories, writingCategories);

    const originalText = btnExportEl.textContent;
    btnExportEl.textContent = '导出中...';
    btnExportEl.disabled = true;

    // 快照：导出成功后只清空快照中的内容，保留导出后新增的数据
    const exportedQuotes = [...quotes];
    const exportedWriting = { ...writingContent };

    const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
    chrome.downloads.download(
      {
        url: dataUrl,
        filename: filename,
        saveAs: true,
      },
      async (downloadId) => {
        btnExportEl.disabled = false;
        if (chrome.runtime.lastError) {
          btnExportEl.textContent = '导出失败';
          console.error('[Pocket Notes] 导出失败:', chrome.runtime.lastError.message);
          setTimeout(() => { btnExportEl.textContent = '下班'; }, 2000);
        } else {
          // 导出成功后：只清空已导出的内容，保留新增的
          try {
            // 清空已导出的待办（用 text+category+time 精确匹配）
            const exportedKeys = new Set(
              exportedQuotes.map(q => q.text + '|' + q.category + '|' + q.time)
            );
            quotes = quotes.filter(q => !exportedKeys.has(q.text + '|' + q.category + '|' + q.time));

            // 清空已导出的写作内容（仅当内容未变化时清空）
            for (const cat of Object.keys(exportedWriting)) {
              if (writingContent[cat] === exportedWriting[cat]) {
                writingContent[cat] = '';
              }
            }

            await Storage.setQuotes(quotes);
            await Storage.setWriting(writingContent);
            await Storage.incrementExportCounter(dateStr);

            renderQuoteList();
            loadWritingCategoryContent();
            quoteInputEl.focus();
          } catch (e) {
            console.error('[Pocket Notes] 清空已导出数据失败:', e);
          }
          btnExportEl.textContent = '已导出 ✓';
          setTimeout(() => { btnExportEl.textContent = '下班'; }, 2000);
        }
      }
    );
  });

  // 待办输入框：Enter 新增
  quoteInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = quoteInputEl.value.trim();
      if (text) {
        addQuote(text);
        quoteInputEl.value = '';
      }
    }
  });

  // 写作区域：输入时自动保存 + 更新字数
  writingAreaEl.addEventListener('input', () => {
    saveCurrentWritingCategory();
    scheduleWritingSave();
    updateWordCount();
  });

  // ESC 最小化窗口
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      isMinimizing = true;
      chrome.windows.getCurrent((win) => {
        chrome.windows.update(win.id, { state: 'minimized' });
      });
    }
  });

  // 置顶模式：窗口失去焦点时重新聚焦（最小化时跳过）
  window.addEventListener('blur', () => {
    if (isPinned && !isMinimizing) {
      setTimeout(() => {
        chrome.windows.getCurrent((win) => {
          // 窗口已最小化则跳过，避免闪烁
          if (win.state === 'minimized') return;
          chrome.windows.update(win.id, { focused: true });
        });
      }, 200);
    }
  });

  // 窗口恢复焦点时重置最小化标记
  window.addEventListener('focus', () => {
    isMinimizing = false;
  });

  // 窗口关闭前强制保存
  window.addEventListener('beforeunload', () => {
    saveCurrentWritingCategory();
    forceSaveAll();
  });
}

/* ============================
 *  数据初始化
 * ============================ */

async function initData() {
  // 加载伪装任务
  workTasks = await Storage.getWorkTasks();

  // 加载分类
  quotesCategories = await Storage.getQuotesCategories();
  writingCategories = await Storage.getWritingCategories();
  selectedQuoteCategory = quotesCategories[0] || '其它';
  selectedWritingCategory = writingCategories[0] || '其它';

  // 填充分类下拉框
  populateQuoteCategorySelect();
  populateWritingCategorySelect();

  // 加载今日数据
  await loadQuotes();
  await loadWriting();

  // 旧数据迁移 & 恢复备份
  await migrateOldData();
  restoreEmergencyBackup();

  // 自动聚焦
  quoteInputEl.focus();
}

async function migrateOldData() {
  let migrated = false;

  // 迁移待办：v0.1 string[] → v2.0 object[]
  if (quotes.length > 0 && typeof quotes[0] === 'string') {
    const defaultCat = quotesCategories[0] || '其它';
    quotes = quotes.map((text, i) => ({
      text: text,
      category: defaultCat,
      time: Date.now() + i,
    }));
    await Storage.setQuotes(quotes);
    migrated = true;
  }

  // 迁移已处理
  const rawWriting = await Storage.getWriting();
  if (typeof rawWriting === 'string' && rawWriting.trim()) {
    const defaultCat = writingCategories[0] || '其它';
    writingContent = { [defaultCat]: rawWriting };
    await Storage.setWriting(writingContent);
    migrated = true;
  }

  if (migrated) {
    console.log('[Pocket Notes] 已完成 v0.1 → v2.0 数据迁移');
  }
}

/* ============================
 *  Tab 切换
 * ============================ */

function switchTab(tab) {
  activeTab = tab;

  if (tab === 'quotes') {
    tabQuotesEl.classList.add('active');
    tabWritingEl.classList.remove('active');
    quotesPageEl.classList.remove('hidden');
    writingPageEl.classList.add('hidden');
    if (!workMode) {
      setTimeout(() => quoteInputEl.focus(), 50);
    }
  } else {
    tabQuotesEl.classList.remove('active');
    tabWritingEl.classList.add('active');
    quotesPageEl.classList.add('hidden');
    writingPageEl.classList.remove('hidden');
    loadWritingCategoryContent();
    if (!workMode) {
      setTimeout(() => writingAreaEl.focus(), 50);
    }
  }
}

/* ============================
 *  待办管理
 * ============================ */

async function loadQuotes() {
  try {
    quotes = await Storage.getQuotes();
    renderQuoteList();
  } catch (e) {
    console.error('[Pocket Notes] 加载待办失败:', e);
  }
}

function saveQuotes() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await Storage.setQuotes(quotes);
    } catch (e) {
      console.error('[Pocket Notes] 保存待办失败:', e);
    }
  }, 2000);
}

function addQuote(text) {
  quotes.push({
    text: text,
    category: selectedQuoteCategory,
    time: Date.now(),
  });
  renderQuoteList();
  saveQuotes();
}

function populateQuoteCategorySelect() {
  quoteCategorySelect.innerHTML = '';
  quotesCategories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === selectedQuoteCategory) opt.selected = true;
    quoteCategorySelect.appendChild(opt);
  });
}

function renderQuoteList() {
  quoteListEl.innerHTML = '';
  quotes.forEach((q, index) => {
    quoteListEl.appendChild(createQuoteItem(q, index));
  });
}

function createQuoteItem(q, index) {
  const item = document.createElement('div');
  item.className = 'quote-item';

  // 分类标签
  const tag = document.createElement('span');
  tag.className = 'quote-cat-tag';
  tag.textContent = q.category || '其它';

  // 文本区
  const textEl = document.createElement('span');
  textEl.className = 'quote-text';
  textEl.textContent = q.text;
  textEl.title = '点击编辑';
  textEl.addEventListener('click', () => startEdit(item, index));

  // 删除按钮
  const delBtn = document.createElement('button');
  delBtn.className = 'quote-del';
  delBtn.textContent = '×';
  delBtn.title = '删除';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteQuote(index);
  });

  item.appendChild(tag);
  item.appendChild(textEl);
  item.appendChild(delBtn);
  return item;
}

function startEdit(itemEl, index) {
  if (itemEl.classList.contains('editing')) return;

  const oldText = quotes[index].text;
  itemEl.classList.add('editing');

  itemEl.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'quote-edit-input';
  input.value = oldText;
  itemEl.appendChild(input);
  input.focus();
  input.select();

  const finish = () => {
    const newText = input.value.trim();
    if (newText && newText !== oldText) {
      quotes[index].text = newText;
      saveQuotes();
    }
    renderQuoteList();
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish();
    } else if (e.key === 'Escape') {
      input.value = oldText;
      finish();
    }
  });
}

function deleteQuote(index) {
  quotes.splice(index, 1);
  renderQuoteList();
  saveQuotes();
}

/* ============================
 *  已处理管理
 * ============================ */

async function loadWriting() {
  try {
    writingContent = await Storage.getWriting();
    loadWritingCategoryContent();
  } catch (e) {
    console.error('[Pocket Notes] 加载已处理失败:', e);
  }
}

function loadWritingCategoryContent() {
  writingAreaEl.value = writingContent[selectedWritingCategory] || '';
  updateWordCount();
}

function saveCurrentWritingCategory() {
  writingContent[selectedWritingCategory] = writingAreaEl.value;
}

function switchWritingCategory(cat) {
  if (cat === selectedWritingCategory) return;
  saveCurrentWritingCategory();
  selectedWritingCategory = cat;
  loadWritingCategoryContent();
}

function populateWritingCategorySelect() {
  writingCategorySelect.innerHTML = '';
  writingCategories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === selectedWritingCategory) opt.selected = true;
    writingCategorySelect.appendChild(opt);
  });
}

function updateWordCount() {
  const text = writingAreaEl.value || '';
  const matches = text.match(/[一-鿿]/g);
  const count = matches ? matches.length : 0;
  wordCountEl.textContent = count + ' 字';
}

function scheduleWritingSave() {
  clearTimeout(writingSaveTimer);
  writingSaveTimer = setTimeout(async () => {
    saveCurrentWritingCategory();
    try {
      await Storage.setWriting(writingContent);
    } catch (e) {
      console.error('[Pocket Notes] 保存已处理失败:', e);
    }
  }, 2000);
}

function scheduleWritingSaveNow() {
  saveCurrentWritingCategory();
  Storage.setWriting(writingContent).catch((e) => {
    console.error('[Pocket Notes] 保存已处理失败:', e);
  });
}

function forceSaveAll() {
  clearTimeout(saveTimer);
  clearTimeout(writingSaveTimer);
  saveCurrentWritingCategory();

  const asyncSave = Promise.all([
    Storage.setQuotes(quotes),
    Storage.setWriting(writingContent),
  ]).catch((e) => {
    console.error('[Pocket Notes] 强制保存失败:', e);
  });

  // 同步写入 localStorage 兜底
  try {
    const backup = JSON.stringify({
      quotes: quotes,
      writing: writingContent,
      time: Date.now(),
    });
    localStorage.setItem('pocket_notes_backup', backup);
  } catch (e) {
    // localStorage 满或不可用，忽略
  }

  return asyncSave;
}

function restoreEmergencyBackup() {
  try {
    const raw = localStorage.getItem('pocket_notes_backup');
    if (!raw) return false;

    const backup = JSON.parse(raw);

    // 24小时内的备份有效
    if (Date.now() - backup.time > 24 * 60 * 60 * 1000) return false;

    if (backup.quotes && backup.quotes.length > 0 && quotes.length === 0) {
      quotes = backup.quotes;
      renderQuoteList();
    }
    if (backup.writing && Object.keys(writingContent).length === 0) {
      writingContent = backup.writing;
      loadWritingCategoryContent();
    }
    return true;
  } catch (e) {
    return false;
  }
}

/* ============================
 *  分类管理弹窗
 * ============================ */

function openCategoryManager(type) {
  const isQuotes = type === 'quotes';
  const categories = isQuotes ? quotesCategories : writingCategories;
  const saveFn = isQuotes ? saveQuotesCategories : saveWritingCategories;

  const existing = document.querySelector('.modal-mask');
  if (existing) existing.remove();

  const mask = document.createElement('div');
  mask.className = 'modal-mask';

  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = isQuotes ? '管理待办分类' : '管理已处理分类';
  box.appendChild(title);

  const list = document.createElement('div');
  list.className = 'modal-list';

  function renderList() {
    list.innerHTML = '';
    categories.forEach((cat, i) => {
      const row = document.createElement('div');
      row.className = 'modal-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'modal-item-name';
      nameSpan.textContent = cat;
      nameSpan.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'modal-item-input';
        input.value = cat;
        row.replaceChild(input, nameSpan);
        input.focus();
        input.select();

        const commit = () => {
          const newName = input.value.trim();
          if (newName && newName !== cat) {
            categories[i] = newName;
            if (isQuotes && selectedQuoteCategory === cat) selectedQuoteCategory = newName;
            if (!isQuotes && selectedWritingCategory === cat) selectedWritingCategory = newName;
            saveFn();
            renderList();
            refreshCategorySelects();
          } else {
            renderList();
          }
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { renderList(); }
        });
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'modal-btn-del';
      delBtn.textContent = '×';
      delBtn.title = '删除';
      delBtn.addEventListener('click', () => {
        if (categories.length <= 1) return;
        const removed = categories[i];
        categories.splice(i, 1);
        if (isQuotes && selectedQuoteCategory === removed) selectedQuoteCategory = categories[0];
        if (!isQuotes && selectedWritingCategory === removed) selectedWritingCategory = categories[0];
        saveFn();
        renderList();
        refreshCategorySelects();
      });

      row.appendChild(nameSpan);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  renderList();
  box.appendChild(list);

  const btnRow = document.createElement('div');
  btnRow.className = 'modal-btn-row';

  const addBtn = document.createElement('button');
  addBtn.className = 'modal-btn';
  addBtn.textContent = '+ 新增分类';
  addBtn.addEventListener('click', () => {
    categories.push('新分类');
    saveFn();
    renderList();
    refreshCategorySelects();
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-btn';
  closeBtn.textContent = '关闭';
  closeBtn.addEventListener('click', () => mask.remove());

  btnRow.appendChild(addBtn);
  btnRow.appendChild(closeBtn);
  box.appendChild(btnRow);

  mask.appendChild(box);
  mask.addEventListener('click', (e) => {
    if (e.target === mask) mask.remove();
  });
  document.body.appendChild(mask);
}

function refreshCategorySelects() {
  populateQuoteCategorySelect();
  populateWritingCategorySelect();
}

async function saveQuotesCategories() {
  try {
    await Storage.setQuotesCategories(quotesCategories);
  } catch (e) {
    console.error('[Pocket Notes] 保存待办分类失败:', e);
  }
}

async function saveWritingCategories() {
  try {
    await Storage.setWritingCategories(writingCategories);
  } catch (e) {
    console.error('[Pocket Notes] 保存已处理分类失败:', e);
  }
}

/* ============================
 *  伪装模式
 * ============================ */

function toggleWorkMode() {
  workMode = !workMode;
  const workModeView = document.getElementById('work-mode-view');
  const pageArea = document.getElementById('page-area');
  const bottomBar = document.getElementById('bottom-bar');
  const tabBar = document.getElementById('tab-bar');

  if (workMode) {
    titleTextEl.classList.add('workmode');
    titleTextEl.textContent = '工作模式';
    pageArea.style.display = 'none';
    tabBar.style.display = 'none';
    bottomBar.style.display = 'none';
    workModeView.classList.remove('hidden');
    workModeBtn.style.display = 'none';
    renderWorkTasks();
  } else {
    titleTextEl.classList.remove('workmode');
    titleTextEl.textContent = '今日工作内容';
    pageArea.style.display = '';
    tabBar.style.display = '';
    bottomBar.style.display = '';
    workModeView.classList.add('hidden');
    workModeBtn.style.display = '';
    if (activeTab === 'quotes') {
      renderQuoteList();
      setTimeout(() => quoteInputEl.focus(), 50);
    } else {
      loadWritingCategoryContent();
      setTimeout(() => writingAreaEl.focus(), 50);
    }
  }
}

function renderWorkTasks() {
  const taskList = document.getElementById('work-task-list');
  taskList.innerHTML = '';
  workTasks.forEach((task) => {
    const item = document.createElement('div');
    item.className = 'work-task-item';

    const name = document.createElement('span');
    name.className = 'work-task-name';
    name.textContent = task.name;

    const status = document.createElement('span');
    status.className = 'work-task-status ' + task.status;
    status.textContent = task.status === 'done' ? '已完成' : '待完成';

    item.appendChild(name);
    item.appendChild(status);
    taskList.appendChild(item);
  });
}

function openWorkTaskEditor() {
  const existing = document.querySelector('.modal-mask');
  if (existing) existing.remove();

  const mask = document.createElement('div');
  mask.className = 'modal-mask';

  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = '编辑工作列表';
  box.appendChild(title);

  const list = document.createElement('div');
  list.className = 'modal-list';

  function renderList() {
    list.innerHTML = '';
    workTasks.forEach((task, i) => {
      const row = document.createElement('div');
      row.className = 'modal-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'modal-item-name';
      nameSpan.textContent = task.name;
      nameSpan.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'modal-item-input';
        input.value = task.name;
        row.replaceChild(input, nameSpan);
        input.focus();
        input.select();

        const commit = () => {
          const newName = input.value.trim();
          if (newName) task.name = newName;
          saveWorkTasks();
          renderList();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { renderList(); }
        });
      });

      const statusSelect = document.createElement('select');
      statusSelect.className = 'modal-item-status';
      const optPending = document.createElement('option');
      optPending.value = 'pending';
      optPending.textContent = '待完成';
      const optDone = document.createElement('option');
      optDone.value = 'done';
      optDone.textContent = '已完成';
      statusSelect.appendChild(optPending);
      statusSelect.appendChild(optDone);
      statusSelect.value = task.status;
      statusSelect.addEventListener('change', () => {
        task.status = statusSelect.value;
        saveWorkTasks();
        if (workMode) renderWorkTasks();
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'modal-btn-del';
      delBtn.textContent = '×';
      delBtn.title = '删除';
      delBtn.addEventListener('click', () => {
        workTasks.splice(i, 1);
        saveWorkTasks();
        renderList();
        if (workMode) renderWorkTasks();
      });

      row.appendChild(nameSpan);
      row.appendChild(statusSelect);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  renderList();
  box.appendChild(list);

  const btnRow = document.createElement('div');
  btnRow.className = 'modal-btn-row';

  const addBtn = document.createElement('button');
  addBtn.className = 'modal-btn';
  addBtn.textContent = '+ 新增任务';
  addBtn.addEventListener('click', () => {
    workTasks.push({ name: '新任务', status: 'pending' });
    saveWorkTasks();
    renderList();
    if (workMode) renderWorkTasks();
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-btn';
  closeBtn.textContent = '关闭';
  closeBtn.addEventListener('click', () => mask.remove());

  btnRow.appendChild(addBtn);
  btnRow.appendChild(closeBtn);
  box.appendChild(btnRow);

  mask.appendChild(box);
  mask.addEventListener('click', (e) => {
    if (e.target === mask) mask.remove();
  });
  document.body.appendChild(mask);
}

async function saveWorkTasks() {
  try {
    await Storage.setWorkTasks(workTasks);
  } catch (e) {
    console.error('[Pocket Notes] 保存伪装任务失败:', e);
  }
}
