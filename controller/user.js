const modalUser = require('../modal/user')
const bcrypt = require('bcrypt')
const createToken = require('../helps/token')
require('dotenv').config()
const RegisterAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body
        if (!name, !email, !password) {
            return res.status(400).json({
                message: "Not Valid"
            })
        }
        const check = await modalUser.findOne({ email })
        if (check) {
            return res.status(403).json({
                message: "Existed"
            })
        }
        const salt = bcrypt.genSaltSync(10)
        const hashPassword = bcrypt.hashSync(password, salt)
        const create = await modalUser.create({
            name, email, password: hashPassword, role: "admin"
        })
        return res.status(200).json({
            message: "successfully",
            create
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const LoginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email, !password) {
            return res.status(400).json({
                message: "Not Valid"
            })
        }
        const user = await modalUser.findOne({ email })
        if (!user) {
            return res.status(400).json({
                message: "Not exist"
            })
        }
        if (user.role !== "admin") {
            return res.status(402).json({
                message: "you are not an admin"
            })
        }
        const isPassword = await bcrypt.compare(password, user.password)
        if (!isPassword) {
            return res.status(403).json({
                message: 'Password is incorrect'
            })
        }
        const payload = {
            id: user._id,
            email: user.email,
            role: user.role
        }
        const accessToken = await createToken(payload, "30m", 'accessToken')
        const refreshToken = await createToken(payload, "7d", 'refreshToken')
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "strict",
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000
        })
        return res.status(200).json({
            accessToken,
            data: payload
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const UpdateUser = async (req, res) => {
    try {
        const { classes, userCode } = req.body
        const { _id } = req.params
        if (!classes, !userCode, !_id) {
            return res.status(400).json({
                message: "not valid"
            })
        }
        await modalUser.findByIdAndUpdate(_id, { classes, userCode }, { new: true })
        return res.status(200).json({
            message: "successfully"
        })
    } catch (error) {
        return res.status(500).json({
            error
        })
    }
}
const GetUser=async(req,res)=>{
    try {
        
    } catch (error) {
        return res.status(500).json({
            error
        })
    }
}
module.exports = { RegisterAdmin, LoginAdmin, UpdateUser }