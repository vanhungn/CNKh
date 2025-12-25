const express = require("express")
const router = express.Router()
const document = require('../controller/document')
const multer = require('multer');
const verifyToken = require('../middleware/verifyToken')
const upload = multer({ storage: multer.memoryStorage() });
const storage = multer.memoryStorage();
const checkRole = require('../middleware/checkRole') // Lưu trong RAM
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
const upload3 = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024  // 20MB
    },
    fileFilter: (req, file, cb) => {
        // ✅ MIME types cho phép
        const allowedMimeTypes = [
            // Ảnh
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',

            // Word
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/msword', // .doc

            // Excel
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls

            // PowerPoint
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
            'application/vnd.ms-powerpoint', // .ppt

            // PDF
            'application/pdf',

            // Text
            'text/plain', // .txt
            'text/csv', // .csv

            // Archive
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',


        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} không được hỗ trợ!`));
        }
    }
});
router.get('/export/:_id', verifyToken, document.ExportDocument)
router.get('/', document.GetNameDocument)
router.get('/list', verifyToken, document.GetListDocument)
router.get('/detail/:_id', verifyToken, document.GetDocumentDetail)
router.get('/docx/:_idCourse/:_idDocx', verifyToken, document.GetDocumentCourse)
router.post('/create', verifyToken, checkRole, upload3.fields([{ name: "file", maxCount: 10 }]), document.CreateFile)
router.post('/import/:_id', verifyToken, checkRole, upload2.single('file'), document.ImportDocument)
router.post('/create_docx/:_id', verifyToken, checkRole, upload.array('file', 10), document.CreateDocx)
router.post('/update/:_id', verifyToken, checkRole, document.UpdateDocument)
router.delete('/docx_delete', verifyToken, checkRole, document.DeleteDocx)
router.delete('/delete/:_id', document.DeleteDocument)

module.exports = router