const express = require('express')
const router = express.Router()
const problem = require('../controller/codeLap')
const algorithm = require('../controller/problem')
const verifyToken = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')

router.get('/algorithm', verifyToken, checkRole, algorithm.GetAlgorithm)
router.post('/update/:_id', verifyToken, checkRole, algorithm.UpdateAlgorithm)
router.delete('/delete/:_id', verifyToken, checkRole, algorithm.DeleteProblem)
//problem
router.get('/', verifyToken, problem.GetProblem)
router.get('/detail/:_id', verifyToken, problem.GetProblemDetail)
router.post('/create', verifyToken, problem.CreatePractice)



module.exports = router