const cloudinary = require('../config/cloudinaryConfig');
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const os = require("os"); // Bạn thiếu import này

const uploadFolder = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

const UploadFile = async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }

        const uploadedImages = await Promise.all(
            files.map(async (file) => {
                const result = await cloudinary.uploader.upload(file.path);
                // Xóa file local sau khi upload
                fs.unlinkSync(file.path);
                return result.secure_url;
            })
        );

        return res.status(200).json({ success: 1, file: { url: uploadedImages } });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const FetchUrl = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: 0, message: "No URL provided" });

        // 1. Tải ảnh từ URL về buffer (dùng axios)
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // 2. Lưu tạm file trong temp folder
        const tempFilePath = path.join(os.tmpdir(), Date.now() + "-" + path.basename(url));
        fs.writeFileSync(tempFilePath, buffer);

        // 3. Upload lên Cloudinary
        const result = await cloudinary.uploader.upload(tempFilePath, {
            folder: "editorjs",
        });

        // 4. Xóa tạm file
        fs.unlinkSync(tempFilePath);

        // 5. Trả về URL Cloudinary
        res.json({ success: 1, file: { url: result.secure_url } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: 0, message: "Error fetching URL" });
    }
};

module.exports = { UploadFile, FetchUrl };