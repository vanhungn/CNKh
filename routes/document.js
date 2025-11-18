const express = require("express")
const router = express.Router()
const document = require('../controller/document')
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/create', upload.array("file", 10), document.CreateFile)
router.get('/export/:_id', document.ExportDocument)
module.exports = router