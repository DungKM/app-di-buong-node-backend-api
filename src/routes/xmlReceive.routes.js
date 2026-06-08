const router = require("express").Router();
const xmlReceiveController = require("../controllers/xmlReceive.controller");

// Không yêu cầu xác thực - dùng cho hệ thống bên ngoài gọi vào
router.post("/xml-receive", xmlReceiveController.receiveXml);
router.get("/xml-receive", xmlReceiveController.listXmlReceives);

module.exports = router;
