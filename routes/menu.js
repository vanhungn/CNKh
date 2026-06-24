const express = require("express")
const router = express.Router()
const menu = require("../controller/menus")
const middleware = require("../middleware/verifyToken")
const multer = require('multer');
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

router.get("/", middleware, menu.ListMenu)
router.post("/create", middleware, upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 10 }
]), menu.createMenu)
router.post("/update/:id", middleware, upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 10 }
]), menu.UpdateMenu)
router.delete("/delete/:id", middleware, menu.DeleteMenu)
module.exports = router

