const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('MONGODB_URI is missing in .env file!');
    process.exit(1);
}

async function resetSystemData() {
    try {
        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000
        });
        console.log('Connected to DB successfully.\n');

        const db = mongoose.connection.db;

        // 1. Create a full safety backup in backups/ folder
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `system_reset_backup_${timestamp}.json`);

        console.log('Creating comprehensive safety backup...');
        const transactions = await db.collection('transactions').find({}).toArray();
        const stocktransfers = await db.collection('stocktransfers').find({}).toArray();
        const lorrytrips = await db.collection('lorrytrips').find({}).toArray();
        const approvalrequests = await db.collection('approvalrequests').find({}).toArray();
        const damagelogs = await db.collection('damagelogs').find({}).toArray();
        const activitylogs = await db.collection('activitylogs').find({}).toArray();
        const monthlybalances = await db.collection('monthlybalances').find({}).toArray();
        const counters = await db.collection('counters').find({}).toArray();
        const customers = await db.collection('customers').find({}).toArray();
        const locations = await db.collection('locations').find({}).toArray();

        const backupData = {
            backupTimestamp: new Date().toISOString(),
            metadata: {
                transactionsCount: transactions.length,
                stockTransfersCount: stocktransfers.length,
                lorryTripsCount: lorrytrips.length,
                approvalRequestsCount: approvalrequests.length,
                damageLogsCount: damagelogs.length,
                activityLogsCount: activitylogs.length,
                monthlyBalancesCount: monthlybalances.length,
                countersCount: counters.length,
                customersCount: customers.length,
                locationsCount: locations.length
            },
            data: {
                transactions,
                stocktransfers,
                lorrytrips,
                approvalrequests,
                damagelogs,
                activitylogs,
                monthlybalances,
                counters,
                customers,
                locations
            }
        };

        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
        console.log(`[Backup Created] Saved full pre-reset backup to: ${backupPath}`);
        console.log(`Backup size: ${(fs.statSync(backupPath).size / 1024).toFixed(2)} KB\n`);

        // 2. Clear Transactions (Receipts)
        const txResult = await db.collection('transactions').deleteMany({});
        console.log(`[Cleared Transactions] Deleted ${txResult.deletedCount} transaction entries. Receipt numbers will start from 1.`);

        // 3. Clear Stock Transfers (TFR) & Goods Received Notes (GRN)
        const tfrResult = await db.collection('stocktransfers').deleteMany({});
        console.log(`[Cleared Transfers & GRNs] Deleted ${tfrResult.deletedCount} stock transfer records.`);

        // 4. Clear Lorry Trips (LOD) & Unloadings (UNLOD)
        const tripsResult = await db.collection('lorrytrips').deleteMany({});
        console.log(`[Cleared Lorry Trips] Deleted ${tripsResult.deletedCount} lorry trip records.`);

        // 5. Clear Special Approval Requests
        const apprResult = await db.collection('approvalrequests').deleteMany({});
        console.log(`[Cleared Approval Requests] Deleted ${apprResult.deletedCount} approval requests.`);

        // 6. Clear Damage Logs
        const dmgResult = await db.collection('damagelogs').deleteMany({});
        console.log(`[Cleared Damage Logs] Deleted ${dmgResult.deletedCount} damage log records.`);

        // 7. Clear Activity Logs
        const actResult = await db.collection('activitylogs').deleteMany({});
        console.log(`[Cleared Activity Logs] Deleted ${actResult.deletedCount} activity log records.`);

        // 8. Clear Monthly Balances
        const mbResult = await db.collection('monthlybalances').deleteMany({});
        console.log(`[Cleared Monthly Balances] Deleted ${mbResult.deletedCount} monthly balance records.`);

        // 9. Clear Counters (Resets all document sequences: TFR, GRN, LOD, UNLOD, etc. to start from 1)
        const counterResult = await db.collection('counters').deleteMany({});
        console.log(`[Reset Counters] Deleted ${counterResult.deletedCount} sequence counters. All document numbers will start from 1 (00001).`);

        // 10. Reset Customer currentBalances back to initialBalance
        const customerDocs = await db.collection('customers').find({}).toArray();
        let resetCustomersCount = 0;
        for (const cust of customerDocs) {
            const initial = cust.initialBalance || 0;
            await db.collection('customers').updateOne(
                { _id: cust._id },
                { $set: { currentBalance: initial } }
            );
            resetCustomersCount++;
        }
        console.log(`[Reset Customer Balances] Reset balances for ${resetCustomersCount} customers back to their initial balance.`);

        // 11. Reset Location stock balances to 0
        const locResult = await db.collection('locations').updateMany(
            {},
            { $set: { currentStock: 0, lostTrays: 0 } }
        );
        console.log(`[Reset Branch Stock] Reset stock count to 0 and lostTrays to 0 for ${locResult.modifiedCount} locations.`);

        console.log('\n======================================================');
        console.log('--- SYSTEM RESET AND RE-INITIALIZATION COMPLETED ---');
        console.log('======================================================');
        process.exit(0);

    } catch (err) {
        console.error('Error during system reset:', err);
        process.exit(1);
    }
}

resetSystemData();
