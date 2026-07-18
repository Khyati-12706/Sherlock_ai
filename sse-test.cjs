const http = require('http');
const url = 'http://localhost:3000/api/investigate?query=Rashmika%20Mandanna%20wedding';
const req = http.get(url, res => {
  console.log('status', res.statusCode, res.headers['content-type']);
  res.setEncoding('utf8');
  let count = 0;
  res.on('data', chunk => {
    count += 1;
    process.stdout.write('chunk ' + count + ': ' + JSON.stringify(chunk) + '\n');
    if (count >= 4) {
      req.destroy();
      process.exit(0);
    }
  });
  res.on('end', () => {
    console.log('end of response');
    process.exit(0);
  });
  res.on('error', err => {
    console.error('response error', err);
    process.exit(1);
  });
});
req.on('error', err => { console.error('request error', err); process.exit(1); });
