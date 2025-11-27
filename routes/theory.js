const express = require('express')
const router = express.Router()
const theory = require('../controller/practice')
const verifyToken = require('../middleware/verifyToken')
const theoryAdmin = require('../controller/theory')
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/:_id',verifyToken, theoryAdmin.GetTheory)
router.get('/question/:_id', verifyToken,theoryAdmin.GetListQuestion)
router.post('/update/:idCourse',verifyToken, upload.array("imgUrl"), theoryAdmin.UpdateTheory)
router.delete('/delete_item/:_id/:idCourse',verifyToken,theoryAdmin.RemoveItemList)
router.delete('/delete/:_id',verifyToken,theoryAdmin.DeleteTheory)
//theory
router.get('/chapter', verifyToken, theory.GetTheoryChapter)
router.get('/list/:_id', verifyToken, theory.GetTheoryList)
router.post('/create/:idCourse',verifyToken, upload.array("imgUrl"), theory.CreateTheory)



module.exports = router