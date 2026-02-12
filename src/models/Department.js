const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['KHOA', 'PHONG'],
    required: true,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department', 
    default: null, 
  },
  idHis: { 
    type: String,
    unique: true,
    sparse: true, 
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

DepartmentSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Department', DepartmentSchema);