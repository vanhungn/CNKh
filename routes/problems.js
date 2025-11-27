const express = require('express')
const router = express.Router()
const problem = require('../controller/codeLap')
const algorithm = require('../controller/problem')
const verifyToken = require('../middleware/verifyToken')


router.get('/algorithm', verifyToken,algorithm.GetAlgorithm)
router.post('/update/:_id', verifyToken,algorithm.UpdateAlgorithm)
router.delete('/delete/:_id',verifyToken ,algorithm.DeleteProblem)
//problem
router.get('/', verifyToken,problem.GetProblem)
router.get('/detail/:_id', verifyToken, problem.GetProblemDetail)
router.post('/create',verifyToken, problem.CreatePractice)



module.exports = router