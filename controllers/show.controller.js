const showUtils = require('../src/showUtils')
const { Worker } = require('worker_threads')
const utils = require('../src/utils')
const path = require('path')
const fs = require('fs')
const { count } = require('console')

exports.getShow = async (req, res) => {
    if (req.body.type === null || req.body.type === undefined) {
        res.status(400).send({ message: 'type Required' })
    }
    if (req.body.link === null || req.body.link === undefined) {
        res.status(400).send({ message: 'link Required' })
    }
    try {
        switch (req.body.type) {
            case 'full':
                const fullResult = await showUtils.getFullShow(req.body.link)
                res.status(200).send(fullResult)
                break
            case 'season':
                const seasonResult = await showUtils.getSeasonVideoUrls(
                    req.body.link
                )
                res.status(200).send(seasonResult)
                break
            default:
                res.status(400).send({
                    message:
                        'invalid type specified. valid types are: full, season',
                })
        }
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
}
exports.downloadHLS = async (req, res) => {
    var test = await utils.getIndexUrl(req.body.url)
    const url = test[2]
    console.log(url)
    const fileName = 'out/video.mp4'
    const worker = new Worker('./src/downloadWorker.js', {
        workerData: { url, fileName },
    })

    worker.on('message', (message) => {
        if (message.success) {
            console.log(message.success)
        } else if (message.error) {
            console.error(`Error: ${message.error}`)
        }
    })

    worker.on('error', (err) => {
        console.error(`Worker Error: ${err}`)
    })

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`)
        }
    })
}
