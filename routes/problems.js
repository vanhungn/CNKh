const express = require('express')
const router = express.Router()
const problem = require('../controller/codeLap')

router.get('/',problem.GetProblem)
router.post('/create',problem.CreatePractice)

module.exports =router