const mongoose = require('mongoose')
const ConnectData = async () => {
    try {
        await mongoose.connect("mongodb+srv://hungnguyenninhbinh2004_db_user:wgi1ikeOGrzmCDPj@thuctap.gtxo4lu.mongodb.net/thucTap?appName=ThucTap")

        console.log("Connect success")

    } catch (error) {
        console.log("can not connect")
    }
}
module.exports = ConnectData