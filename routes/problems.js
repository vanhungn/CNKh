const express = require('express')
const router = express.Router()
const problem = require('../controller/codeLap')
const verifyToken = require('../middleware/verifyToken')

router.get('/',verifyToken,problem.GetProblem)
router.get('/detail/:_id',verifyToken,problem.GetProblemDetail)
router.post('/create',verifyToken,problem.CreatePractice)

module.exports =router