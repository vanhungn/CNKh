var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const problemRouter = require('./routes/problems')
const theoryRouter = require('./routes/theory')
const document = require('./routes/document')
const contact = require('./routes/contact')
const news = require('./routes/news')
const mark = require('./routes/mark')

const db = require('./config/db')
var app = express();

db()
app.use(cookieParser());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174','https://highereducation.netlify.app/'], // hoặc '*' nếu không dùng credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposedHeaders: ['Set-Cookie']
}));
// view engine setup


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static('public'));
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/problem', problemRouter);
app.use('/theory', theoryRouter);
app.use('/document', document)
app.use('/contact', contact)
app.use('/news', news)
app.use('/mark', mark)

// catch 404 and forward to error handler
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});


module.exports = app;
