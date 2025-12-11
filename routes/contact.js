const express = require('express')
const router = express.Router()
const contact = require('../controller/contact')

router.get('/', contact.GetContact)
router.post('/create', contact.CreateContact)
router.delete('/delete/:_id',contact.DeleteContact)

module.exports = router