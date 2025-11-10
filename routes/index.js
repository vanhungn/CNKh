var express = require('express');
var router = express.Router();
const code = require('../controller/codeLap')
const checkJwt = require('../middleware/authMicrosoft')
const microsoft = require('../controller/microsoft')
/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});
router.get('/login_microsoft', checkJwt, microsoft)
router.post("/run", code.Lapcode)

module.exports = router;
