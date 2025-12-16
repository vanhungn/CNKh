const mongoose = require("mongoose")
const Schema = mongoose.Schema
const modalMark = new Schema({
    userId:{type:mongoose.Types.ObjectId,ref:"users"},
    theoryId:{type:mongoose.Types.ObjectId,ref:"thoerys"},
    core:Number,
},{timestamps:true},{collection:"marks"})
module.exports = mongoose.model("marks",modalMark)