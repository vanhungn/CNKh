
const Microsoft = (req, res) => {
    try {
        const data = req.auth
        
        return res.status(200).json({
            data: req.auth
        })
    } catch (error) {
        return res.status(500).json({
            error
        })
    }
}
module.exports = Microsoft