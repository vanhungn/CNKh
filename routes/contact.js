const express = require('express')
const router = express.Router()
const contact = require('../controller/contact')

router.post('/create', contact.CreateContact)

module.exports = router