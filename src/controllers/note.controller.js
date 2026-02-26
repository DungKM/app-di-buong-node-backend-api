const Note = require("../models/Note");

exports.list = async (req, res) => {
  const { idPhieuKham } = req.params;

  const notes = await Note.find({ idPhieuKham })
    .populate("createdBy", "username role")
    .sort({ createdAt: -1 });

  res.json(notes);
};

exports.create = async (req, res) => {
  const { idPhieuKham } = req.params;
  const { content } = req.body;

  const newNote = await Note.create({
    idPhieuKham,
    content,
    createdBy: req.user.sub,
  });

  const populated = await newNote.populate("createdBy", "username role");

  res.json(populated);
};