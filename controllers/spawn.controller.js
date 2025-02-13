const { spawn } = require('child_process')

exports.spawnPipe = async (req, res) => {
    const commander = spawn('node', ['./src/commander.js'], {
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
    })

    commander.stdin.write(JSON.stringify({ soldiers: 3 }))
    commander.stdin.end()

    commander.stdout.on('data', (data) => {
        console.log(data)
    })
}
