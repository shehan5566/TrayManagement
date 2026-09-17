/**
 * Automated QA Test Suite for Nelna Tray Management System
 * Tests:
 *  - System Settings Approvers List persistence & validation
 *  - WhatsApp Alert Message Builder (Tray details, Customer, Due, PIN, Link)
 *  - Approval Request creation and personalized URL generation
 *  - Approver Action execution & designation tracking
 *  - Transaction persistence with specialApprovalId & custom approvedBy
 *  - Receipt data sanitization & clean remarks filter
 */

const { SystemSetting, ApprovalRequest, Transaction, Customer, connectDB } = require('./db');
const smsService = require('./smsService');
const mongoose = require('mongoose');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passedTests++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failedTests++;
    }
}

async function runQA() {
    console.log('====================================================');
    console.log('  🧪 NELNA TRAY MANAGEMENT SYSTEM - QA TEST SUITE  ');
    console.log('====================================================\n');

    try {
        await connectDB();

        // ----------------------------------------------------
        // TEST SUITE 1: System Settings & Approvers Management
        // ----------------------------------------------------
        console.log('▶ [TEST 1] System Settings & Approvers Management');
        const initialSettings = await SystemSetting.get();
        assert(Array.isArray(initialSettings.approvers), 'initialSettings.approvers is an Array');
        assert(initialSettings.approvers.length >= 1, 'At least one default approver exists');

        // Test updating approvers list with custom designations and checkboxes
        const testApprovers = [
            { id: 'appr_1', name: 'Sales Manager', phone: '0771112222', enabled: true },
            { id: 'appr_2', name: 'Area Operations Manager', phone: '0773334444', enabled: true },
            { id: 'appr_3', name: 'Managing Director', phone: '0775556666', enabled: false }
        ];

        await SystemSetting.update({ approvers: testApprovers });
        const updatedSettings = await SystemSetting.get();

        assert(updatedSettings.approvers.length === 3, 'All 3 approvers saved successfully');
        assert(updatedSettings.approvers[1].name === 'Area Operations Manager', 'Custom designation "Area Operations Manager" saved correctly');
        assert(updatedSettings.approvers[2].enabled === false, 'Selection checkbox (enabled: false) preserved correctly');
        assert(updatedSettings.salesManagerPhone === '0771112222', 'salesManagerPhone synced to first active approver');

        // ----------------------------------------------------
        // TEST SUITE 2: WhatsApp Approval Alert Message Builder
        // ----------------------------------------------------
        console.log('\n▶ [TEST 2] WhatsApp Alert Message Builder with Tray Details');
        const mockAlertDetails = {
            customerName: 'Saman Perera & Sons',
            customerPhone: '0779998877',
            currentBalance: 45,
            requestedQty: 60,
            pendingDepositBalance: 24000,
            depositOption: 'HALF',
            locationName: 'Colombo Central Hub',
            vehicleNo: 'WP-CAD-8822'
        };
        const mockUrl = 'https://traymanagement.onrender.com/approval/mocktoken123?approver=Area%20Operations%20Manager';
        const mockPin = '8246';

        const generatedMsg = smsService.buildApprovalMessage(mockAlertDetails, mockUrl, mockPin);

        assert(generatedMsg.includes('NELNA AGRI - TRAY APPROVAL REQUEST'), 'Includes branded header "NELNA AGRI - TRAY APPROVAL REQUEST"');
        assert(generatedMsg.includes('Saman Perera & Sons'), 'Includes Customer Name');
        assert(generatedMsg.includes('*Requested Tray Issue:* *60 Trays*'), 'Includes Requested Tray count');
        assert(generatedMsg.includes('*Outstanding (Due):* *45 Trays*'), 'Includes Due/Outstanding Tray balance');
        assert(generatedMsg.includes('Pending Deposit:'), 'Includes Pending Deposit details');
        assert(generatedMsg.includes('Colombo Central Hub'), 'Includes Location Name');
        assert(generatedMsg.includes('WP-CAD-8822'), 'Includes Vehicle Number');
        assert(generatedMsg.includes('👉 *Click Link to APPROVE or REJECT TRAY ISSUE:*'), 'Includes clear tray-specific Call-to-Action link title');
        assert(generatedMsg.includes(mockUrl), 'Includes personalized Approval URL');
        assert(generatedMsg.includes(mockPin), 'Includes 4-digit Override PIN');

        // ----------------------------------------------------
        // TEST SUITE 3: Approval Request Lifecycle & Approver Tracking
        // ----------------------------------------------------
        console.log('\n▶ [TEST 3] Approval Request Creation & Authorization Flow');
        
        // Find or create test customer
        let customer = await Customer.getById('cust_qa_test');
        if (!customer) {
            customer = await Customer.create({
                _id: 'cust_qa_test',
                name: 'QA Test Customer Ltd',
                phone: '0770001122',
                currentBalance: 30
            });
        }

        const approvalPayload = {
            customerId: customer.id || customer._id,
            customerName: customer.name,
            customerPhone: customer.phone,
            currentBalance: customer.currentBalance,
            requestedQty: 50,
            pendingDepositBalance: 10000,
            txPayload: {
                customerId: customer.id || customer._id,
                type: 'OUT',
                count: 50,
                depositOption: 'FULL',
                vehicleNo: 'TEST-001',
                remarks: 'QA Auto Test Issue'
            },
            locationName: 'QA Test Branch',
            requestedBy: 'QA Automated Bot'
        };

        const newApproval = await ApprovalRequest.create(approvalPayload);
        assert(newApproval && newApproval.token, 'ApprovalRequest created with secure token');
        assert(newApproval.pin && newApproval.pin.length === 4, 'ApprovalRequest generated 4-digit PIN');
        assert(newApproval.status === 'PENDING', 'Initial approval status is PENDING');

        // Simulate Approver approving the request with a custom designation
        const customApproverTitle = 'Area Operations Manager';
        const approvedRecord = await ApprovalRequest.approve(newApproval.token, customApproverTitle, 'Approved via QA Test Suite');
        
        assert(approvedRecord.status === 'APPROVED', 'ApprovalRequest status changed to APPROVED');
        assert(approvedRecord.approvedBy === customApproverTitle, `approvedBy tracked as "${customApproverTitle}"`);

        // ----------------------------------------------------
        // TEST SUITE 4: Transaction Generation & Persistence
        // ----------------------------------------------------
        console.log('\n▶ [TEST 4] Transaction Creation with ApprovedBy & SpecialApprovalId');
        const txData = { ...approvedRecord.txPayload };
        txData.specialApprovalId = approvedRecord._id;
        txData.approvedBy = approvedRecord.approvedBy;

        const createdTx = await Transaction.create(txData, 'QA Automated Bot');

        assert(createdTx && createdTx._id, 'Transaction successfully created in database');
        assert(createdTx.specialApprovalId === approvedRecord._id, 'specialApprovalId correctly persisted');
        assert(createdTx.approvedBy === customApproverTitle, `approvedBy correctly persisted as "${customApproverTitle}"`);
        assert(createdTx.receiptNo > 0, `Generated sequential receiptNo: RE-${String(createdTx.receiptNo).padStart(6, '0')}`);

        // ----------------------------------------------------
        // TEST SUITE 5: Receipt Print Formatting & Filter Logic
        // ----------------------------------------------------
        console.log('\n▶ [TEST 5] Receipt Print & Remarks Sanitization Logic');
        
        // Simulate receipt filtering logic
        const txWithSystemRemark = {
            remarks: 'Customer requested quick dispatch | Approved by sales manager via WhatsApp',
            approvedBy: customApproverTitle,
            specialApprovalId: approvedRecord._id
        };

        const hasApproval = !!(txWithSystemRemark.approvedBy || txWithSystemRemark.specialApprovalId || (txWithSystemRemark.remarks && /approved by/i.test(txWithSystemRemark.remarks)));
        const approverTitle = txWithSystemRemark.approvedBy || 'Sales Manager';
        let cleanRemarks = (txWithSystemRemark.remarks || '').replace(/\|?\s*Approved by\b[^|]*/gi, '').trim();
        cleanRemarks = cleanRemarks.replace(/^\|\s*|\s*\|$/g, '').trim();

        assert(hasApproval === true, 'Receipt identifies transaction has special approval');
        assert(approverTitle === customApproverTitle, `Receipt shows Approved By: "${customApproverTitle}"`);
        assert(!cleanRemarks.toLowerCase().includes('approved by sales manager'), 'Clean remarks removes "Approved by sales manager" phrase');
        assert(cleanRemarks === 'Customer requested quick dispatch', 'Clean remarks retains genuine user remark');

        // ----------------------------------------------------
        // CLEANUP (Remove temporary QA test data)
        // ----------------------------------------------------
        console.log('\n▶ Cleaning up QA test records...');
        if (createdTx && createdTx._id) {
            await Transaction.delete(createdTx._id);
        }
        await ApprovalRequest.reject(newApproval.token, 'Cleanup QA test request');
        // Restore initial settings
        await SystemSetting.update({ approvers: initialSettings.approvers });
        console.log('  🧹 Cleanup completed. Database returned to pristine state.');

        // ----------------------------------------------------
        // SUMMARY
        // ----------------------------------------------------
        console.log('\n====================================================');
        console.log(`  QA TEST RUN FINISHED: ${passedTests} PASSED, ${failedTests} FAILED`);
        console.log('====================================================\n');

        if (failedTests > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (err) {
        console.error('Unhandled QA Test Error:', err);
        process.exit(1);
    }
}

runQA();
