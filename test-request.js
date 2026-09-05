const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/transfers/1/print',
  method: 'GET',
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  let data = '';
  res.on('data', d => {
    data += d;
  });
  res.on('end', () => {
    console.log(data.substring(0, 50));
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
