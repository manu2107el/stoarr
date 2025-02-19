const path = require('path')
const fs = require('fs')

function getProgress(folderPath) {
    if (fs.existsSync(path.join(folderPath, PROGRESSFILE))) {
        try {
            const progress = fs.readFileSync(
                path.join(folderPath, PROGRESSFILE),
                'utf8'
            )
            return progress.split(':').map((p) => parseInt(p, 10) || 0)
        } catch (error) {
            fs.unlinkSync(path.join(folderPath, PROGRESSFILE))
            return [0, 0]
        }
    }
    return [0, 0]
}

function saveProgress(folderPath, segmentIndex, episodeString) {
    try {
        let episodeIndex = getEpisodeNumber(episodeString) ?? 0
        fs.writeFileSync(
            path.join(folderPath, PROGRESSFILE),
            `${episodeIndex.toString()}:${segmentIndex.toString()}`,
            { encoding: 'utf8', flag: 'w' }
        )
    } catch (error) {
        console.error('##LESS##Error saving progress: ', error)
    }
}
async function getIndexUrl(url) {
    videoURL = [1, 1, url]
    try {
        // Redirect URL
        const redRegex = /window\.location\.href\s*=\s*'([^']+)'/
        const redResponse = await fetch(videoURL[2])
        const redBody = await redResponse.text()
        const redUrl = redBody.match(redRegex)?.[1]
        if (!redUrl) throw new Error('Redirect URL not found')

        // Fetch HLS Master URL
        const hlsRegex = /'hls':\s*'([^']+)'/
        const hlsResponse = await fetch(redUrl)
        const hlsBody = await hlsResponse.text()
        const masterURL = atob(hlsBody.match(hlsRegex)?.[1])
        if (!masterURL) throw new Error('HLS URL not found')

        // Fetch index.m3u8 URL
        const masterResponse = await fetch(masterURL)
        const masterBody = await masterResponse.text()
        const indexPath = masterBody
            .split('\n')
            .find((line) => line.startsWith('index'))
        if (!indexPath) throw new Error('Index.m3u8 path not found')

        const baseMasterUrl = masterURL.split('master')[0]
        const indexUrlComplete = baseMasterUrl + indexPath
        const Update = { type: 'pull', message: videoURL[1] }
        process.stdout.write(JSON.stringify(Update) + '\n')
        return [videoURL[0], videoURL[1], indexUrlComplete]
    } catch (error) {
        console.error('Error processing URL: ', videoURL, error.message)
        return null // Or throw the error if you prefer
    }
}

const LOCKFILE = path.join(__dirname, '.running')
const QUEUEFILE = path.join(__dirname, '.queue')
const PROGRESSFILE = '.progress'

module.exports = {
    saveProgress,
    getProgress,
    getIndexUrl,
    LOCKFILE,
    QUEUEFILE,
    PROGRESSFILE,
}
