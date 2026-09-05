/**
* Migration: Import transactions from database.json into MongoDB 
* and assign sequential receipt numbers RE-000001, RE-000002, etc.
*/
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const TransactionSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    customerId: { type: String },
    customerName: { type: String },
    type: { type: String },
    count: { type: Number },
    depositPerTray: { type: Number, default: 2000 },
    expectedDeposit: { type: Number, default: 0 },
    totalDeposit: { type: Number, default: 0 },
    depositOption: { type: String, default: 'FULL' },
    vehicleNo: { type: String, default: 'N/A' },
    remarks: { type: String, default: '' },
    date: { type: String },
    user: { type: String, default: 'System' },
    receiptNo: { type: Number, default: 0 }
});

const TransactionModel = mongoose.model('Transaction', TransactionSchema);

async function migrate() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    // Check if transactions exist in MongoDB
    const existingCount = await TransactionModel.countDocuments();
    console.log(`Existing transactions in MongoDB: ${existingCount}`);

    if (existingCount === 0) {
        // Load from database.json
        const dbPath = path.join(__dirname, 'database.json');
        if (fs.existsSync(dbPath)) {
            const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            if (data.transactions && data.transactions.length > 0) {
                console.log(`Found ${data.transactions.length} transactions in database.json, importing...`);

                // Sort by date (oldest first)
                const sorted = data.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

                for (let i = 0; i < sorted.length; i++) {
                    const t = sorted[i];
                    const receiptNo = i + 1;
                    const doc = new TransactionModel({
                        _id: t.id || t._id,
                        customerId: t.customerId,
                        customerName: t.customerName,
                        type: t.type,
                        count: t.count,
                        depositPerTray: t.depositPerTray,
                        expectedDeposit: t.expectedDeposit,
                        totalDeposit: t.totalDeposit,
                        depositOption: t.depositOption,
                        vehicleNo: t.vehicleNo || 'N/A',
                        remarks: t.remarks || '',
                        date: t.date,
                        user: t.user || 'System',
                        receiptNo: receiptNo
                    });
                    await doc.save();
                    console.log(`  RE-${String(receiptNo).padStart(6, '0')} -> ${t.customerName} (${t.type}, ${t.count} trays)`);
                }
                console.log(`\nImported ${sorted.length} transactions with receipt numbers RE-000001 to RE-${String(sorted.length).padStart(6, '0')}`);
            }
        }
    } else {
        // Transactions exist — just assign receipt numbers to ones that don't have them
        const allTx = await TransactionModel.find().sort({ date: 1 }).lean();
        console.log(`Found ${allTx.length} transactions, assigning receipt numbers...`);

        for (let i = 0; i < allTx.length; i++) {
            const receiptNo = i + 1;
            await TransactionModel.updateOne(
                { _id: allTx[i]._id },
                { $set: { receiptNo: receiptNo } }
            );
            console.log(`  RE-${String(receiptNo).padStart(6, '0')} -> ${allTx[i].customerName}`);
        }
        console.log(`\nAssigned receipt numbers RE-000001 to RE-${String(allTx.length).padStart(6, '0')}`);
    }

    await mongoose.disconnect();
    console.log('Done!');
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
