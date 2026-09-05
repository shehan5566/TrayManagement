const fs = require('fs');
let lines = fs.readFileSync('db.js', 'utf8').split('\n');

// I will fix it completely by finding the exact lines and fixing them
// Because the file is completely messed up right now due to the last replacement.

// First, I'll find where `const mapDoc = (doc) => {` is defined.
// It might be duplicated. I'll remove all duplicates and reconstruct the file cleanly.

// Actually, let me just download the file, parse it, and write it cleanly.
// Since I can't download, I will just do:
let cleanLines = [];
let insideDuplicate = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if we hit the duplicate start
    if (line.includes('// Compile models') && i > 100) {
        // Find if it was already defined before
        const firstIndex = cleanLines.findIndex(l => l.includes('// Compile models'));
        if (firstIndex !== -1) {
            insideDuplicate = true;
            continue;
        }
    }
    
    if (insideDuplicate) {
        // Where does duplicate end?
        if (line.includes('    update: async (id, locationData) => {')) {
            insideDuplicate = false;
            cleanLines.push('    },');
            cleanLines.push(line);
        }
        continue;
    }
    
    cleanLines.push(line);
}

fs.writeFileSync('db.js', cleanLines.join('\n'));
console.log('Fixed file lines: ' + cleanLines.length);
