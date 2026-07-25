const modelMenu = require("../modal/menu")
const cloudinary = require('../config/cloudinaryConfig')
const menuTranslationQueue = require('../helps/menuTranslationQueue');
const ListMenu = async (req, res) => {
    try {
        const data = await modelMenu.aggregate([
            // Unwind menu
            { $unwind: { path: "$menu", preserveNullAndEmptyArrays: true } },

            // Unwind menu1
            { $unwind: { path: "$menu.menu1", preserveNullAndEmptyArrays: true } },
            { $sort: { "menu.local": 1, "menu.menu1.location": 1 } },

            // Unwind menu2
            { $unwind: { path: "$menu.menu1.menu2", preserveNullAndEmptyArrays: true } },
            { $sort: { "menu.local": 1, "menu.menu1.location": 1, "menu.menu1.menu2.locationChildrenMenu": 1 } },

            // Group lại menu2
            {
                $group: {
                    _id: { docId: "$_id", menuId: "$menu._id", menu1Id: "$menu.menu1._id" },
                    logo: { $first: "$logo" },
                    banner: { $first: "$banner" },

                    menuTitle: { $first: "$menu.title" },
                    menuTitleEN: { $first: "$menu.titleEN" },
                    menuLocal: { $first: "$menu.local" },

                    titleMenu: { $first: "$menu.menu1.titleMenu" },
                    titleMenuEN: { $first: "$menu.menu1.titleMenuEN" },
                    typeof: { $first: "$menu.menu1.typeof" },
                    location: { $first: "$menu.menu1.location" },

                    menu2: {
                        $push: {
                            $cond: [
                                { $ifNull: ["$menu.menu1.menu2._id", false] },
                                {
                                    _id: "$menu.menu1.menu2._id",
                                    titleChildrenMenu: "$menu.menu1.menu2.titleChildrenMenu",
                                    titleChildrenMenuEN: "$menu.menu1.menu2.titleChildrenMenuEN",
                                    typeofChildrenMenu: "$menu.menu1.menu2.typeofChildrenMenu",
                                    locationChildrenMenu: "$menu.menu1.menu2.locationChildrenMenu"
                                },
                                "$$REMOVE" // Nếu menu1 không có menu2 nào (preserveNullAndEmptyArrays), không push item rác
                            ]
                        }
                    }
                }
            },

            // Group lại menu1
            {
                $group: {
                    _id: { docId: "$_id.docId", menuId: "$_id.menuId" },
                    logo: { $first: "$logo" },
                    banner: { $first: "$banner" },

                    menuTitle: { $first: "$menuTitle" },
                    menuTitleEN: { $first: "$menuTitleEN" },
                    menuLocal: { $first: "$menuLocal" },

                    menu1: {
                        $push: {
                            $cond: [
                                { $ifNull: ["$_id.menu1Id", false] },
                                {
                                    _id: "$_id.menu1Id",
                                    titleMenu: "$titleMenu",
                                    titleMenuEN: "$titleMenuEN",
                                    typeof: "$typeof",
                                    location: "$location",
                                    menu2: "$menu2"
                                },
                                "$$REMOVE"
                            ]
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
                            $cond: [
                                { $ifNull: ["$_id.menuId", false] },
                                {
                                    _id: "$_id.menuId",
                                    title: "$menuTitle",
                                    titleEN: "$menuTitleEN",
                                    local: "$menuLocal",
                                    menu1: "$menu1"
                                },
                                "$$REMOVE"
                            ]
                        }
                    }
                }
            },

            // Sort banner, menu (theo local) và menu1 (theo location)
            {
                $addFields: {
                    banner: {
                        $sortArray: { input: "$banner", sortBy: { locationBanner: 1 } }
                    },
                    menu: {
                        $sortArray: {
                            input: {
                                $map: {
                                    input: "$menu",
                                    as: "m",
                                    in: {
                                        _id: "$$m._id",
                                        title: "$$m.title",
                                        titleEN: "$$m.titleEN",
                                        local: "$$m.local",
                                        menu1: {
                                            $sortArray: { input: "$$m.menu1", sortBy: { location: 1 } }
                                        }
                                    }
                                }
                            },
                            sortBy: { local: 1 }
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
        const { menu, bannerMeta } = req.body; // đổi locationBanner -> bannerMeta
        const { id } = req.params;
        const logo = req.files?.['logo']?.[0];
        const newBannerFiles = req.files?.['banner'] || [];

        if (!id) {
            return res.status(400).json({ message: "ID is required" });
        }

        const updateData = {};
        let oldMenu = null;

        if (menu) {
            const oldDoc = await modelMenu.findById(id).select('menu').lean();
            oldMenu = oldDoc?.menu || [];
            updateData.menu = JSON.parse(menu);
        }

        if (logo) {
            const resultLogo = await cloudinary.uploader.upload(logo.path, {
                folder: "editorjs",
            });
            updateData.logo = resultLogo.secure_url;
        }

        if (bannerMeta) {
            const parsedMeta = JSON.parse(bannerMeta);

            // Upload song song CHỈ những file mới
            const uploadedUrls = await Promise.all(
                newBannerFiles.map(file =>
                    cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                        .then(result => result.secure_url)
                )
            );

            let newFileIndex = 0;
            updateData.banner = parsedMeta.map(item => {
                if (item.type === "new") {
                    const img = uploadedUrls[newFileIndex];
                    newFileIndex++;
                    return { img, locationBanner: item.locationBanner };
                }
                // existing -> giữ nguyên url cũ, không upload lại
                return { img: item.img, locationBanner: item.locationBanner };
            });
        }

        const update = await modelMenu.findByIdAndUpdate(id, updateData, { new: true });

        if (!update) {
            return res.status(404).json({ message: "Menu not found" });
        }

        if (updateData.menu) {
            menuTranslationQueue.addJob(id, oldMenu, updateData.menu);
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