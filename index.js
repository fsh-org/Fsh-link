const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');

let nanoid;
(async()=>{
  const nanid = await import('nanoid');
  nanoid = nanid.nanoid;
})();

const PORT = 3003;
const app = express();
app.use(cors());

const DB = require('fshdb');
const links = new DB('databases/links.json');

function clean(text) {
  return text.replaceAll('<', '%3C').replaceAll('>', '%3E');
}

process.on('uncaughtException', (err)=>{
  console.log('Error!');
  console.log(err);
});

app.get('/', async(req, res)=>{
  res.sendFile(path.join(__dirname, 'pages/index.html'));
});
app.get('/blocked', async(req, res)=>{
  res.sendFile(path.join(__dirname, 'pages/blocked.html'));
});
app.get('/robots.txt', async(req, res)=>{
  res.sendFile(path.join(__dirname, 'pages/robots.txt'));
});
app.get('/favicon.ico', async(req, res)=>{
  res.sendFile(path.join(__dirname, 'pages/favicon.ico'));
});

// API
app.post('/create', async(req, res)=>{
  let url = req.query['url'];
  if (!url || url.length < 2) {
    res.status(400);
    res.json({
      err: true,
      msg: 'Too short to be a url'
    });
    return;
  }
  if (!url.includes('://')) url = 'https://'+url;
  try {
    url = new URL(url);
  } catch(err) {
    res.status(400);
    res.json({
      err: true,
      msg: 'Invalid url'
    });
    return;
  }
  if (!['http:','https:'].includes(url.protocol)) {
    res.status(400);
    res.json({
      err: true,
      msg: 'Only http and https protocols supported'
    });
    return;
  }
  url = url.href;
  let time = Math.max(Number(req.query['time']) || 0, 0);
  time = time===0?0:Math.floor(Date.now()/1000)+time;
  let uses = Math.max(Number(req.query['uses']) || 0, 0);
  let sub = [];
  let code;
  if (time===0 && uses===0) sub = links.find((val)=>val.time===0&&val.uses===0&&val.url===url);
  if (sub[0]) {
    code = sub[0];
  } else {
    code = nanoid(10);
    while (links.has(code)) code = nanoid(10);
  }
  links.set(code, { url, time, uses });
  res.json({ url: 'https://link.fsh.plus/'+code });
});
app.get('/get/:id', async(req, res)=>{
  let id = req.params['id'];
  let url = links.get(id);
  if (!url || url.blocked) {
    res.json({ link: '' });
    return;
  }
  if (url.time !== 0 && (Date.now()/1000)>url.time) {
    links.remove(id);
    res.json({ link: '' });
    return;
  }
  res.json({ link: url.url });
});

// Links
let linkPage;
app.get('/:id', async(req, res)=>{
  let id = req.params['id'];
  let direct = false;
  if (id.endsWith('+')) {
    direct = true;
    id = id.slice(0, -1);
  }
  if (req.get('User-Agent')?.includes('bot')) direct = true;
  if (!links.has(id)) {
    res.status(404);
    res.sendFile(path.join(__dirname, 'pages/notfound.html'));
    return;
  }
  let link = links.get(id);
  if (link.blocked) {
    res.redirect('/blocked');
    return;
  }
  if (link.time !== 0 && (Date.now()/1000)>link.time) {
    links.remove(id);
    res.sendFile(path.join(__dirname, 'pages/notfound.html'));
    return;
  }
  if (direct) {
    res.redirect(link.url);
    return;
  }
  if (!linkPage) linkPage = fs.readFileSync('pages/link.html', 'utf8');
  res.send(linkPage
    .replaceAll('{{url}}', clean(link.url))
    .replace('{{domain}}', clean(new URL(link.url).hostname)));
  if (link.uses !== 0) {
    if (link.uses < 2) {
      links.remove(id);
      return;
    }
    links.set(id+'.uses', link.uses-1);
  }
});

app.use((req, res)=>{
  res.status(404);
  res.sendFile(path.join(__dirname, 'pages/404.html'));
});

app.listen(PORT, ()=>{
  console.log('listening at '+PORT);
});