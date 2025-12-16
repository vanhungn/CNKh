const express = require('express')
const router = express.Router()
const theory = require('../controller/practice')
const verifyToken = require('../middleware/verifyToken')
const theoryAdmin = require('../controller/theory')
const checkRole = require('../middleware/checkRole')
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });


router.get('/question/:_id', verifyToken, theoryAdmin.GetListQuestion)
router.post('/update/:idCourse', verifyToken, checkRole, upload.array("imgUrl"), theoryAdmin.UpdateTheory)
router.delete('/delete_item/:_id/:idCourse', checkRole, verifyToken, theoryAdmin.RemoveItemList)
router.delete('/delete/:_id', verifyToken, checkRole, theoryAdmin.DeleteTheory)
//theory
router.get('/chapter/:_id', theory.GetTheoryChapter)
router.get('/list/:_id', verifyToken, theory.GetTheoryList)
router.post('/create/:idCourse', verifyToken, upload.array("imgUrl"), theory.CreateTheory)
router.get('/:_id', verifyToken, theoryAdmin.GetTheory)


module.exports = router