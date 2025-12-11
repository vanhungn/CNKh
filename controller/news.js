const cloudinary = require('../config/cloudinaryConfig');
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const os = require("os"); // Bạn thiếu import
const modelNews = require("../modal/news")
const isEqual = require('lodash.isequal')


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
const uploadVideo = async (req, res) => {
    try {
        const file = req.file
        const result = await cloudinary.uploader.upload(file.path, {
            resource_type: 'video',
            folder: 'videos',
            upload_preset: 'video_school_171'
        });


       return res.json({
            success: 1,
            file: {
                url: result.secure_url
            }
        });
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const CreateNew = async (req, res) => {
    try {
        const { note, title, typeOf, content } = req.body;
        const file = req.file;

        if (!content || !typeOf || !note || !title || !file) {
            return res.status(400).json({ message: "not valid" });
        }

        // luôn parse nếu là string
        let parsedContent = content;
        if (typeof content === "string") {
            try {
                parsedContent = JSON.parse(content);
            } catch (err) {
                return res.status(400).json({ message: "content JSON invalid" });
            }
        }

        const result = await cloudinary.uploader.upload(file.path);

        const existing = await modelNews.findOne({ title, typeOf });
        if (existing) {
            return res.status(406).json({ message: "valid" });

        }

        await modelNews.create({
            typeOf,
            img: { etag: result.etag, url: result.secure_url },
            content: parsedContent,
            note,
            title
        });

        return res.status(200).json({
            message: "created successfully"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error });
    }
};


const GetNews = async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 1
        const limit = parseInt(req.query.limit) || 10
        const typeOf = req.query.typeOf
        const search = req.query.search || ""
        const sort = req.query.sort || -1
        const query = {
            $match: {
                ...(typeOf && { typeOf: typeOf }),
                $or: [
                    { title: { $regex: search, $options: "i" } }
                ]
            }
        }
        const data = await modelNews.aggregate([
            query,
            { $sort: { createdAt: sort } },
            { $skip: (skip - 1) * limit },
            { $limit: limit }
        ])
        const totalData = await modelNews.find({})
        const dataLength = await modelNews.aggregate([query])
        const total = Math.ceil(dataLength.length / limit)
        const counts = totalData.reduce((acc, item) => {
            1
            acc[item.typeOf] = (acc[item.typeOf] || 0) + 1;
            return acc;
        }, {});

        console.log(counts);

        return res.status(200).json({
            data,
            total,
            counts
        })
    } catch (error) {
        return res.status(500).json({
            massage: error
        })
    }
}
const GetDetailNews = async (req, res) => {
    try {
        const { _id } = req.params
        if (!_id) {
            return res.status(400).json({ message: "not valid" })
        }
        const data = await modelNews.findById(_id)
        const dataSuggest = await modelNews.find({ typeOf: data.typeOf, _id: { $ne: _id } }).select(['title', 'img', 'note', 'createdAt']).skip(0).limit(3)
        return res.status(200).json({ data, dataSuggest })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const UpdateNews = async (req, res) => {
    try {
        const { _id } = req.params
        const { note, title, typeOf, content, img } = req.body
        const file = req.file
        if (!_id || !content || !typeOf || !note || !title) {
            return res.status(400).json({ message: "not valid" });
        }
        const existing = await modelNews.findOne({ title, typeOf });
        if (existing) {
            return res.status(406).json({ message: "valid" });

        }
        const data = await modelNews.findById(_id)
        console.log(img)
        if (file) {
            const result = await cloudinary.uploader.upload(file?.path);
            data.img = { etag: result?.etag, url: result?.secure_url };
        } else if (img) {
            data.img = JSON.parse(img)
        }
        await data.save()
        return res.status(200).json({
            message: "successfully"
        })
    } catch (error) {
        return res.status(500).json({
            message: error
        })
    }
}
const DeleteNew = async (req, res) => {
    try {
        const { _id } = req.params
        if (!_id) {
            return res.status(400).json({
                message: "not valid"
            })
        }
        await modelNews.findByIdAndDelete(_id)
        return res.status(200).json({
            message: 'successfully'
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}

module.exports = { uploadVideo, DeleteNew, UpdateNews, GetDetailNews, GetNews, UploadFile, FetchUrl, CreateNew };