#!/usr/bin/env node

var fuse = require('node-fuse-bindings')
const memops = require('./indexed')
let mountdir = process.argv[2] || 'mnt'
let mountPath = mountdir;
fuse.mount(mountPath, memops(), { options: ["big_writes"] }, function (err) {
    if (err) throw err
    console.log('filesystem mounted on ' + mountPath)
});

process.once('SIGINT', function () {
    fuse.unmount(mountdir, function (err) {
        console.log('unmounted', err)
        process.exit()
    })
})
