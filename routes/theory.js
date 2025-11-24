const express = require('express')
const router = express.Router()
const theory = require('../controller/practice')
const verifyToken = require('../middleware/verifyToken')
const theoryAdmin = require('../controller/theory')
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/:_id', theoryAdmin.GetTheory)
router.get('/question/:_id',theoryAdmin.GetListQuestion)
//theory
router.get('/chapter', verifyToken, theory.GetTheoryChapter)
router.get('/list/:_id', verifyToken, theory.GetTheoryList)
router.post('/create/:idCourse', upload.array("imgUrl", 10), theory.CreateTheory)


module.exports = router