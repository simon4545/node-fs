const constants = require('filesystem-constants')
const c = process.platform === 'darwin' ? constants.darwin : constants.linux
class CacheManager {
    constructor() {
        this.fds = []
        this.fd_base = 20;
        this.caches=[]
    }
    //尝试创建下一个文件编号
    tryGetNextFD() {
        return this.fds.length + 1 + this.fd_base
    }
    findByFD(fd){
        let idx=this.fds.findIndex((item)=>item==fd);
        return idx
    }

    write(fd,offset,buf){
        
    }
}

module.exports = CacheManager;