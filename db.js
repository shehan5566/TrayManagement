const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
dotenv.config();

let cachedPromise = null;

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }
    if (!cachedPromise) {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error('MONGODB_URI environment variable is missing!');
            throw new Error('MONGODB_URI environment variable is missing');
        }
        console.log('Connecting to MongoDB Atlas...');
        cachedPromise = mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            bufferCommands: false
        }).catch(err => {
            cachedPromise = null;
            console.error('MongoDB Connection Error:', err.message || err);
            throw err;
        });
    }
    try {
        await cachedPromise;
        console.log('Successfully connected to Live MongoDB.');
        return mongoose.connection;
    } catch (err) {
        cachedPromise = null;
        throw err;
    }
};

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB connection lost. Clearing cached promise.');
    cachedPromise = null;
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error event:', err.message || err);
    cachedPromise = null;
});

// Initial connection attempt (Catch startup error to allow server port binding)
connectDB().catch(err => {
    console.error('Initial DB Connection Notice:', err.message || err);
});

// Define Schemas
const LocationSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    code: { type: String },
    address: { type: String },
    currentStock: { type: Number, default: 0 },
    lostTrays: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // e.g. WH_TFR or HO_GRN
    seq: { type: Number, default: 0 }
});

const StockTransferSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    transferDocNo: { type: String }, // e.g. HOTFR00001
    vehicleNo: { type: String },
    fromLocationId: { type: String, required: true },
    fromLocationName: { type: String },
    toLocationId: { type: String, required: true },
    toLocationName: { type: String },
    dispatchedQty: { type: Number, required: true },
    receivedQty: { type: Number, default: 0 },
    variance: { type: Number, default: 0 },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' },
    dispatchedBy: { type: String },
    receivedBy: { type: String },
    dispatchedDate: { type: Date, default: Date.now },
    receivedDate: { type: Date },
    grnNo: { type: String },
    remarks: { type: String },
    rep: { type: String },
    route: { type: String },
    distributor: { type: String },
    serialNo: { type: String },
    refNo: { type: String },
    isDeleted: { type: Boolean, default: false }
});

const DamageLogSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    damageNo: { type: String },
    locationId: { type: String, required: true },
    locationName: { type: String },
    type: { type: String, enum: ['DAMAGED', 'DISPOSED', 'AUDIT_ADJUSTMENT'], default: 'DAMAGED' },
    qty: { type: Number, required: true },
    reason: { type: String },
    reportedBy: { type: String },
    date: { type: Date, default: Date.now }
});

const SystemSettingSchema = new mongoose.Schema({
    _id: { type: String, default: 'global_config' },
    depositPerTray: { type: Number, default: 2000 },
    companyName: { type: String, default: 'NELNA AGRI DEVELOPMENT (PVT) LTD' },
    smsWebhookUrl: { type: String, default: 'https://trigger.macrodroid.com/55b77285-583d-4748-b4e8-765fa3e9fb2b/sendsms' },
    emailReceiver: { type: String, default: 'shehand@nelna.lk' },
    receiptFooterNote: { type: String, default: 'Official Inward Stock Receipt & Verification Log' }
});

const RoleSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true, unique: true },
    isSuperUser: { type: Boolean, default: false },
    permissions: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }, // Deprecated, keeping for legacy fallback
    roleId: { type: String }, // Maps to RoleSchema _id
    locationId: { type: String, default: 'main' } // Link user to a branch
});

const CustomerSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String },
    address: { type: String },
    phone: { type: String },
    initialBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    locationId: { type: String, default: 'main' }
});

const TransactionSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    customerId: { type: String },
    customerName: { type: String },
    type: { type: String, enum: ['IN', 'OUT'] },
    count: { type: Number },
    depositPerTray: { type: Number, default: 2000 },
    expectedDeposit: { type: Number, default: 0 },
    totalDeposit: { type: Number, default: 0 },
    depositOption: { type: String, default: 'FULL' },
    vehicleNo: { type: String, default: 'N/A' },
    remarks: { type: String, default: '' },
    date: { type: String },
    user: { type: String, default: 'System' },
    receiptNo: { type: Number, default: 0 },
    locationId: { type: String, default: 'main' },
    isDeleted: { type: Boolean, default: false }
});

const ActivityLogSchema = new mongoose.Schema({
    user: { type: String, required: true },
    action: { type: String, required: true }, // CREATE, UPDATE, DELETE
    target: { type: String, required: true }, // Customer, Transaction, User
    details: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    locationId: { type: String, default: 'main' }
});

const MonthlyBalanceSchema = new mongoose.Schema({
    locationId: { type: String, required: true },
    month: { type: String, required: true }, // Format: YYYY-MM
    openingBalance: { type: Number, required: true },
    updatedBy: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance optimization
StockTransferSchema.index({ fromLocationId: 1, dispatchedDate: -1 });
StockTransferSchema.index({ toLocationId: 1, receivedDate: -1 });
StockTransferSchema.index({ isDeleted: 1, status: 1 });

CustomerSchema.index({ locationId: 1, name: 1 });
CustomerSchema.index({ currentBalance: 1 });

TransactionSchema.index({ customerId: 1, isDeleted: 1 });
TransactionSchema.index({ locationId: 1, date: -1 });
TransactionSchema.index({ date: -1 });
TransactionSchema.index({ isDeleted: 1 });
TransactionSchema.index({ receiptNo: -1 });

// Compile models
const LocationModel = mongoose.model('Location', LocationSchema);
const CounterModel = mongoose.model('Counter', CounterSchema);
const StockTransferModel = mongoose.model('StockTransfer', StockTransferSchema);
const RoleModel = mongoose.model('Role', RoleSchema);
const UserModel = mongoose.model('User', UserSchema);
const CustomerModel = mongoose.model('Customer', CustomerSchema);
const TransactionModel = mongoose.model('Transaction', TransactionSchema);
const ActivityLogModel = mongoose.model('ActivityLog', ActivityLogSchema);
const MonthlyBalanceModel = mongoose.model('MonthlyBalance', MonthlyBalanceSchema);
const DamageLogModel = mongoose.model('DamageLog', DamageLogSchema);
const SystemSettingModel = mongoose.model('SystemSetting', SystemSettingSchema);

// Helper function to map _id to id
const mapDoc = (doc) => {
    if (!doc) return null;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    obj.id = obj._id;
    return obj;
};

// Helper function to generate location-specific document numbers
const generateDocNo = async (locationCode, type) => {
    // type: 'TFR' or 'GRN'
    const prefix = locationCode ? `${locationCode}${type}` : `SYS${type}`;
    const counterId = `${locationCode || 'SYS'}_${type}`;
    const counter = await CounterModel.findByIdAndUpdate(
        counterId,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    const seqNum = counter.seq.toString().padStart(5, '0');
    return `${prefix}${seqNum}`; // e.g. HOTFR00001
};

// Locations CRUD
const Location = {
    getAll: async () => {
        const locations = await LocationModel.find({}).lean();
        return locations.map(mapDoc);
    },
    getById: async (id) => {
        const doc = await LocationModel.findById(id).lean();
        return mapDoc(doc);
    },
    create: async (locationData) => {
        const id = locationData.id || Date.now().toString();
        const newLocation = new LocationModel({
            _id: id,
            name: locationData.name,
            code: locationData.code,
            address: locationData.address,
            currentStock: parseInt(locationData.currentStock) || 0
        });
        await newLocation.save();
        return mapDoc(newLocation);
    },
    update: async (id, locationData) => {
        const loc = await LocationModel.findById(id);
        if (loc) {
            if (locationData.name) loc.name = locationData.name;
            if (locationData.code) loc.code = locationData.code;
            if (locationData.address) loc.address = locationData.address;
            if (locationData.currentStock !== undefined) loc.currentStock = parseInt(locationData.currentStock) || 0;
            await loc.save();
            return mapDoc(loc);
        }
        return null;
    },
    delete: async (id) => {
        if (id === 'main') throw new Error('Cannot delete main branch');
        await LocationModel.deleteOne({ _id: id });
    }
};

// Stock Transfer (GRN) CRUD
const StockTransfer = {
    getAll: async (locationId = null, role = 'user', queryParams = {}) => {
        let filter = { isDeleted: { $ne: true } };

        if (role !== 'admin' && locationId) {
            filter.$or = [
                { fromLocationId: locationId },
                { toLocationId: locationId }
            ];
        }

        if (queryParams.startDate || queryParams.endDate) {
            let dateCondition = {};
            if (queryParams.startDate) {
                dateCondition.$gte = new Date(queryParams.startDate);
            }
            if (queryParams.endDate) {
                const end = new Date(queryParams.endDate);
                end.setHours(23, 59, 59, 999);
                dateCondition.$lte = end;
            }

            if (queryParams.page === 'receive') {
                filter.$and = filter.$and || [];
                filter.$and.push({
                    $or: [
                        { status: 'PENDING', dispatchedDate: dateCondition },
                        { status: { $ne: 'PENDING' }, receivedDate: dateCondition },
                        { status: { $ne: 'PENDING' }, receivedDate: { $exists: false }, dispatchedDate: dateCondition }
                    ]
                });
            } else {
                filter.dispatchedDate = dateCondition;
            }
        }

        if (queryParams.srcLocation && queryParams.srcLocation !== 'All') {
            filter.fromLocationId = queryParams.srcLocation;
        }
        if (queryParams.destLocation && queryParams.destLocation !== 'All') {
            filter.toLocationId = queryParams.destLocation;
        }
        if (queryParams.status && queryParams.status !== 'Select' && queryParams.status !== 'All') {
            filter.status = queryParams.status;
        }
        if (queryParams.distributor && queryParams.distributor !== 'Head Office') {
            filter.distributor = new RegExp(queryParams.distributor, 'i');
        }
        if (queryParams.serialNo) {
            filter.serialNo = new RegExp(queryParams.serialNo, 'i');
        }
        if (queryParams.refNo) {
            filter.refNo = new RegExp(queryParams.refNo, 'i');
        }
        if (queryParams.rep && queryParams.rep !== 'Select') {
            filter.rep = new RegExp(queryParams.rep, 'i');
        }
        if (queryParams.route && queryParams.route !== 'Select') {
            filter.route = new RegExp(queryParams.route, 'i');
        }

        const transfers = await StockTransferModel.find(filter).sort({ dispatchedDate: -1 }).lean();
        return transfers.map(mapDoc);
    },
    dispatch: async (transferData) => {
        const fromLoc = await LocationModel.findById(transferData.fromLocationId);
        const toLoc = await LocationModel.findById(transferData.toLocationId);

        if (!fromLoc) throw new Error('Source location not found');
        if (!toLoc) throw new Error('Destination location not found');
        if (fromLoc.currentStock < transferData.dispatchedQty) {
            throw new Error(`Not enough stock in ${fromLoc.name}. Current stock: ${fromLoc.currentStock}`);
        }

        // Deduct from source branch
        fromLoc.currentStock -= transferData.dispatchedQty;
        await fromLoc.save();

        const id = Date.now().toString();
        const transferDocNo = await generateDocNo(fromLoc.code, 'TFR');

        const newTransfer = new StockTransferModel({
            _id: id,
            transferDocNo: transferDocNo,
            fromLocationId: fromLoc._id,
            fromLocationName: fromLoc.name,
            toLocationId: toLoc._id,
            toLocationName: toLoc.name,
            dispatchedQty: transferData.dispatchedQty,
            vehicleNo: transferData.vehicleNo,
            rep: transferData.rep,
            route: transferData.route,
            distributor: transferData.distributor,
            serialNo: transferData.serialNo,
            refNo: transferData.refNo,
            remarks: transferData.remarks,
            dispatchedBy: transferData.dispatchedBy,
            dispatchedDate: transferData.dispatchedDate || Date.now(),
            status: 'PENDING'
        });

        await newTransfer.save();
        return mapDoc(newTransfer);
    },
    update: async (id, updateData) => {
        const transfer = await StockTransferModel.findById(id);
        if (!transfer) throw new Error('Transfer not found');
        if (transfer.status !== 'PENDING') throw new Error('Only PENDING transfers can be edited');

        // Check if qty changed
        if (updateData.dispatchedQty && parseInt(updateData.dispatchedQty) !== transfer.dispatchedQty) {
            const newQty = parseInt(updateData.dispatchedQty);
            const fromLoc = await LocationModel.findById(transfer.fromLocationId);
            if (!fromLoc) throw new Error('Source location not found');

            // Calculate difference
            const diff = newQty - transfer.dispatchedQty;

            // If diff > 0, we are dispatching more. Check if enough stock.
            if (diff > 0 && fromLoc.currentStock < diff) {
                throw new Error(`Not enough stock in ${fromLoc.name} to increase transfer quantity. Current stock: ${fromLoc.currentStock}`);
            }

            fromLoc.currentStock -= diff;
            await fromLoc.save();
            transfer.dispatchedQty = newQty;
        }

        if (updateData.vehicleNo !== undefined) transfer.vehicleNo = updateData.vehicleNo;
        if (updateData.remarks !== undefined) transfer.remarks = updateData.remarks;
        if (updateData.dispatchedDate) transfer.dispatchedDate = updateData.dispatchedDate;

        if (updateData.toLocationId && updateData.toLocationId !== transfer.toLocationId) {
            const newToLoc = await LocationModel.findById(updateData.toLocationId);
            if (!newToLoc) throw new Error('New destination location not found');
            transfer.toLocationId = newToLoc._id;
            transfer.toLocationName = newToLoc.name;
        }

        await transfer.save();
        return mapDoc(transfer);
    },
    backdate: async (id, dispatchedDate, receivedDate) => {
        const transfer = await StockTransferModel.findById(id);
        if (!transfer) throw new Error('Transfer not found');
        if (transfer.status !== 'ACCEPTED') throw new Error('Only ACCEPTED transfers can be backdated using this function');

        if (dispatchedDate) transfer.dispatchedDate = dispatchedDate;
        if (receivedDate) transfer.receivedDate = receivedDate;

        await transfer.save();
        return mapDoc(transfer);
    },
    processGRN: async (id, grnData) => {
        const transfer = await StockTransferModel.findById(id);
        if (!transfer) throw new Error('Transfer not found');
        if (transfer.status !== 'PENDING') throw new Error('Transfer already processed');

        const toLoc = await LocationModel.findById(transfer.toLocationId);
        if (!toLoc) throw new Error('Destination location not found');

        if (grnData.action === 'REJECT') {
            transfer.status = 'REJECTED';
            transfer.remarks = (transfer.remarks ? transfer.remarks + ' | ' : '') + 'Rejected by ' + grnData.receivedBy;
            transfer.receivedDate = grnData.receivedDate || new Date();
            transfer.receivedBy = grnData.receivedBy;
            await transfer.save();

            // Return stock to sender
            const fromLoc = await LocationModel.findById(transfer.fromLocationId);
            if (fromLoc) {
                fromLoc.currentStock += transfer.dispatchedQty;
                await fromLoc.save();
            }
            return mapDoc(transfer);
        }

        if (grnData.action === 'ACCEPT') {
            transfer.status = 'ACCEPTED';
            transfer.receivedQty = parseInt(grnData.receivedQty) || 0;
            transfer.variance = transfer.receivedQty - transfer.dispatchedQty;
            transfer.receivedDate = grnData.receivedDate || new Date();
            transfer.receivedBy = grnData.receivedBy;
            transfer.grnNo = await generateDocNo(toLoc.code, 'GRN');
            await transfer.save();

            // Add received stock to destination branch
            toLoc.currentStock += transfer.receivedQty;
            await toLoc.save();

            // Handle lost trays (variance) - if variance < 0, trays were lost in transit
            if (transfer.variance < 0) {
                // E.g., Dispatched 50, Received 45 -> Variance = -5
                // The -5 means 5 trays are lost.
                toLoc.lostTrays = (toLoc.lostTrays || 0) + Math.abs(transfer.variance);
                await toLoc.save();
            }
            return mapDoc(transfer);
        }
    },
    delete: async (id) => {
        const transfer = await StockTransferModel.findById(id);
        if (!transfer) return false;

        const fromLoc = await LocationModel.findById(transfer.fromLocationId);

        if (transfer.status === 'PENDING') {
            if (fromLoc) {
                fromLoc.currentStock += transfer.dispatchedQty;
                await fromLoc.save();
            }
        } else if (transfer.status === 'ACCEPTED') {
            if (fromLoc) {
                fromLoc.currentStock += transfer.dispatchedQty;
                await fromLoc.save();
            }
            const toLoc = await LocationModel.findById(transfer.toLocationId);
            if (toLoc) {
                toLoc.currentStock -= transfer.receivedQty;
                if (transfer.variance < 0) {
                    toLoc.lostTrays = (toLoc.lostTrays || 0) - Math.abs(transfer.variance);
                }
                await toLoc.save();
            }
        }

        await StockTransferModel.updateOne({ _id: id }, { isDeleted: true });
        return transfer;
    }
};

// Customers CRUD
const Customer = {
    getAll: async (locationId = null, role = 'user') => {
        let filter = {};
        // If not global admin and a locationId is provided, filter by location
        if (role !== 'admin' && locationId) {
            filter.locationId = locationId;
        }
        const customers = await CustomerModel.find(filter).lean();
        const mapped = customers.map(mapDoc);
        return mapped.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    },
    getById: async (id) => {
        const doc = await CustomerModel.findById(id).lean();
        return mapDoc(doc);
    },
    create: async (customerData) => {
        const id = Date.now().toString();
        const newCustomer = new CustomerModel({
            _id: id,
            name: customerData.name,
            address: customerData.address,
            phone: customerData.phone,
            initialBalance: parseInt(customerData.initialBalance) || 0,
            currentBalance: parseInt(customerData.initialBalance) || 0,
            locationId: customerData.locationId || 'main'
        });
        await newCustomer.save();
        return mapDoc(newCustomer);
    },
    update: async (id, customerData) => {
        const customer = await CustomerModel.findById(id);
        if (customer) {
            customer.name = customerData.name;
            customer.address = customerData.address;
            customer.phone = customerData.phone;

            // Recalculate balance based on initialBalance and all transactions
            const transactions = await TransactionModel.find({ customerId: id, isDeleted: { $ne: true } });
            let netTx = 0;
            transactions.forEach(t => {
                if (t.type === 'OUT') {
                    netTx += t.count;
                } else if (t.type === 'IN') {
                    netTx -= t.count;
                }
            });

            if (customerData.currentBalance !== undefined && customerData.currentBalance !== null && customerData.currentBalance !== '') {
                const targetCurrentBalance = parseInt(customerData.currentBalance) || 0;
                customer.currentBalance = targetCurrentBalance;
                customer.initialBalance = targetCurrentBalance - netTx;
            } else {
                customer.initialBalance = parseInt(customerData.initialBalance) || 0;
                customer.currentBalance = customer.initialBalance + netTx;
            }

            await customer.save();
            return mapDoc(customer);
        }
        return null;
    },
    delete: async (id) => {
        const customerExists = await CustomerModel.findById(id);
        if (customerExists) {
            await CustomerModel.deleteOne({ _id: id });
            await TransactionModel.deleteMany({ customerId: id });
            return true;
        }
        return false;
    },
    recalculateCustomerBalance: async (customerId) => {
        const customer = await CustomerModel.findById(customerId);
        if (customer) {
            let balance = customer.initialBalance;
            const transactions = await TransactionModel.find({ customerId: customer._id, isDeleted: { $ne: true } });
            transactions.forEach(t => {
                if (t.type === 'OUT') balance += t.count;
                if (t.type === 'IN') balance -= t.count;
            });
            customer.currentBalance = balance;
            await customer.save();
        }
    },
    recalculateBalances: async () => {
        const customers = await CustomerModel.find({});
        for (const customer of customers) {
            let balance = customer.initialBalance;
            const customerTx = await TransactionModel.find({ customerId: customer._id, isDeleted: { $ne: true } });
            customerTx.forEach(t => {
                if (t.type === 'OUT') balance += t.count;
                if (t.type === 'IN') balance -= t.count;
            });
            customer.currentBalance = balance;
            await customer.save();
        }
    },
    getAlerts: async () => {
        const thresholdDays = 7; // 1 week
        const thresholdQty = 50; // 50 trays

        const customers = await CustomerModel.find({ currentBalance: { $gt: 0 } });
        const alerts = [];
        const now = new Date();

        for (const customer of customers) {
            const lastTx = await TransactionModel.findOne({ customerId: customer._id, isDeleted: { $ne: true } }).sort({ date: -1, _id: -1 });
            if (lastTx) {
                const txDate = new Date(lastTx.date);
                const diffTime = now.getTime() - txDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays >= thresholdDays || customer.currentBalance >= thresholdQty) {
                    alerts.push({
                        customerId: customer._id,
                        customerName: customer.name,
                        phone: customer.phone,
                        currentBalance: customer.currentBalance,
                        lastTransactionDate: lastTx.date,
                        daysPending: diffDays
                    });
                }
            } else {
                if (customer.currentBalance >= thresholdQty) {
                    alerts.push({
                        customerId: customer._id,
                        customerName: customer.name,
                        phone: customer.phone,
                        currentBalance: customer.currentBalance,
                        lastTransactionDate: now,
                        daysPending: 0
                    });
                }
            }
        }

        alerts.sort((a, b) => b.daysPending - a.daysPending || b.currentBalance - a.currentBalance);
        return alerts;
    },

    getAggregatedCustomerBalances: async (startDateStr, endDateStr, locationId = null, role = 'user') => {
        const startTimestamp = startDateStr ? new Date(startDateStr + 'T00:00:00').getTime() : 0;
        const endTimestamp = endDateStr ? new Date(endDateStr + 'T23:59:59').getTime() : Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;

        const agg = await TransactionModel.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            {
                $addFields: {
                    txDate: { $toDate: "$date" }
                }
            },
            {
                $group: {
                    _id: "$customerId",
                    pastOut: { $sum: { $cond: [{ $and: [{ $lt: ["$txDate", new Date(startTimestamp)] }, { $eq: ["$type", "OUT"] }] }, "$count", 0] } },
                    pastIn: { $sum: { $cond: [{ $and: [{ $lt: ["$txDate", new Date(startTimestamp)] }, { $eq: ["$type", "IN"] }] }, "$count", 0] } },
                    pastDepositCollected: { $sum: { $cond: [{ $and: [{ $lt: ["$txDate", new Date(startTimestamp)] }, { $eq: ["$type", "OUT"] }] }, { $ifNull: ["$totalDeposit", 0] }, 0] } },
                    pastDepositRefunded: { $sum: { $cond: [{ $and: [{ $lt: ["$txDate", new Date(startTimestamp)] }, { $eq: ["$type", "IN"] }] }, { $ifNull: ["$totalDeposit", 0] }, 0] } },
                    periodOut: { $sum: { $cond: [{ $and: [{ $gte: ["$txDate", new Date(startTimestamp)] }, { $lte: ["$txDate", new Date(endTimestamp)] }, { $eq: ["$type", "OUT"] }] }, "$count", 0] } },
                    periodIn: { $sum: { $cond: [{ $and: [{ $gte: ["$txDate", new Date(startTimestamp)] }, { $lte: ["$txDate", new Date(endTimestamp)] }, { $eq: ["$type", "IN"] }] }, "$count", 0] } },
                    depositCollected: { $sum: { $cond: [{ $and: [{ $gte: ["$txDate", new Date(startTimestamp)] }, { $lte: ["$txDate", new Date(endTimestamp)] }, { $eq: ["$type", "OUT"] }] }, { $ifNull: ["$totalDeposit", 0] }, 0] } },
                    depositRefunded: { $sum: { $cond: [{ $and: [{ $gte: ["$txDate", new Date(startTimestamp)] }, { $lte: ["$txDate", new Date(endTimestamp)] }, { $eq: ["$type", "IN"] }] }, { $ifNull: ["$totalDeposit", 0] }, 0] } }
                }
            }
        ]);

        const txStatsMap = {};
        agg.forEach(stat => {
            txStatsMap[stat._id] = stat;
        });

        let filter = {};
        if (role !== 'admin' && locationId) {
            filter.locationId = locationId;
        }
        const customers = await CustomerModel.find(filter).lean();
        const customerBalances = customers.map(c => {
            const stats = txStatsMap[c._id] || { pastOut: 0, pastIn: 0, pastDepositCollected: 0, pastDepositRefunded: 0, periodOut: 0, periodIn: 0, depositCollected: 0, depositRefunded: 0 };

            const openingBalance = c.initialBalance + stats.pastOut - stats.pastIn;
            const openingDepositOutstanding = stats.pastDepositCollected - stats.pastDepositRefunded;

            const closingBalance = openingBalance + stats.periodOut - stats.periodIn;
            const depositOutstanding = openingDepositOutstanding + stats.depositCollected - stats.depositRefunded;

            return {
                id: String(c._id),
                name: c.name,
                phone: c.phone,
                initialBalance: openingBalance,
                totalOut: stats.periodOut,
                totalIn: stats.periodIn,
                currentBalance: closingBalance,
                depositCollected: stats.depositCollected,
                depositRefunded: stats.depositRefunded,
                depositOutstanding
            };
        });

        return customerBalances.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    }
};

// Transactions CRUD
const Transaction = {
    getAll: async (locationId = null, role = 'user') => {
        let filter = { isDeleted: { $ne: true } };
        if (role !== 'admin' && locationId) {
            filter.locationId = locationId;
        }
        const transactions = await TransactionModel.find(filter).lean();
        return transactions.map(mapDoc);
    },
    getPaginated: async (page = 1, limit = 50, search = '', locationId = null, role = 'user') => {
        let query = { isDeleted: { $ne: true } };
        if (search) {
            query.customerName = { $regex: search, $options: 'i' };
        }
        if (role !== 'admin' && locationId) {
            query.locationId = locationId;
        }
        const total = await TransactionModel.countDocuments(query);
        const skip = (page - 1) * limit;
        const docs = await TransactionModel.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean();
        return {
            transactions: docs.map(mapDoc),
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    },
    getById: async (id) => {
        const doc = await TransactionModel.findById(id).lean();
        return mapDoc(doc);
    },
    create: async (txData, username) => {
        const customer = await CustomerModel.findById(txData.customerId);
        if (!customer) {
            throw new Error('Customer not found');
        }

        const count = parseInt(txData.count) || 0;
        const type = txData.type;

        let depositPerTray = parseFloat(txData.depositPerTray);
        if (isNaN(depositPerTray)) {
            const sysSetting = await SystemSettingModel.findById('global_config');
            depositPerTray = sysSetting && sysSetting.depositPerTray ? sysSetting.depositPerTray : 2000;
        }
        const expectedDeposit = depositPerTray * count;

        let depositOption = txData.depositOption || 'FULL';
        let actualDeposit = expectedDeposit;

        if (txData.actualDeposit !== undefined && txData.actualDeposit !== null && txData.actualDeposit !== '') {
            actualDeposit = parseFloat(txData.actualDeposit);
            if (isNaN(actualDeposit)) actualDeposit = 0;

            if (txData.depositOption === 'CUSTOM') {
                depositOption = 'CUSTOM';
            } else if (txData.depositOption === 'HALF' || actualDeposit === expectedDeposit / 2) {
                depositOption = (actualDeposit === expectedDeposit / 2) ? 'HALF' : 'CUSTOM';
            } else if (txData.depositOption === 'ZERO' || actualDeposit === 0) {
                depositOption = (actualDeposit === 0) ? 'ZERO' : 'CUSTOM';
            } else if (actualDeposit === expectedDeposit) {
                depositOption = 'FULL';
            } else {
                depositOption = 'CUSTOM';
            }
        } else if (depositOption === 'HALF') {
            actualDeposit = expectedDeposit / 2;
        } else if (depositOption === 'ZERO') {
            actualDeposit = 0;
        }

        // Generate sequential receipt number
        const lastTx = await TransactionModel.findOne({ receiptNo: { $exists: true, $ne: null, $gt: 0 } }).sort({ receiptNo: -1 }).lean();
        const nextReceiptNo = lastTx ? lastTx.receiptNo + 1 : 1;
        console.log('[Receipt] Last receiptNo:', lastTx ? lastTx.receiptNo : 'none', '-> Next:', nextReceiptNo);

        const txId = txData._id || (Date.now().toString() + '_' + Math.random().toString(36).substr(2, 6));
        const newTx = new TransactionModel({
            _id: txId,
            customerId: txData.customerId,
            customerName: customer.name,
            type: type,
            count: count,
            depositPerTray: depositPerTray,
            expectedDeposit: expectedDeposit,
            totalDeposit: actualDeposit,
            depositOption: depositOption,
            vehicleNo: txData.vehicleNo || 'N/A',
            remarks: txData.remarks || '',
            date: txData.date || new Date().toISOString(),
            user: username || 'System',
            receiptNo: nextReceiptNo,
            locationId: txData.locationId || customer.locationId || 'main'
        });

        await newTx.save();
        await Customer.recalculateCustomerBalance(txData.customerId);

        // Update branch warehouse current stock in real-time
        const locId = newTx.locationId || 'main';
        const loc = await LocationModel.findById(locId);
        if (loc) {
            if (type === 'OUT') {
                loc.currentStock = Math.max(0, (loc.currentStock || 0) - count);
            } else if (type === 'IN') {
                loc.currentStock = (loc.currentStock || 0) + count;
            }
            await loc.save();
        }

        return mapDoc(newTx);
    },
    delete: async (id) => {
        const tx = await TransactionModel.findById(id);
        if (tx) {
            await TransactionModel.updateOne({ _id: id }, { isDeleted: true });
            await Customer.recalculateCustomerBalance(tx.customerId);

            // Reverse branch warehouse stock adjustment
            const locId = tx.locationId || 'main';
            const loc = await LocationModel.findById(locId);
            if (loc) {
                if (tx.type === 'OUT') {
                    loc.currentStock = (loc.currentStock || 0) + (tx.count || 0);
                } else if (tx.type === 'IN') {
                    loc.currentStock = Math.max(0, (loc.currentStock || 0) - (tx.count || 0));
                }
                await loc.save();
            }

            return true;
        }
        return false;
    },
    update: async (id, txData, username) => {
        const tx = await TransactionModel.findById(id);
        if (!tx) throw new Error('Transaction not found');

        const oldCustomerId = tx.customerId;

        if (txData.customerId) {
            const customer = await CustomerModel.findById(txData.customerId);
            if (!customer) throw new Error('Customer not found');
            tx.customerId = txData.customerId;
            tx.customerName = customer.name;
        }

        if (txData.type) tx.type = txData.type;
        if (txData.count !== undefined) tx.count = parseInt(txData.count) || 0;
        if (txData.depositPerTray !== undefined) tx.depositPerTray = parseFloat(txData.depositPerTray) || 2000;

        tx.expectedDeposit = tx.depositPerTray * tx.count;

        let depositOption = txData.depositOption || tx.depositOption;
        let actualDeposit = tx.totalDeposit;

        if (txData.actualDeposit !== undefined && txData.actualDeposit !== null && txData.actualDeposit !== '') {
            actualDeposit = parseFloat(txData.actualDeposit);
            if (isNaN(actualDeposit)) actualDeposit = 0;

            if (txData.depositOption === 'CUSTOM') {
                depositOption = 'CUSTOM';
            } else if (txData.depositOption === 'HALF' || actualDeposit === tx.expectedDeposit / 2) {
                depositOption = (actualDeposit === tx.expectedDeposit / 2) ? 'HALF' : 'CUSTOM';
            } else if (txData.depositOption === 'ZERO' || actualDeposit === 0) {
                depositOption = (actualDeposit === 0) ? 'ZERO' : 'CUSTOM';
            } else if (actualDeposit === tx.expectedDeposit) {
                depositOption = 'FULL';
            } else {
                depositOption = 'CUSTOM';
            }
        } else if (txData.depositOption) {
            if (depositOption === 'HALF') actualDeposit = tx.expectedDeposit / 2;
            else if (depositOption === 'ZERO') actualDeposit = 0;
            else if (depositOption === 'FULL') actualDeposit = tx.expectedDeposit;
        }

        tx.totalDeposit = actualDeposit;
        tx.depositOption = depositOption;

        if (txData.vehicleNo) tx.vehicleNo = txData.vehicleNo;
        if (txData.remarks !== undefined) tx.remarks = txData.remarks;
        if (txData.date) tx.date = txData.date;

        tx.user = username || tx.user;

        await tx.save();

        await Customer.recalculateCustomerBalance(tx.customerId);
        if (oldCustomerId !== tx.customerId) {
            await Customer.recalculateCustomerBalance(oldCustomerId);
        }

        return mapDoc(tx);
    }
};

// User verification and management
const User = {
    verify: async (username, password) => {
        const user = await UserModel.findOne({ username });
        if (!user || !user.password) return null;

        // Check if password is a bcrypt hash
        if (typeof user.password === 'string' && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) return mapDoc(user);
            return null;
        } else {
            // Migration fallback for existing plain-text passwords
            if (user.password === password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(password, salt);
                await user.save();
                return mapDoc(user);
            }
            return null;
        }
    },
    getById: async (id) => {
        const user = await UserModel.findById(id);
        return mapDoc(user);
    },
    getAll: async () => {
        const users = await UserModel.find({});
        return users.map(mapDoc);
    },
    create: async (data) => {
        // Check if username exists
        const existing = await UserModel.findOne({ username: data.username });
        if (existing) {
            throw new Error("Username already exists.");
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(data.password, salt);

        const id = Date.now().toString();
        const newUser = new UserModel({
            _id: id,
            username: data.username,
            password: hashedPassword,
            role: data.role || 'user',
            roleId: data.roleId || null,
            locationId: data.locationId || 'main'
        });

        await newUser.save();
        return mapDoc(newUser);
    },
    update: async (id, data) => {
        const user = await UserModel.findById(id);
        if (user) {
            if (data.username) user.username = data.username;
            if (data.role) user.role = data.role;
            if (data.roleId !== undefined) user.roleId = data.roleId || null;
            if (data.locationId) user.locationId = data.locationId;
            if (data.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(data.password, salt);
            }
            await user.save();
            return mapDoc(user);
        }
        return null;
    },
    delete: async (id) => {
        const user = await UserModel.findById(id);
        if (user && user.username !== 'admin') { // Prevent deleting main admin
            await UserModel.findByIdAndDelete(id);
        }
    }
};

const ActivityLog = {
    log: async (user, action, target, details) => {
        try {
            await ActivityLogModel.create({ user, action, target, details });
        } catch (err) {
            console.error('Failed to write activity log:', err);
        }
    },
    create: async (data) => {
        try {
            if (typeof data === 'object') {
                const { user, action, target, details } = data;
                await ActivityLogModel.create({ user, action, target, details });
            }
        } catch (err) {
            console.error('Failed to write activity log:', err);
        }
    },
    getRecent: async (limit = 200) => {
        return await ActivityLogModel.find({}).sort({ timestamp: -1 }).limit(limit);
    }
};

const MonthlyBalance = {
    getByMonth: async (locationId, month) => {
        const doc = await MonthlyBalanceModel.findOne({ locationId, month });
        return doc ? doc.toObject() : null;
    },
    saveBalance: async (locationId, month, openingBalance, updatedBy) => {
        return await MonthlyBalanceModel.findOneAndUpdate(
            { locationId, month },
            { openingBalance, updatedBy, updatedAt: new Date() },
            { upsert: true, new: true }
        );
    }
};

const SystemTools = {
    restoreData: async (backupData) => {
        try {
            // Delete existing records
            await TransactionModel.deleteMany({});
            await CustomerModel.deleteMany({});
            await UserModel.deleteMany({ username: { $ne: 'admin' } }); // Keep main admin

            // Insert new records
            if (backupData.transactions && backupData.transactions.length > 0) {
                // Ensure _id fields are mapped correctly for mongoose insertion
                const txs = backupData.transactions.map(t => ({ ...t, _id: t.id || t._id }));
                await TransactionModel.insertMany(txs);
            }
            if (backupData.customers && backupData.customers.length > 0) {
                const custs = backupData.customers.map(c => ({ ...c, _id: c.id || c._id }));
                await CustomerModel.insertMany(custs);
            }
            if (backupData.users && backupData.users.length > 0) {
                // Filter out the 'admin' from backup to prevent duplication issues 
                // if we are keeping our own admin. Or overwrite if we want to restore old passwords.
                // It's safer to overwrite if the backup has an admin, so let's delete our admin 
                // if the backup has one.
                const backupHasAdmin = backupData.users.some(u => u.username === 'admin');
                if (backupHasAdmin) {
                    await UserModel.deleteMany({ username: 'admin' });
                }
                const users = backupData.users.map(u => ({ ...u, _id: u.id || u._id }));
                await UserModel.insertMany(users);
            }
            return true;
        } catch (err) {
            console.error('Error during database restore:', err);
            throw err;
        }
    }
};

const Role = {
    getAll: async () => {
        const roles = await RoleModel.find({});
        return roles.map(mapDoc);
    },
    getById: async (id) => {
        const role = await RoleModel.findById(id);
        return mapDoc(role);
    },
    create: async (data) => {
        const existing = await RoleModel.findOne({ name: data.name });
        if (existing) throw new Error("Role name already exists.");

        const id = Date.now().toString();
        const newRole = new RoleModel({
            _id: id,
            name: data.name,
            isSuperUser: data.isSuperUser || false,
            permissions: data.permissions || []
        });
        await newRole.save();
        return mapDoc(newRole);
    },
    update: async (id, data) => {
        const role = await RoleModel.findById(id);
        if (role) {
            if (data.name) {
                const existing = await RoleModel.findOne({ name: data.name, _id: { $ne: id } });
                if (existing) throw new Error("Role name already exists.");
                role.name = data.name;
            }
            if (data.isSuperUser !== undefined) role.isSuperUser = data.isSuperUser;
            if (data.permissions) role.permissions = data.permissions;
            await role.save();
            return mapDoc(role);
        }
        return null;
    },
    delete: async (id) => {
        // Prevent deleting if users are assigned to this role
        const usersWithRole = await UserModel.countDocuments({ roleId: id });
        if (usersWithRole > 0) {
            throw new Error(`Cannot delete role. It is assigned to ${usersWithRole} user(s).`);
        }
        await RoleModel.findByIdAndDelete(id);
    }
};

const DamageLog = {
    getAll: async (locationId = null) => {
        const query = (locationId && locationId !== 'main') ? { locationId } : {};
        const logs = await DamageLogModel.find(query).sort({ date: -1 });
        return logs.map(mapDoc);
    },
    create: async (data) => {
        const id = Date.now().toString();
        const damageNo = `DMG-${Date.now().toString().slice(-6)}`;
        const newLog = new DamageLogModel({
            _id: id,
            damageNo,
            locationId: data.locationId || 'main',
            locationName: data.locationName || 'Head Office',
            type: data.type || 'DAMAGED',
            qty: parseInt(data.qty) || 0,
            reason: data.reason || '',
            reportedBy: data.reportedBy || 'System',
            date: new Date()
        });
        await newLog.save();

        // Reduce location stock
        const loc = await LocationModel.findById(data.locationId || 'main');
        if (loc) {
            loc.currentStock = Math.max(0, (loc.currentStock || 0) - (parseInt(data.qty) || 0));
            await loc.save();
        }
        return mapDoc(newLog);
    },
    getById: async (id) => {
        const doc = await DamageLogModel.findById(id);
        return mapDoc(doc);
    },
    update: async (id, data) => {
        const log = await DamageLogModel.findById(id);
        if (!log) return null;

        const oldQty = log.qty || 0;
        const newQty = parseInt(data.qty) || 0;
        const qtyDiff = newQty - oldQty;

        if (data.type) log.type = data.type;
        if (data.qty !== undefined) log.qty = newQty;
        if (data.reason !== undefined) log.reason = data.reason;
        if (data.locationId) log.locationId = data.locationId;
        if (data.locationName) log.locationName = data.locationName;
        await log.save();

        if (qtyDiff !== 0) {
            const loc = await LocationModel.findById(log.locationId || 'main');
            if (loc) {
                loc.currentStock = Math.max(0, (loc.currentStock || 0) - qtyDiff);
                await loc.save();
            }
        }
        return mapDoc(log);
    },
    delete: async (id) => {
        const log = await DamageLogModel.findById(id);
        if (log) {
            const qty = log.qty || 0;
            const locId = log.locationId || 'main';
            await DamageLogModel.findByIdAndDelete(id);

            const loc = await LocationModel.findById(locId);
            if (loc) {
                loc.currentStock = (loc.currentStock || 0) + qty;
                await loc.save();
            }
            return true;
        }
        return false;
    }
};

const SystemSetting = {
    get: async () => {
        let setting = await SystemSettingModel.findById('global_config');
        if (!setting) {
            setting = new SystemSettingModel({ _id: 'global_config' });
            await setting.save();
        }
        return mapDoc(setting);
    },
    update: async (data) => {
        let setting = await SystemSettingModel.findById('global_config');
        if (!setting) {
            setting = new SystemSettingModel({ _id: 'global_config' });
        }
        if (data.depositPerTray !== undefined && data.depositPerTray !== '') setting.depositPerTray = parseFloat(data.depositPerTray);
        if (data.companyName) setting.companyName = data.companyName;
        if (data.smsWebhookUrl) setting.smsWebhookUrl = data.smsWebhookUrl;
        if (data.emailReceiver !== undefined) setting.emailReceiver = data.emailReceiver;
        if (data.receiptFooterNote) setting.receiptFooterNote = data.receiptFooterNote;
        await setting.save();
        return mapDoc(setting);
    }
};

module.exports = {
    connectDB,
    Location,
    StockTransfer,
    Customer,
    Transaction,
    User,
    Role,
    ActivityLog,
    MonthlyBalance,
    SystemTools,
    DamageLog,
    SystemSetting,
    StockTransferModel,
    ActivityLogModel,
    TransactionModel,
    CustomerModel,
    RoleModel,
    UserModel,
    DamageLogModel,
    SystemSettingModel,
    CounterModel
};
