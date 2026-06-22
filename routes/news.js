const express = require('express')
const multer = require('multer');
const router = express.Router()
const news = require('../controller/news')
const path = require('path')
const verifyToken = require("../middleware/verifyToken")
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const originalName = file.originalname;
        const extension = originalName.split('.').pop();
        const filename = `${uniqueSuffix}.${extension}`;
        cb(null, filename);
    },
});

const upload = multer({
    storage: storage,
});


router.get('/', news.GetNews)
router.get('/typeof', news.GetTypeOf)
router.get('/detail/:_id', news.GetDetailNews)
router.post('/update/:_id', verifyToken, upload.single('image'), news.UpdateNews)
router.post('/uploadFile', verifyToken, upload.single('image'), news.UploadFile)
router.post('/uploadVideo', verifyToken, upload.single('video'), news.uploadVideo)
router.post("/fetchUrl", verifyToken, express.json(), news.FetchUrl);
router.post('/create', verifyToken, upload.single('image'), news.CreateNew)
router.delete('/delete/:_id', verifyToken, news.DeleteNew)
module.exports = router