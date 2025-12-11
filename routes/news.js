const express = require('express')
const multer = require('multer');
const router = express.Router()
const news = require('../controller/news')
const path = require('path')
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
router.get('/detail/:_id', news.GetDetailNews)
router.post('/update/:_id', upload.single('image'), news.UpdateNews)
router.post('/uploadFile', upload.single('image'), news.UploadFile)
router.post('/uploadVideo', upload.single('video'), news.uploadVideo)
router.post("/fetchUrl", express.json(), news.FetchUrl);
router.post('/create', upload.single('image'), news.CreateNew)
router.delete('/delete/:_id', news.DeleteNew)
module.exports = router