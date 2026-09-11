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

