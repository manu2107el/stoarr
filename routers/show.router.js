const express = require('express')
const router = express.Router()
const { getShow } = require('../controllers/show.controller')
const { downloadHLS } = require('../controllers/show.controller')

router.get('/', async (req, res) => getShow(req, res))
router.get('/download', async (req, res) => downloadHLS(req, res))

module.exports = router
