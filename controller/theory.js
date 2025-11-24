const modalTheory = require("../modal/thoery")
const mongoose = require("mongoose");
const cloudinary = require('../config/cloudinaryConfig')
const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream((error, result) => {
            if (result) resolve(result);
            else reject(error);
        });
        stream.end(buffer);
    });
};
const GetTheory = async (req, res) => {
    try {
        const { _id } = req.params
        const skip = parseInt(req.query.skip) || 1
        const limit = parseInt(req.query.limit) || 10
        const search = req.query.search || ""
        if (!_id) {
            return res.status(400).json({
                message: "Valid"
            })
        }
        const querys = {
            $match: {
                $and: [
                    { idCourse: new mongoose.Types.ObjectId(_id) },
                    {
                        $or: [
                            { chapter: { $regex: search, $options: "i" } }
                        ]
                    }
                ]
            }
        }
        const data = await modalTheory.aggregate([
            querys,
            { $skip: (skip - 1) * limit },
            { $limit: limit }
        ])
        const length = await modalTheory.aggregate([querys])
        const total = Math.ceil(length.length / limit)
        const dataChapter = []
        data.forEach((e) => {
            dataChapter.push({ chapter: e.chapter, _id: e._id })
        })

        return res.status(200).json({
            data: dataChapter, total
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const GetListQuestion = async (req, res) => {
    try {
        const { _id } = req.params
        if (!_id) {
            return res.status(400).json({
                message: "valid"
            })
        }
        const data = await modalTheory.findById(_id)
        return res.status(200).json({
            data: data
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const UpdateTheory = async (req, res) => {
    try {
        const { idCourse } = req.params;
        let { chapter, list, index } = req.body;

        if (!chapter || !list) {
            return res.status(400).json({ message: "chapter và list không được để trống" });
        }

        list = JSON.parse(list);
        index = JSON.parse(index); // array các index của list cần upload ảnh

        // req.files.length <= index.length
        for (let i = 0; i < req.files.length; i++) {
            const idx = index[i]; // lấy index thực sự trong list
            if (idx !== undefined && list[idx]) {
                const result = await uploadToCloudinary(req.files[i].buffer);
                list[idx].imgUrl = result.secure_url;
            }
        }

        const data = await modalTheory.findByIdAndUpdate(
            idCourse,
            { chapter, list },
            { new: true }
        );

        return res.status(200).json({ data });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};


module.exports = { GetTheory, GetListQuestion, UpdateTheory }