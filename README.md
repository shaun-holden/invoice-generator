# Invoice Generator

A fully client-side invoice generator built with plain HTML, CSS, and JavaScript — no frameworks, no installs, no server required.

---

## Getting Started

1. Open `index.html` in any modern browser
2. That's it — no install, no build step

To save as a PDF: click **⬇ Download PDF** and choose **"Save as PDF"** in the print dialog.

---

## Features

| Feature | How to use |
|---|---|
| **Inline editing** | Click any text on the invoice to edit it directly |
| **Logo upload** | Click the logo box in the top-left to upload an image |
| **Line items** | Click **+ Add Line Item** — Qty × Rate calculates Amount automatically |
| **Multiple tax lines** | Click **+ Add Tax Line** — add as many named taxes as you need (State Tax, VAT, etc.) |
| **Currency selector** | Pick a currency from the dropdown — all amounts update instantly |
| **Save invoice** | Click **💾 Save** — stored in your browser's localStorage |
| **Auto-load** | The last saved invoice loads automatically on page open |
| **New invoice** | Click **+ New Invoice** — increments the invoice number, clears client fields |
| **Auto-increment** | Invoice numbers count up automatically (001, 002, 003…) |
| **Dark mode** | Click **🌙 Dark** to toggle — preference is remembered |
| **PDF export** | Click **⬇ Download PDF** — dark mode is temporarily removed so PDFs are always clean |

---

## File Structure

```
InvoiceGenerator/
├── index.html   — Structure: all the HTML elements, IDs, and layout
├── style.css    — Appearance: colors, dark mode, print styles, animations
├── app.js       — Behavior: calculations, save/load, currency, dark mode
└── README.md    — This file
```

---

## Key Concepts Learned

### HTML
- `contenteditable="true"` — makes any element directly editable in the browser
- `data-placeholder` — custom attribute read by CSS to show placeholder text
- `id` attributes — used by JavaScript to find and update specific elements
- `<input type="file">` — triggers the OS file picker
- `class="no-print"` — hidden in the PDF via `@media print`

### CSS
- **CSS variables** (`--accent`, `--text`, etc.) — change one value to retheme everything
- **Dark mode** — override variables under `body.dark { }`, toggled by JavaScript
- `@media print` — rules that only apply when printing/saving as PDF
- `:empty::before` — shows placeholder text when a `contenteditable` field is empty
- `@keyframes` — defines a CSS animation (used for the toast fade)

### JavaScript
- `localStorage` — browser storage that persists between page refreshes
- `JSON.stringify` / `JSON.parse` — converts JS objects to/from text for storage
- `FileReader` API — reads a local file (like a logo image) into memory as base64
- `createElement` / `innerHTML` — builds and injects new HTML dynamically
- `dataset.amount` — HTML `data-*` attribute accessed via JavaScript
- `addEventListener('input', fn)` — fires on every keystroke in a contenteditable
- `classList.toggle('dark')` — adds the class if absent, removes it if present
- IIFE `(function() { ... })()` — runs immediately, keeps variables out of global scope
- Optional chaining `?.` — safely accesses nested properties that might not exist

---

## How Save / Load Works

```
Save clicked
  → collect all text fields by ID
  → collect line items (desc, qty, rate)
  → collect tax rows (label, rate)
  → collect logo (base64 string)
  → JSON.stringify → localStorage.setItem('invoice_data', ...)

Page opens
  → localStorage.getItem('invoice_data')
  → JSON.parse → restore all fields, rows, logo, currency
  → updateTotals() recalculates everything
```

---

## How Invoice Auto-Increment Works

```
localStorage stores 'lastInvoiceNum' (e.g. "3")
getNextInvoiceNum():
  → read: 3
  → add 1: 4
  → save: 4
  → return: "004"
```

"New Invoice" calls `getNextInvoiceNum()` so the number always moves forward, even across browser refreshes.

---

## Possible Next Steps

- [ ] Multiple saved invoices (save by name or date, show a list to load from)
- [ ] Export to JSON file (download a `.json` file instead of just localStorage)
- [ ] Invoice status tags (Draft, Sent, Paid)
- [ ] Discount line (fixed amount or percentage off subtotal)
- [ ] Custom accent color picker
- [ ] Client address book (save clients, pick from a dropdown)
