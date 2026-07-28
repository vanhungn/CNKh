const cloudinary = require('../config/cloudinaryConfig');
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const os = require("os"); // Bạn thiếu import
const modelNews = require("../modal/news")
const isEqual = require('lodash.isequal')
const translationQueue = require('../helps/translationQueue.js');
require('dotenv').config()

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
            upload_preset: process.env.PRESET
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
        const { note, title, typeOf, content, kindOf } = req.body;
        const file = req.file;

        // Validate
        if (!content || !typeOf || !kindOf) {
            return res.status(400).json({ message: "not valid" });
        }

        // Nếu là article thì bắt buộc có title
        if (kindOf === "article" && !title) {
            return res.status(400).json({
                message: "Title is required"
            });
        }

        // Parse content
        let parsedContent = content;
        if (typeof content === "string") {
            try {
                parsedContent = JSON.parse(content);
            } catch (err) {
                return res.status(400).json({
                    message: "content JSON invalid"
                });
            }
        }

        // Upload ảnh nếu có
        let image = null;

        if (file) {
            const result = await cloudinary.uploader.upload(file.path);

            image = {
                etag: result.etag,
                url: result.secure_url
            };
        }

        // Kiểm tra trùng
        const existing = await modelNews.findOne({
            title,
            typeOf,
            kindOf
        });

        if (existing) {
            return res.status(406).json({
                message: "valid"
            });
        }

        // Tạo bài viết
        const newArticle = await modelNews.create({
            title: title || "",
            note: note || "",
            typeOf,
            kindOf,
            content: parsedContent,
            img: image
        });

        // Đưa vào queue dịch
        translationQueue.addJob(
            newArticle._id,
            parsedContent,
            title || "",
            note || ""
        );

        return res.status(200).json({
            message: "created successfully",
            articleId: newArticle._id
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

const GetNews = async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 1
        const limit = parseInt(req.query.limit) || 10
        const typeOf = req.query.typeOf
        const type = req.query.type
        const search = (req.query.search || "").trim()
        const sort = req.query.sort || -1
        const query = {
            $match: {
                ...(typeOf && { typeOf: typeOf }),
                ...(type && { kindOf: type }),
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
        const dataSuggest = await modelNews.find({ typeOf: data.typeOf, _id: { $ne: _id } }).select(['title', 'titleEN', 'noteEN', 'img', 'note', 'createdAt']).skip(0).limit(3)
        return res.status(200).json({ data, dataSuggest })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
// Thêm import này lên đầu file nếu chưa có
// const translationQueue = require('../services/translationQueue');

const UpdateNews = async (req, res) => {
    try {
        const { _id } = req.params;
        const { note, title, typeOf, content, img, kindOf } = req.body;
        const file = req.file;

        // Validate
        if (!_id || !content || !typeOf || !kindOf) {
            return res.status(400).json({
                message: "not valid"
            });
        }

        if (kindOf === "article" && !title) {
            return res.status(400).json({
                message: "Title is required"
            });
        }

        // Lấy dữ liệu cũ
        const oldData = await modelNews.findById(_id);

        if (!oldData) {
            return res.status(404).json({
                message: "News not found"
            });
        }

        // Kiểm tra trùng
        if (
            oldData.title !== title ||
            oldData.typeOf !== typeOf ||
            oldData.kindOf !== kindOf
        ) {
            const existing = await modelNews.findOne({
                title,
                typeOf,
                kindOf,
                _id: { $ne: _id }
            });

            if (existing) {
                return res.status(406).json({
                    message: "valid"
                });
            }
        }

        // Parse content
        let parsedContent = content;

        if (typeof content === "string") {
            try {
                parsedContent = JSON.parse(content);
            } catch (err) {
                return res.status(400).json({
                    message: "content JSON invalid"
                });
            }
        }

        // Upload ảnh mới nếu có
        if (file) {
            const result = await cloudinary.uploader.upload(file.path);

            oldData.img = {
                etag: result.etag,
                url: result.secure_url
            };
        }
        // Nếu frontend gửi lại ảnh cũ
        else if (img) {
            try {
                oldData.img = typeof img === "string" ? JSON.parse(img) : img;
            } catch {
                oldData.img = img;
            }
        }
        // Nếu không gửi gì thì giữ nguyên ảnh cũ

        // So sánh dữ liệu
        const newTitle = title || "";
        const newNote = note || "";

        const isTitleChanged = oldData.title !== newTitle;
        const isNoteChanged = oldData.note !== newNote;
        const isContentChanged =
            JSON.stringify(oldData.content) !== JSON.stringify(parsedContent);

        // Cập nhật dữ liệu
        oldData.title = newTitle;
        oldData.note = newNote;
        oldData.typeOf = typeOf;
        oldData.kindOf = kindOf;
        oldData.content = parsedContent;

        await oldData.save();

        // Chỉ dịch lại phần thay đổi
        const contentToTranslate = isContentChanged ? parsedContent : null;
        const titleToTranslate = isTitleChanged ? newTitle : null;
        const noteToTranslate = isNoteChanged ? newNote : null;

        if (
            contentToTranslate !== null ||
            titleToTranslate !== null ||
            noteToTranslate !== null
        ) {
            console.log(
                `♻️ News ${_id} changed -> Content(${isContentChanged}) | Title(${isTitleChanged}) | Note(${isNoteChanged})`
            );

            translationQueue.addJob(
                _id,
                contentToTranslate,
                titleToTranslate,
                noteToTranslate
            );
        } else {
            console.log(
                `⏩ News ${_id} updated but no text changed -> Skip translation.`
            );
        }

        return res.status(200).json({
            message: "successfully"
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: error.message || "Internal server error"
        });
    }
};
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
const GetTypeOf = async (req, res) => {
    try {
        const type = await modelNews.distinct('typeOf')
        return res.status(200).json({
            data: type
        })
    } catch (error) {
        return res.status(500).json({
            error
        })
    }
}
const updateKindOf = async (req, res) => {
    try {
        const { kind } = req.body
        await modelNews.updateMany(
            {},
            {
                $set: {
                    kindOf: kind
                }
            }
        );
        return res.status(200).json({
            m: "ok"
        })
    } catch (ex) {

    }
}
const a = async (req, res) => {
    try {
        const { news, old } = req.body
        await modelNews.updateMany({
            typeOf: old
        }, {
            typeOf: news
        })
        return res.status(200).json({
            m: "ok"
        })
    } catch (error) {
        console.log(error)
    }
}
module.exports = { a, updateKindOf, uploadVideo, DeleteNew, UpdateNews, GetDetailNews, GetNews, UploadFile, FetchUrl, CreateNew, GetTypeOf };