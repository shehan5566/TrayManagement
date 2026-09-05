require('dotenv').config();

const MACRODROID_WEBHOOK_URL = process.env.MACRODROID_WEBHOOK_URL;

/**
 * Format a phone number to standard local format (e.g., 077...)
 * Mobile phones typically prefer the local 07x format when sending via their own SIM.
 */
const formatPhoneNumber = (phone) => {
    if (!phone) return null;
    let formatted = phone.replace(/\D/g, ''); // Remove all non-numeric characters
    
    // If someone entered 94075... (12 digits) or +94075...
    if (formatted.startsWith('940') && formatted.length === 12) {
        formatted = '0' + formatted.substring(3);
    }
    // If it starts with 94 and is 11 digits (e.g. 9475...) convert to 07x
    else if (formatted.startsWith('94') && formatted.length === 11) {
        formatted = '0' + formatted.substring(2);
    } 
    // If it is 9 digits (e.g. 751234567), prepend 0
    else if (formatted.length === 9) {
        formatted = '0' + formatted;
    }
    
    // Return the formatted 10-digit number (e.g. 0750889713)
    return formatted;
};

/**
 * Send an SMS via MacroDroid Webhook over the internet
 * @param {string} phone - Target phone number
 * @param {string} message - SMS message content
 */
const sendSMS = async (phone, message) => {
    if (!MACRODROID_WEBHOOK_URL) {
        console.warn('MacroDroid Webhook URL not configured. Skipping SMS.');
        return false;
    }

    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
        console.error('Invalid phone number for SMS:', phone);
        return false;
    }

    try {
        // Construct the URL with query parameters for the webhook
        const url = new URL(MACRODROID_WEBHOOK_URL);
        url.searchParams.append('number', formattedPhone);
        url.searchParams.append('msg', message);

        console.log(`Triggering MacroDroid webhook to send SMS to ${formattedPhone}...`);
        
        const response = await fetch(url.toString(), {
            method: 'GET'
        });

        const text = await response.text();

        if (response.ok) {
            console.log(`MacroDroid webhook triggered successfully! SMS requested for ${formattedPhone}.`);
            return true;
        } else {
            console.error(`MacroDroid Webhook failed with status ${response.status}: ${text}`);
            return false;
        }
    } catch (error) {
        console.error('Error triggering MacroDroid Webhook:', error.message);
        return false;
    }
};


/**
 * Send an SMS for a new transaction
 */
const sendTransactionSMS = async (phone, name, tx, newBalance) => {
    const action = tx.type === 'OUT' ? 'Issued' : 'Returned';
    
    // Format receipt number
    const rNo = String(tx.receiptNo || 0).padStart(6, '0');
    
    // Format date nicely
    const d = new Date(tx.date || new Date());
    const dateStr = d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'});
    
    const msg = `--- NELNA AGRI DEVELOPMENT (PVT) LTD ---
Receipt: RE-${rNo}
Date: ${dateStr}
Customer: ${name}
${tx.vehicleNo ? `Vehicle: ${tx.vehicleNo}\n` : ''}-----------------
Trays ${action}: ${tx.count}
-----------------
New Balance: ${newBalance} Trays
Thank you!`;
    
    return await sendSMS(phone, msg);
};


/**
 * Send an SMS manually for balance reminder
 */
const sendManualSMS = async (phone, name, balance) => {
    const d = new Date();
    const dateStr = d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'});
    
    const msg = `--- NELNA AGRI DEVELOPMENT (PVT) LTD ---
BALANCE REMINDER
Date: ${dateStr}
Customer: ${name}
-----------------
Current Balance: ${balance} Trays
-----------------
Please return the due trays at your earliest convenience.
Thank you!`;
    
    return await sendSMS(phone, msg);
};

module.exports = { sendSMS, formatPhoneNumber, sendTransactionSMS, sendManualSMS };



