const modalTheory = require('../modal/thoery')
const modalDocument = require('../modal/document')
const cloudinary = require('../config/cloudinaryConfig');
const e = require('cors');
const { default: mongoose } = require('mongoose');
const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream((error, result) => {
            if (result) resolve(result);
            else reject(error);
        });
        stream.end(buffer);
    });
};

const CreateTheory = async (req, res) => {
    try {
        const { idCourse } = req.params;
        let { chapter, list } = req.body;
        if (!chapter, !list) {
            return res.status(400).json({
                message: "valid"
            })
        }
        list = JSON.parse(list);
        for (let i = 0; i < req.files.length; i++) {
            const result = await uploadToCloudinary(req.files[i].buffer);
            list[i].imgUrl = result.secure_url;
        }

        const data = await modalTheory.create({ chapter, list, idCourse });

        return res.status(200).json({ data });
    } catch (err) {

        return res.status(500).json({ error: err.message });
    }
};


const GetTheoryChapter = async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const search = (req.query.search || "").trim()
        const { _id } = req.params
        if (!_id) {
            return res.status(400).json({
                message: "not valid"
            })
        }
        const query = {
            $match: {
                idCourse: new mongoose.Types.ObjectId(_id),
                $or: [
                    { chapter: { $regex: search, $options: "i" } }
                ]
            }

        }
        const listChapter = await modalTheory.aggregate([
            query,
            { $sort: { createdAt: -1 } },
            { $skip: (skip - 1) * limit },
            { $limit: (limit) }
        ])

        const chapterLength = await modalTheory.aggregate([query])
        const total = Math.ceil(chapterLength.length / limit)
        const chapter = await modalDocument.findById(_id)
        const data = listChapter.map(ch => ({ _id: ch._id, title: ch.chapter, chapter: chapter.course }));
        return res.status(200).json({ data, total });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error
        });
    }

}
const GetTheoryList = async (req, res) => {
    try {
        const { _id } = req.params
        if (!_id) {
            return res.status(400).json({
                message: "not valid"
            })
        }
        const data = await modalTheory.findById(_id)
        return res.status(200).json({
            data
        })
    } catch (error) {
        return res.status(500).json({
            message: error.message,
            stack: error.stack
        });
    }
}
module.exports = { CreateTheory, GetTheoryChapter, GetTheoryList }