const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'templates');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const sampleData = [
    {
        'Phone': '0771234567',
        'Customer Name': 'Ruwan Agri Farm',
        'Type': 'OUT',
        'Quantity': 50,
        'Date': '2026-09-11 09:30',
        'Vehicle No': 'LK-3945',
        'Deposit Amount': 100000,
        'Remarks': 'Regular morning issue'
    },
    {
        'Phone': '0719876543',
        'Customer Name': 'Kamal Stores',
        'Type': 'IN',
        'Quantity': 30,
        'Date': '2026-09-11 14:15',
        'Vehicle No': 'LN-4124',
        'Deposit Amount': 60000,
        'Remarks': 'Return from market'
    }
];

const ws = xlsx.utils.json_to_sheet(sampleData);

// Set column widths for readability
ws['!cols'] = [
    { wch: 15 }, // Phone
    { wch: 25 }, // Customer Name
    { wch: 10 }, // Type
    { wch: 12 }, // Quantity
    { wch: 20 }, // Date
    { wch: 15 }, // Vehicle No
    { wch: 18 }, // Deposit Amount
    { wch: 30 }  // Remarks
];

const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, "Transactions");

const filePath = path.join(dir, 'Transaction_Template.xlsx');
xlsx.writeFile(wb, filePath);
console.log('Transaction template created successfully at ' + filePath);
