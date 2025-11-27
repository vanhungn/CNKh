const modelUser = require('../modal/user')
const createToken = require('../helps/token')

const MicrosoftLogin = async (req, res) => {
    try {
        const data = req.auth
        const accessToken = await createToken({
            name: data.name,
            email: data. preferred_username
        }, '30m', 'accessToken')
        const refreshToken = await createToken({
            name: data.name,
            email: data. preferred_username
        }, '1d', 'refreshToken')
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,  // 🔒 chặn JS truy cập cookie
            secure: true,    // 🔒 chỉ gửi qua HTTPS (khi deploy)
            sameSite: 'strict', // chống CSRF
            path: '/',       // cookie dùng toàn site
            maxAge: 1 * 24 * 60 * 60 * 1000
        });
        console.log(data)
        let id = ""
        const check = await modelUser.findOne({ email: data. preferred_username })
        id = check?._id
        if (!check) {
            const create = await modelUser.create({
                name: data.name,
                email: data. preferred_username,
                role: "student",
                password: ""
            })
            id = create._id
        }

        return res.status(200).json({
            token: accessToken,
            data: { _id: id, name: data.name, email: data. preferred_username }
        })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            // ⚠️ Chỉ hiển thị detail trong dev
            ...(process.env.NODE_ENV !== 'production' && { detail: error.stack })
        })
    }
}
module.exports = { MicrosoftLogin }