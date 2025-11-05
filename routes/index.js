var express = require('express');
var router = express.Router();
const code = require('../controller/codeLap')

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});
router.post("/run",code.Lapcode)
module.exports = router;
