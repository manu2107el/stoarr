const express = require('express')
const router = express.Router()
const { spawnPipe } = require('../controllers/spawn.controller')

router.get('/', (req, res) => spawnPipe(req, res))

module.exports = router
