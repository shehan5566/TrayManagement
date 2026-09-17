# Repository Guidelines & Locked Configuration Rules

## 1. Scope Containment
- Any code changes must be strictly limited to the specific files requested by the user. Do not modify unrelated files.

## 2. Locked Epson Dot-Matrix (5.5" x 8.0" Paper) Receipt, GRN & Transfer Print Format
The print CSS in `public/css/style.css` (`@media print`) and print layouts in `views/receipt.ejs`, `views/print-grn.ejs`, and `views/print-transfer.ejs` are LOCKED for Epson Dot-Matrix printers (5.5" x 8.0" continuous form paper):
- **Page Size**: `5.5in x 8.0in` portrait
- **Top Margin**: `0.85in` (clears pre-printed company letterhead)
- **Left Margin**: `-0.45in` (left-aligned for continuous form tractor)
- **Pre-printed Header**: `.receipt-logo-img` and `.receipt-title` must remain hidden in print
- **Title**: Document titles (`TRAY TRANSACTION RECEIPT`, `GOODS RECEIVED NOTE (GRN)`, `STOCK TRANSFER NOTE & GATE PASS`) displayed centered with dashed border
- **Font Stack**: `Consolas, 'Lucida Console', 'Courier New', monospace`
- **Font Weight**: `normal` (no bolding in print for crisp single-pass printing)
- **Font Style**: `normal` (no italics in print)
- **Signature Block**: `margin-top: 105px`, `font-size: 10.5pt`
- **Net Balance Box / Notes**: `font-size: 10.5pt`
- **Detail Lines**: `border-bottom: none` (no dotted lines under table detail rows in print)
- **Status Badges & Boxes**: `background: transparent`, `color: #000`, `border: 1px solid #000` (no dark background highlight ink blobs in print)

## 3. Locked 110mm Bluetooth Thermal Receipt Format (`views/print-thermal-receipt.ejs`)
The layout, ESC/POS byte sequence generation, and mobile preview in `views/print-thermal-receipt.ejs` are LOCKED for 110mm (4-inch / 112mm) Bluetooth Thermal Receipt Printers:
- **Paper & Printable Area**: 110mm roll width, 832 dots printable area (`1D 57 40 03`), left margin 0 (`1D 4C 00 00`), Font A (12x24 dots / ~69 characters per line width).
- **Centering & Margin Alignment**: Inner content width `innerWidth = 44` columns padded with `sideMargin = 12` spaces (`12 + 44 + 13 = ~69` columns), ensuring text is centered on the wide 110mm roll.
- **Font Stack & Text Formatting**: Standard Font A (`1B 4D 00`), normal text sizing (`1D 21 00`) except for highlighted Tray Quantity count (`1D 21 11` double width & height), standard line spacing (`1B 32`).
- **Signature Block Layout**:
  - 6 blank line feeds (`\n\n\n\n\n\n`) in ESC/POS and `margin-top: 65px` in HTML for ample physical signing room.
  - Dotted signature lines on top (`..........     ..........     ..........`).
  - Signer role titles directly underneath (`Created By     Checked By    Received By`).
- **Footer**: Centered `*** THANK YOU! ***` only. System application name ("Nelna Agri Smart Tray System") must remain removed from the receipt footer.
- **UI Controls**: Clean action bar containing only "‹ Back" and "Print" buttons. No temporary radio buttons, font-size selectors, or width toggles.
- **Mobile Card Preview**: Screen preview card (`.receipt-container`) styled with `max-width: 380px` for mobile app usability, keeping all transaction data fields fully visible.
- **Approved Transactions Receipt Format**:
  - `Remarks:` line must NEVER display system/approval phrases (`Approved by sales manager...`). Any such string must be filtered out so only genuine user remarks are shown.
  - Directly beneath the `Remarks:` line, a dedicated line `Approved By: Sales Manager` must be printed (in HTML: `.row` with `.val text-bold` and color `#15803d`; in ESC/POS: `formatLine("Approved By:", approverTitle)`).
  - This line is strictly reserved for approved transactions (`hasApproval` / `tx.approvedBy` / `tx.specialApprovalId`). It must never appear on regular non-approved transactions.

## 4. Locked Customer Balance Badges
The selected customer balance display beneath the customer search input is LOCKED in both desktop and mobile views:
- **Layout**: Single-row, 2-column grid (`display: grid; grid-template-columns: 1fr 1fr; gap: 8px;`) showing only:
  `[ Net Trays: X Trays ] [ Pending: Rs. Y ]`
- **Exclusions**: Redundant customer name and phone number must remain completely excluded from the badge.
- **Desktop Transactions (`views/transactions.ejs`)**:
  - Label font size: `10px` (`#64748b`, bold).
  - Value font size: `11px`, styled in Dark Green (`#166534`).
  - Container padding: `4px 8px`, `border-radius: 6px`.
  - Autocomplete dropdown suggestions must display customer name only (no phone number or balance badges).
- **Driver Mobile App (`views/driver-mobile.ejs`)**:
  - Label font size: `11.5px` (`#64748b`, bold).
  - Value font size: `13px`, styled in Red (`#dc2626`).
  - Container padding: `6px 10px`, `border-radius: 8px`.

## 5. Locked Approval Workflow & Modal Configuration
- **Approval Status Endpoint (`server.js` `/api/approvals/status/:id`)**: Must keep returning `status: 'PENDING'` while `transactionId` is not yet populated, preventing clients from receiving `undefined` transaction IDs during the creation window.
- **Receipt Print Preview Modal (`views/driver-mobile.ejs`)**: `.receipt-preview-overlay` must have `z-index: 99999` so it is never occluded by SweetAlert backdrops (`z-index: 1060`).
- **Database Persistence (`db.js`)**: `Transaction.create` must always persist `specialApprovalId` and `approvedBy` into the `TransactionModel`.

