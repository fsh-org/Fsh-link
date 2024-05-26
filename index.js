const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
var path = require('path');
const fs = require('fs');

const PORT = 20208;
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());
app.use(function(req, res, next) {
  let orig = res.send;
  function mod(text) {
    return text.replace(/\{\{[^¬]+?\}\}/g, function(match){
      let re;
      try {
        re = eval(match.replace('{{','').replace('}}','').trim());
      } catch (err) {
        re = 'Error';
        console.log('Err: '+err)
      }
      return re;
    })
  }
  res.send = function(){
    arguments[0] = mod(arguments[0]);
    orig.apply(res, arguments)
  };
  next();
})

const { DB } = require("fshdb")
const links = new DB('databases/links.json')

process.on('uncaughtException', function(err) {
  console.log('Error!');
  console.log(err);
});

function makeid(length) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < Number(length); i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

app.get('/', async function(req, res) {
  res.sendFile(path.join(__dirname, 'pages/index.html'))
})
    
app.post('/create', async function(req, res) {
  uri = req.query['url'];
  if (uri.length < 5) {
    res.status(400)
    res.json({
      err: true,
      msg: "Too short to be a url"
    })
    return;
  }
  if (!uri.includes('://')) {
    uri = 'https://' + uri;
  }
  if (!uri.includes('.')) {
    res.status(400)
    res.json({
      err: true,
      msg: "Missing <i>.com</i> part of url"
    })
    return;
  }
  if (uri.split('://')[1].split('/')[0].split('.').slice(-1)[0].length < 2) {
    res.status(400)
    res.json({
      err: true,
      msg: "Missing <i>.com</i> part of url"
    })
    return;
  }
  let code = makeid(6);
  while (links.has(code)) {
    code = makeid(6);
  }
  links.set(code, {
    url: uri,
    time: ((Number(req.query['time']) || 0)===0?0:(Math.floor(Date.now()/1000)+(Number(req.query['time']) || 0))),
    uses: Number(req.query['uses']) || 0,
  });
  res.json({
    url: `https://link.fsh.plus/${code}`
  })
})
app.get("/get/:id", async function(req, res) {
  res.json({
    link: links.get(req.params['id']).url
  })
})

app.get("/robots.txt", async function(req, res) {
  res.sendFile(path.join(__dirname, 'pages/robots.txt'))
})
  
app.get('/:id', async function(req, res) {
  if (links.has(req.params['id'])) {
    if (links.get(req.params['id']).time !== 0) {
      if ((Date.now()/1000)>links.get(req.params['id']).time) {
        links.remove(req.params['id']);
        res.sendFile(path.join(__dirname, 'pages/notfound.html'));
        return;
      }
    }
    if (req.get('User-Agent').includes('bot')) {
      res.redirect(links.get(req.params['id']).url);
      return;
    }
    res.send(fs.readFileSync('pages/link.html', 'utf8'))
    if (links.get(req.params['id']).uses !== 0) {
      if (links.get(req.params['id']).uses === 1) {
        links.remove(req.params['id']);
        return;
      }
      links.set(req.params['id']+'.uses', links.get(req.params['id']).uses-1)
    }
  } else {
    res.sendFile(path.join(__dirname, 'pages/notfound.html'))
  }
})
  
app.use(function(req, res) {
  res.status(404)
  res.sendFile(path.join(__dirname, 'pages/404.html'))
})

app.listen(PORT, function(){console.log('listening at '+PORT)});
