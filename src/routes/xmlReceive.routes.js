const router = require("express").Router();
const multer = require("multer");
const xmlReceiveController = require("../controllers/xmlReceive.controller");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "text/xml" ||
      file.mimetype === "application/xml" ||
      file.originalname.endsWith(".xml")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file XML"));
    }
  },
});

// Không yêu cầu xác thực - dùng cho hệ thống bên ngoài gọi vào
router.post("/xml-receive", xmlReceiveController.receiveXml);
router.post("/xml-receive/file", upload.single("file"), xmlReceiveController.receiveXmlFile);
router.get("/xml-receive", xmlReceiveController.listXmlReceives);

module.exports = router;
