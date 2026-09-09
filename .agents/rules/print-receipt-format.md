# Strict Rules for Print Receipt Template & File Editing

## 1. File Modification Scoping
- All code modifications MUST be strictly isolated to the exact target files requested.
- Never make unrequested edits or refactors to unrelated modules or CSS files.

## 2. Locked Epson Dot-Matrix (5.5" x 8.0" Paper) Receipt, GRN & Transfer Specification
DO NOT modify or override the following `@media print` rules in `public/css/style.css` or layout elements in `views/receipt.ejs`, `views/print-grn.ejs`, and `views/print-transfer.ejs`:

- **Paper Size & Margins**:
  - `@page { size: 5.5in 8.0in portrait; margin: 0.15in 0in 0.15in 0in; }`
- **Receipt Card Alignment**:
  - Top Offset: `margin: 0.85in auto 0 -0.45in !important;` (aligns below pre-printed letterhead).
  - Left Offset: `-0.45in` (aligns with continuous tractor left margin).
- **Header Elements**:
  - Hide `.receipt-logo-img` and `.receipt-title` (`display: none !important;`) because paper is pre-printed.
  - Show `.receipt-doc-title` ("TRAY TRANSACTION RECEIPT") and `.receipt-subtitle` ("STORE OPERATIONS LOG") with a `1px dashed #000` bottom border.
- **Typography & Font Weight**:
  - Font Family: `Consolas, 'Lucida Console', 'Courier New', monospace, sans-serif !important;`
  - Font Weight: `font-weight: normal !important;` across all print elements (single-pass crisp printing).
  - Font Style: `font-style: normal !important;` (no italics in print).
- **Signature Block**:
  - `margin-top: 75px !important;` and `font-size: 10.5pt !important;`.
- **Net Tray Balance Box & Verification Notes**:
  - `font-size: 10.5pt !important;`.
- **Detail Lines**:
  - `border-bottom: none !important;` (no dotted lines under table detail rows in print).
- **Status Badges & Boxes**:
  - `background: transparent !important; color: #000000 !important; border: 1px solid #000000 !important;` (no dark background highlight ink blobs in print).
