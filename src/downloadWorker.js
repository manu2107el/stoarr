const { parentPort, workerData } = require('worker_threads')
const fs = require('fs')
const request = require('request')
const utils = require('./utils')

let downloadOptions = {
    url: '',
    outputDir: 'out',
    outputFileName: new Date().getTime() + '.mp4',
    threadCount: 3,
    videoSuffix: '',
    videoUrlDirPath: '',
    headerReferrer: '',
    retryOnError: true,
    proxy: null,
    debug: true,
    useResumeDEBUG: false,
    forceReDownload: false,
}

function loadM3u8(onLoad) {
    let options = {
        method: 'GET',
        url: downloadOptions.url,
        headers: {
            Referer: downloadOptions.headerReferrer,
        },
        proxy: downloadOptions.proxy,
    }
    request(options, (error, response, body) => {
        if (error || response.statusCode !== 200) {
            console.error(
                'Error loading M3U8:',
                error ? error.message : `HTTP Error: ${response?.statusCode}`
            )
            parentPort.postMessage({
                type: 'error',
                data: error
                    ? error.message
                    : `HTTP Error: ${response?.statusCode}`,
            }) // Send error to parent
            return
        }

        if (downloadOptions.debug) {
            console.log('M3u8 url res:', body)
        }

        let files = body
            .split('\n')
            .filter((line) => {
                let videoSuffix = downloadOptions.videoSuffix
                return (
                    line.trim() !== '' &&
                    !line.startsWith('#') &&
                    (!videoSuffix ||
                        line.endsWith(videoSuffix) ||
                        line.includes(videoSuffix + '?'))
                )
            })
            .map((line) => {
                let videoUrlDirPath = downloadOptions.videoUrlDirPath
                if (line.startsWith('http://') || line.startsWith('https://')) {
                    return line
                }
                return (
                    (videoUrlDirPath.endsWith('/')
                        ? videoUrlDirPath
                        : videoUrlDirPath + '/') + line.replace(/^\//, '')
                )
            })

        onLoad(files)
    })
}

function downloadVideoFile(url) {
    return new Promise((resolve, reject) => {
        let proxy = downloadOptions.proxy
        let headerReferrer = downloadOptions.headerReferrer
        let outputDir = downloadOptions.outputDir

        let options = {
            method: 'GET',
            url: url,
            encoding: null,
            headers: {
                Referer: headerReferrer,
            },
            proxy,
        }
        request(options, function (error, response) {
            if (error) {
                console.error('Error downloading segment:', error)
                parentPort.postMessage({ type: 'error', data: error.message })
                return reject(url)
            }

            if (
                response.statusCode >= 300 &&
                response.statusCode < 400 &&
                response.headers.location
            ) {
                console.log(
                    `Following redirect for segment: ${response.headers.location}`
                )
                return downloadVideoFile(response.headers.location)
                    .then(resolve)
                    .catch(reject) // Follow redirect
            }

            if (response.statusCode !== 200) {
                console.error(
                    `HTTP error downloading segment: Status ${response.statusCode} for ${url}`
                )
                parentPort.postMessage({
                    type: 'error',
                    data: `HTTP error downloading segment: Status ${response.statusCode} for ${url}`,
                })
                return reject(
                    new Error(
                        `HTTP error! Status: ${response.statusCode} for ${url}`
                    )
                )
            }

            var regex = /\/([^\/?#]+\.ts)(?:[?#]|$)/
            var match = url.match(regex)
            let fileName = match
                ? match[1]
                : `segment_${new Date().getTime()}.ts`
            fs.writeFileSync(outputDir + '/' + fileName, response.body)
            resolve()
        })
    })
}

let startTasks = (
    taskList,
    taskHandlePromise,
    progress = [0, 0],
    limit = 3
) => {
    let retryOnError = downloadOptions.retryOnError

    let _runTask = (arr) => {
        console.log(
            'Progress:',
            parseInt(((taskList.length - arr.length) / taskList.length) * 100) +
                '%'
        )
        parentPort.postMessage({
            type: 'progress',
            data: parseInt(
                ((taskList.length - arr.length) / taskList.length) * 100
            ),
        })

        let _url = arr.shift()

        if (downloadOptions.debug) {
            console.log('Download fragment:', _url)
        }

        return taskHandlePromise(_url)
            .then(() => {
                utils.saveProgress(
                    downloadOptions.outputDir,
                    taskList.length - arr.length,
                    downloadOptions.outputFileName
                )
                if (arr.length !== 0) return _runTask(arr)
            })
            .catch((item) => {
                if (retryOnError) {
                    arr.push(item)
                    return _runTask(arr)
                } else {
                    parentPort.postMessage({
                        type: 'error',
                        data: `Failed to download segment: ${_url}`,
                    }) // Notify parent thread of failure
                }
            })
    }

    let listCopy = [].concat(taskList)
    if (progress[1] > 0) listCopy = listCopy.slice(progress[1] - 1)
    let asyncTaskList = []
    while (limit > 0 && listCopy.length > 0) {
        asyncTaskList.push(_runTask(listCopy))
        limit--
    }

    return Promise.all(asyncTaskList)
}

function mergeFiles(list) {
    let outputDir = downloadOptions.outputDir
    let outFile = outputDir + '/' + downloadOptions.outputFileName

    if (fs.existsSync(outFile)) {
        fs.unlinkSync(outFile)
    }

    try {
        list.forEach((url) => {
            var regex = /\/([^\/?#]+\.ts)(?:[?#]|$)/
            var match = url.match(regex)
            let fileName = match
                ? match[1]
                : `segment_${new Date().getTime()}.ts`
            let result = fs.readFileSync(outputDir + '/' + fileName)
            fs.unlinkSync(outputDir + '/' + fileName)
            fs.appendFileSync(outFile, result)
        })
    } catch (mergeError) {
        console.error('Error during file merge:', mergeError)
        parentPort.postMessage({
            type: 'error',
            data: `Error during file merge: ${mergeError.message}`,
        })
        return // Stop merging if there's an error
    }

    console.log('Merged files:', outFile)
    parentPort.postMessage({ type: 'complete', data: outFile }) // Send complete message with file path
}

function downloadInner() {
    downloadOptions = Object.assign(downloadOptions, workerData)
    console.log('Download options:', downloadOptions)
    if (!downloadOptions.videoUrlDirPath) {
        downloadOptions.videoUrlDirPath =
            downloadOptions.url.substring(
                0,
                downloadOptions.url.lastIndexOf('/')
            ) + '/'
    }

    if (!fs.existsSync(downloadOptions.outputDir)) {
        console.log('Creating output directory:', downloadOptions.outputDir)
        fs.mkdirSync(downloadOptions.outputDir, { recursive: true })
    }

    const lastDownloadedInfo = utils.getProgress(downloadOptions.outputDir)

    if (
        !downloadOptions.forceReDownload &&
        fs.existsSync(
            downloadOptions.outputDir + '/' + downloadOptions.outputFileName
        )
    ) {
        parentPort.postMessage({
            type: 'skipped',
            data: downloadOptions.outputFileName,
        })
        return
    }

    loadM3u8((list) => {
        if (downloadOptions.debug) {
            console.log('Ready download file list:', list)
        }

        parentPort.postMessage({ type: 'progress', data: 0 })

        startTasks(
            list,
            downloadVideoFile,
            lastDownloadedInfo,
            downloadOptions.threadCount
        )
            .then(() => {
                mergeFiles(list)
                parentPort.postMessage({ type: 'downloaded', data: list })
                // The 'complete' message is already sent in mergeFiles
            })
            .catch((err) => {
                parentPort.postMessage({ type: 'error', data: err.message })
            })
    })

    parentPort.postMessage({ type: 'start', data: downloadOptions })
}

downloadInner()
