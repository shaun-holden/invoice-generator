// ══════════════════════════════════════════════════════
// app.js — Invoice Generator (full feature version)
// Sections:
//   1. Constants & State
//   2. Date Helpers
//   3. Money Formatting
//   4. Toast Notification
//   5. Invoice Number Auto-Increment
//   6. Logo Upload
//   7. Currency Selector
//   8. Line Items
//   9. Tax Rows (multiple)
//  10. Totals Calculation
//  11. Dark Mode
//  12. Save / Load / New Invoice
//  13. Print
//  14. Initialization
// ══════════════════════════════════════════════════════


// ──────────────────────────────────────────────────────
// 1. CONSTANTS & STATE
// ──────────────────────────────────────────────────────

/*
  CURRENCIES maps the <select> option values to their symbols.
  When the user picks "EUR", currentSymbol becomes "€".
*/
const CURRENCIES = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
};

/*
  FIELD_IDS lists every element id whose text content we
  want to save to localStorage and restore on load.
*/
const FIELD_IDS = [
  'businessName', 'businessAddress', 'businessPhone',
  'clientName',   'clientAddress',   'clientEmail',
  'invoiceNum',   'invoiceDate',     'dueDate',
  'invoiceNotes',
];

// currentSymbol is updated whenever the user changes the currency.
// All money formatting goes through formatMoney() which uses this.
let currentSymbol = '$';

// logoBase64 holds the uploaded image as a data URL string (or null).
// We store it here so it can be included in the saved invoice JSON.
let logoBase64 = null;


// ──────────────────────────────────────────────────────
// 2. DATE HELPERS
// ──────────────────────────────────────────────────────

function formatDate(date) {
  // toLocaleDateString formats a Date object into a readable string.
  // 'en-US' + these options → "February 26, 2026"
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function setDefaultDates() {
  const today = new Date();
  const due   = new Date(today);
  due.setDate(today.getDate() + 30); // 30-day payment terms

  document.getElementById('invoiceDate').textContent = formatDate(today);
  document.getElementById('dueDate').textContent     = formatDate(due);
}


// ──────────────────────────────────────────────────────
// 3. MONEY FORMATTING
// ──────────────────────────────────────────────────────

/*
  formatMoney is the single place where we turn a number into
  a display string. By routing all amounts through here, changing
  the currency symbol instantly affects every displayed value.

  Example: formatMoney(1234.5) → "$1234.50"  (or "€1234.50")
*/
function formatMoney(amount) {
  return currentSymbol + amount.toFixed(2);
}


// ──────────────────────────────────────────────────────
// 4. TOAST NOTIFICATION
// ──────────────────────────────────────────────────────

/*
  showToast creates a temporary <div>, appends it to the body,
  and removes it after 2.5 seconds. CSS handles the fade animation.
  This is a common UX pattern for non-blocking feedback.
*/
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}


// ──────────────────────────────────────────────────────
// 5. INVOICE NUMBER AUTO-INCREMENT
// ──────────────────────────────────────────────────────

/*
  localStorage persists data between page refreshes (unlike variables).
  We store the last-used number under the key 'lastInvoiceNum'.

  padStart(3, '0') left-pads the number with zeros to 3 digits:
    1  → "001"
    12 → "012"
   123 → "123"
*/
function getNextInvoiceNum() {
  const last = parseInt(localStorage.getItem('lastInvoiceNum') || '0');
  const next = last + 1;
  localStorage.setItem('lastInvoiceNum', next);
  return String(next).padStart(3, '0');
}


// ──────────────────────────────────────────────────────
// 6. LOGO UPLOAD
// ──────────────────────────────────────────────────────

const logoInput       = document.getElementById('logoInput');
const logoPlaceholder = document.getElementById('logoPlaceholder');
const logoImg         = document.getElementById('logoImg');
const logoText        = document.getElementById('logoText');

/*
  showLogo / clearLogo toggle between the placeholder text and
  the actual image without replacing innerHTML (which would
  destroy the file input and its event listener).
*/
function showLogo(src) {
  logoImg.src             = src;
  logoImg.style.display   = 'block';
  logoText.style.display  = 'none';
}

function clearLogo() {
  logoBase64              = null;
  logoImg.src             = '';
  logoImg.style.display   = 'none';
  logoText.style.display  = 'block';
}

/*
  FileReader API: reads a local file into memory as a base64 string.
  Steps:
    1. User picks a file → 'change' event fires
    2. We create a FileReader and call readAsDataURL(file)
    3. When reading is complete, reader.onload fires
    4. e.target.result is the base64 data URL (e.g. "data:image/png;base64,...")
    5. We save it to logoBase64 and display it
*/
logoInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    logoBase64 = e.target.result;
    showLogo(logoBase64);
  };
  reader.readAsDataURL(file);
});


// ──────────────────────────────────────────────────────
// 7. CURRENCY SELECTOR
// ──────────────────────────────────────────────────────

const currencySelect = document.getElementById('currencySelect');

currencySelect.addEventListener('change', () => {
  // Look up the symbol for the newly selected currency
  currentSymbol = CURRENCIES[currencySelect.value] || '$';

  // Update the table header (e.g. "Rate ($)" → "Rate (€)")
  document.getElementById('rateHeader').textContent =
    `Rate (${currentSymbol})`;

  /*
    Re-trigger the 'input' event on each row's qty field.
    This causes updateRow() to run for every line item,
    which calls formatMoney() with the new symbol and
    then calls updateTotals() to refresh the totals section.
  */
  document.querySelectorAll('#itemsBody tr').forEach(tr => {
    tr.querySelector('.qty').dispatchEvent(new Event('input'));
  });

  updateTotals();
});


// ──────────────────────────────────────────────────────
// 8. LINE ITEMS
// ──────────────────────────────────────────────────────

const itemsBody = document.getElementById('itemsBody');

/*
  createRow builds one table row and wires up its logic.
  Parameters let us pre-fill values when loading saved data.

  Key concepts:
  - createElement / innerHTML: build DOM nodes
  - .desc / .qty / .rate classes: identify the editable cells
  - data-amount attribute: stores the raw number so updateTotals
    can sum amounts without re-parsing the formatted string
*/
function createRow(descHTML = '', qtyText = '1', rateText = '0.00') {
  const tr = document.createElement('tr');

  tr.innerHTML = `
    <td>
      <div class="editable desc" contenteditable="true"
           data-placeholder="Item description">${descHTML}</div>
    </td>
    <td>
      <div class="editable qty" contenteditable="true"
           data-placeholder="1">${qtyText}</div>
    </td>
    <td>
      <div class="editable rate" contenteditable="true"
           data-placeholder="0.00">${rateText}</div>
    </td>
    <td class="amount-cell" data-amount="0">$0.00</td>
    <td class="no-print">
      <button class="del-btn" title="Remove row">✕</button>
    </td>
  `;

  const qty        = tr.querySelector('.qty');
  const rate       = tr.querySelector('.rate');
  const amountCell = tr.querySelector('.amount-cell');

  function updateRow() {
    const q = parseFloat(qty.textContent)  || 0;
    const r = parseFloat(rate.textContent) || 0;
    const amount = q * r;

    // Store the raw number as a data attribute for summing later
    amountCell.dataset.amount  = amount;
    // Display the formatted string using the current currency symbol
    amountCell.textContent     = formatMoney(amount);

    updateTotals();
  }

  // 'input' fires on every keystroke inside a contenteditable element
  qty.addEventListener('input',  updateRow);
  rate.addEventListener('input', updateRow);

  // Initialize the amount cell immediately (important when loading saved data)
  updateRow();

  tr.querySelector('.del-btn').addEventListener('click', () => {
    tr.remove();
    updateTotals();
  });

  return tr;
}

// Add one starter row on page load
itemsBody.appendChild(createRow());

document.getElementById('addItemBtn').addEventListener('click', () => {
  itemsBody.appendChild(createRow());
});


// ──────────────────────────────────────────────────────
// 9. TAX ROWS (multiple tax lines)
// ──────────────────────────────────────────────────────

const taxesContainer = document.getElementById('taxesContainer');

/*
  createTaxRow builds one dynamic tax line.
  Each row has:
    - An editable label (e.g. "State Tax", "VAT")
    - An editable rate percentage
    - A calculated amount (updated by updateTotals)
    - A delete button

  The rate is read by updateTotals to calculate tax on the subtotal.
*/
function createTaxRow(label = 'Tax', rate = '0') {
  const div = document.createElement('div');
  div.className = 'totals-row tax-row';

  div.innerHTML = `
    <span class="tax-label-group">
      <span class="editable tax-label" contenteditable="true">${label}</span>
      (<span class="editable tax-rate-input" contenteditable="true">${rate}</span>%)
      <button class="del-tax-btn no-print" title="Remove tax">✕</button>
    </span>
    <span class="tax-amount-display">$0.00</span>
  `;

  // Any change to the rate % triggers a full recalculation
  div.querySelector('.tax-rate-input').addEventListener('input', updateTotals);

  div.querySelector('.del-tax-btn').addEventListener('click', () => {
    div.remove();
    updateTotals();
  });

  return div;
}

document.getElementById('addTaxBtn').addEventListener('click', () => {
  taxesContainer.appendChild(createTaxRow());
  updateTotals();
});


// ──────────────────────────────────────────────────────
// 10. TOTALS CALCULATION
// ──────────────────────────────────────────────────────

/*
  updateTotals is called whenever anything changes:
  line items, tax rates, or currency.

  Flow:
    1. Sum data-amount from every .amount-cell  → subtotal
    2. For each .tax-row: calculate (subtotal × rate%) → update its display
    3. Sum all taxes → total = subtotal + totalTax
    4. Update #subtotal and #totalDue
*/
function updateTotals() {
  // Step 1: subtotal
  let subtotal = 0;
  document.querySelectorAll('#itemsBody .amount-cell').forEach(cell => {
    // dataset.amount stores the raw number we set in updateRow()
    subtotal += parseFloat(cell.dataset.amount) || 0;
  });

  // Step 2 & 3: taxes
  let totalTax = 0;
  document.querySelectorAll('.tax-row').forEach(row => {
    const rate   = parseFloat(row.querySelector('.tax-rate-input').textContent) || 0;
    const taxAmt = subtotal * (rate / 100);
    row.querySelector('.tax-amount-display').textContent = formatMoney(taxAmt);
    totalTax += taxAmt;
  });

  // Step 4: display
  document.getElementById('subtotal').textContent = formatMoney(subtotal);
  document.getElementById('totalDue').textContent = formatMoney(subtotal + totalTax);
}


// ──────────────────────────────────────────────────────
// 11. DARK MODE
// ──────────────────────────────────────────────────────

/*
  classList.toggle(className) adds the class if absent, removes it if present.
  We store the preference in localStorage so it survives page refresh.
  Note: dark mode preference is saved separately from invoice data — that way
  toggling dark mode doesn't require re-saving the invoice.
*/
const darkBtn = document.getElementById('darkModeBtn');

darkBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  darkBtn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
  localStorage.setItem('darkMode', isDark ? '1' : '0');
});


// ──────────────────────────────────────────────────────
// 12. SAVE / LOAD / NEW INVOICE
// ──────────────────────────────────────────────────────

/*
  SAVE: Collects all invoice data into a plain JS object,
  converts it to a JSON string, and stores it in localStorage.

  JSON.stringify(object) → text string  (for storage)
  JSON.parse(text)       → JS object    (to restore)
*/
function saveInvoice() {
  const data = {
    version:  1,               // future-proofing: lets us handle format changes
    currency: currencySelect.value,
    logo:     logoBase64,      // null, or "data:image/png;base64,..."
    fields:   {},
    items:    [],
    taxes:    [],
  };

  // Collect all named editable fields
  FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    // innerHTML preserves any formatting the user may have typed
    if (el) data.fields[id] = el.innerHTML;
  });

  // Collect line item data (description, qty, rate — amount is derived)
  document.querySelectorAll('#itemsBody tr').forEach(tr => {
    data.items.push({
      desc: tr.querySelector('.desc').innerHTML,
      qty:  tr.querySelector('.qty').textContent.trim(),
      rate: tr.querySelector('.rate').textContent.trim(),
    });
  });

  // Collect tax row data (label and rate — amount is derived)
  document.querySelectorAll('.tax-row').forEach(row => {
    data.taxes.push({
      label: row.querySelector('.tax-label').textContent.trim(),
      rate:  row.querySelector('.tax-rate-input').textContent.trim(),
    });
  });

  localStorage.setItem('invoice_data', JSON.stringify(data));
  showToast('Invoice saved!');
}

/*
  LOAD: Reads the stored JSON and restores every part of the invoice.
  Returns true if data was found and restored, false if nothing was saved.
*/
function loadInvoice() {
  const raw = localStorage.getItem('invoice_data');
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);

    // Restore currency
    if (data.currency && CURRENCIES[data.currency]) {
      currencySelect.value = data.currency;
      currentSymbol = CURRENCIES[data.currency];
      document.getElementById('rateHeader').textContent =
        `Rate (${currentSymbol})`;
    }

    // Restore logo
    if (data.logo) {
      logoBase64 = data.logo;
      showLogo(data.logo);
    }

    // Restore all text fields
    // The ?. (optional chaining) safely handles missing keys
    FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el && data.fields?.[id] !== undefined) {
        el.innerHTML = data.fields[id];
      }
    });

    // Restore line items — clear existing rows first
    itemsBody.innerHTML = '';
    (data.items || []).forEach(item => {
      itemsBody.appendChild(createRow(item.desc, item.qty, item.rate));
    });
    // Always keep at least one row
    if (itemsBody.children.length === 0) itemsBody.appendChild(createRow());

    // Restore tax rows
    taxesContainer.innerHTML = '';
    (data.taxes || []).forEach(tax => {
      taxesContainer.appendChild(createTaxRow(tax.label, tax.rate));
    });

    updateTotals();
    return true;

  } catch (err) {
    // JSON.parse can throw if the stored data is corrupted.
    // We log the error but don't crash — just start fresh.
    console.error('Could not load saved invoice:', err);
    return false;
  }
}

/*
  RESET: Clears client-specific data and starts a fresh invoice.
  Business info (name, address, logo) is preserved — it's the same
  business every time. Client info, line items, and taxes are cleared.
*/
function resetInvoice() {
  if (!confirm('Start a new invoice? Unsaved changes will be lost.')) return;

  // Clear client fields (empty string shows the CSS placeholder)
  document.getElementById('clientName').textContent    = '';
  document.getElementById('clientAddress').textContent = '';
  document.getElementById('clientEmail').textContent   = '';

  // Fresh dates and a new auto-incremented invoice number
  setDefaultDates();
  document.getElementById('invoiceNum').textContent = getNextInvoiceNum();

  // Reset notes to default
  document.getElementById('invoiceNotes').textContent =
    'Payment due within 30 days. Thank you for your business!';

  // One blank line item
  itemsBody.innerHTML = '';
  itemsBody.appendChild(createRow());

  // No taxes
  taxesContainer.innerHTML = '';

  updateTotals();
  showToast('New invoice started!');
}

document.getElementById('saveBtn').addEventListener('click', saveInvoice);
document.getElementById('newInvoiceBtn').addEventListener('click', resetInvoice);


// ──────────────────────────────────────────────────────
// 13. PRINT / SAVE AS PDF
// ──────────────────────────────────────────────────────

/*
  Before printing, we temporarily remove the dark mode class.
  This ensures the PDF always comes out with a clean white background
  regardless of which theme the user has selected.
  window.print() is synchronous — it blocks until the print dialog
  is closed — so we can safely re-add the class right after.
*/
document.getElementById('printBtn').addEventListener('click', () => {
  const wasDark = document.body.classList.contains('dark');
  if (wasDark) document.body.classList.remove('dark');

  window.print();

  if (wasDark) document.body.classList.add('dark');
});


// ──────────────────────────────────────────────────────
// 14. INITIALIZATION
// ──────────────────────────────────────────────────────

/*
  IIFE = Immediately Invoked Function Expression.
  Syntax: (function() { ... })()
  It runs instantly when the script loads and keeps its
  local variables private (not polluting the global scope).

  On startup:
    1. Try to restore a previously saved invoice
    2. If none exists, set up a brand-new invoice with today's dates
       and the next sequential invoice number
    3. Always restore the dark mode preference (stored separately)
*/
(function init() {
  const loaded = loadInvoice();

  if (!loaded) {
    setDefaultDates();
    document.getElementById('invoiceNum').textContent = getNextInvoiceNum();
    updateTotals();
  }

  // Restore dark mode preference independently of invoice data
  if (localStorage.getItem('darkMode') === '1') {
    document.body.classList.add('dark');
    darkBtn.textContent = '☀️ Light';
  }
})();
