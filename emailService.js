const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const xlsx = require('xlsx');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    async sendWeeklyReport(backupResult, overrideEmails = null, customStartDate = null, customEndDate = null) {
        try {
            let dbEmails = null;
            try {
                const SystemSettingModel = mongoose.model('SystemSetting');
                const setting = await SystemSettingModel.findById('global_config');
                if (setting && setting.emailReceiver) {
                    dbEmails = setting.emailReceiver;
                }
            } catch (sysErr) {
                console.error('[EMAIL] Could not read SystemSetting:', sysErr);
            }

            const receiver = overrideEmails || dbEmails || process.env.REPORT_RECEIVER;
            if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !receiver) {
                console.log('[EMAIL] Skipping weekly report: Email credentials or receiver not configured');
                return false;
            }

            console.log('[EMAIL] Generating weekly report...');

            // Get models
            const TransactionModel = mongoose.model('Transaction');
            const CustomerModel = mongoose.model('Customer');

            // Calculate date range
            let endDate = new Date();
            let startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            
            let isCustomDate = false;
            if (customStartDate) {
                startDate = new Date(customStartDate);
                startDate.setHours(0, 0, 0, 0);
                isCustomDate = true;
            }
            if (customEndDate) {
                endDate = new Date(customEndDate);
                endDate.setHours(23, 59, 59, 999);
                isCustomDate = true;
            }

            // Format dates to YYYY-MM-DDTHH:mm string format to match DB string format
            const formatStringDate = (d) => {
                const pad = (n) => n < 10 ? '0' + n : n;
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            };
            const startDateStr = formatStringDate(startDate);
            const endDateStr = formatStringDate(endDate);

            // Fetch transactions for the last 7 days
            const recentTransactions = await TransactionModel.find({
                date: { $gte: startDateStr, $lte: endDateStr }
            }).lean();

            // Fetch customers added in the last 7 days
            const newCustomers = await CustomerModel.find({
                createdAt: { $gte: startDate, $lte: endDate }
            }).lean();

            // Helper to format receipt no as RExxxx
            const formatReceiptNo = (no) => no ? 'RE' + String(no).padStart(4, '0') : '-';

            // Calculate stats and prepare Excel data
            let traysOut = 0;
            let traysIn = 0;
            let totalDepositCollected = 0;
            
            const excelDataTransactions = recentTransactions.map(tx => {
                let traysIssued = 0;
                let traysReturned = 0;
                let depositCollected = 0;
                let refunded = 0;

                if (tx.type === 'OUT') {
                    traysOut += tx.count;
                    totalDepositCollected += (tx.totalDeposit || 0);
                    traysIssued = tx.count;
                    depositCollected = (tx.totalDeposit || 0);
                } else if (tx.type === 'IN') {
                    traysIn += tx.count;
                    totalDepositCollected -= (tx.totalDeposit || 0);
                    traysReturned = tx.count;
                    refunded = (tx.totalDeposit || 0);
                }
                
                return {
                    'Date': tx.date ? tx.date.split('T')[0] : '-',
                    'Time': tx.date ? tx.date.split('T')[1] : '-',
                    'Customer Name': tx.customerName || 'Unknown',
                    'Trays Issued (OUT)': traysIssued,
                    'Trays Returned (IN)': traysReturned,
                    'Deposit Collected (Rs)': depositCollected,
                    'Refunded Amount (Rs)': refunded,
                    'Receipt No': formatReceiptNo(tx.receiptNo),
                    'Remarks': tx.remarks || tx.note || ''
                };
            });

            // Generate Excel buffer
            let excelBuffer = null;
            if (excelDataTransactions.length === 0) {
                excelDataTransactions.push({
                    'Date': '-', 'Time': '-', 'Customer Name': '-',
                    'Trays Issued (OUT)': '-', 'Trays Returned (IN)': '-',
                    'Deposit Collected (Rs)': '-', 'Refunded Amount (Rs)': '-',
                    'Receipt No': '-', 'Remarks': 'No transactions in this period'
                });
            }
            
            // Get Customer Balances and their last receipt no
            const allCustomers = await CustomerModel.find({}).lean();
            
            // Aggregation to find the last receipt number for each customer
            const lastTxPerCustomer = await TransactionModel.aggregate([
                { $sort: { date: -1 } },
                { $group: { _id: "$customerId", lastReceiptNo: { $first: "$receiptNo" } } }
            ]);
            const lastReceiptMap = {};
            lastTxPerCustomer.forEach(tx => {
                lastReceiptMap[tx._id] = tx.lastReceiptNo;
            });

            // Sort customers alphabetically by name
            allCustomers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            let totalOutstandingTrays = 0;
            const excelDataCustomers = allCustomers.map(c => {
                totalOutstandingTrays += (c.currentBalance || 0);
                const joinDate = c._id ? new Date(parseInt(c._id)).toLocaleDateString() : '-';
                return {
                    'Customer Name': c.name,
                    'Phone': c.phone || '-',
                    'Address/Route': c.address || '-',
                    'Outstanding Trays Balance': c.currentBalance || 0,
                    'Last Receipt No': formatReceiptNo(lastReceiptMap[c._id]),
                    'Joined Date': joinDate
                };
            });

            const workbook = xlsx.utils.book_new();
            
            const wsTransactions = xlsx.utils.json_to_sheet(excelDataTransactions);
            xlsx.utils.book_append_sheet(workbook, wsTransactions, 'Transactions');
            
            if (excelDataCustomers.length > 0) {
                const wsCustomers = xlsx.utils.json_to_sheet(excelDataCustomers);
                xlsx.utils.book_append_sheet(workbook, wsCustomers, 'Customer Balances');
            }
            
            excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #107c41; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">Nelna Tray System</h2>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">${isCustomDate ? 'Summary Report' : 'Weekly Summary Report'}</p>
                    </div>
                    
                    <div style="padding: 20px;">
                        <p style="margin-top: 0;">Here is your summary report from <strong>${startDate.toLocaleDateString()}</strong> to <strong>${endDate.toLocaleDateString()}</strong>.</p>
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid #e0e0e0; padding-bottom: 5px;">Activity Summary</h3>
                            <ul style="list-style-type: none; padding-left: 0; margin-bottom: 0;">
                                <li style="margin-bottom: 8px;">📊 <strong>Total Transactions:</strong> ${recentTransactions.length}</li>
                                <li style="margin-bottom: 8px; color: #d32f2f;">📤 <strong>Trays Issued (OUT):</strong> ${traysOut}</li>
                                <li style="margin-bottom: 8px; color: #388e3c;">📥 <strong>Trays Returned (IN):</strong> ${traysIn}</li>
                                <li style="margin-bottom: 8px;">💰 <strong>Net Deposit Flow:</strong> Rs. ${totalDepositCollected.toFixed(2)}</li>
                                <li>👥 <strong>New Customers Added:</strong> ${newCustomers.length}</li>
                            </ul>
                        </div>
                        
                        <div style="background-color: #fffbea; border-left: 4px solid #ffb900; padding: 15px; margin-bottom: 20px;">
                            <h3 style="margin-top: 0; color: #333;">System Status</h3>
                            <p style="margin-bottom: 5px;"><strong>Total Customers in DB:</strong> ${backupResult.stats.customersCount}</p>
                            <p style="margin-bottom: 5px;"><strong>Total Transactions in DB:</strong> ${backupResult.stats.transactionsCount}</p>
                            <p style="margin-bottom: 0; color: #d32f2f;"><strong>⚠️ Total Outstanding Trays (All Customers):</strong> ${totalOutstandingTrays}</p>
                        </div>
                        
                        <p>A full backup of your database (JSON format)${excelBuffer ? ' and an Excel sheet with detailed transactions' : ''} has been attached to this email for safekeeping.</p>
                        
                        <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
                            This is an automated message generated by the Nelna Tray System.
                        </p>
                    </div>
                </div>
            `;

            const mailOptions = {
                from: `"Nelna Tray System" <${process.env.EMAIL_USER}>`,
                to: receiver,
                subject: `${isCustomDate ? 'Summary Report' : 'Weekly Report'} & Backup - Nelna Tray System (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`,
                html: htmlContent,
                attachments: [
                    {
                        filename: backupResult.filename,
                        path: backupResult.filepath
                    }
                ]
            };

            if (excelBuffer) {
                mailOptions.attachments.push({
                    filename: `Transactions_Summary_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.xlsx`,
                    content: excelBuffer
                });
            }

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`[EMAIL] Weekly report sent successfully to ${receiver}: ${info.messageId}`);
            return true;
        } catch (error) {
            console.error('[EMAIL] Error sending weekly report:', error);
            return false;
        }
    }
}

module.exports = new EmailService();
