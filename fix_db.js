const fs = require('fs');

const content = fs.readFileSync('db.js', 'utf8');

const target = `    delete: async (id) => {
        if (id === 'main') throw new Error('Cannot delete main branch');
            // We can match distributor text or ID if needed, currently string`;

const replacement = `    delete: async (id) => {
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
            // We can match distributor text or ID if needed, currently string`;

const newContent = content.replace(target, replacement);

fs.writeFileSync('db.js', newContent);
console.log('Fixed db.js');
