const constants = require('filesystem-constants')
const fs = require("fs")
const c = process.platform === 'darwin' ? constants.darwin : constants.linux;
let fsutil = require("./fsutil")
const BLOCK_SIZE=1024 * 1024 * 4
class CacheManager {
    constructor() {
        this.fds = {}
    }
    findByFD(fd) {
        return this.fds[fd]
    }

    write(fd, path, offset, buf, length) {
        let realname = fsutil.path_parse(path)
        let current_buf = this.fds[fd];
        //如果之前没有记录，创建
        if (offset == 0 && !current_buf) {
            current_buf = Buffer.from(buf)
        }else{
            current_buf = Buffer.concat([current_buf, buf]);
        }
        if (current_buf.length > BLOCK_SIZE) {
            let temp_buf=current_buf.slice(0,BLOCK_SIZE)
            current_buf=current_buf.slice(BLOCK_SIZE)
            fs.writeFileSync(`${realname.name}-1.${realname.ext}`,temp_buf);
        }
        return length
    }
}

module.exports = CacheManager;