require("@marko/compiler/register");

const fs = require('fs');
const path = require('path');

const express = require("express");
const markoExpress = require("@marko/express").default;

const layout = require("../views/layout.marko");
const apicall = require("../views/apicall.marko");

const PORT = parseInt(process.env.PORT || 3000, 10);

const isProd = process.env.NODE_ENV === 'production';
const isDev = !isProd;

const app = express();

// compression
const compression = require('compression');
app.use(compression());

// body parser
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// cors
const cors = require("cors");
app.use(cors({ optionsSuccessStatus: 200 }));

// marko middleware
app.use(markoExpress());

// development/production errors + logger
const logger = require('morgan');
app.enable('verbose errors');
if (isProd) {
  app.disable('verbose errors')
} else {
  app.use(logger('dev'));
}
console.log(__dirname);
app.use("/assets", express.static("dist/assets"));

app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.marko(layout.default, {});
})

app.use((req, res, next) => {
  console.log(`Time: ${Date.now()}`);
  next();
});

app.get('/api/:date', (req, res, next) => {
  console.log(`Request URL: ${req.originalUrl}`);
  next();
}, (req, res, next) => {
  console.log(`Request Type: ${req.method}`);
  next();
});

app.get('/api/:date', (req, res, next) => {
  let { date } = req.params;
  let formatDate = date.split("-");

  let utc = 0;
  let unix = 0;

  if(formatDate.length > 1){
    let [year, month, day] = formatDate;

    utc = new Date(year, month, day);
    unix = utc.getTime();

    console.log(utc);
    console.log(unix);
  } else {
    unix = parseInt(formatDate[0]);
    utc = new Date(unix);

    console.log(utc);    
    console.log(unix);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.marko(apicall.default, {unix, utc});
  res.json({unix, utc});
});

const server = app.listen(PORT, err => {
  if (err) throw err;
  if (PORT) console.log(`Listening on: ${server.address().address}:${server.address().port}`);
});