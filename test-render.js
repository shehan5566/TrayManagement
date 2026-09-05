const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const transfer = {
    transferDocNo: 'TR-123',
    grnNo: 'GRN-123',
    dispatchedBy: 'Admin',
    dispatchedDate: new Date(),
    fromLocationName: 'Loc A',
    toLocationName: 'Loc B',
    dispatchedQty: 50,
    status: 'ACCEPTED',
    receivedQty: 50,
    variance: 0,
    vehicleNo: 'V-123',
    remarks: 'Test'
};

const templateStr = fs.readFileSync(path.join(__dirname, 'views', 'print-transfer.ejs'), 'utf-8');

try {
    // mock include function roughly by providing filename
    ejs.render(templateStr, { transfer, user: { role: 'admin' }, activePath: '/transfers' }, { filename: path.join(__dirname, 'views', 'print-transfer.ejs') });
    console.log("Render successful");
} catch (e) {
    console.error("Render failed:", e);
}
