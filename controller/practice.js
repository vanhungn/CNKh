const modalTheory = require('../modal/thoery')
const CreateTheory = async (req, res) => {
    try {
        const { chapter, list } = req.body
        if (!chapter || list.length === 0) {
            return res.status(400).json({
                message: "not valid"
            })
        }
        const data = await modalTheory.create({
            chapter, list
        })
        return res.status(200).json({
            data
        })
    } catch (error) {
        console.error("❌ CreateTheory error:", error);
        return res.status(500).json({
            message: error.message,
            stack: error.stack
        });
    }
}
const GetTheoryChapter = async (req, res) => {
    try {
        const listChapter = await modalTheory.find({})
        const data = [];
        listChapter.forEach(element => {
            data.push({
                title: element.chapter,
                _id: element._id
            })
        });
        return res.status(200).json({
            data
        })
    } catch (error) {
        console.log('ksdhjh')
        return res.status(500).json({
            
            message: error.message,
            stack: error.stack
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