const modelUser = require('../modal/user')
const createToken = require('../helps/token')
const MicrosoftLogin = async (req, res) => {
    try {
        const data = req.auth;
        const accessToken = await createToken({
            name: data.name,
            email: data.preferred_username
        }, '30m', 'accessToken');

        const refreshToken = await createToken({
            name: data.name,
            email: data.preferred_username
        }, '7d', 'refreshToken');


        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: false,
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });



        let id = "";
        const check = await modelUser.findOne({ email: data.preferred_username });
        id = check?._id;

        if (!check) {
            const create = await modelUser.create({
                name: data.name,
                email: data.preferred_username,
                role: "student",
                password: ""
            });
            id = create._id;
        }

        return res.status(200).json({
            token: accessToken,
            data: { _id: id, name: data.name, email: data.preferred_username }
        });

    } catch (error) {
        console.error('❌ Microsoft login error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            ...(process.env.NODE_ENV !== 'production' && { detail: error.stack })
        });
    }
};

module.exports = { MicrosoftLogin };