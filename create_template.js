const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'templates');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const data = [
    { Name: 'John Doe', Phone: '0712345678', Address: 'Colombo 7', InitialBalance: 50 },
    { Name: 'Jane Smith', Phone: '0779876543', Address: 'Kandy', InitialBalance: 0 }
];

const ws = xlsx.utils.json_to_sheet(data);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, "Customers");

const filePath = path.join(dir, 'Customer_Template.xlsx');
xlsx.writeFile(wb, filePath);
console.log('Template created at ' + filePath);
