const cloudinary = require('../config/cloudinaryConfig');
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const os = require("os"); // Bạn thiếu import này



const UploadFile = async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: 0,
                message: "No file uploaded"
            });
        }

        const result = await cloudinary.uploader.upload(file.path, {
            folder: "editorjs",
        });

        fs.unlinkSync(file.path);

        // ✅ Format đúng cho EditorJS
        return res.status(200).json({
            success: 1,
            file: {
                url: result.secure_url,
                // Thêm các field tùy chọn
                width: result.width,
                height: result.height,
                size: result.bytes
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: 0,
            message: error.message
        });
    }
};

const FetchUrl = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({
                success: 0,
                message: "No URL provided"
            });
        }

        const axios = require('axios');
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        const tempFilePath = path.join(require('os').tmpdir(), Date.now() + "-image.jpg");
        fs.writeFileSync(tempFilePath, buffer);

        const result = await cloudinary.uploader.upload(tempFilePath, {
            folder: "editorjs",
        });

        fs.unlinkSync(tempFilePath);

        // ✅ Format đúng cho EditorJS
        res.json({
            success: 1,
            file: {
                url: result.secure_url,
                width: result.width,
                height: result.height
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: 0,
            message: "Error fetching URL"
        });
    }
};

module.exports = { UploadFile, FetchUrl };