const modalTheory = require("../modal/thoery")
const mongoose = require("mongoose");
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
            data: data.list
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
module.exports = { GetTheory, GetListQuestion }