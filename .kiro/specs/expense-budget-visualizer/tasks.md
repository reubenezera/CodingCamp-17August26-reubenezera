# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a zero-dependency, client-side single-page application using HTML, CSS, and Vanilla JavaScript. The implementation is broken into discrete steps that build on each other — from static structure and styling, through application logic, to wiring everything together. All data persists in browser Local Storage. Chart.js is loaded from CDN.

## Tasks

- [x] 1. Create the HTML structure (`index.html`)
  - Create `index.html` at the workspace root with the full semantic markup
  - Include `<header>` with `#balance-display`, `<main class="app-grid">` containing `.form-section` (with `#expense-form` and three field groups including inline `<span class="field-error">` elements and `#storage-error` div) and `.list-section` (with `#transaction-list`), and a `<section class="chart-section">` containing `#chart-container` with `<canvas id="expense-chart">` and `#chart-placeholder`
  - Add `<select id="category">` with a default blank option and options for Food, Transport, Fun
  - Link `css/styles.css` in `<head>` and load Chart.js CDN (`https://cdn.jsdelivr.net/npm/chart.js`) then `js/app.js` at the bottom of `<body>`
  - _Requirements: 1.1, 2.7, 3.1, 4.5, 6.4_

- [x] 2. Implement base CSS layout and styling (`css/styles.css`)
  - [x] 2.1 Implement responsive two-column and single-column layout
    - Use CSS Grid or Flexbox on `.app-grid` to produce a two-column layout (form left, list right, each ≥ 30% viewport width) at `min-width: 768px`
    - Add a `@media (max-width: 767px)` breakpoint that stacks `.form-section` above `.list-section` in a single column at 100% width
    - _Requirements: 6.2, 6.3_
  - [x] 2.2 Style all UI components
    - Style `#balance-display`, `#expense-form` field groups (label, input, select, error spans), the submit button, `#transaction-list` (with `overflow-y: auto` and a fixed max-height), individual transaction entries and their delete controls, `#chart-container`, `#chart-placeholder`, and `.storage-error`
    - Apply `hidden` utility class (`display: none`) used by JavaScript to show/hide placeholder and error elements
    - _Requirements: 1.1, 2.2, 4.5, 4.6, 6.1_

- [x] 3. Implement Config block and State initialization (`js/app.js`)
  - Define all constants at the top of `app.js`: `STORAGE_KEY = 'expense_transactions'`, `CATEGORIES`, `CATEGORY_COLORS` (`{ Food: '#FF6384', Transport: '#36A2EB', Fun: '#FFCE56' }`), `CURRENCY_SYMBOL = '$'`, `MAX_AMOUNT = 999999999.99`, `MAX_NAME_LENGTH = 100`, `DISPLAY_NAME_LIMIT = 50`
  - Declare `let transactions = [];` and `let chartInstance = null;` as module-level state
  - _Requirements: 1.1, 4.6, 5.1_

- [x] 4. Implement the StorageManager block (`js/app.js`)
  - [x] 4.1 Implement `loadFromStorage()`
    - Read `localStorage.getItem(STORAGE_KEY)`; if `null`, return `[]`
    - Wrap `JSON.parse` in `try/catch`; if parse fails or result is not an array, return `[]` and set a load-error flag
    - Filter out any array items that are missing required Transaction fields (`id`, `name`, `amount`, `category`, `createdAt`)
    - _Requirements: 5.2, 5.3, 2.5, 2.6_
  - [x] 4.2 Implement `saveToStorage(transactions)`
    - Wrap `localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))` in `try/catch`
    - On catch, throw a custom `StorageError` so callers can display the appropriate error message
    - _Requirements: 5.1, 1.6_
  - [x] 4.3 Implement `removeFromStorage(id, transactions)`
    - Filter the array to exclude the transaction with the given `id`, then call `saveToStorage()` with the filtered array
    - On `StorageError`, re-throw so the event handler can retain the transaction and show an error
    - _Requirements: 5.4, 2.3, 2.4_

- [x] 5. Implement the Validator block (`js/app.js`)
  - [x] 5.1 Implement `validateName(value)`, `validateAmount(value)`, `validateCategory(value)`
    - `validateName`: return `'Item name is required.'` if empty/whitespace; `'Item name must be 100 characters or fewer.'` if > 100 chars; else `null`
    - `validateAmount`: return `'Amount is required.'` if blank; `'Amount must be a number.'` if `isNaN`; `'Amount must be greater than zero.'` if ≤ 0; `'Amount must not exceed 999,999,999.99.'` if > `MAX_AMOUNT`; else `null`
    - `validateCategory`: return `'Please select a category.'` if value is empty or not in `CATEGORIES`; else `null`
    - All three are pure functions with no side effects
    - _Requirements: 1.3, 1.4_
  

- [x] 6. Implement the Renderer block (`js/app.js`)
  - [x] 6.1 Implement `renderBalance(transactions)`
    - Sum all `transaction.amount` values; format with `toFixed(2)`
    - Render as `$X.XX` for zero/positive, `-$X.XX` for negative sums
    - Update `#balance-display` inner text with label `"Total Expenditure: $X.XX"` (or `-$...`)
    - _Requirements: 3.1, 3.4, 3.5_
 
  - [x] 6.3 Implement `renderTransactionList(transactions)`
    - If `transactions` is empty, show a placeholder message ("No expenses added yet.") inside `#transaction-list`
    - For each transaction, create a row element showing: item name (truncated with `…` at 50 chars if needed), amount formatted as `$X.XX`, category, and a delete button with `data-id` set to the transaction's `id`
    - Fully replace the contents of `#transaction-list` on each call
    - _Requirements: 2.1, 2.2, 2.7_

  - [x] 6.5 Implement `renderChart(transactions)`
    - Compute per-category totals by summing amounts for each of `CATEGORIES`
    - If all totals are zero / `transactions` is empty: destroy `chartInstance` if it exists, hide `<canvas>`, show `#chart-placeholder` with "No data to visualize."
    - Otherwise: hide `#chart-placeholder`, show `<canvas>`, create or update `chartInstance` using the Chart.js pie config (labels, data, `backgroundColor` from `CATEGORY_COLORS`, legend at `bottom`)
    - _Requirements: 4.1, 4.4, 4.5, 4.6_

  - [x] 6.7 Implement `renderAll(transactions)`
    - Call `renderTransactionList(transactions)`, `renderBalance(transactions)`, `renderChart(transactions)` in sequence
    - _Requirements: 3.2, 4.2_

- [x] 7. Checkpoint — verify rendering pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Event Handlers block (`js/app.js`)
  - [x] 8.1 Implement `handleFormSubmit(event)`
    - Prevent default form submission
    - Read values from `#item-name`, `#amount`, `#category`
    - Run all three validators; display inline error messages in the corresponding `<span class="field-error">` elements; if any error exists, stop and return
    - Build a new Transaction object: `{ id: crypto.randomUUID(), name: trimmed value, amount: parseFloat(amount), category, createdAt: Date.now() }`
    - Call `saveToStorage([...transactions, newTransaction])`; on `StorageError`, show `#storage-error` and return without mutating `transactions`
    - On success: push to `transactions`, call `renderAll(transactions)`, reset the form and clear all error spans, hide `#storage-error`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 5.1_

  - [x] 8.3 Implement `handleDelete(event)`
    - Use event delegation on `#transaction-list`; only act when `event.target` matches a delete button (check `data-id`)
    - Call `removeFromStorage(id, transactions)`; on `StorageError`, re-render list unchanged and show an error message in the list area, then return
    - On success: update `transactions` by filtering out the deleted id, call `renderAll(transactions)`
    - _Requirements: 2.3, 2.4, 5.4_


- [x] 9. Implement Storage round-trip and Init block (`js/app.js`)
  - [x] 9.1 Implement `init()`
    - Call `loadFromStorage()` and assign result to `transactions`
    - If load produced an error (invalid JSON or non-array), display the load error message in `#transaction-list` and `#chart-placeholder`
    - Call `renderAll(transactions)` to paint the initial UI state
    - Attach `handleFormSubmit` to `#expense-form`'s `submit` event
    - Attach `handleDelete` to `#transaction-list`'s `click` event (delegation)
    - Register `init` on `DOMContentLoaded`
    - _Requirements: 2.5, 2.6, 3.3, 4.3, 4.7, 5.2, 5.3_


- [x] 10. Final checkpoint — verify full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design document specifies **fast-check** as the property-based testing library with **jest + jest-environment-jsdom** as the runner — see design.md Testing Strategy for setup commands
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical breaks
- The app has no npm runtime dependency — `npm` is only needed if running tests; the deployed artifact is `index.html`, `css/styles.css`, and `js/app.js`
- `crypto.randomUUID()` is available in all modern browsers (Chrome 92+, Firefox 95+, Edge 92+, Safari 15.4+)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3"] },
    { "id": 2, "tasks": ["4.1", "4.2", "4.3", "5.1"] },
    { "id": 3, "tasks": ["5.2", "6.1", "6.3", "6.5"] },
    { "id": 4, "tasks": ["6.2", "6.4", "6.6", "6.7"] },
    { "id": 5, "tasks": ["8.1", "8.3", "9.1"] },
    { "id": 6, "tasks": ["8.2", "8.4", "9.2"] }
  ]
}
```
