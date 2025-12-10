const jwt = require('jsonwebtoken');
require('dotenv').config();

const Verify = (req, res, next) => {
    try {
        const token = req.headers['authorization'];
        
        if (!token) {
            return res.status(400).json({
                message: "Token is incorrect"
            });
        }

        jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    return res.status(401).json({
                        message: 'Token expired',
                    });
                }

                return res.status(400).json({ error: 'Invalid token' });
            }

            // Lưu user vào request
            req.user = user;

            next();
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports = Verify;
