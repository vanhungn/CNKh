const express = require('express')
const router = express.Router()
const problem = require('../controller/codeLap')
const algorithm = require('../controller/problem')
const verifyToken = require('../middleware/verifyToken')


router.get('/algorithm', algorithm.GetAlgorithm)
router.post('/update/:_id', algorithm.UpdateAlgorithm)
router.delete('/delete/:_id', algorithm.DeleteProblem)
//problem
router.get('/', problem.GetProblem)
router.get('/detail/:_id', verifyToken, problem.GetProblemDetail)
router.post('/create', problem.CreatePractice)



module.exports = router