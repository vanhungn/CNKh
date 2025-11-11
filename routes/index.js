var express = require('express');
var router = express.Router();
const code = require('../controller/codeLap')
const checkJwt = require('../middleware/authMicrosoft')
const { MicrosoftLogin } = require('../controller/microsoft')

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});
router.get('/login_microsoft', checkJwt, MicrosoftLogin)
router.post("/run", code.Lapcode)

module.exports = router;
  