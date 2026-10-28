const express = require("express");
const router = express.Router();
const { streamDriveFile } = require("../services/googleDriveService"); // sửa đường dẫn cho đúng
router.get("/files/:id/view", async (req, res) => {
    try {
        await streamDriveFile(req.params.id, res);
    } catch (err) {
        if (res.headersSent) return res.end();
        const status = err.code === 403 ? 403 : 404;
        res.status(status).json({ success: false, message: "Không thể mở file" });
    }
});

router.get("/files/:id/download", async (req, res) => {
    try {
        await streamDriveFile(req.params.id, res, { download: true });
    } catch (err) {
        if (res.headersSent) return res.end();
        const status = err.code === 403 ? 403 : 404;
        res.status(status).json({ success: false, message: "Không thể tải file" });
    }
});

module.exports = router;