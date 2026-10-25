var express = require('express');
var router = express.Router();
const code = require('../controller/codeLap')
const checkJwt = require('../middleware/authMicrosoft')
const { MicrosoftLogin } = require('../controller/microsoft')
const refreshToken = require("../helps/refreshToken")
const chatBoxAi = require("../controller/chatController");
const { analyzeCode } = require('../controller/analyzeController')
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const analyzeLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 })
/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});
router.get('/login_microsoft', checkJwt, MicrosoftLogin)
router.post("/run", code.Lapcode)
router.post("/analyze", analyzeLimiter, analyzeCode)
router.post('/refreshToken', refreshToken)
router.post('/chatbot', chatBoxAi.handleChat)
router.post('/voidchat', upload.single('file'), chatBoxAi.VoidChat);
module.exports = router;
