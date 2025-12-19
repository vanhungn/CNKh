const express = require('express')
const router = express.Router()
const mark = require('../controller/mark')

router.get('/', mark.GetMark)
router.post('/update/:_id', mark.UpdateMark)
router.post('/create', mark.CreateMark)
router.delete('/delete/:_id', mark.DeleteMark)

module.exports = router