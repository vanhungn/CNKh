var express = require('express');
var router = express.Router();
const user = require('../controller/user')

/* GET users listing. */
router.post('/create', user.RegisterAdmin)
router.post('/login', user.LoginAdmin)
router.post('/update/:_id', user.UpdateUser)

module.exports = router;
