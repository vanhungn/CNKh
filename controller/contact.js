const modelContact = require('../modal/contact')
const CreateContact = async (req, res) => {
    try {
        const { name, phone, email, title, content } = req.body
        if (!name || !phone || !email || !title || !content) {
            return res.status(400).json({
                message: "not valid"
            })
        }
        const create = await modelContact.create({ name, phone, email, title, content })
        return res.status(200).json({
            message: "successfully",
            create
        })
    } catch (error) {
        return res.status(500).json({
            error
        })
    }
}
const GetContact = async (req, res) => {
    try {
        const sort = parseInt(req.query.sort) || -1
        const search = req.query.search.trim() || ""
        const skip = parseInt(req.query.skip) || 1
        const limit = parseInt(req.query.limit) || 10
        const query = {
            $match: {
                $or: [
                    { title: { $regex: search, $options: "i" } },
                    { name: { $regex: search, $options:"i"} }
                ]
            }
        }
        const data = await modelContact.aggregate([query, {
            $sort: {createdAt:sort}
        },
            { $skip: (skip - 1) * limit },
            { $limit: limit }
        ])
        const dataLength = await modelContact.aggregate([query])
        const total = Math.ceil(dataLength.length / limit)
        return res.status(200).json({
            data,total
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const DeleteContact = async(req,res)=>{
    try {
        const {_id} = req.params
        if(!_id){
            return res.status(400).json({
                message:"not valid"
            })
        }
        await modelContact.findByIdAndDelete(_id)
        return res.status(200).json({
            message:"successFully"
        })
    } catch (error) {
        return res.status(500).json(error)
    }
}
module.exports = { CreateContact,GetContact,DeleteContact }