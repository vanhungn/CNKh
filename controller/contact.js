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
            message:"successfully",
            create
        })
    } catch (error) {
        return res.status(500).json({
            error
        })
    }
}

module.exports ={CreateContact}