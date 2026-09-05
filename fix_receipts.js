const mongoose = require('mongoose');
require('dotenv').config();

const T = mongoose.model('Transaction', new mongoose.Schema({
    _id: String,
    receiptNo: Number,
    customerName: String,
    date: String
}));

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    // Fix any transactions with missing receiptNo
    // Get all transactions sorted by date
    const all = await T.find({}).sort({ date: 1 }).lean();
    console.log('Total transactions:', all.length);
    
    // Reassign ALL receipt numbers sequentially by date order
    for (let i = 0; i < all.length; i++) {
        const receiptNo = i + 1;
        await T.updateOne({ _id: all[i]._id }, { receiptNo: receiptNo });
        console.log(`  RE-${String(receiptNo).padStart(6, '0')} | ${all[i].customerName} | ID: ${all[i]._id} | old receiptNo: ${all[i].receiptNo}`);
    }
    
    console.log('\nAll receipt numbers fixed!');
    await mongoose.disconnect();
});
