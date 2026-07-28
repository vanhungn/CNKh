const mongoose = require("mongoose")
const schema = mongoose.Schema

const ModelMenu = new schema({
    menu: [
        {
            title: String,
            titleEN: String,
            local: Number,
            kindOf: String,

            menu1: [
                {
                    titleMenu: String,
                    titleMenuEN: String,
                    typeof: String,
                    location: Number,
                    menu2: [
                        {
                            titleChildrenMenu: String,
                            titleChildrenMenuEN: String,
                            typeofChildrenMenu: String,
                            locationChildrenMenu: Number,
                        }
                    ]
                }
            ]
        }
    ],
    logo: String,
    banner: [
        {
            img: String,
            locationBanner: Number
        }
    ],
    bannerTopPic: [
        {
            typeofTopPic: String,
            banner: [
                {
                    img: String,
                    locationBanner: Number
                }
            ],
        }
    ],
}, { timestamps: true, collection: "menus" })

module.exports = mongoose.model("menus", ModelMenu)