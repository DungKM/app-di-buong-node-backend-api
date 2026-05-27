const Department = require('../models/Department');
const User = require('../models/User');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find({});
    res.json({ success: true, data: departments });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách khoa/phòng." });
  }
};

exports.getDepartmentHisById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "id khoa không hợp lệ."
      });
    }

    const department = await Department.findById(id).select("idHis name type");
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khoa/phòng."
      });
    }

    return res.json({
      success: true,
      data: {
        idKhoa: department._id,
        idHis: department.idHis ?? null,
        name: department.name,
        type: department.type,
      }
    });
  } catch (error) {
    console.error("Error fetching department idHis:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy idHis của khoa/phòng."
    });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, type, parentIdHis, idHis } = req.body;

    let finalParentId = null;

    if (type === "PHONG" && parentIdHis) {
      const parentDept = await Department.findOne({ idHis: parentIdHis });
      if (!parentDept) {
        return res.status(400).json({ 
          success: false, 
          message: `Không tìm thấy khoa cha có mã HIS: ${parentIdHis}` 
        });
      }
      finalParentId = parentDept._id; 
    }

    const newDept = new Department({
      name,
      type,
      idHis,
      parentId: finalParentId
    });

    await newDept.save(); //
    res.status(201).json({ success: true, data: newDept });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { name, type, parentId, idHis } = req.body;

  try {
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khoa/phòng." });
    }

    if (name && name !== department.name) {
      const existingDept = await Department.findOne({ name });
      if (existingDept && existingDept._id.toString() !== id) {
        return res.status(400).json({ success: false, message: "Tên khoa/phòng đã tồn tại." });
      }
    }
    if (idHis && idHis !== department.idHis) {
      const existingDept = await Department.findOne({ idHis });
      if (existingDept && existingDept._id.toString() !== id) {
        return res.status(400).json({ success: false, message: "ID HIS đã tồn tại." });
      }
    }

    if (type === 'PHONG') {
        if (parentId === null) { 
            department.parentId = null;
        } else if (parentId) {
            const parentKhoa = await Department.findById(parentId);
            if (!parentKhoa || parentKhoa.type !== 'KHOA') {
                return res.status(400).json({ success: false, message: "Khoa chủ quản không hợp lệ." });
            }
            department.parentId = parentId;
        }
    } else if (type === 'KHOA') {
        department.parentId = null; 
    }

    department.name = name || department.name;
    department.type = type || department.type;
    department.idHis = idHis !== undefined ? idHis : department.idHis; 

    await department.save();
    res.json({ success: true, message: "Cập nhật khoa/phòng thành công!", data: department });
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi cập nhật khoa/phòng." });
  }
};

exports.downloadImportTemplate = async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('KhoaPhong');

    // Header style
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    const centerAlign = { horizontal: 'center', vertical: 'middle' };
    const border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };

    ws.columns = [
      { header: 'name (*)',       key: 'name',        width: 30 },
      { header: 'type (*)',       key: 'type',        width: 12 },
      { header: 'idHis',         key: 'idHis',        width: 38 },
      { header: 'parentIdHis',   key: 'parentIdHis',  width: 38 },
    ];

    // Style header row
    ws.getRow(1).eachCell(cell => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = centerAlign;
      cell.border = border;
    });
    ws.getRow(1).height = 22;

    // Sample data rows
    const samples = [
      { name: 'Khoa Nội',      type: 'KHOA',  idHis: 'KH001', parentIdHis: '' },
      { name: 'Khoa Ngoại',    type: 'KHOA',  idHis: 'KH002', parentIdHis: '' },
      { name: 'Phòng 101',     type: 'PHONG', idHis: 'PH101', parentIdHis: 'KH001' },
      { name: 'Phòng 102',     type: 'PHONG', idHis: 'PH102', parentIdHis: 'KH001' },
      { name: 'Phòng không khoa', type: 'PHONG', idHis: 'PH200', parentIdHis: '' },
    ];

    const dataFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF4FF' } };
    const dataFont  = { size: 11 };

    samples.forEach((row, idx) => {
      const r = ws.addRow(row);
      r.eachCell({ includeEmpty: true }, cell => {
        cell.fill = dataFill;
        cell.font = dataFont;
        cell.border = border;
        cell.alignment = { vertical: 'middle' };
      });
      r.height = 20;
    });

    // Notes sheet
    const wsNote = wb.addWorksheet('Hướng dẫn');
    wsNote.getColumn(1).width = 70;
    const notes = [
      ['HƯỚNG DẪN IMPORT KHOA / PHÒNG'],
      [''],
      ['Cột bắt buộc:'],
      ['  name   - Tên khoa hoặc phòng (duy nhất trong hệ thống)'],
      ['  type   - Loại: KHOA hoặc PHONG (viết hoa)'],
      [''],
      ['Cột tùy chọn:'],
      ['  idHis       - Mã định danh từ hệ thống HIS (dùng để upsert)'],
      ['  parentIdHis - idHis của KHOA cha (chỉ dành cho PHONG, có thể bỏ trống)'],
      [''],
      ['Lưu ý:'],
      ['  - PHONG không bắt buộc phải thuộc KHOA nào (để trống parentIdHis)'],
      ['  - Nếu có idHis, hệ thống upsert theo idHis; nếu không thì upsert theo name'],
      ['  - KHOA được import trước, sau đó mới đến PHONG'],
    ];
    notes.forEach((row, i) => {
      const r = wsNote.addRow(row);
      if (i === 0) {
        r.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1F4E79' } };
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="mau_import_khoa_phong.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Download Template Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.importDepartments = async (req, res) => {
  try {
    const { departments } = req.body;

    if (!Array.isArray(departments) || departments.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách khoa/phòng không hợp lệ" });
    }

    const khoaRows = [];
    const phongRows = [];
    const errors = [];

    for (let i = 0; i < departments.length; i++) {
      const d = departments[i] || {};
      const name = String(d.name || "").trim();
      const type = String(d.type || "").trim().toUpperCase();

      if (!name) {
        errors.push({ row: i + 2, message: "Thiếu tên khoa/phòng" });
        continue;
      }
      if (!["KHOA", "PHONG"].includes(type)) {
        errors.push({ row: i + 2, name, message: `Loại không hợp lệ: ${d.type} (phải là KHOA hoặc PHONG)` });
        continue;
      }

      const idHis = d.idHis ? String(d.idHis).trim() : null;
      const parentIdHis = d.parentIdHis ? String(d.parentIdHis).trim() : null;

      if (type === "KHOA") {
        khoaRows.push({ rowIndex: i, name, idHis });
      } else {
        phongRows.push({ rowIndex: i, name, idHis, parentIdHis });
      }
    }

    // --- Bước 1: Upsert KHOA trước ---
    const khoaOps = khoaRows.map(({ name, idHis }) => ({
      updateOne: {
        filter: idHis ? { idHis } : { name },
        update: { $set: { name, type: "KHOA", parentId: null, ...(idHis ? { idHis } : {}) } },
        upsert: true,
      },
    }));

    let khoaInserted = 0, khoaUpdated = 0;
    if (khoaOps.length > 0) {
      const khoaResult = await Department.bulkWrite(khoaOps, { ordered: false });
      khoaInserted = khoaResult.upsertedCount || 0;
      khoaUpdated = khoaResult.modifiedCount || 0;
    }

    // --- Bước 2: Build map idHis -> _id cho KHOA ---
    const allParentIdHis = [...new Set(phongRows.map(p => p.parentIdHis).filter(Boolean))];
    const parentDepts = await Department.find({
      $or: [
        ...(allParentIdHis.length ? [{ idHis: { $in: allParentIdHis } }] : []),
        { type: "KHOA" },
      ],
    }).select("_id idHis name");

    const mapIdHisToId = new Map(parentDepts.filter(d => d.idHis).map(d => [String(d.idHis), d._id]));
    const mapNameToId = new Map(parentDepts.map(d => [d.name, d._id]));

    // --- Bước 3: Upsert PHONG ---
    const phongOps = [];
    for (const { rowIndex, name, idHis, parentIdHis } of phongRows) {
      let parentId = null;

      if (parentIdHis) {
        if (mapIdHisToId.has(parentIdHis)) {
          parentId = mapIdHisToId.get(parentIdHis);
        } else if (mapNameToId.has(parentIdHis)) {
          parentId = mapNameToId.get(parentIdHis);
        } else {
          errors.push({ row: rowIndex + 2, name, message: `Không tìm thấy khoa cha theo parentIdHis: ${parentIdHis}` });
          continue;
        }
      }

      phongOps.push({
        updateOne: {
          filter: idHis ? { idHis } : { name },
          update: { $set: { name, type: "PHONG", parentId: parentId ?? null, ...(idHis ? { idHis } : {}) } },
          upsert: true,
        },
      });
    }

    let phongInserted = 0, phongUpdated = 0;
    if (phongOps.length > 0) {
      const phongResult = await Department.bulkWrite(phongOps, { ordered: false });
      phongInserted = phongResult.upsertedCount || 0;
      phongUpdated = phongResult.modifiedCount || 0;
    }

    return res.json({
      success: true,
      message: "Import khoa/phòng thành công",
      data: {
        inserted: khoaInserted + phongInserted,
        updated: khoaUpdated + phongUpdated,
        khoaInserted,
        khoaUpdated,
        phongInserted,
        phongUpdated,
      },
      errors,
    });
  } catch (error) {
    console.error("Import Departments Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  const { id } = req.params;

  try {
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khoa/phòng." });
    }
    const usersInDept = await User.countDocuments({ idKhoaPhong: id });
    if (usersInDept > 0) {
      return res.status(400).json({ success: false, message: `Không thể xóa. Có ${usersInDept} người dùng thuộc khoa/phòng này.` });
    }

    if (department.type === 'KHOA') {
      const childDepartments = await Department.countDocuments({ parentId: id });
      if (childDepartments > 0) {
        return res.status(400).json({ success: false, message: `Không thể xóa. Có ${childDepartments} phòng trực thuộc khoa này.` });
      }
    }

    await department.deleteOne(); 
    res.status(204).json({ success: true, message: "Xóa khoa/phòng thành công!" }); // 204 No Content
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi xóa khoa/phòng." });
  }
};
