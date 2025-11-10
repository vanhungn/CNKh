const modelUser = require('../modal/user')
const createToken = require('../helps/token')

const MicrosoftLogin = async (req, res) => {
    try {
        const data = req.auth
        const accessToken = await createToken({
            name: data.name,
            email: data.unique_name
        }, '30m', 'accessToken')
        const refreshToken = await createToken({
            name: data.name,
            email: data.unique_name
        }, '1d', 'refreshToken')
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,  // 🔒 chặn JS truy cập cookie
            secure: true,    // 🔒 chỉ gửi qua HTTPS (khi deploy)
            sameSite: 'strict', // chống CSRF
            path: '/',       // cookie dùng toàn site
            maxAge: 1 * 24 * 60 * 60 * 1000
        });
        await modelUser.create({
            name: data.name,
            email: data.unique_name
        })
        return res.status(200).json({
            token: accessToken
        })
    } catch (error) {
        return res.status(500).json({
            message: error
        })
    }
}
module.exports = { MicrosoftLogin }