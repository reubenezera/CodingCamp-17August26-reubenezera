// ============================================================
// CONFIG
// ============================================================

const STORAGE_KEY          = 'expense_transactions';
const CATEGORIES_KEY       = 'expense_categories';
const THEME_KEY            = 'expense_theme';
const CURRENCY_SYMBOL      = 'Rp';
const MAX_AMOUNT           = 999999999.99;
const MAX_NAME_LENGTH      = 100;
const DISPLAY_NAME_LIMIT   = 50;

// Default categories (used when no custom ones are stored yet)
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

// Default chart colors for the built-in categories
const DEFAULT_CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56'
};

// Palette for dynamically assigned colors (cycles if more categories added)
const COLOR_PALETTE = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
  '#9966FF', '#FF9F40', '#C9CBCF', '#7BC8A4',
  '#E74C3C', '#2ECC71', '#3498DB', '#F39C12'
];

// ============================================================
// STATE
// ============================================================

let transactions   = [];
let categories     = [];        // mutable, loaded from storage
let categoryColors = {};        // category name → hex color
let chartInstance  = null;
let loadError      = false;

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    toggle.innerHTML = `<span aria-hidden="true">${isDark ? '☀' : '◐'}</span> ${isDark ? 'Light mode' : 'Dark mode'}`;
  }

  if (chartInstance) {
    chartInstance.options.plugins.legend.labels.color = getComputedStyle(document.documentElement)
      .getPropertyValue('--text').trim();
    chartInstance.update();
  }
}

function handleThemeToggle() {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

// ============================================================
// CATEGORY HELPERS
// ============================================================

/**
 * Assigns a color to every category, reusing existing assignments
 * and allocating new palette slots for new ones.
 */
function rebuildCategoryColors() {
  const existing = { ...categoryColors };
  categoryColors = {};
  categories.forEach((cat, idx) => {
    categoryColors[cat] = existing[cat] || COLOR_PALETTE[idx % COLOR_PALETTE.length];
  });
}

/**
 * Loads categories from localStorage. Falls back to DEFAULT_CATEGORIES.
 * @returns {string[]}
 */
function loadCategoriesFromStorage() {
  const raw = localStorage.getItem(CATEGORIES_KEY);
  if (raw === null) return [...DEFAULT_CATEGORIES];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) { /* fall through */ }
  return [...DEFAULT_CATEGORIES];
}

/**
 * Persists the current categories array to localStorage.
 */
function saveCategoriesToStorage() {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

// ============================================================
// VALIDATOR
// ============================================================

function validateName(value) {
  if (!value || value.trim().length === 0) return 'Item name is required.';
  if (value.trim().length > MAX_NAME_LENGTH) return 'Item name must be 100 characters or fewer.';
  return null;
}

function validateAmount(value) {
  if (value === '' || value === null || value === undefined) return 'Amount is required.';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Amount must be a number.';
  if (num <= 0)   return 'Amount must be greater than zero.';
  if (num > MAX_AMOUNT) return 'Amount must not exceed 999,999,999.99.';
  return null;
}

function validateCategory(value) {
  if (!value || !categories.includes(value)) return 'Please select a category.';
  return null;
}

// ============================================================
// STORAGE MANAGER
// ============================================================

function isValidTransaction(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.id        === 'string' &&
    typeof item.name      === 'string' &&
    typeof item.amount    === 'number' &&
    typeof item.category  === 'string' &&
    typeof item.createdAt === 'number'
  );
}

function loadFromStorage() {
  loadError = false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { loadError = true; return []; }
  if (!Array.isArray(parsed)) { loadError = true; return []; }
  return parsed.filter(isValidTransaction);
}

class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageError';
  }
}

function saveToStorage(transactions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (err) {
    throw new StorageError('Unable to save data: storage is unavailable or full.');
  }
}

function removeFromStorage(id, transactions) {
  const updated = transactions.filter(t => t.id !== id);
  saveToStorage(updated);
}

// ============================================================
// RENDERER — Balance
// ============================================================

function renderBalance(transactions) {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  const absFormatted = Math.abs(total).toFixed(2);
  const formatted = total < 0
    ? `-${CURRENCY_SYMBOL}${absFormatted}`
    : `${CURRENCY_SYMBOL}${absFormatted}`;

  const el = document.getElementById('balance-display');
  if (el) el.textContent = `Total Expenditure: ${formatted}`;
}

// ============================================================
// RENDERER — Chart
// ============================================================

function renderChart(transactions) {
  const canvas      = document.getElementById('expense-chart');
  const placeholder = document.getElementById('chart-placeholder');

  const totals = categories.map(cat =>
    transactions.reduce((sum, t) => t.category === cat ? sum + t.amount : sum, 0)
  );

  const allZero = totals.every(t => t === 0);

  if (allZero) {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    canvas.classList.add('hidden');
    placeholder.textContent = 'No data to visualize.';
    placeholder.classList.remove('hidden');
    return;
  }

  placeholder.classList.add('hidden');
  canvas.classList.remove('hidden');

  if (chartInstance) {
    chartInstance.data.labels                       = categories;
    chartInstance.data.datasets[0].data             = totals;
    chartInstance.data.datasets[0].backgroundColor  = categories.map(c => categoryColors[c]);
    chartInstance.update();
  } else {
    chartInstance = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: categories,
        datasets: [{
          data:            totals,
          backgroundColor: categories.map(c => categoryColors[c])
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim()
            }
          }
        }
      }
    });
  }
}

// ============================================================
// RENDERER — Category Select (dropdown in the form)
// ============================================================

function renderCategorySelect() {
  const select = document.getElementById('category');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '<option value="">Select a category</option>';

  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value       = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  // Restore selection if still valid
  if (categories.includes(currentValue)) {
    select.value = currentValue;
  }
}

// ============================================================
// RENDERER — Custom Category Manager panel
// ============================================================

function renderCategoryManager() {
  const listEl = document.getElementById('custom-category-list');
  if (!listEl) return;

  listEl.innerHTML = '';

  categories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'category-item';

    const swatch = document.createElement('span');
    swatch.className   = 'category-swatch';
    swatch.style.background = categoryColors[cat] || '#ccc';

    const nameEl = document.createElement('span');
    nameEl.className   = 'category-name';
    nameEl.textContent = cat;

    const deleteBtn = document.createElement('button');
    deleteBtn.className    = 'category-delete-btn';
    deleteBtn.type         = 'button';
    deleteBtn.textContent  = '×';
    deleteBtn.dataset.cat  = cat;
    deleteBtn.setAttribute('aria-label', `Delete category ${cat}`);

    // Disable delete if it's the last remaining category
    if (categories.length === 1) {
      deleteBtn.disabled = true;
      deleteBtn.title    = 'At least one category is required.';
    }

    item.appendChild(swatch);
    item.appendChild(nameEl);
    item.appendChild(deleteBtn);
    listEl.appendChild(item);
  });
}

// ============================================================
// RENDERER — Monthly Summary
// ============================================================

/**
 * Groups transactions by "YYYY-MM" and renders a monthly breakdown.
 * Shows per-month total and per-category sub-totals for each month.
 */
function renderMonthlySummary() {
  const container = document.getElementById('monthly-summary-content');
  if (!container) return;

  container.innerHTML = '';

  if (transactions.length === 0) {
    const empty = document.createElement('p');
    empty.className   = 'summary-placeholder';
    empty.textContent = 'No transactions to summarize yet.';
    container.appendChild(empty);
    return;
  }

  // Group by YYYY-MM
  const groups = {};
  transactions.forEach(t => {
    const d   = new Date(t.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  // Sort months descending (most recent first)
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  sortedKeys.forEach(key => {
    const [year, month] = key.split('-');
    const monthName = new Date(Number(year), Number(month) - 1, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });

    const monthTotal = groups[key].reduce((sum, t) => sum + t.amount, 0);

    // Card for this month
    const card = document.createElement('div');
    card.className = 'summary-month-card';

    // Month header
    const header = document.createElement('div');
    header.className = 'summary-month-header';

    const titleEl = document.createElement('span');
    titleEl.className   = 'summary-month-title';
    titleEl.textContent = monthName;

    const totalEl = document.createElement('span');
    totalEl.className   = 'summary-month-total';
    totalEl.textContent = formatAmount(monthTotal);

    header.appendChild(titleEl);
    header.appendChild(totalEl);
    card.appendChild(header);

    // Per-category breakdown
    const breakdown = document.createElement('div');
    breakdown.className = 'summary-breakdown';

    // Collect categories present in this month
    const catTotals = {};
    groups[key].forEach(t => {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });

    // Sort by amount descending
    Object.entries(catTotals)
      .sort(([, a], [, b]) => b - a)
      .forEach(([cat, total]) => {
        const row = document.createElement('div');
        row.className = 'summary-breakdown-row';

        const swatch = document.createElement('span');
        swatch.className = 'category-swatch summary-swatch';
        swatch.style.background = categoryColors[cat] || '#ccc';

        const catLabel = document.createElement('span');
        catLabel.className   = 'summary-cat-label';
        catLabel.textContent = cat;

        const catAmount = document.createElement('span');
        catAmount.className   = 'summary-cat-amount';
        catAmount.textContent = formatAmount(total);

        // Progress bar showing proportion of monthly total
        const barWrap = document.createElement('div');
        barWrap.className = 'summary-bar-wrap';

        const bar = document.createElement('div');
        bar.className = 'summary-bar';
        const pct = monthTotal > 0 ? (total / monthTotal) * 100 : 0;
        bar.style.width      = `${pct.toFixed(1)}%`;
        bar.style.background = categoryColors[cat] || '#ccc';

        barWrap.appendChild(bar);

        row.appendChild(swatch);
        row.appendChild(catLabel);
        row.appendChild(barWrap);
        row.appendChild(catAmount);
        breakdown.appendChild(row);
      });

    card.appendChild(breakdown);
    container.appendChild(card);
  });
}

// ============================================================
// RENDERER — Transaction List
// ============================================================

function truncateName(name) {
  if (name.length > DISPLAY_NAME_LIMIT) return name.slice(0, DISPLAY_NAME_LIMIT) + '…';
  return name;
}

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR'
});

function formatAmount(amount) {
  return rupiahFormatter.format(amount);
}

function renderTransactionList(transactions) {
  const listEl = document.getElementById('transaction-list');
  if (!listEl) return;

  listEl.innerHTML = '';

  if (transactions.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className   = 'list-placeholder';
    placeholder.textContent = 'No expenses added yet.';
    listEl.appendChild(placeholder);
    return;
  }

  transactions.forEach(transaction => {
    const item = document.createElement('div');
    item.className = 'transaction-item';

    const info = document.createElement('div');
    info.className = 'transaction-info';

    const nameEl = document.createElement('span');
    nameEl.className   = 'transaction-name';
    nameEl.textContent = truncateName(transaction.name);

    const categoryEl = document.createElement('span');
    categoryEl.className   = 'transaction-category';
    categoryEl.textContent = transaction.category;

    info.appendChild(nameEl);
    info.appendChild(categoryEl);

    const amountEl = document.createElement('span');
    amountEl.className   = 'transaction-amount';
    amountEl.textContent = formatAmount(transaction.amount);

    const deleteBtn = document.createElement('button');
    deleteBtn.className      = 'delete-btn';
    deleteBtn.type           = 'button';
    deleteBtn.textContent    = 'Delete';
    deleteBtn.dataset.id     = transaction.id;

    item.appendChild(info);
    item.appendChild(amountEl);
    item.appendChild(deleteBtn);
    listEl.appendChild(item);
  });
}

// ============================================================
// RENDERER — Full re-render
// ============================================================

function renderAll(transactions) {
  renderTransactionList(transactions);
  renderBalance(transactions);
  renderChart(transactions);
  renderMonthlySummary();
}

// ============================================================
// EVENT HANDLERS — Expense Form
// ============================================================

function handleFormSubmit(event) {
  event.preventDefault();

  const nameInput     = document.getElementById('item-name');
  const amountInput   = document.getElementById('amount');
  const categoryInput = document.getElementById('category');

  const nameValue     = nameInput     ? nameInput.value     : '';
  const amountValue   = amountInput   ? amountInput.value   : '';
  const categoryValue = categoryInput ? categoryInput.value : '';

  const nameError     = validateName(nameValue);
  const amountError   = validateAmount(amountValue);
  const categoryError = validateCategory(categoryValue);

  const nameErrorEl     = document.getElementById('item-name-error');
  const amountErrorEl   = document.getElementById('amount-error');
  const categoryErrorEl = document.getElementById('category-error');

  if (nameErrorEl)     nameErrorEl.textContent     = nameError     || '';
  if (amountErrorEl)   amountErrorEl.textContent   = amountError   || '';
  if (categoryErrorEl) categoryErrorEl.textContent = categoryError || '';

  if (nameError || amountError || categoryError) return;

  const newTransaction = {
    id:        crypto.randomUUID(),
    name:      nameValue.trim(),
    amount:    parseFloat(amountValue),
    category:  categoryValue,
    createdAt: Date.now()
  };

  const storageErrorEl = document.getElementById('storage-error');

  try {
    saveToStorage([...transactions, newTransaction]);
  } catch (err) {
    if (err instanceof StorageError) {
      if (storageErrorEl) {
        storageErrorEl.textContent = err.message;
        storageErrorEl.classList.remove('hidden');
      }
      return;
    }
    throw err;
  }

  transactions.push(newTransaction);
  renderAll(transactions);

  if (nameInput)     nameInput.value     = '';
  if (amountInput)   amountInput.value   = '';
  if (categoryInput) categoryInput.value = '';

  if (nameErrorEl)     nameErrorEl.textContent     = '';
  if (amountErrorEl)   amountErrorEl.textContent   = '';
  if (categoryErrorEl) categoryErrorEl.textContent = '';

  if (storageErrorEl) {
    storageErrorEl.textContent = '';
    storageErrorEl.classList.add('hidden');
  }
}

// ============================================================
// EVENT HANDLERS — Transaction Delete
// ============================================================

function handleDelete(event) {
  const btn = event.target;
  if (!btn.dataset.id) return;

  const id = btn.dataset.id;

  try {
    removeFromStorage(id, transactions);
  } catch (err) {
    if (err instanceof StorageError) {
      renderTransactionList(transactions);
      const listEl = document.getElementById('transaction-list');
      if (listEl) {
        const errorEl = document.createElement('p');
        errorEl.className   = 'storage-error delete-error';
        errorEl.textContent = 'Could not delete transaction: storage is unavailable or full.';
        listEl.prepend(errorEl);
      }
      return;
    }
    throw err;
  }

  transactions = transactions.filter(t => t.id !== id);
  renderAll(transactions);
}

// ============================================================
// EVENT HANDLERS — Custom Category Manager
// ============================================================

/**
 * Handles adding a new custom category from the input field.
 */
function handleAddCategory() {
  const input    = document.getElementById('new-category-input');
  const errorEl  = document.getElementById('new-category-error');
  if (!input) return;

  const raw   = input.value.trim();
  let   error = null;

  if (!raw) {
    error = 'Category name cannot be empty.';
  } else if (raw.length > 50) {
    error = 'Category name must be 50 characters or fewer.';
  } else if (categories.map(c => c.toLowerCase()).includes(raw.toLowerCase())) {
    error = 'That category already exists.';
  }

  if (errorEl) errorEl.textContent = error || '';
  if (error) return;

  // Add the new category
  categories.push(raw);
  rebuildCategoryColors();
  saveCategoriesToStorage();

  // Sync UI
  renderCategoryManager();
  renderCategorySelect();
  renderChart(transactions);     // chart labels/colors may expand

  input.value = '';
}

/**
 * Handles deleting a category via the × button in the category manager.
 * Transactions that used this category are kept but their category label
 * becomes "(Deleted)" to preserve history.
 */
function handleDeleteCategory(event) {
  const btn = event.target.closest('.category-delete-btn');
  if (!btn) return;

  const cat = btn.dataset.cat;
  if (!cat || !categories.includes(cat)) return;

  if (categories.length === 1) return; // guard: keep at least one

  // Remove category
  categories = categories.filter(c => c !== cat);
  rebuildCategoryColors();
  saveCategoriesToStorage();

  // Re-render everything (transactions keep the old category label)
  renderCategoryManager();
  renderCategorySelect();
  renderAll(transactions);
}

// ============================================================
// INIT
// ============================================================

function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');

  // Load categories first (needed for validation & rendering)
  categories = loadCategoriesFromStorage();
  rebuildCategoryColors();

  // Load transactions
  transactions = loadFromStorage();

  if (loadError) {
    const listEl = document.getElementById('transaction-list');
    if (listEl) {
      listEl.innerHTML = '';
      const errorEl = document.createElement('p');
      errorEl.className   = 'storage-error load-error';
      errorEl.textContent = 'Transactions could not be loaded. Storage data is unavailable or corrupted.';
      listEl.appendChild(errorEl);
    }

    const chartPlaceholder = document.getElementById('chart-placeholder');
    if (chartPlaceholder) {
      chartPlaceholder.textContent = 'Chart data could not be loaded.';
      chartPlaceholder.classList.remove('hidden');
    }

    const canvas = document.getElementById('expense-chart');
    if (canvas) canvas.classList.add('hidden');

    renderBalance(transactions);
  } else {
    renderAll(transactions);
  }

  // Populate category dropdown with loaded categories
  renderCategorySelect();

  // Populate the category manager panel
  renderCategoryManager();

  // Attach form submit handler
  const form = document.getElementById('expense-form');
  if (form) form.addEventListener('submit', handleFormSubmit);

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.addEventListener('click', handleThemeToggle);

  // Attach transaction delete handler
  const listEl = document.getElementById('transaction-list');
  if (listEl) listEl.addEventListener('click', handleDelete);

  // Attach "Add Category" button handler
  const addCatBtn = document.getElementById('add-category-btn');
  if (addCatBtn) addCatBtn.addEventListener('click', handleAddCategory);

  // Allow Enter key in the new-category input
  const newCatInput = document.getElementById('new-category-input');
  if (newCatInput) {
    newCatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); }
    });
  }

  // Attach category delete handler (delegated)
  const catListEl = document.getElementById('custom-category-list');
  if (catListEl) catListEl.addEventListener('click', handleDeleteCategory);
}

document.addEventListener('DOMContentLoaded', init);
