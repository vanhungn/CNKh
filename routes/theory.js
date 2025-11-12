const express = require('express')
const router = express.Router()
const theory = require('../controller/practice')


router.get('/chapter', theory.GetTheoryChapter)
router.get('/list/:_id', theory.GetTheoryList)
router.post('/create', theory.CreateTheory)


module.exports = router