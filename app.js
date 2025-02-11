const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(bodyParser.json());

const showRouter = require('./routers/show.router');
const spawnRouter = require('./routers/spawn.router');

app.use('/show', showRouter);
app.use('/spawn', spawnRouter);

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
