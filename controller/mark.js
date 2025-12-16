const { default: mongoose } = require('mongoose')
const modelMark = require('../modal/mark')
const CreateMark = async (req, res) => {
    try {
        const { userId, theoryId, core } = req.body
        if (!userId || !theoryId || !core) {
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
        const { _id } = req.params

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
            {
                $match: {

                    ...(_id && { userId: new mongoose.Types.ObjectId(_id) }),
                    $or: [
                        { "infoUser.name": { $regex: search === "" ? ".*" : search, $options: "i" } }
                    ]
                }
            }
        ]

        const data = await modelMark.aggregate([...query,
        { $skip: (skip - 1) * limit },
        { $limit: limit }
        ])
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
module.exports = { CreateMark, GetMark, UpdateMark, DeleteMark }