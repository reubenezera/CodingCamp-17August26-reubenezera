// ============================================================
// CONFIG
// ============================================================

const STORAGE_KEY = 'expense_transactions';
const CATEGORIES = ['Food', 'Transport', 'Fun'];
const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56'
};
const CURRENCY_SYMBOL = '$';
const MAX_AMOUNT = 999999999.99;
const MAX_NAME_LENGTH = 100;
const DISPLAY_NAME_LIMIT = 50;

// ============================================================
// STATE
// ============================================================

let transactions = [];
let chartInstance = null;
let loadError = false;

// ============================================================
// VALIDATOR
// ============================================================

/**
 * Validates the item name field.
 * @param {string} value
 * @returns {string|null} Error message, or null if valid.
 */
function validateName(value) {
  if (!value || value.trim().length === 0) return 'Item name is required.';
  if (value.trim().length > MAX_NAME_LENGTH) return 'Item name must be 100 characters or fewer.';
  return null;
}

/**
 * Validates the amount field.
 * @param {string} value
 * @returns {string|null} Error message, or null if valid.
 */
function validateAmount(value) {
  if (value === '' || value === null || value === undefined) return 'Amount is required.';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Amount must be a number.';
  if (num <= 0) return 'Amount must be greater than zero.';
  if (num > MAX_AMOUNT) return 'Amount must not exceed 999,999,999.99.';
  return null;
}

/**
 * Validates the category field.
 * @param {string} value
 * @returns {string|null} Error message, or null if valid.
 */
function validateCategory(value) {
  if (!value || !CATEGORIES.includes(value)) return 'Please select a category.';
  return null;
}

// ============================================================
// STORAGE MANAGER
// ============================================================

/**
 * Checks whether a value is a valid Transaction object.
 * @param {*} item
 * @returns {boolean}
 */
function isValidTransaction(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.amount === 'number' &&
    typeof item.category === 'string' &&
    typeof item.createdAt === 'number'
  );
}

/**
 * Reads and deserializes transactions from localStorage.
 * - Returns [] if the key is absent.
 * - Returns [] (and sets loadError = true) if JSON is invalid or value is not an array.
 * - Filters out any items missing required Transaction fields.
 * @returns {Transaction[]}
 */
function loadFromStorage() {
  loadError = false;

  const raw = localStorage.getItem(STORAGE_KEY);

  // Key absent — fresh state, no error
  if (raw === null) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    loadError = true;
    return [];
  }

  if (!Array.isArray(parsed)) {
    loadError = true;
    return [];
  }

  // Filter out any items that don't conform to the Transaction schema
  return parsed.filter(isValidTransaction);
}

class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Serializes the transactions array and writes to localStorage.
 * @param {Transaction[]} transactions
 * @throws {StorageError} if localStorage.setItem fails
 */
function saveToStorage(transactions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (err) {
    throw new StorageError('Unable to save data: storage is unavailable or full.');
  }
}

/**
 * Removes the transaction with the given id from storage.
 * Filters the transactions array to exclude the matching id,
 * then persists the result via saveToStorage().
 * Re-throws StorageError so the event handler can retain the
 * transaction in-memory and display an appropriate error.
 *
 * @param {string} id - The id of the transaction to remove
 * @param {Transaction[]} transactions - The current transactions array
 */
function removeFromStorage(id, transactions) {
  const updated = transactions.filter(t => t.id !== id);
  saveToStorage(updated);
}

// ============================================================
// RENDERER
// ============================================================

/**
 * Renders the total balance into #balance-display.
 * Sums all transaction amounts, formats to 2 decimal places.
 * - Zero/positive: "Total Expenditure: $X.XX"
 * - Negative:      "Total Expenditure: -$X.XX"
 * @param {Transaction[]} transactions
 */
function renderBalance(transactions) {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  const absFormatted = Math.abs(total).toFixed(2);
  const formatted = total < 0
    ? `-${CURRENCY_SYMBOL}${absFormatted}`
    : `${CURRENCY_SYMBOL}${absFormatted}`;

  const el = document.getElementById('balance-display');
  if (el) {
    el.textContent = `Total Expenditure: ${formatted}`;
  }
}

/**
 * Renders (or updates) the pie chart based on the current transactions.
 * - Computes per-category totals.
 * - If all totals are zero or transactions is empty: destroys any existing
 *   chartInstance, hides the <canvas>, and shows #chart-placeholder.
 * - Otherwise: hides #chart-placeholder, shows <canvas>, then creates a new
 *   Chart.js instance or updates the existing one with the latest data.
 * @param {Transaction[]} transactions
 */
function renderChart(transactions) {
  const canvas = document.getElementById('expense-chart');
  const placeholder = document.getElementById('chart-placeholder');

  // Compute per-category totals
  const totals = CATEGORIES.map(cat =>
    transactions.reduce((sum, t) => t.category === cat ? sum + t.amount : sum, 0)
  );

  const allZero = totals.every(t => t === 0);

  if (allZero) {
    // Destroy existing chart instance if present
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    // Hide canvas, show placeholder
    canvas.classList.add('hidden');
    placeholder.textContent = 'No data to visualize.';
    placeholder.classList.remove('hidden');
    return;
  }

  // Hide placeholder, show canvas
  placeholder.classList.add('hidden');
  canvas.classList.remove('hidden');

  const totalsData = totals;

  if (chartInstance) {
    // Update existing chart in-place
    chartInstance.data.datasets[0].data = totalsData;
    chartInstance.update();
  } else {
    // Create a new Chart.js instance
    chartInstance = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: CATEGORIES,
        datasets: [{
          data: totalsData,
          backgroundColor: CATEGORIES.map(cat => CATEGORY_COLORS[cat])
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }
}

/**
 * Truncates a string to DISPLAY_NAME_LIMIT characters, appending '…' if needed.
 * @param {string} name
 * @returns {string}
 */
function truncateName(name) {
  if (name.length > DISPLAY_NAME_LIMIT) {
    return name.slice(0, DISPLAY_NAME_LIMIT) + '…';
  }
  return name;
}

/**
 * Formats a numeric amount as a currency string.
 * Positive / zero → "$X.XX", negative → "-$X.XX"
 * @param {number} amount
 * @returns {string}
 */
function formatAmount(amount) {
  if (amount < 0) {
    return '-' + CURRENCY_SYMBOL + Math.abs(amount).toFixed(2);
  }
  return CURRENCY_SYMBOL + amount.toFixed(2);
}

/**
 * Renders the transaction list into #transaction-list.
 * - If transactions is empty, shows a placeholder message.
 * - Otherwise, renders one row per transaction with name, amount, category,
 *   and a delete button (data-id = transaction.id).
 * Fully replaces #transaction-list contents on every call.
 * @param {Transaction[]} transactions
 */
function renderTransactionList(transactions) {
  const listEl = document.getElementById('transaction-list');
  if (!listEl) return;

  // Clear existing content
  listEl.innerHTML = '';

  if (transactions.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'list-placeholder';
    placeholder.textContent = 'No expenses added yet.';
    listEl.appendChild(placeholder);
    return;
  }

  transactions.forEach(function (transaction) {
    // Outer row
    const item = document.createElement('div');
    item.className = 'transaction-item';

    // Info block: name + category
    const info = document.createElement('div');
    info.className = 'transaction-info';

    const nameEl = document.createElement('span');
    nameEl.className = 'transaction-name';
    nameEl.textContent = truncateName(transaction.name);

    const categoryEl = document.createElement('span');
    categoryEl.className = 'transaction-category';
    categoryEl.textContent = transaction.category;

    info.appendChild(nameEl);
    info.appendChild(categoryEl);

    // Amount
    const amountEl = document.createElement('span');
    amountEl.className = 'transaction-amount';
    amountEl.textContent = formatAmount(transaction.amount);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.dataset.id = transaction.id;

    item.appendChild(info);
    item.appendChild(amountEl);
    item.appendChild(deleteBtn);

    listEl.appendChild(item);
  });
}

/**
 * Orchestrates a full UI re-render by calling all three renderer functions.
 * @param {Transaction[]} transactions
 */
function renderAll(transactions) {
  renderTransactionList(transactions);
  renderBalance(transactions);
  renderChart(transactions);
}

// ============================================================
// EVENT HANDLERS
// ============================================================

/**
 * Handles the expense form's submit event.
 * - Validates all fields and shows inline errors; stops if any are invalid.
 * - Builds a new Transaction, attempts to persist it, and on success updates
 *   in-memory state, re-renders all UI, and resets the form.
 * - On StorageError, displays an error banner and preserves the form values.
 * @param {Event} event
 */
function handleFormSubmit(event) {
  event.preventDefault();

  // --- Read field values ---
  const nameInput     = document.getElementById('item-name');
  const amountInput   = document.getElementById('amount');
  const categoryInput = document.getElementById('category');

  const nameValue     = nameInput     ? nameInput.value     : '';
  const amountValue   = amountInput   ? amountInput.value   : '';
  const categoryValue = categoryInput ? categoryInput.value : '';

  // --- Validate ---
  const nameError     = validateName(nameValue);
  const amountError   = validateAmount(amountValue);
  const categoryError = validateCategory(categoryValue);

  // Display (or clear) inline error messages
  const nameErrorEl     = document.getElementById('item-name-error');
  const amountErrorEl   = document.getElementById('amount-error');
  const categoryErrorEl = document.getElementById('category-error');

  if (nameErrorEl)     nameErrorEl.textContent     = nameError     || '';
  if (amountErrorEl)   amountErrorEl.textContent   = amountError   || '';
  if (categoryErrorEl) categoryErrorEl.textContent = categoryError || '';

  // If any field is invalid, stop here
  if (nameError || amountError || categoryError) {
    return;
  }

  // --- Build new transaction ---
  const newTransaction = {
    id:        crypto.randomUUID(),
    name:      nameValue.trim(),
    amount:    parseFloat(amountValue),
    category:  categoryValue,
    createdAt: Date.now()
  };

  // --- Persist ---
  const storageErrorEl = document.getElementById('storage-error');

  try {
    saveToStorage([...transactions, newTransaction]);
  } catch (err) {
    if (err instanceof StorageError) {
      if (storageErrorEl) {
        storageErrorEl.textContent = err.message;
        storageErrorEl.classList.remove('hidden');
      }
      // Do NOT mutate in-memory state; preserve the form values
      return;
    }
    throw err; // re-throw unexpected errors
  }

  // --- Success: update state, re-render, reset form ---
  transactions.push(newTransaction);
  renderAll(transactions);

  // Reset form fields
  if (nameInput)     nameInput.value     = '';
  if (amountInput)   amountInput.value   = '';
  if (categoryInput) categoryInput.value = '';

  // Clear all error spans
  if (nameErrorEl)     nameErrorEl.textContent     = '';
  if (amountErrorEl)   amountErrorEl.textContent   = '';
  if (categoryErrorEl) categoryErrorEl.textContent = '';

  // Hide storage error banner
  if (storageErrorEl) {
    storageErrorEl.textContent = '';
    storageErrorEl.classList.add('hidden');
  }
}

/**
 * Handles click events on #transaction-list via event delegation.
 * Only acts when the clicked element is a delete button (has data-id attribute).
 * - On StorageError: re-renders the list unchanged and shows an error in the list area.
 * - On success: removes the transaction from in-memory state and re-renders all.
 * @param {MouseEvent} event
 */
function handleDelete(event) {
  const btn = event.target;

  // Only handle clicks on delete buttons that carry a data-id
  if (!btn.dataset.id) return;

  const id = btn.dataset.id;

  try {
    removeFromStorage(id, transactions);
  } catch (err) {
    if (err instanceof StorageError) {
      // Re-render the list unchanged so the transaction is still visible
      renderTransactionList(transactions);

      // Show a delete-error message inside the list area
      const listEl = document.getElementById('transaction-list');
      if (listEl) {
        const errorEl = document.createElement('p');
        errorEl.className = 'storage-error delete-error';
        errorEl.textContent = 'Could not delete transaction: storage is unavailable or full.';
        listEl.prepend(errorEl);
      }
      return;
    }
    throw err;
  }

  // Success — remove from in-memory state and re-render
  transactions = transactions.filter(t => t.id !== id);
  renderAll(transactions);
}

// ============================================================
// INIT
// ============================================================

/**
 * Bootstraps the application on DOMContentLoaded.
 * - Loads persisted transactions from localStorage.
 * - If the stored data was corrupt/invalid (loadError === true), displays
 *   error messages in #transaction-list and #chart-placeholder instead of
 *   the normal empty-state placeholders.
 * - Paints the initial UI state via renderAll().
 * - Wires up the form submit and list click event handlers.
 */
function init() {
  transactions = loadFromStorage();

  if (loadError) {
    // Show load error in the transaction list area
    const listEl = document.getElementById('transaction-list');
    if (listEl) {
      listEl.innerHTML = '';
      const errorEl = document.createElement('p');
      errorEl.className = 'storage-error load-error';
      errorEl.textContent = 'Transactions could not be loaded. Storage data is unavailable or corrupted.';
      listEl.appendChild(errorEl);
    }

    // Show load error in the chart placeholder area
    const chartPlaceholder = document.getElementById('chart-placeholder');
    if (chartPlaceholder) {
      chartPlaceholder.textContent = 'Chart data could not be loaded.';
      chartPlaceholder.classList.remove('hidden');
    }

    // Hide the canvas since we have no valid data
    const canvas = document.getElementById('expense-chart');
    if (canvas) {
      canvas.classList.add('hidden');
    }

    // Still render balance (will show $0.00) and skip list/chart via early returns
    renderBalance(transactions);
  } else {
    renderAll(transactions);
  }

  // Attach event handlers
  const form = document.getElementById('expense-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  const listEl = document.getElementById('transaction-list');
  if (listEl) {
    listEl.addEventListener('click', handleDelete);
  }
}

document.addEventListener('DOMContentLoaded', init);
