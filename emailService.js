const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const xlsx = require('xlsx');

class EmailService {
    getTransporter() {
        const user = process.env.EMAIL_USER || 'nelnatray@gmail.com';
        const pass = (process.env.EMAIL_PASS || 'tcqekxmxfywsbrod').replace(/\s+/g, '');
        return nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: { user, pass }
        });
    }

    async sendWeeklyReport(backupResult, overrideEmails = null, customStartDate = null, customEndDate = null) {
        try {
            let dbEmails = null;
            let companyName = 'NELNA AGRI DEVELOPMENT (PVT) LTD';
            try {
                const SystemSettingModel = mongoose.model('SystemSetting');
                const setting = await SystemSettingModel.findById('global_config');
                if (setting) {
                    if (setting.emailReceiver) dbEmails = setting.emailReceiver;
                    if (setting.companyName) companyName = setting.companyName;
                }
            } catch (sysErr) {
                console.error('[EMAIL] Could not read SystemSetting:', sysErr);
            }

            const emailUser = process.env.EMAIL_USER || 'nelnatray@gmail.com';
            const emailPass = (process.env.EMAIL_PASS || 'tcqekxmxfywsbrod').replace(/\s+/g, '');
            const receiver = (overrideEmails && overrideEmails.trim()) || dbEmails || process.env.REPORT_RECEIVER || 'shehand@nelna.lk';

            if (!emailUser || !emailPass || !receiver) {
                console.log('[EMAIL] Skipping report: Email credentials or receiver not configured');
                return false;
            }

            console.log('[EMAIL] Generating comprehensive executive summary report...');

            // Get models
            const TransactionModel = mongoose.model('Transaction');
            const CustomerModel = mongoose.model('Customer');
            const LocationModel = mongoose.model('Location');
            const DamageLogModel = mongoose.model('DamageLog');

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

            // 1. Fetch transactions for the date range
            const recentTransactions = await TransactionModel.find({
                date: { $gte: startDateStr, $lte: endDateStr }
            }).lean();

            // 2. Fetch new customers added in period
            const newCustomers = await CustomerModel.find({
                createdAt: { $gte: startDate, $lte: endDate }
            }).lean();

            // 3. Fetch all branches / locations and their current stock
            const allLocations = await LocationModel.find({}).lean();
            allLocations.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            const totalBranchStock = allLocations.reduce((sum, l) => sum + (l.currentStock || 0), 0);

            // 4. Fetch damaged / lost tray logs
            const recentDamages = await DamageLogModel.find({
                date: { $gte: startDate, $lte: endDate }
            }).lean();
            const totalDamagedInPeriod = recentDamages.reduce((sum, d) => sum + (d.qty || 0), 0);

            const allDamages = await DamageLogModel.find({}).lean();
            const totalDamagedAllTime = allDamages.reduce((sum, d) => sum + (d.qty || 0), 0);

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

            // Net balance for the period (Trays Issued vs Returned)
            const netTrayDifference = traysOut - traysIn;

            // Generate Excel buffer fallback if empty
            let excelBuffer = null;
            if (excelDataTransactions.length === 0) {
                excelDataTransactions.push({
                    'Date': '-', 'Time': '-', 'Customer Name': '-',
                    'Trays Issued (OUT)': '-', 'Trays Returned (IN)': '-',
                    'Deposit Collected (Rs)': '-', 'Refunded Amount (Rs)': '-',
                    'Receipt No': '-', 'Remarks': 'No transactions in this period'
                });
            }
            
            // 5. Get Customer Balances and Top 10 Outstanding Customers
            const allCustomers = await CustomerModel.find({}).lean();
            
            const lastTxPerCustomer = await TransactionModel.aggregate([
                { $sort: { date: -1 } },
                { $group: { _id: "$customerId", lastReceiptNo: { $first: "$receiptNo" } } }
            ]);
            const lastReceiptMap = {};
            lastTxPerCustomer.forEach(tx => {
                lastReceiptMap[tx._id] = tx.lastReceiptNo;
            });

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

            // Top 10 Customers with highest outstanding trays
            const topOutstandingCustomers = [...allCustomers]
                .filter(c => (c.currentBalance || 0) > 0)
                .sort((a, b) => (b.currentBalance || 0) - (a.currentBalance || 0))
                .slice(0, 10);

            // 6. Branch Stocks Excel sheet data
            const excelDataBranches = allLocations.map(l => ({
                'Branch Name': l.name,
                'Code': l.code || '-',
                'Current Stock (Trays)': l.currentStock || 0
            }));

            const workbook = xlsx.utils.book_new();
            const wsTransactions = xlsx.utils.json_to_sheet(excelDataTransactions);
            xlsx.utils.book_append_sheet(workbook, wsTransactions, 'Transactions');
            
            if (excelDataCustomers.length > 0) {
                const wsCustomers = xlsx.utils.json_to_sheet(excelDataCustomers);
                xlsx.utils.book_append_sheet(workbook, wsCustomers, 'Customer Balances');
            }

            if (excelDataBranches.length > 0) {
                const wsBranches = xlsx.utils.json_to_sheet(excelDataBranches);
                xlsx.utils.book_append_sheet(workbook, wsBranches, 'Branch Stocks');
            }
            
            excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            // Build HTML Email
            const branchRowsHtml = allLocations.map((loc, idx) => `
                <tr style="border-bottom: 1px solid #e5e7eb; background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                    <td style="padding: 9px 12px; font-weight: 600; color: #1f2937;">${loc.name} ${loc.code ? `<span style="color:#6b7280; font-size:11px;">(${loc.code})</span>` : ''}</td>
                    <td style="padding: 9px 12px; text-align: right; font-weight: 700; color: #174e3e; font-size: 14px;">${(loc.currentStock || 0).toLocaleString()} Trays</td>
                </tr>
            `).join('');

            const topCustomerRowsHtml = topOutstandingCustomers.length > 0 ? topOutstandingCustomers.map((c, idx) => `
                <tr style="border-bottom: 1px solid #e5e7eb; background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                    <td style="padding: 9px 12px; text-align: center; color: #6b7280; font-weight: 700;">#${idx + 1}</td>
                    <td style="padding: 9px 12px; font-weight: 600; color: #1f2937;">${c.name}</td>
                    <td style="padding: 9px 12px; color: #4b5563; font-size: 12.5px;">${c.phone || '-'}</td>
                    <td style="padding: 9px 12px; text-align: right; font-weight: 700; color: #dc2626; font-size: 13.5px;">${(c.currentBalance || 0).toLocaleString()} Trays</td>
                </tr>
            `).join('') : `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 18px; color: #9ca3af;">No customers currently hold pending trays.</td>
                </tr>
            `;

            const htmlContent = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background: #ffffff; color: #1f2937; line-height: 1.5;">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #174e3e 0%, #0e3328 100%); color: #ffffff; padding: 26px 24px; text-align: center;">
                        <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">${companyName}</h1>
                        <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; font-weight: 500;">
                            ${isCustomDate ? 'Executive Management Summary' : 'Weekly Executive Management Summary & Operational Audit'}
                        </p>
                        <div style="margin-top: 10px; display: inline-block; background: rgba(255, 255, 255, 0.15); padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                            Period: ${startDate.toLocaleDateString('en-GB')} — ${endDate.toLocaleDateString('en-GB')}
                        </div>
                    </div>
                    
                    <div style="padding: 24px;">

                        <!-- Key Operational Metrics Grid -->
                        <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #174e3e; padding-bottom: 6px;">
                            📊 Operational Activity Summary
                        </h3>

                        <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 20px;">
                            <tr>
                                <td style="width: 50%; background: #fff7ed; border-left: 4px solid #ea580c; border-radius: 8px; padding: 14px 16px;">
                                    <div style="font-size: 11.5px; font-weight: 700; color: #9a3412; text-transform: uppercase;">📤 Total Trays Issued (OUT)</div>
                                    <div style="font-size: 24px; font-weight: 800; color: #ea580c; margin-top: 4px;">${traysOut.toLocaleString()} <span style="font-size: 13px; font-weight: 600;">Trays</span></div>
                                    <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Dispatched to customers</div>
                                </td>
                                <td style="width: 50%; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 8px; padding: 14px 16px;">
                                    <div style="font-size: 11.5px; font-weight: 700; color: #166534; text-transform: uppercase;">📥 Total Trays Returned (IN)</div>
                                    <div style="font-size: 24px; font-weight: 800; color: #16a34a; margin-top: 4px;">${traysIn.toLocaleString()} <span style="font-size: 13px; font-weight: 600;">Trays</span></div>
                                    <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Recovered from customers</div>
                                </td>
                            </tr>
                            <tr>
                                <td style="width: 50%; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 8px; padding: 14px 16px;">
                                    <div style="font-size: 11.5px; font-weight: 700; color: #1e40af; text-transform: uppercase;">💰 Net Circulation Balance</div>
                                    <div style="font-size: 24px; font-weight: 800; color: #2563eb; margin-top: 4px;">
                                        ${netTrayDifference > 0 ? '+' + netTrayDifference.toLocaleString() : netTrayDifference.toLocaleString()} <span style="font-size: 13px; font-weight: 600;">Trays</span>
                                    </div>
                                    <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">
                                        ${netTrayDifference > 0 ? 'Net Outflow (Issued > Returned)' : (netTrayDifference < 0 ? 'Net Inflow (Recovered > Issued)' : 'Balanced')}
                                    </div>
                                </td>
                                <td style="width: 50%; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px; padding: 14px 16px;">
                                    <div style="font-size: 11.5px; font-weight: 700; color: #991b1b; text-transform: uppercase;">⚠️ Damaged / Lost Trays</div>
                                    <div style="font-size: 24px; font-weight: 800; color: #dc2626; margin-top: 4px;">${totalDamagedInPeriod.toLocaleString()} <span style="font-size: 13px; font-weight: 600;">Trays</span></div>
                                    <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">All-time recorded: ${totalDamagedAllTime.toLocaleString()} Trays</div>
                                </td>
                            </tr>
                        </table>

                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px;">
                            <span style="font-weight: 700; color: #334155;">Financial & Flow Highlights:</span>
                            <span style="margin-left: 8px; color: #475569;">Net Deposit Cash Flow: <strong>Rs. ${totalDepositCollected.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</strong> | Total Transactions: <strong>${recentTransactions.length}</strong> | New Accounts: <strong>${newCustomers.length}</strong></span>
                        </div>

                        <!-- Branch Stock Breakdown -->
                        <h3 style="margin: 24px 0 12px 0; font-size: 15px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #174e3e; padding-bottom: 6px;">
                            🏢 Branch Stock Breakdown (${allLocations.length} Locations)
                        </h3>

                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; font-size: 13px;">
                            <thead>
                                <tr style="background: #174e3e; color: #ffffff;">
                                    <th style="padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase;">Branch / Location</th>
                                    <th style="padding: 10px 12px; text-align: right; font-size: 12px; text-transform: uppercase;">Real-Time Stock</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${branchRowsHtml}
                                <tr style="background: #f3f4f6; border-top: 2px solid #d1d5db; font-weight: 800;">
                                    <td style="padding: 11px 12px; color: #111827;">Total Warehouse Stock (All Locations)</td>
                                    <td style="padding: 11px 12px; text-align: right; color: #174e3e; font-size: 15px;">${totalBranchStock.toLocaleString()} Trays</td>
                                </tr>
                            </tbody>
                        </table>

                        <!-- Top 10 Outstanding Customers -->
                        <h3 style="margin: 28px 0 12px 0; font-size: 15px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #dc2626; padding-bottom: 6px;">
                            👥 Top 10 Customers with Highest Outstanding Trays
                        </h3>

                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; font-size: 13px;">
                            <thead>
                                <tr style="background: #374151; color: #ffffff;">
                                    <th style="padding: 10px 12px; text-align: center; width: 40px;">#</th>
                                    <th style="padding: 10px 12px; text-align: left;">Customer Name</th>
                                    <th style="padding: 10px 12px; text-align: left;">Phone</th>
                                    <th style="padding: 10px 12px; text-align: right;">Pending Trays</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${topCustomerRowsHtml}
                            </tbody>
                        </table>

                        <!-- System Status & Backup Alert -->
                        <div style="background: #fffbea; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 6px; margin-bottom: 20px; font-size: 13px;">
                            <div style="font-weight: 700; color: #92400e; margin-bottom: 4px;">System Health & Ledger Totals:</div>
                            <div style="color: #78350f;">
                                • Total Active Customers: <strong>${allCustomers.length}</strong><br>
                                • Total Trays Currently with Customers: <strong style="color:#b91c1c;">${totalOutstandingTrays.toLocaleString()} Trays</strong><br>
                                • Automated Database JSON Backup: <strong>Successfully Created & Attached</strong>
                            </div>
                        </div>

                        <p style="font-size: 12.5px; color: #6b7280; margin: 16px 0 0 0;">
                            📎 <strong>Attached Documents:</strong> Full system JSON database backup (${backupResult.filename}) and complete Excel workbook with detailed transaction logs and customer balances.
                        </p>

                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

                        <p style="font-size: 11.5px; color: #9ca3af; text-align: center; margin: 0;">
                            This is an automated operational audit message generated by <strong>Nelna Tray Management System</strong>.<br>
                            For inquiries or manual adjustment, please access the system dashboard.
                        </p>
                    </div>
                </div>
            `;

            const mailOptions = {
                from: `"${companyName}" <${process.env.EMAIL_USER}>`,
                to: receiver,
                subject: `${isCustomDate ? 'Executive Management Summary' : 'Weekly Executive Report'} & Stock Audit - ${companyName} (${startDate.toLocaleDateString('en-GB')} - ${endDate.toLocaleDateString('en-GB')})`,
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
                    filename: `Nelna_Executive_Summary_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.xlsx`,
                    content: excelBuffer
                });
            }

            const transporter = this.getTransporter();
            const info = await transporter.sendMail(mailOptions);
            console.log(`[EMAIL] Comprehensive report sent successfully to ${receiver}: ${info.messageId}`);
            return true;
        } catch (error) {
            console.error('[EMAIL] Error sending executive summary report:', error.message || error);
            throw error;
        }
    }
}

module.exports = new EmailService();
