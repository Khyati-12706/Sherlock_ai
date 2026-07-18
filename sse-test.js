const http = require('http');
const url = 'http://localhost:3000/api/investigate?query=Rashmika%20Mandanna%20wedding';
const req = http.get(url, res => {
  console.log('status', res.statusCode, res.headers['content-type']);
  res.setEncoding('utf8');
  res.on('data', chunk => {
    process.stdout.write('chunk:' + JSON.stringify(chunk) + '\n');
  });
  res.on('end', () => console.log('end of response'));
  res.on('error', err => console.error('response error', err));
});
req.on('error', err => console.error('request error', err));
