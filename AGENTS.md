# Repository Guidelines & Locked Configuration Rules

## 1. Scope Containment
- Any code changes must be strictly limited to the specific files requested by the user. Do not modify unrelated files.

## 2. Locked Epson Dot-Matrix (5.5" x 8.0" Paper) Receipt Format
The print CSS in `public/css/style.css` (`@media print`) and print layout in `views/receipt.ejs` are LOCKED for Epson Dot-Matrix printers (5.5" x 8.0" continuous form paper):
- **Page Size**: `5.5in x 8.0in` portrait
- **Top Margin**: `0.85in` (clears pre-printed company letterhead)
- **Left Margin**: `-0.45in` (left-aligned for continuous form tractor)
- **Pre-printed Header**: `.receipt-logo-img` and `.receipt-title` must remain hidden in print
- **Title**: `TRAY TRANSACTION RECEIPT` and `STORE OPERATIONS LOG` displayed centered with dashed border
- **Font Stack**: `Consolas, 'Lucida Console', 'Courier New', monospace`
- **Font Weight**: `normal` (no bolding in print for crisp single-pass printing)
- **Font Style**: `normal` (no italics in print)
- **Signature Block**: `margin-top: 75px`, `font-size: 10.5pt`
- **Net Balance Box**: `font-size: 10.5pt`
