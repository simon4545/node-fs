var fuse = require('node-fuse-bindings');
var async = require("async");
let fsutil = require("./fsutil")
const knex = require('knex')({
  client: 'mysql',
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'mysqlfs'
  }
});
var CacheManager = require('./CacheManager')
let fds = [];
let cacheManager;
module.exports = function (opts) {
  return {
    init(cb) {
      cacheManager = new CacheManager();
      cb(0)
    },
    statfs(path, cb) {
      cb(0, {
        bsize: 1000000,
        frsize: 1000000,
        blocks: 1000000,
        bfree: 1000000,
        bavail: 1000000,
        files: 1000000,
        ffree: 1000000,
        favail: 1000000,
        fsid: 1000000,
        flag: 1000000,
        namemax: 1000000
      })
    },
    chown(path /*:string*/, uid /*:number*/, gid /*:number*/, cb /*:function*/){
      cb(0)
    },
    chmod(path /*:string*/, mode /*:number*/, cb /*:function*/){
      cb(0)
    },
    // rename(src, dest, cb) { },
    // link(src, dest, cb) { },
    // symlink(src, dest, cb) { },
    async mkdir(path, mode, cb) {
      let basepath = fsutil.base_path(path)
      let base_ino_record = await knex('paths').select('ino').where('path', basepath).first()
      if (!base_ino_record) {
        return callback(fuse.ENOTDIR)
      }
      async.waterfall([
        function (callback) {
          knex('paths').count('ino as count').where('path', path).first().then((data) => {
            if (data['count'] > 0) {
              return callback(fuse.EEXIST)
            }
            callback();
          }).catch((err) => {
            callback(err)
          })
        },
        function (callback) {
          let curr = new Date().getTime() / 1000;
          const context = fuse.context();
          knex('paths').insert({ ctime: curr, atime: curr, mtime: curr, mode: (mode & 0o7777) | 0o040000, uid: context.uid, gid: context.gid, nlink: 0, size: 4096, type: 1, path: path, parent: base_ino_record['ino'] }).then((data) => {
            callback(null);
          }).catch((err) => {
            callback(err)
          })
        }
      ], function (err) {
        if (err)
          return cb(fuse.EEXIST);
        cb(0)
      });
    },
    async rmdir(path, cb) {
      let result = await knex('paths').select('ino').where('path', path).first()
      if (!result) {
        return callback(fuse.ENOENT)
      }
      await knex('paths').where("path", path).del()
      await knex('paths').where("parent", result['ino']).del()
      cb(0)
    },
    async mknod(path, mode, dev, cb){
      let result = await knex('paths').max('ino as maxino').first()
      if (!result) {
        return callback(fuse.ENOENT)
      }
      let basepath = fsutil.base_path(path);
      let parentrow = await knex('paths').select('ino').where('path', basepath).first();
      let curr = new Date().getTime() / 1000;
      const context = fuse.context();
      result = await knex('paths').insert({
        ctime: curr,
        atime: curr,
        mtime: curr,
        mode: mode,
        rdev:dev,
        uid: context.uid,
        gid: context.gid,
        nlink: 0, size: 0, type: 2,
        path: path,
        parent: parentrow['ino']
      })
      return cb(0, result[0])
    },
    
    async read(path, fd, buffer, length, position, cb) {
      let result = await knex('paths').where("ino", fd).first()
      if (!result) {
        return cb(fuse.ENOENT)
      }

    },
    async open(path, flags, cb) {
      let result = await knex('paths').where("path", path).first()
      if (!result) {
        return cb(fuse.ENOENT)
      }
      return cb(0, result["ino"])
    },
    async release(path, fd, cb) { 
      cb(0) 
    },
    async read(path, fd, buf, len, pos, cb) {
      let result = await knex('paths').where("path", path).first()
      if (!result) {
        return cb(fuse.ENOENT)
      }
      cb(Buffer.from([11111]))
    },
    async write(path, fd, buffer, length, position, cb) {
      let result = await knex('paths').where("ino", fd).first()
      if (!result) {
        return cb(fuse.ENOENT)
      }
      
      cb(cacheManager.write(fd, path, position, buffer, length))
    },
    // releasedir(path, fd, cb) { },
    // opendir(path, flags, cb) { },
    // truncate(path, size, cb) { },
    async readdir(path, cb) {
      let result = await knex('paths').select("ino").where('path', path).first();
      if (!result) {
        return callback(fuse.ENOENT)
      }
      result = await knex('paths').select("path").where('parent', result['ino'])
      result = result.map((item) => {
        return fsutil.real_name(item['path'])
      })
      cb(0, result)
    },
    // fsyncdir(path, fd, datasync, cb) { },
    async getattr(path, cb) {
      if (path === '/') {
        cb(0, { mtime: new Date(), atime: new Date(), ctime: new Date(), nlink: 2, size: 4096, mode: 16895, uid: process.getuid ? process.getuid() : 0, gid: process.getgid ? process.getgid() : 0, dev: 0, rdev: 0, blocks: 1 })
        return
      } else {
        let data = await knex('paths').select('atime', 'ctime', 'mtime', 'size', 'mode', 'uid', 'gid', 'ino').where('path', path).first()
        if (!data) {
          return cb(fuse.ENOENT)
        }
        data['atime'] = data['atime'] * 1000;
        data['ctime'] = data['ctime'] * 1000;
        data['mtime'] = data['mtime'] * 1000;
        cb(0, data)
      }
    },
    async fgetattr(path, fd, cb) {
      if (path === '/') {
        cb(0, { mtime: new Date(), atime: new Date(), ctime: new Date(), nlink: 2, size: 4096, mode: 16895, uid: process.getuid ? process.getuid() : 0, gid: process.getgid ? process.getgid() : 0, dev: 0, rdev: 0, blocks: 1 })
        return
      } else {
        let data = await knex('paths').select('atime', 'ctime', 'mtime', 'size', 'mode', 'uid', 'gid', 'ino').where('path', path).first()
        if (!data) {
          return cb(fuse.ENOENT)
        }
        data['atime'] = data['atime'] * 1000;
        data['ctime'] = data['ctime'] * 1000;
        data['mtime'] = data['mtime'] * 1000;
        cb(0, data)
      }
    },
    access(path, mode, cb) {
      cb(0)
    },
    async utimens(path /*:string*/, atime /*:Date*/, mtime /*:Date*/, cb /*:function*/) {
      let result = await knex('paths').where("path", path).first()
      if (!result) {
        return cb(fuse.ENOENT)
      }
      result = await knex('paths').where(ino, result['ino']).update({
        atime: atime.getTime(),
        mtime: mtime.getTime()
      })
      cb(0)
    }
  }
}

function split(path) {
  return Array.isArray(path) ? path : path.split('/').filter(notEmpty)
}

function notEmpty(s) {
  return s
}

function timeToDate(ms) {
  return typeof ms === 'number' ? new Date(ms) : ms
}

function ENOENT(method, name) {
  throw createError('ENOENT', -2, `no such file or directory, ${method} '${name}'`)
}

function ENOTDIR(method, name) {
  throw createError('ENOTDIR', -20, `not a directory, ${method} '${name}'`)
}

function EINVAL(method, name) {
  throw createError('EINVAL', -23, `invalid argument, ${method} '${name}'`)
}

function EPERM(method, name) {
  throw createError('EPERM', -1, `operation not permitted, ${method} '${name}'`)
}

function EBADF(method, name) {
  throw createError('EBADF', -9, `bad file descriptor, ${method} '${name}'`)
}

function ENOTEMPTY(method, name) {
  throw createError('ENOTEMPTY', -66, `directory not empty, ${method} '${name}'`)
}

function EEXIST(method, name) {
  throw createError('EEXIST', -17, `file already exists, ${method} '${name}'`)
}

function EISDIR(method, name) {
  throw createError('EISDIR', -21, `illegal operation on a directory, ${method} '${name}'`)
}

function createError(code, errno, name) {
  const err = new Error(code + ': ' + name)
  err.errno = errno
  err.code = code
  return err
}
