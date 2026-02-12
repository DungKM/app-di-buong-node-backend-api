const Department = require('../models/Department');
const User = require('../models/User'); 

exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find({});
    res.json({ success: true, data: departments });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách khoa/phòng." });
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