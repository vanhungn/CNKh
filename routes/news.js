const express = require('express')
const multer = require('multer');
const router = express.Router()
const news = require('../controller/news')
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
router.post('/uploadFile', upload.single('image'), news.UploadFile)
router.post("/fetchUrl", express.json(), news.FetchUrl);
router.post('/create', news.CreateNew)
module.exports = router