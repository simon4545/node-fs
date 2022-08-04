let path = require("path")
let fs = require("fs")



module.exports = {
    base_path(path_str) {
        return path.dirname(path_str)
    },

    path_parse(path_str) {
        return path.parse(path_str)
    },

    real_name(path_str) {
        return path.basename(path_str)
    }
}