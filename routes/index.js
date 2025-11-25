var express = require('express');
var router = express.Router();
const code = require('../controller/codeLap')
const checkJwt = require('../middleware/authMicrosoft')
const { MicrosoftLogin } = require('../controller/microsoft')
const refreshToken = require("../helps/refreshToken")

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});
router.get('/login_microsoft', checkJwt, MicrosoftLogin)
router.post("/run", code.Lapcode)
router.post('/refreshToken',refreshToken)
module.exports = router;
  