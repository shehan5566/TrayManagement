require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB.");
        
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('NelAg@#2021', 10);
        const result = await mongoose.connection.collection('users').updateOne(
            { username: 'admin' },
            { $set: { password: hashedPassword, role: 'admin' } },
            { upsert: true }
        );
        
        console.log('Admin password successfully updated to NelAg@#2021', result);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
})();
