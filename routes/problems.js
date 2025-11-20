const express = require('express')
const router = express.Router()
const problem = require('../controller/codeLap')
const algorithm = require('../controller/problem')
const verifyToken = require('../middleware/verifyToken')

router.get('/', problem.GetProblem)
router.get('/algorithm',algorithm.GetAlgorithm)
router.get('/detail/:_id', verifyToken, problem.GetProblemDetail)
router.post('/create', problem.CreatePractice)


module.exports = router