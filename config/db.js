const mongoose = require('mongoose')
require('dotenv').config()
const ConnectData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI)

        console.log("Connect success")

    } catch (error) {
        console.log("can not connect", error)
    }
}
module.exports = ConnectData