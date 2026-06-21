const mongoose = require("mongoose")
const schema = mongoose.Schema

const ModelMenu = new schema({
    title:String,
    news: {
        status:Boolean,
        article:{ }
    }

})