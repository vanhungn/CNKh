const express = require('express')
const router = express.Router()
const contact = require('../controller/contact')
const verify = require('../middleware/verifyToken')

router.get('/', verify,contact.GetContact)
router.post('/create',verify,contact.CreateContact)
router.delete('/delete/:_id',verify,contact.DeleteContact)

module.exports = router