const express = require('express')
const router = express.Router()
const theory = require('../controller/practice')
const verifyToken = require('../middleware/verifyToken')


router.get('/chapter',verifyToken, theory.GetTheoryChapter)
router.get('/list/:_id',verifyToken, theory.GetTheoryList)
router.post('/create',verifyToken, theory.CreateTheory)


module.exports = router