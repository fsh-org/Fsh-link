const fs = require('fs');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PORT = 3000;

const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
var path = require('path');
const app = express();
const Database = require("easy-json-database")

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

var what, uri;

async function cache_url(what, res) {
  try {
    const data = await ogs({ url: url.get(what) });

    const {
      twitterTitle,
      twitterDescription,
      twitterImage
    } = data.result;
    const {
      ogTitle,
      ogDescription,
      ogImage
    } = data.result;

    let par = {}
    if (twitterTitle) {
      par.title = twitterTitle;
    } else {
      par.title = ogTitle;
    }
    if (twitterDescription) {
      par.description = twitterDescription;
    } else {
      par.description = ogDescription;
    }
    if (twitterImage) {
      par.image = twitterImage[0].url;
    } else {
      par.image = ogImage[0].url;
    }
      
    time.set(what, Math.floor(new Date().getTime() / 1000));
    cache.set(what, par)
  } catch (error) {
    // err
    //res.send('Error')
  }
}

const ogs = require('open-graph-scraper');

const url = new Database('./url.json')
const cache = new Database('./cache.json')
const time = new Database('./time.json')

app.use(cors());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());

app.get('/', async function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'))
})
    
app.get('/create', async function(req, res) {
  uri = req.query['url'];
  if (uri.length < 5) {
    res.status(400)
    res.json({
      err: true,
      msg: "Too short to be a url"
    })
    return;
  }
  if (uri.split('.')[1].length < 2) {
    res.status(400)
    res.json({
      err: true,
      msg: "Missing <i>.com</i> part of url"
    })
    return;
  }
  if (!uri.includes('://')) {
    uri = 'https://' + uri;
  }
  let json = JSON.parse(fs.readFileSync('./url.json'));
  if (Object.values(json).includes(uri)) {
    res.json({url: `https://link.fsh.plus/${Object.keys(json)[Object.values(json).indexOf(uri)]}`})
  } else {
    let code = makeid(6);
    while (url.has(code)) {
      code = makeid(6);
    }
    url.set(code, uri);
    res.json({url: `https://link.fsh.plus/${code}`})
  }
})

app.get("/get/:id", async function(req, res) {
  res.json({
    link: url.get(req.params['id'])
  })
})

app.get('/services/oembed', async function(req, res) {
  let co = req.query["url"].split("://")[1].split("/")[1]
  if (co == "") {
    res.json({
      version: "1.1",
      type: "link",
      title: 'Fsh link'
    })
    return;
  }
  if (url.has(String(co))) {
    if (time.has(co)) {
      if ((Math.floor(new Date().getTime() / 1000)) > time.get(co) + 1200) {
        cache_url(co,res);
      }
    } else {
      cache_url(co,res);
    }
    if (cache.has(co)) {
      res.json({
        version: "1.0",
        type: "link",
        title: cache.get(co).title || url.get(co).split("://")[1].split("/")[0],
        provider_name: "Fsh link",
        provider_url: "http://link.fsh.plus"
      })
    } else {
      res.json({
        version: "1.0",
        type: "link",
        title: url.get(co).split("://")[1].split("/")[0],
        provider_name: "Fsh link",
        provider_url: "http://link.fsh.plus"
      })
    }
  } else {
    res.status(404)
    res.send("Error")
  }
})

app.get("/robots.txt", async function(req, res) {
  res.sendFile(path.join(__dirname, 'robots.txt'))
})
  
app.get('/:id', async function(req, res) {
  if (url.has(req.params['id'])) {
    if (time.has(req.params['id'])) {
      if ((Math.floor(new Date().getTime() / 1000)) > time.get(req.params['id']) + 1200) {
        cache_url(req.params['id'],res);
      }
    } else {
      cache_url(req.params['id'],res);
    }

    let fil = fs.readFileSync('link.html', 'utf8');
    fil = fil
      .replaceAll('[URL]', url.get(req.params['id']))
      .replaceAll('[ID]', req.params['id']);
    try {
      fil = fil
        .replaceAll('[NAME]', cache.get(req.params['id']).title)
    } catch (err) {
      fil = fil
        .replaceAll('[NAME]', url.get(req.params['id']).split("://")[1].split("/")[0])
    }
    try {
      fil = fil
        .replaceAll('[DESC]', (cache.get(req.params['id']).description || "None"))
        .replaceAll('[IMG]', (cache.get(req.params['id']).image || "None"))
    } catch (err) {
      fil = fil
        .replaceAll('[DESC]', "No description")
    }
      
    res.send(fil)
  } else {
    res.sendFile(path.join(__dirname, 'notfound.html'))
  }
})
  
app.use(function(req, res) {
  res.status(404)
  res.sendFile(path.join(__dirname, 'error.html'))
})

app.listen(PORT, function(){console.log('listening at '+PORT)});