# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses by category, view a running balance, and visualize spending distribution via a pie chart. The app stores all data in the browser's Local Storage and requires no backend server. It is delivered as a single-page HTML/CSS/Vanilla JavaScript application that works in all modern browsers.

## Glossary

- **App**: The Expense & Budget Visualizer single-page web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Category**: One of the three predefined expense groupings: Food, Transport, or Fun.
- **Transaction_List**: The scrollable UI component that displays all saved transactions.
- **Balance_Display**: The UI element at the top of the page that shows the current total of all transaction amounts.
- **Chart**: The pie chart component that visualizes spending distribution by category.
- **Storage**: The browser's Local Storage API used to persist transaction data client-side.
- **Input_Form**: The UI form containing the Item Name, Amount, and Category fields used to create a new transaction.
- **Validator**: The client-side logic component responsible for validating Input_Form field values before submission.

---

## Requirements

### Requirement 1: Input Form

**User Story:** As a user, I want to enter expense details through a form, so that I can record my spending quickly and accurately.

#### Acceptance Criteria

1. THE App SHALL render an Input_Form containing three fields: Item Name (text input, maximum 100 characters), Amount (number input), and Category (select with options Food, Transport, Fun).
2. WHEN the user submits the Input_Form with all fields filled and a valid Amount between 0.01 and 999999999.99, THE App SHALL add a new Transaction to the Transaction_List and persist it to Storage.
3. IF the user submits the Input_Form with one or more empty fields, THEN THE Validator SHALL display an inline error message beneath each empty field identifying the missing field by name and prevent the Transaction from being saved.
4. IF the user enters a value of zero, a negative number, a number outside the range 0.01 to 999999999.99, or a non-numeric value in the Amount field, THEN THE Validator SHALL display an inline error message beneath the Amount field and prevent the Transaction from being saved.
5. WHEN a Transaction is successfully added, THE Input_Form SHALL clear all field values and remove any previously displayed validation error messages to prepare for the next entry.
6. IF Storage is unavailable when the user submits the Input_Form, THEN THE App SHALL display an error message indicating the Transaction could not be saved and preserve the current field values without clearing the form.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to view a list of all my recorded transactions, so that I can review and manage my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all persisted Transactions, each showing the item name (truncated with an ellipsis if it exceeds 50 characters), the amount formatted to exactly two decimal places preceded by the application's configured currency symbol, and the category.
2. WHILE the number of Transactions exceeds the visible height of the Transaction_List container, THE Transaction_List SHALL remain scrollable such that every Transaction entry can be reached by scrolling.
3. WHEN the user clicks the delete control on a Transaction entry, THE App SHALL remove that Transaction from both the Transaction_List and from Storage.
4. IF the Storage operation to remove a Transaction fails, THEN THE App SHALL retain that Transaction in the Transaction_List and display an error message indicating the deletion could not be completed.
5. WHEN the App loads in the browser, THE Transaction_List SHALL restore and display all Transactions previously saved to Storage.
6. IF Storage is unavailable or returns invalid data when the App loads, THEN THE Transaction_List SHALL display an error message indicating transactions could not be loaded and render as empty.
7. IF no Transactions have been recorded, THEN THE Transaction_List SHALL display a placeholder message indicating that no expenses have been added yet.

---

### Requirement 3: Total Balance

**User Story:** As a user, I want to see my total expenditure at the top of the page, so that I always have an up-to-date overview of how much I have spent.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all Transaction amounts formatted to exactly two decimal places preceded by the "$" currency symbol, alongside a label identifying it as the total expenditure.
2. WHEN a Transaction is added or deleted, THE Balance_Display SHALL update its displayed value within 100 milliseconds without requiring a page reload.
3. WHEN the App loads in the browser, THE Balance_Display SHALL reflect the sum of all Transactions restored from Storage.
4. IF no Transactions exist, THEN THE Balance_Display SHALL show a value of $0.00.
5. IF the sum of all Transaction amounts is negative, THEN THE Balance_Display SHALL display the value with a minus sign preceding the "$" currency symbol (e.g., -$12.50).

---

### Requirement 4: Visual Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can quickly understand where my money is going.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart where each Category with a non-zero total is represented as a segment proportional to that Category's share of the total spending across all Categories, and each segment SHALL display its Category name.
2. WHEN a Transaction is added or deleted, THE Chart SHALL re-render to reflect the updated category totals within 100 milliseconds without requiring a page reload.
3. WHEN the App loads in the browser, THE Chart SHALL render based on all Transactions restored from Storage.
4. IF only one Category contains Transactions, THEN THE Chart SHALL render a full single-segment chart for that Category.
5. IF no Transactions exist, THEN THE Chart SHALL display a placeholder message indicating there is no data to visualize.
6. THE Chart SHALL assign a unique, visually distinct color to each Category such that no two Category segments share the same color, and a legend SHALL be present identifying each Category by name and color.
7. IF Storage is unavailable or returns invalid data when the App loads, THEN THE Chart SHALL display a placeholder message indicating chart data could not be loaded.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my expense data to survive page refreshes, so that I do not lose my records when I close or reload the browser tab.

#### Acceptance Criteria

1. WHEN the App saves a Transaction, THE Storage SHALL serialize the full Transaction_List as a JSON string and write it to the Local Storage key `expense_transactions`.
2. WHEN the App loads, THE Storage SHALL read the value stored at key `expense_transactions`, deserialize it, and restore the Transaction_List.
3. IF the Local Storage key `expense_transactions` is absent, contains invalid JSON, or contains a value that is not an array of Transaction objects, THEN THE Storage SHALL initialize the Transaction_List as an empty array and render the App in a fully operational state with no transactions displayed.
4. WHEN the user deletes a Transaction, THE Storage SHALL update the value at key `expense_transactions` to reflect the removal.
5. WHEN the user edits a Transaction, THE Storage SHALL update the value at key `expense_transactions` to reflect the updated Transaction data.

---

### Requirement 6: Responsive Layout and Browser Compatibility

**User Story:** As a user, I want the app to be usable on different screen sizes and browsers, so that I can access it from any modern device.

#### Acceptance Criteria

1. THE App SHALL render all UI components without overlapping or clipped content and SHALL allow all interactive elements to be operable in the latest stable versions of Chrome, Firefox, Edge, and Safari.
2. WHILE the viewport width is 768px or greater, THE App SHALL display the Input_Form and the Transaction_List side-by-side in a two-column layout, with each column occupying no less than 30% of the viewport width.
3. WHILE the viewport width is less than 768px, THE App SHALL stack the Input_Form above the Transaction_List in a single-column layout occupying 100% of the viewport width.
4. THE App SHALL load from a single HTML file referencing one CSS file and one JavaScript file, with no server-side processing required.
