require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB.");
        
        const result = await mongoose.connection.collection('users').updateOne(
            { username: 'admin' },
            { $set: { password: 'admin123', role: 'admin' } },
            { upsert: true }
        );
        
        console.log('Admin password reset to plain text: admin123', result);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
})();
