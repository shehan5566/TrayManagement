const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { LocationModel, UserModel, CustomerModel, TransactionModel, ActivityLogModel } = require('./db');

dotenv.config();

async function runMigration() {
    console.log('Starting Multi-Branch Data Migration...');
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Create Main Branch if it doesn't exist
        let mainBranch = await LocationModel.findById('main');
        if (!mainBranch) {
            mainBranch = new LocationModel({
                _id: 'main',
                name: 'Head Office',
                code: 'HO',
                address: 'Main Branch Address',
                currentStock: 0,
                lostTrays: 0
            });
            await mainBranch.save();
            console.log('Created Main Branch');
        }

        // 2. Update Users
        const users = await UserModel.updateMany(
            { locationId: { $exists: false } },
            { $set: { locationId: 'main' } }
        );
        console.log(`Updated ${users.modifiedCount} users`);

        // 3. Update Customers
        const customers = await CustomerModel.updateMany(
            { locationId: { $exists: false } },
            { $set: { locationId: 'main' } }
        );
        console.log(`Updated ${customers.modifiedCount} customers`);

        // 4. Update Transactions
        const txs = await TransactionModel.updateMany(
            { locationId: { $exists: false } },
            { $set: { locationId: 'main' } }
        );
        console.log(`Updated ${txs.modifiedCount} transactions`);

        // 5. Update Activity Logs
        const logs = await ActivityLogModel.updateMany(
            { locationId: { $exists: false } },
            { $set: { locationId: 'main' } }
        );
        console.log(`Updated ${logs.modifiedCount} activity logs`);

        console.log('Migration Completed Successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
