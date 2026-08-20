# Technical Design Document

## Expense & Budget Visualizer

---

## Overview

The Expense & Budget Visualizer is a zero-dependency, client-side single-page application (SPA) built with plain HTML, CSS, and Vanilla JavaScript. It allows users to record personal expenses by category, track a running total balance, and visualize spending distribution through an interactive pie chart. All data is persisted in the browser's Local Storage — no server, no build step, no frameworks.

The app is delivered as three files:
- `index.html` — structural markup and CDN script tags
- `css/styles.css` — all visual styling and responsive layout
- `js/app.js` — all application logic

[Chart.js 4.x](https://www.chartjs.org/docs/latest/) is loaded from CDN (`https://cdn.jsdelivr.net/npm/chart.js`) to handle pie chart rendering. Everything else is implemented in raw browser APIs.

**Key design principles:**
- All state lives in a single in-memory array (`transactions`), which is the single source of truth
- Every state mutation synchronously updates localStorage, then re-renders all dependent UI components
- DOM manipulation is imperative and targeted — no virtual DOM, no data binding
- Error states are handled explicitly at the storage boundary so the rest of the UI always receives clean data

---

## Architecture

The application follows a simple unidirectional data flow:

```
User Action
    │
    ▼
Event Handler (js/app.js)
    │
    ├─► Validator          (pure functions — validate inputs)
    │
    ├─► StorageManager     (read/write localStorage)
    │       └─► in-memory `transactions` array (single source of truth)
    │
    └─► Renderer           (update DOM from state)
            ├─► renderTransactionList()
            ├─► renderBalance()
            └─► renderChart()
```

There is no separate framework or module bundler. All code runs in a single `<script>` tag that loads `js/app.js` as a classic script (after Chart.js CDN).

### Module Boundaries (within app.js)

Although delivered as one file, `app.js` is organized into clearly separated responsibility blocks using comments and function grouping:

| Block | Responsibility |
|---|---|
| **Config** | Constants: `STORAGE_KEY`, `CATEGORIES`, `CURRENCY_SYMBOL`, `MAX_AMOUNT`, `MAX_NAME_LENGTH` |
| **State** | The `transactions` array; `loadFromStorage()` initializer |
| **Validator** | Pure functions: `validateName()`, `validateAmount()`, `validateCategory()` |
| **StorageManager** | `saveToStorage()`, `loadFromStorage()`, `removeFromStorage()` |
| **Renderer** | `renderAll()`, `renderTransactionList()`, `renderBalance()`, `renderChart()` |
| **Event Handlers** | `handleFormSubmit()`, `handleDelete()` |
| **Init** | `init()` — called on `DOMContentLoaded` |

---

## Components and Interfaces

### index.html Structure

```
<body>
  <header>
    <h1>Expense & Budget Visualizer</h1>
    <div id="balance-display">        <!-- Balance_Display -->
  </header>

  <main class="app-grid">
    <!-- Left column -->
    <section class="form-section">
      <form id="expense-form">        <!-- Input_Form -->
        <div class="field-group">
          <label for="item-name">Item Name</label>
          <input id="item-name" type="text" maxlength="100" />
          <span class="field-error" id="item-name-error"></span>
        </div>
        <div class="field-group">
          <label for="amount">Amount</label>
          <input id="amount" type="number" step="0.01" min="0.01" />
          <span class="field-error" id="amount-error"></span>
        </div>
        <div class="field-group">
          <label for="category">Category</label>
          <select id="category">
            <option value="">Select a category</option>
            <option value="Food">Food</option>
            <option value="Transport">Transport</option>
            <option value="Fun">Fun</option>
          </select>
          <span class="field-error" id="category-error"></span>
        </div>
        <button type="submit">Add Expense</button>
        <div id="storage-error" class="storage-error hidden"></div>
      </form>
    </section>

    <!-- Right column -->
    <section class="list-section">
      <div id="transaction-list">     <!-- Transaction_List -->
        <!-- populated by renderTransactionList() -->
      </div>
    </section>
  </main>

  <section class="chart-section">
    <div id="chart-container">
      <canvas id="expense-chart"></canvas>
      <div id="chart-placeholder" class="hidden"></div>
    </div>
  </section>
</body>
```

### Functional Interfaces (JavaScript)

#### Validator

```js
// Returns null if valid, or an error message string if invalid
validateName(value: string): string | null
validateAmount(value: string): string | null
validateCategory(value: string): string | null
```

All validators are pure functions with no side effects.

#### StorageManager

```js
// Serializes the transactions array and writes to localStorage
// Throws StorageError if localStorage.setItem fails
saveToStorage(transactions: Transaction[]): void

// Reads and deserializes transactions from localStorage
// Returns [] if key is absent, JSON is invalid, or value is not an array
loadFromStorage(): Transaction[]

// Saves the updated list after filtering out the deleted transaction
// Equivalent to saveToStorage(transactions.filter(t => t.id !== id))
removeFromStorage(id: string, transactions: Transaction[]): void
```

#### Renderer

```js
renderAll(transactions: Transaction[]): void        // calls all three below
renderTransactionList(transactions: Transaction[]): void
renderBalance(transactions: Transaction[]): void
renderChart(transactions: Transaction[]): void
```

#### Chart

Chart.js is instantiated once and stored in a module-level variable `chartInstance`. On every `renderChart()` call:
1. If `transactions` is empty, destroy `chartInstance` (if exists), show `#chart-placeholder`
2. Otherwise, compute category totals, call `chartInstance.data.datasets[0].data = [...]` and `chartInstance.update()`, or create a new instance if none exists

```js
// Chart.js configuration
{
  type: 'pie',
  data: {
    labels: ['Food', 'Transport', 'Fun'],
    datasets: [{
      data: [foodTotal, transportTotal, funTotal],
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' }
    }
  }
}
```

---

## Data Models

### Transaction

The core data unit. Each transaction is a plain JavaScript object:

```js
/**
 * @typedef {Object} Transaction
 * @property {string} id         - UUID generated at creation time (crypto.randomUUID())
 * @property {string} name       - Item name, 1–100 characters
 * @property {number} amount     - Positive number, 0.01–999999999.99
 * @property {string} category   - One of: 'Food' | 'Transport' | 'Fun'
 * @property {number} createdAt  - Unix timestamp (Date.now())
 */
```

### Serialized Storage Format

The `expense_transactions` localStorage key holds a JSON string representing an array of Transaction objects:

```json
[
  {
    "id": "a1b2c3d4-...",
    "name": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "createdAt": 1700000000000
  }
]
```

### In-Memory State

A single module-level variable holds all runtime state:

```js
let transactions = []; // Transaction[]
```

This array is the single source of truth. All renders read from it; all mutations write to it and then persist to localStorage before calling `renderAll()`.

### Category Configuration

```js
const CATEGORIES = ['Food', 'Transport', 'Fun'];
const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56'
};
const CURRENCY_SYMBOL = '$';
const STORAGE_KEY = 'expense_transactions';
const MAX_AMOUNT = 999999999.99;
const MAX_NAME_LENGTH = 100;
const DISPLAY_NAME_LIMIT = 50; // characters before truncation with ellipsis
```

### Formatting Rules

| Value | Rule | Example |
|---|---|---|
| Amount display | `toFixed(2)` preceded by `$` | `$12.50` |
| Negative balance | `-` precedes `$` | `-$12.50` |
| Long item name | Truncate at 50 chars, append `…` | `"This is a very long item na…"` |
| Balance label | `"Total Expenditure: $X.XX"` | `"Total Expenditure: $45.00"` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transaction addition grows the list by one

*For any* current list of transactions and any valid transaction input (non-empty name ≤ 100 chars, amount in [0.01, 999999999.99], valid category), calling the add function should result in the transaction list length increasing by exactly one, and the new transaction should be present in the list.

**Validates: Requirements 1.2**

---

### Property 2: Invalid form submissions are rejected without modifying state

*For any* form submission where at least one field is empty (item name, amount, or category), the transaction list should remain unchanged — no new transaction should be added, and the list length should be identical before and after the attempted submission.

**Validates: Requirements 1.3**

---

### Property 3: Invalid amount values are rejected

*For any* invalid amount value — zero, any negative number, any value greater than 999999999.99, or any non-numeric string — the validator should return an error message and the transaction list should remain unchanged.

**Validates: Requirements 1.4**

---

### Property 4: Successful transaction addition resets the form

*For any* valid transaction that is successfully added, all three input fields (item name, amount, category) should be empty/reset, and no validation error messages should be visible after the operation completes.

**Validates: Requirements 1.5**

---

### Property 5: Transaction name and amount are rendered correctly for all transactions

*For any* transaction in the list: if the item name is longer than 50 characters, the rendered display name should end with an ellipsis (`…`) and be no longer than 51 characters total; and the rendered amount should consist of exactly the currency symbol followed by the absolute value formatted to exactly two decimal places (with `-` prefix for negative).

**Validates: Requirements 2.1**

---

### Property 6: Deleting a transaction removes it from both the list and storage

*For any* non-empty list of transactions and any transaction in that list, after the delete operation: the transaction with that id should not be present in the in-memory list, and the serialized value stored at `expense_transactions` in localStorage should not contain an object with that id.

**Validates: Requirements 2.3, 5.4**

---

### Property 7: Storage serialization round-trip preserves all transaction data

*For any* array of valid Transaction objects, serializing to JSON via `JSON.stringify` and then deserializing via `JSON.parse` should produce an array where every transaction's `id`, `name`, `amount`, `category`, and `createdAt` fields are strictly equal to those of the original objects.

**Validates: Requirements 2.5, 5.1, 5.2**

---

### Property 8: Balance calculation equals the sum of all transaction amounts formatted to two decimal places

*For any* non-empty array of transactions, the displayed balance value (as a number extracted from the rendered string) should be equal to the arithmetic sum of all `amount` fields rounded to two decimal places, and the rendered string should begin with `$` (or `-$` for negative sums).

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 9: Negative total balance is displayed with the minus sign preceding the currency symbol

*For any* set of transactions whose amounts sum to a negative value, the rendered balance string should match the pattern `-$X.XX` — the minus sign must precede the `$` symbol, not follow it.

**Validates: Requirements 3.5**

---

### Property 10: Chart data segments are proportional to each category's share of total spending

*For any* non-empty array of transactions containing at least one category with a non-zero total, the data values passed to the chart for each category should be equal to that category's sum of amounts, and only categories with a non-zero total should have a segment value greater than zero.

**Validates: Requirements 4.1, 4.2**

---

### Property 11: Each category is assigned a unique color

*For any* rendering of the expense chart, all category color values in the `backgroundColor` array should be distinct strings — no two categories share the same color value.

**Validates: Requirements 4.6**

---

## Error Handling

All error conditions are handled at well-defined boundaries. The rest of the application code assumes clean data once the boundary has been passed.

### Storage Errors

| Scenario | Detection | Behavior |
|---|---|---|
| `localStorage.setItem` throws (quota exceeded, private mode) | `try/catch` around `setItem` | Show `#storage-error` banner, preserve form field values, do NOT add transaction to in-memory state |
| `localStorage.removeItem`/`setItem` throws on delete | `try/catch` in `removeFromStorage()` | Re-render list with original transaction retained, show error message in transaction list area |
| `localStorage.getItem` returns `null` (key absent) | `=== null` check | Initialize `transactions = []`, render empty state |
| `localStorage.getItem` returns invalid JSON | `try/catch` around `JSON.parse` | Initialize `transactions = []`, show load error message |
| Parsed value is not an array | `Array.isArray()` check | Initialize `transactions = []`, show load error message |
| Parsed array contains non-Transaction objects | Schema validation per item | Filter out invalid items, continue with valid items |

### Validation Errors

Validation errors are display-only — they never throw. Each validator returns a string error message or `null`:

```js
function validateName(value) {
  if (!value || value.trim().length === 0) return 'Item name is required.';
  if (value.trim().length > 100) return 'Item name must be 100 characters or fewer.';
  return null;
}

function validateAmount(value) {
  const num = parseFloat(value);
  if (value === '' || value === null || value === undefined) return 'Amount is required.';
  if (isNaN(num)) return 'Amount must be a number.';
  if (num <= 0) return 'Amount must be greater than zero.';
  if (num > 999999999.99) return 'Amount must not exceed 999,999,999.99.';
  return null;
}

function validateCategory(value) {
  if (!value || !CATEGORIES.includes(value)) return 'Please select a category.';
  return null;
}
```

Inline error messages are rendered in `<span class="field-error">` elements directly below each field. They are cleared on successful submit or when the user modifies the field.

### Chart Errors

If `transactions` is empty or all category totals are zero, the `<canvas>` element is hidden and `#chart-placeholder` is shown with a "No data to display" message. No Chart.js error handling is required beyond this guard.

---

## Testing Strategy

### Overview

This feature uses a dual approach:
- **Property-based tests** verify universal correctness properties across a wide input space (see Correctness Properties section)
- **Example-based unit tests** verify specific behaviors, edge cases, and error conditions

The property-based testing library for this project is **[fast-check](https://fast-check.dev/)** (JavaScript), run in the test environment via Node.js with a DOM simulation (jsdom). Each property test runs a minimum of **100 iterations**.

### Test File Organization

```
tests/
  unit/
    validator.test.js           -- Tests for validateName, validateAmount, validateCategory
    storage.test.js             -- Tests for loadFromStorage, saveToStorage, removeFromStorage
    renderer.test.js            -- Tests for formatting functions (name truncation, amount format)
    balance.test.js             -- Tests for balance calculation
    chart.test.js               -- Tests for chart data preparation (category totals, proportions)
  integration/
    form-submit.test.js         -- Full add-transaction flow (form → state → storage → render)
    delete.test.js              -- Full delete flow (click → state → storage → render)
    load.test.js                -- App initialization from storage states
  smoke/
    layout.md                   -- Manual checklist: cross-browser, responsive layout
```

### Property-Based Tests

Each property test is tagged with the corresponding design property using a comment.

```js
// Feature: expense-budget-visualizer, Property 1: Valid transaction addition grows the list by one
fc.assert(
  fc.property(
    fc.array(arbitraryTransaction()),
    arbitraryValidInput(),
    (existingList, newInput) => {
      const result = addTransaction(existingList, newInput);
      return result.length === existingList.length + 1
          && result.some(t => t.name === newInput.name.trim());
    }
  ),
  { numRuns: 100 }
);
```

| Property | Test File | fast-check Arbitraries |
|---|---|---|
| P1: Valid add grows list | form-submit.test.js | `fc.string(1,100)`, `fc.float({ min: 0.01, max: 999999999.99 })`, `fc.constantFrom(...CATEGORIES)` |
| P2: Invalid form rejected | validator.test.js | At least one of name/amount/category empty/invalid |
| P3: Invalid amount rejected | validator.test.js | `fc.oneof(fc.constant(0), fc.float({max: 0}), fc.float({min: 999999999.991}), fc.string())` |
| P4: Form reset on success | form-submit.test.js | Same as P1 |
| P5: Name/amount formatting | renderer.test.js | `fc.string()` for names, `fc.float()` for amounts |
| P6: Delete removes from list+storage | delete.test.js | `fc.array(arbitraryTransaction(), {minLength: 1})` |
| P7: Serialization round-trip | storage.test.js | `fc.array(arbitraryTransaction())` |
| P8: Balance calculation | balance.test.js | `fc.array(fc.float({min: 0.01, max: 999999999.99}), {minLength: 1})` |
| P9: Negative balance format | balance.test.js | `fc.array(fc.float({max: -0.01}))` |
| P10: Chart proportionality | chart.test.js | `fc.array(arbitraryTransaction(), {minLength: 1})` |
| P11: Unique category colors | chart.test.js | Static assertion on `CATEGORY_COLORS` object values |

### Example-Based Unit Tests

| Test | Description |
|---|---|
| Form renders three fields | Verifies `#item-name`, `#amount`, `#category` are present in DOM |
| Empty transaction list shows placeholder | `#transaction-list` shows empty-state message when no transactions |
| Empty chart shows placeholder | `#chart-placeholder` visible when no transactions |
| Storage unavailable on add | `localStorage.setItem` throws → storage error shown, fields preserved |
| Storage unavailable on delete | `localStorage.setItem` throws → transaction retained, error shown |
| Invalid JSON in storage | `JSON.parse` fails → app loads with empty state, error shown |
| Missing storage key | `localStorage.getItem` returns null → empty state, no error thrown |
| Single-category chart | Only one category has transactions → full single-segment chart |
| Zero balance display | No transactions → `$0.00` displayed |

### Smoke Tests (Manual)

The following are manual verification steps, documented in `tests/smoke/layout.md`:

1. Open `index.html` directly in Chrome, Firefox, Edge, and Safari — verify no console errors
2. At viewport width ≥ 768px: verify two-column layout (form left, list right)
3. At viewport width < 768px: verify single-column stacked layout
4. Add 15+ transactions: verify transaction list scrolls
5. Verify file structure: `index.html` references exactly `css/styles.css` and `js/app.js`
6. Verify Chart.js CDN loads and pie chart renders
7. Close and reopen the browser tab: verify transactions persist

### Test Runner Setup

```bash
# Install test dependencies (dev only — not shipped)
npm install --save-dev fast-check jest jest-environment-jsdom

# Run all unit and property tests
npx jest --testEnvironment jsdom

# Run a single test file
npx jest tests/unit/validator.test.js
```

> Note: The app itself has no npm dependency — `npm` is only used for running tests during development. The deployed artifact is three static files.
