const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

class BackupService {
    constructor() {
        this.backupDir = path.join(__dirname, 'backups');
        
        // Ensure backups directory exists
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    async runBackup() {
        try {
            console.log(`[BACKUP] Starting automated database backup at ${new Date().toISOString()}`);
            
            // Get models
            const UserModel = mongoose.model('User');
            const CustomerModel = mongoose.model('Customer');
            const TransactionModel = mongoose.model('Transaction');
            const ActivityLogModel = mongoose.model('ActivityLog');

            // Fetch all data
            const users = await UserModel.find({}).lean();
            const customers = await CustomerModel.find({}).lean();
            const transactions = await TransactionModel.find({}).lean();
            const activityLogs = await ActivityLogModel.find({}).lean();

            const backupData = {
                timestamp: new Date().toISOString(),
                stats: {
                    usersCount: users.length,
                    customersCount: customers.length,
                    transactionsCount: transactions.length,
                    activityLogsCount: activityLogs.length
                },
                data: {
                    users,
                    customers,
                    transactions,
                    activityLogs
                }
            };

            // Format filename: backup-YYYY-MM-DD-HH-MM.json
            const now = new Date();
            const filename = `backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}.json`;
            const filepath = path.join(this.backupDir, filename);

            fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf8');
            console.log(`[BACKUP] Successfully saved backup to ${filepath}`);
            
            return {
                success: true,
                filepath,
                filename,
                stats: backupData.stats
            };
        } catch (error) {
            console.error('[BACKUP] Backup failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new BackupService();
