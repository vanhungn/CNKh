const modalProblem = require('../modal/problem')
const GetAlgorithm = async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 1
        const limit = parseInt(req.query.limit) || 10
        const search = (req.query.search || "").trim()
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
const UpdateAlgorithm = async (req, res) => {
    try {
        const { _id } = req.params
        const { titleTopic, typeOfTopic, questionTopic, inputTopic, outputTopic, suggestTopic } = req.body
        if (!_id || !titleTopic || !typeOfTopic || !questionTopic || !inputTopic || !outputTopic || !suggestTopic) {
            return res.status(400).json({
                message: "Valid"
            })
        }
        const update = await modalProblem.findByIdAndUpdate(_id,
            {
                title: titleTopic, typeOf: typeOfTopic, statement: questionTopic,
                input: inputTopic, output: outputTopic, suggest: suggestTopic
            }, { new: true }
        )
        return res.status(200).json({
            message: "successfully",

        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const DeleteProblem = async (req, res) => {
    try {
        const { _id } = req.params
        if (!_id) {
            return res.status(400).json({
                message: "Not valid"
            })
        }
        await modalProblem.findByIdAndDelete(_id)
        return res.status(200).json({
            message: "successfully"
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
module.exports = { DeleteProblem, GetAlgorithm, UpdateAlgorithm }