const createToken = require('../helps/token')
const jwt = require('jsonwebtoken')
const User = require('../modal/user')


const RefreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ message: 'Không tìm thấy refresh token' });
        }
        const decode = jwt.verify(refreshToken, process.env.REFRESH_KEY)
        const user = await User.findOne({ email: decode.email })
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy user' });
        }
        const payload = {
            id: user._id,
            email: user.email,
            role: user.role
        }
        const accessToken = await createToken(payload, "30m", "accessToken");
        return res.status(200).json({
            success: true,
            accessToken,
            data: payload
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ message: 'Refresh token không hợp lệ' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ message: 'Refresh token đã hết hạn' });
        }
        console.error('Lỗi refresh token:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
}
module.exports = RefreshToken