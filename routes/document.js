const express = require("express")
const router = express.Router()
const document = require('../controller/document')
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const storage = multer.memoryStorage(); // Lưu trong RAM
const upload2 = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Chỉ cho phép file .docx
        if (file.originalname.match(/\.(docx)$/)) {
            cb(null, true);
        } else {
            cb(new Error('Chi chap nhan file .docx'), false);
        }
    }
});
router.get('/export/:_id', document.ExportDocument)
router.get('/', document.GetNameDocument)
router.get('/docx/:_idCourse/:_idDocx',document.GetDocumentCourse)
router.get('/detail/:_id', document.GetDocumentDetail)
router.post('/create', upload.array("file", 10), document.CreateFile)
router.post('/import/:_id', upload2.single('file'), document.ImportDocument);

module.exports = router