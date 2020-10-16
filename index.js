const Fs = require('fs');
const Https = require('https');
const Path = require('path');
const Url = require('url');
const Chalk = require('chalk');
const Figures = require('figures');
const Ora = require('ora');
const { ByteSize, RandomNum, RoundNum } = require('trample/node');

const TINYIMG_URL = ['tinyjpg.com', 'tinypng.com'];

const inputPath = 'input'; // 输入路径
const outPutPath = 'output'; // 输入路径

function RandomHeader() {
  const ip = new Array(4)
    .fill(0)
    .map(() => parseInt(Math.random() * 255))
    .join('.');
  const index = RandomNum(0, 1);
  return {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Postman-Token': Date.now(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36',
      'X-Forwarded-For': ip,
    },
    hostname: TINYIMG_URL[index],
    method: 'POST',
    path: '/web/shrink',
    rejectUnauthorized: false,
  };
}

function UploadImg(file) {
  const opts = RandomHeader();
  return new Promise((resolve, reject) => {
    const req = Https.request(opts, (res) =>
      res.on('data', (data) => {
        const obj = JSON.parse(data.toString());
        obj.error ? reject(obj.message) : resolve(obj);
      }),
    );
    req.write(file, 'binary');
    req.on('error', (e) => reject(e));
    req.end();
  });
}

function DownloadImg(url) {
  const opts = new Url.URL(url);
  return new Promise((resolve, reject) => {
    const req = Https.request(opts, (res) => {
      let file = '';
      res.setEncoding('binary');
      res.on('data', (chunk) => (file += chunk));
      res.on('end', () => resolve(file));
    });
    req.on('error', (e) => reject(e));
    req.end();
  });
}

async function CompressImg(path) {
  try {
    const file = Fs.readFileSync(path, 'binary');
    const obj = await UploadImg(file);
    const data = await DownloadImg(obj.output.url);
    const oldSize = Chalk.redBright(ByteSize(obj.input.size));
    const newSize = Chalk.greenBright(ByteSize(obj.output.size));
    const ratio = Chalk.blueBright(RoundNum(1 - obj.output.ratio, 2, true));
    const dpath = Path.join(outPutPath, Path.basename(path));
    const msg = `${Figures.tick} 压缩的 [${Chalk.yellowBright(path)}] completed: 原大小 ${oldSize}, 新大小 ${newSize}, 压缩百分比 ${ratio}`;
    Fs.writeFileSync(dpath, data, 'binary');
    return Promise.resolve(msg);
  } catch (err) {
    const msg = `${Figures.cross} 压缩的 [${Chalk.yellowBright(path)}] 失败: ${Chalk.redBright(err)}`;
    return Promise.resolve(msg);
  }
}

(async () => {
  const spinner = Ora('压缩中......').start();

  Fs.readdir(inputPath, (err, files) => {
    files.forEach((file) => {
      if (!/\w(\.gif|\.jpeg|\.png|\.jpg|\.bmp)/i.test(file)) {
        return;
      }
      Fs.stat(Path.join(inputPath, file), async (err, data) => {
          if (data.isFile()) {
            const res = await CompressImg(inputPath+'/'+file);
            console.log(res);
          }
      });
    });
  });
  spinner.stop();
})();
