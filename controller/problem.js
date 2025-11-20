const modalProblem = require('../modal/problem')
const GetAlgorithm = async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 1
        const limit = parseInt(req.query.limit) || 10
        const search = req.query.search || ""
        const querys = {
            $match: {
                $or: [
                    { title: { $regex: search, $options: "i" } }
                ]
            }
        }
        const data = await modalProblem.aggregate([
            querys,
            { $skip: (skip - 1) * limit },
            { $limit: limit }
        ])
        const length = await modalProblem.aggregate([querys])
        const total = Math.ceil(length.length / limit)
        return res.status(200).json({
            data, total
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}

module.exports = { GetAlgorithm }