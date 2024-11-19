const router = require('express').Router()
const { onCreateService, onInsertMany } = require('./../controllers/service.controller');


router.post('/insert/many', onInsertMany)
router.post('/', onCreateService)


module.exports = router