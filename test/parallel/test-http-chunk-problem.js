'use strict';
// http://groups.google.com/group/nodejs/browse_thread/thread/f66cd3c960406919
const common = require('../common');
const assert = require('assert');
if (!common.hasCrypto) {
  common.skip('missing crypto');
  return;
}

if (process.argv[2] === 'request') {
  const http = require('http');
  const options = {
    port: common.PORT,
    path: '/'
  };

  http.get(options, (res) => {
    res.pipe(process.stdout);
  });

  return;
}

if (process.argv[2] === 'shasum') {
  const crypto = require('crypto');
  const shasum = crypto.createHash('sha1');
  process.stdin.on('data', (d) => {
    shasum.update(d);
  });

  process.stdin.on('close', () => {
    process.stdout.write(shasum.digest('hex'));
  });

  return;
}

const http = require('http');
const cp = require('child_process');

const filename = require('path').join(common.tmpDir, 'big');

function executeRequest(cb) {
  cp.exec([process.execPath,
           __filename,
           'request',
           '|',
           process.execPath,
           __filename,
           'shasum' ].join(' '),
          (err, stdout, stderr) => {
            if (err) throw err;
            assert.equal('8c206a1a87599f532ce68675536f0b1546900d7a',
                         stdout.slice(0, 40));
            cb();
          }
  );
}


common.refreshTmpDir();

const ddcmd = common.ddCommand(filename, 10240);

cp.exec(ddcmd, function(err, stdout, stderr) {
  if (err) throw err;
  const server = http.createServer(function(req, res) {
    res.writeHead(200);

    // Create the subprocess
    const cat = cp.spawn('cat', [filename]);

    // Stream the data through to the response as binary chunks
    cat.stdout.on('data', (data) => {
      res.write(data);
    });

    cat.stdout.on('end', () => res.end());

    // End the response on exit (and log errors)
    cat.on('exit', (code) => {
      if (code !== 0) {
        console.error('subprocess exited with code ' + code);
        process.exit(1);
      }
    });

  });

  server.listen(common.PORT, () => {
    executeRequest(() => server.close());
  });
});
