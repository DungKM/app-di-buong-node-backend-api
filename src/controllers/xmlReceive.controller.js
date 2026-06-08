const xml2js = require("xml2js");
const XmlReceive = require("../models/XmlReceive");

const parser = new xml2js.Parser({ explicitArray: false, trim: true });

exports.receiveXml = async (req, res) => {
  const { xml } = req.body;

  if (!xml || typeof xml !== "string") {
    return res.status(400).json({ success: false, message: "Trường 'xml' (base64) là bắt buộc" });
  }

  const callerIp =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket?.remoteAddress;
  const userAgent = req.headers["user-agent"];

  let rawXml, parsedData, status, parseError;

  try {
    rawXml = Buffer.from(xml, "base64").toString("utf8");
  } catch (err) {
    const doc = await XmlReceive.create({
      xmlBase64: xml,
      callerIp,
      userAgent,
      status: "error",
      parseError: "Base64 không hợp lệ: " + err.message,
    });
    return res.status(400).json({ success: false, message: "Base64 không hợp lệ", id: doc._id });
  }

  try {
    parsedData = await parser.parseStringPromise(rawXml);
    status = "parsed";
  } catch (err) {
    parseError = "XML không hợp lệ: " + err.message;
    status = "error";
  }

  const doc = await XmlReceive.create({
    xmlBase64: xml,
    rawXml,
    parsedData,
    callerIp,
    userAgent,
    status,
    parseError,
  });

  if (status === "error") {
    return res.status(422).json({
      success: false,
      message: parseError,
      id: doc._id,
    });
  }

  return res.status(201).json({
    success: true,
    message: "Nhận XML thành công",
    id: doc._id,
    data: parsedData,
  });
};

exports.listXmlReceives = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    XmlReceive.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    XmlReceive.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    total,
    page,
    limit,
    items,
  });
};
