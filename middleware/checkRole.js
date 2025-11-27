const User = require('../modal/user')
const CheckRole =async (req, res, next) => {
    const user = req.user
    const check = await User.findOne({email:user.email})
    if(check.role!=="admin"){
        return res.status(402).json({
            message:"you are not an admin"
        })
    }
    next()
}
module.exports = CheckRole