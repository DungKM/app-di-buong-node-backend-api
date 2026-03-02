const router = require("express").Router();
const controller = require("../controllers/ai.controller");
const { authRequired } = require("../middlewares/auth.middleware");



router.post('/chat', authRequired, controller.chatWithAI);

module.exports = router;