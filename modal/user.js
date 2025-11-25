const mongoose = require("mongoose")
const Schema = mongoose.Schema

const modelUser = new Schema({
    name: String,
    email:String,
    password:String,
    role:String
},
{timestamps:true},
{collection:'users'}
)
module.exports = mongoose.model('users',modelUser)