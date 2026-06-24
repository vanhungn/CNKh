const modelMenu = require("../modal/menu")
const cloudinary = require('../config/cloudinaryConfig')
const ListMenu = async (req, res) => {
    try {
        const data = await modelMenu.aggregate([
            // Unwind menu
            { $unwind: { path: "$menu", preserveNullAndEmptyArrays: true } },

            // Unwind menu1
            { $unwind: { path: "$menu.menu1", preserveNullAndEmptyArrays: true } },
            { $sort: { "menu.menu1.location": 1 } },

            // Unwind menu2
            { $unwind: { path: "$menu.menu1.menu2", preserveNullAndEmptyArrays: true } },
            { $sort: { "menu.menu1.location": 1, "menu.menu1.menu2.locationChildrenMenu": 1 } },

            // Group lại menu2
            {
                $group: {
                    _id: { docId: "$_id", menuId: "$menu._id", menu1Id: "$menu.menu1._id" },
                    logo: { $first: "$logo" },
                    banner: { $first: "$banner" },
                    menuTitle: { $first: "$menu.title" },
                    menuId: { $first: "$menu._id" },
                    titleMenu: { $first: "$menu.menu1.titleMenu" },
                    typeof: { $first: "$menu.menu1.typeof" },
                    location: { $first: "$menu.menu1.location" },
                    menu2: { $push: "$menu.menu1.menu2" }
                }
            },

            // Group lại menu1
            {
                $group: {
                    _id: { docId: "$_id.docId", menuId: "$menuId" },
                    logo: { $first: "$logo" },
                    banner: { $first: "$banner" },
                    menuTitle: { $first: "$menuTitle" },
                    menu1: {
                        $push: {
                            titleMenu: "$titleMenu",
                            typeof: "$typeof",
                            location: "$location",
                            menu2: "$menu2"
                        }
                    }
                }
            },

            // Group lại menu
            {
                $group: {
                    _id: "$_id.docId",
                    logo: { $first: "$logo" },
                    banner: { $first: "$banner" },
                    menu: {
                        $push: {
                            title: "$menuTitle",
                            menu1: "$menu1"
                        }
                    }
                }
            },

            // Sort banner và menu1 theo location
            {
                $addFields: {
                    banner: {
                        $sortArray: { input: "$banner", sortBy: { locationBanner: 1 } }
                    },
                    menu: {
                        $map: {
                            input: "$menu",
                            as: "m",
                            in: {
                                title: "$$m.title",
                                menu1: {
                                    $sortArray: { input: "$$m.menu1", sortBy: { location: 1 } }
                                }
                            }
                        }
                    }
                }
            }
        ]);

        return res.status(200).json({ data });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
const createMenu = async (req, res) => {
    try {
        const { menu, locationBanner } = req.body;
        const logo = req.files?.['logo']?.[0];
        const banners = req.files?.['banner'];

        if (!menu || !logo || !banners || banners.length <= 0 || !locationBanner) {
            return res.status(400).json({ message: "Not valid" });
        }

        const parsedMenu = JSON.parse(menu);
        const parsedLocations = JSON.parse(locationBanner);

        const resultLogo = await cloudinary.uploader.upload(logo.path, {
            folder: "editorjs",
        });

        const uploadPromises = banners.map((file, index) =>
            cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                .then(result => ({
                    img: result.secure_url,
                    locationBanner: Number(parsedLocations[index]) || index + 1
                }))
        );
        const arrBanner = await Promise.all(uploadPromises);

        const create = await modelMenu.create({
            menu: parsedMenu,
            logo: resultLogo.secure_url,
            banner: arrBanner
        });

        return res.status(201).json({ message: "Successfully", data: create });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
const UpdateMenu = async (req, res) => {
    try {
        const { menu, locationBanner } = req.body;
        const { id } = req.params;
        const logo = req.files?.['logo']?.[0];
        const banners = req.files?.['banner'];

        if (!id) {
            return res.status(400).json({ message: "ID is required" });
        }

        const updateData = {};

        if (menu) updateData.menu = JSON.parse(menu);

        if (logo) {
            const resultLogo = await cloudinary.uploader.upload(logo.path, {
                folder: "editorjs",
            });
            updateData.logo = resultLogo.secure_url;
        }

        if (banners && banners.length > 0) {
            const parsedLocations = locationBanner ? JSON.parse(locationBanner) : [];
            const uploadPromises = banners.map((file, index) =>
                cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                    .then(result => ({
                        img: result.secure_url,
                        locationBanner: Number(parsedLocations[index]) || index + 1
                    }))
            );
            updateData.banner = await Promise.all(uploadPromises);
        }

        const update = await modelMenu.findByIdAndUpdate(id, updateData, { new: true });

        if (!update) {
            return res.status(404).json({ message: "Menu not found" });
        }

        return res.status(200).json({ message: "Successfully", data: update });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
const DeleteMenu = async (req, res) => {
    try {
        const { id } = req.params
        if (!id) {
            return res.status(400).json({
                message: "Not valid"
            })
        }
        const deleteMenu = await modelMenu.findByIdAndDelete(id)
        return res.status(200).json({
            message: "Successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: error
        })
    }
}
module.exports = { ListMenu, createMenu, UpdateMenu, DeleteMenu }