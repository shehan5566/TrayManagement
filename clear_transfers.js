const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri).then(async () => {
    console.log('Connected to DB. Clearing StockTransfers...');
    const db = mongoose.connection.db;
    
    // Clear StockTransfers
    await db.collection('stocktransfers').deleteMany({});
    console.log('Cleared all Stock Transfers.');
    
    // Reset sequence counters for TFR and GRN
    await db.collection('counters').deleteMany({ _id: { $regex: /TFR|GRN/ } });
    console.log('Cleared related Counters.');

    mongoose.disconnect();
    console.log('Done.');
}).catch(err => {
    console.error(err);
});
