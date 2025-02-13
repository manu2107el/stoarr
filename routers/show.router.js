const express = require('express')
const router = express.Router()
const { getShow } = require('../controllers/show.controller')

router.get('/', async (req, res) => getShow(req, res))

module.exports = router
