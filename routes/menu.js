const express = require("express")
const router = express.Router()
const menu = require("../controller/menus")
const middleware = require("../middleware/verifyToken")

router.get("/", middleware, menu.ListMenu)
router.post("/create", middleware, menu.createMenu)
router.post("/update/:id", middleware, menu.UpdateMenu)
router.delete("/delete/:id", middleware, menu.DeleteMenu)
module.exports = router

