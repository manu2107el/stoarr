const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const utils = require('./src/utils')
const app = express();
const port = 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(bodyParser.json());

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

app.post('/test', async (req, res) => {
    
    if(req.body.type === null || req.body.type === undefined){
        res.status(400).send({ message: "type Required"})
    }
    if(req.body.link === null || req.body.link === undefined){
        res.status(400).send({ message: "link Required"})
    }
    res.status(200).send(await utils.getFullShow(req.body.link))
})

app.get('/spawn', (req, res) => {

    const commander = spawn('node', ['./src/commander.js'], {
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    commander.stdin.write(JSON.stringify( {soldiers: 3}));
    commander.stdin.end();

    commander.stdout.on('data', (data) => {
        console.log(data)
    })
}
)
