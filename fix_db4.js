const fs = require('fs');

let content = fs.readFileSync('db.js', 'utf8');

content = content.replace(`return mapDoc(newLocation);\r
    update: async (id, locationData) => {`, `return mapDoc(newLocation);\r
    },\r
    update: async (id, locationData) => {`);

content = content.replace(`return mapDoc(newLocation);\n
    update: async (id, locationData) => {`, `return mapDoc(newLocation);\n    },\n    update: async (id, locationData) => {`);
    
content = content.replace(`return mapDoc(newLocation);\n    update: async`, `return mapDoc(newLocation);\n    },\n    update: async`);
content = content.replace(`return mapDoc(newLocation);\r\n    update: async`, `return mapDoc(newLocation);\r\n    },\r\n    update: async`);

fs.writeFileSync('db.js', content);
console.log('Fixed syntax error');
