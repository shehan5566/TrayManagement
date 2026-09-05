const { exec } = require('child_process');
const child = exec('node server.js');
let stdout = '';
let stderr = '';
child.stdout.on('data', data => stdout += data);
child.stderr.on('data', data => stderr += data);
setTimeout(() => {
    child.kill();
    console.log("Stdout:", stdout);
    console.error("Stderr:", stderr);
}, 3000);
