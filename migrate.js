const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const { UserModel, CustomerModel, TransactionModel } = require('./db');

const DB_FILE = path.join(__dirname, 'database.json');
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI environment variable is missing in .env!');
    process.exit(1);
}

if (!fs.existsSync(DB_FILE)) {
    console.error(`ERROR: database.json file not found at ${DB_FILE}!`);
    process.exit(1);
}

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Successfully connected to MongoDB.');

        console.log('Reading database.json...');
        const rawData = fs.readFileSync(DB_FILE, 'utf-8');
        const dbData = JSON.parse(rawData);

        // 1. Migrate Users
        if (dbData.users && dbData.users.length > 0) {
            console.log(`Migrating ${dbData.users.length} users...`);
            for (const user of dbData.users) {
                await UserModel.updateOne(
                    { _id: user.id },
                    { username: user.username, password: user.password },
                    { upsert: true }
                );
            }
            console.log('Users migrated successfully.');
        }

        // 2. Migrate Customers
        if (dbData.customers && dbData.customers.length > 0) {
            console.log(`Migrating ${dbData.customers.length} customers...`);
            for (const customer of dbData.customers) {
                await CustomerModel.updateOne(
                    { _id: customer.id },
                    {
                        name: customer.name,
                        address: customer.address,
                        phone: customer.phone,
                        initialBalance: customer.initialBalance,
                        currentBalance: customer.currentBalance
                    },
                    { upsert: true }
                );
            }
            console.log('Customers migrated successfully.');
        }

        // 3. Migrate Transactions
        if (dbData.transactions && dbData.transactions.length > 0) {
            console.log(`Migrating ${dbData.transactions.length} transactions...`);
            for (const tx of dbData.transactions) {
                await TransactionModel.updateOne(
                    { _id: tx.id },
                    {
                        customerId: tx.customerId,
                        customerName: tx.customerName,
                        type: tx.type,
                        count: tx.count,
                        depositPerTray: tx.depositPerTray,
                        expectedDeposit: tx.expectedDeposit,
                        totalDeposit: tx.totalDeposit,
                        depositOption: tx.depositOption,
                        vehicleNo: tx.vehicleNo,
                        remarks: tx.remarks,
                        date: tx.date,
                        user: tx.user
                    },
                    { upsert: true }
                );
            }
            console.log('Transactions migrated successfully.');
        }

        console.log('Data migration complete! You can now start the server.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed with error:', err);
        process.exit(1);
    }
}

run();
