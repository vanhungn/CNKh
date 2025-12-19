const { default: mongoose } = require('mongoose')
const modelMark = require('../modal/mark')
const modelUser = require('../modal/user')
const modelDocument = require('../modal/document')
const modelTheory = require('../modal/thoery')
const CreateMark = async (req, res) => {
    try {
        const { userId, theoryId, core } = req.body
        if (!userId || !theoryId || core < 0) {
            return res.status(400).json({
                message: "not valid"
            })
        }
        const check = await modelMark.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            theoryId: new mongoose.Types.ObjectId(theoryId)
        })
        if (check) {
            check.core = core
            await check.save()
        } else {
            await modelMark.create({ userId, theoryId, core })

        }

        return res.status(200).json({
            message: "successfully"
        })
    } catch (error) {
        return res.status(500).json({
            message: error
        })
    }
}
const GetMark = async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 1
        const limit = parseInt(req.query.limit) || 10
        const search = (req.query.search || "").trim()
        const { _id } = req.query

        const query = [
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "infoUser"
                },


            },
            {
                $lookup: {
                    from: "thoerys",
                    localField: "theoryId",
                    foreignField: "_id",
                    as: "infoTheory"
                },
            },
            { $unwind: "$infoUser" },
            { $unwind: "$infoTheory" },
            { $project: { "infoUser.password": 0 } },
            { $project: { "infoTheory.list": 0 } },
            {
                $match: {

                    ...(_id && { userId: new mongoose.Types.ObjectId(_id) }),
                    $or: [
                        { "infoUser.name": { $regex: search === "" ? ".*" : search, $options: "i" } }
                    ]
                }
            }
        ]
        const classes = await modelUser.distinct('classes')
        const course = await modelDocument.find({})
          
        
        const data = await modelMark.aggregate([...query,
        { $skip: (skip - 1) * limit },
        { $limit: limit }
        ])
        return res.status(200).json({
            data, classes, course, length: data.length
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const GetMarkAdmin = async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 1
        const limit = parseInt(req.query.limit) || 10
        const classesQuery = req.query.classes
        const courseQuery = req.query.course
        let document = {}
        let countTheory = 0
        if (courseQuery) {
            const docum = await modelDocument.findOne({ codeCourse: courseQuery })
            document = docum
            const theoryOfDocument = await modelTheory.find({
                idCourse: docum._id
            })
            countTheory = theoryOfDocument.length
        }
        const query = [
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "infoUser"
                },


            },
            {
                $lookup: {
                    from: "thoerys",
                    localField: "theoryId",
                    foreignField: "_id",
                    as: "infoTheory"
                },
            },
            { $unwind: "$infoUser" },
            { $unwind: "$infoTheory" },
            { $project: { "infoUser.password": 0 } },
            { $project: { "infoTheory.list": 0 } },
            {
                $match: {
                    ...(classesQuery && { "infoUser.classes": classesQuery }),
                    ...(courseQuery && { "infoTheory.idCourse": document._id }),
                }
            },
            {
                $group: {
                    _id: "$userId",
                    infoUser: { $first: "$infoUser" },
                    totalScore: { $sum: "$core" },
                    doneCount: { $sum: 1 },

                }
            },
            {
                $project: {
                    infoUser: 1,
                    avgCore: {
                        $round: [
                            {
                                $divide: ["$totalScore", countTheory] // 5 = tổng số bài
                            },
                            1
                        ]
                    },
                    progress: {
                        $concat: [
                            { $toString: "$doneCount" },
                            "/",
                            { $toString: countTheory }
                        ]
                    },
                    nameCourse: {
                        $concat: [
                            { $toString: document.course }
                        ]
                    },
                    codeCourse: {
                        $concat: [
                            { $toString: document.codeCourse }
                        ]
                    }
                }
            }

        ]
        const data = await modelMark.aggregate([...query])
        return res.status(200).json({
            data
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const UpdateMark = async (req, res) => {
    try {
        const { _id } = req.params
        const { core } = req.body

        if (!core || !_id) {
            return req.status(400).json({
                message: "not valid"
            })
        }
        await modelMark.findByIdAndUpdate(_id, { core }, { new: true })
        return res.status(200).json({
            message: "successfully"
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const DeleteMark = async (req, res) => {
    try {
        const { _id } = req.params
        if (!_id) {
            return res.status(400).json({
                message: 'not valid'
            })
        }
        await modelMark.findByIdAndDelete(_id)
        return res.status(200).json({
            message: "successfully"
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
module.exports = { GetMarkAdmin, CreateMark, GetMark, UpdateMark, DeleteMark }