const fs = require('fs');

let content = fs.readFileSync('db.js', 'utf8');

// I will extract the file up to line 169 (before the duplicated Compile models)
// Let's find the FIRST occurrence of 'return mapDoc(newLocation);'
const idx1 = content.indexOf('return mapDoc(newLocation);');

// The second part is after the duplicate ends. The duplicate ends around the correct 'dispatch: async'
const dispatchIdx = content.indexOf('    dispatch: async (transferData) => {');

if (idx1 !== -1 && dispatchIdx !== -1) {
    const startPart = content.substring(0, idx1 + 'return mapDoc(newLocation);'.length + 2); // +2 for \r\n
    
    const properMiddle = `
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

        const transfers = await StockTransferModel.find(filter).sort({ dispatchedDate: -1 });
        return transfers.map(mapDoc);
    },
`;
    
    const endPart = content.substring(dispatchIdx);
    
    fs.writeFileSync('db.js', startPart + properMiddle + endPart);
    console.log('Successfully repaired db.js');
} else {
    console.log('Failed to find indexes');
}
