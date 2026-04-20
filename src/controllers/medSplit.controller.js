const MedShiftSplit = require("../models/MedShiftSplit");
const MedicationOrder = require("../models/MedicationOrder");
const Notification = require("../models/Notification");
const Department = require("../models/Department");
const User = require("../models/User");
const {
  suggestSplitFromInstruction,
} = require("../services/medSplitSuggestion.service");
const {
  getBaseUrl,
  getCacheTtlMs,
  getBuongPhong,
  getDonThuocByPhieuKham,
  getDsLanKham,
  mapWithConcurrency,
} = require("../services/quocOaiDibuong.service");

const VALID_SHIFTS = ["MORNING", "NOON", "AFTERNOON", "NIGHT"];
const SPLIT_FIELDS = ["MORNING", "NOON", "AFTERNOON", "NIGHT"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const validateShift = (shift) => {
  if (!shift) {
    return "Thiếu ca dùng thuốc";
  }

  if (!VALID_SHIFTS.includes(shift)) {
    return "Ca dùng thuốc không hợp lệ";
  }

  return null;
};

const normalizeSplitValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const normalized =
    typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);

  if (!Number.isFinite(normalized) || normalized < 0) {
    return null;
  }

  return normalized;
};

const normalizeSplits = (splits = {}) => {
  const normalizedSplits = {};

  for (const field of SPLIT_FIELDS) {
    const normalizedValue = normalizeSplitValue(splits[field]);
    if (normalizedValue === null) {
      return null;
    }

    normalizedSplits[field] = normalizedValue;
  }

  return normalizedSplits;
};

const pickFirstDefined = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== "") {
      return source[key];
    }
  }

  return null;
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const getMedicationOrderField = (medOrder, keys) =>
  normalizeString(pickFirstDefined(medOrder, keys));

const resolveDepartmentId = async (rawIdKhoa) => {
  if (!rawIdKhoa) return null;

  const normalizedId = rawIdKhoa.toString().trim();
  if (!normalizedId) return null;

  const mongoose = require("mongoose");
  if (mongoose.Types.ObjectId.isValid(normalizedId)) {
    return normalizedId;
  }

  const department = await Department.findOne({ idHis: normalizedId })
    .select("_id")
    .lean();

  return department?._id?.toString() ?? null;
};

const resolveDepartmentContext = async (rawIdKhoa, fallbackIdHis) => {
  const normalizedId = normalizeString(rawIdKhoa);
  const normalizedFallbackHis = normalizeString(fallbackIdHis);

  if (!normalizedId) {
    if (!normalizedFallbackHis) {
      return null;
    }

    const fallbackDepartment = await Department.findOne({ idHis: normalizedFallbackHis })
      .select("_id idHis")
      .lean();

    return {
      departmentId: fallbackDepartment?._id?.toString() ?? null,
      idHis: normalizedFallbackHis,
    };
  }

  const mongoose = require("mongoose");

  if (mongoose.Types.ObjectId.isValid(normalizedId)) {
    const department = await Department.findById(normalizedId).select("_id idHis").lean();
    if (!department) {
      return null;
    }

    return {
      departmentId: department._id.toString(),
      idHis: normalizeString(department.idHis),
    };
  }

  const department = await Department.findOne({ idHis: normalizedId }).select("_id idHis").lean();

  return {
    departmentId: department?._id?.toString() ?? null,
    idHis: normalizeString(department?.idHis) ?? normalizedId,
  };
};

const getCurrentDateInBangkok = () => {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 7 * 60 * 60000).toISOString().slice(0, 10);
};

const collectBenhAnIds = (wardData) => {
  const ids = new Set();

  wardData?.DSPhong?.forEach((phong) => {
    phong?.DsGiuong?.forEach((giuong) => {
      giuong?.DsBenhAn?.forEach((benhAn) => {
        const idBenhAn = normalizeString(benhAn?.IdBenhAn);
        if (idBenhAn) {
          ids.add(idBenhAn);
        }
      });
    });
  });

  return Array.from(ids).sort();
};

const collectLatestPhieuKhamIds = (wardData) => {
  const ids = new Set();

  wardData?.DSPhong?.forEach((phong) => {
    phong?.DsGiuong?.forEach((giuong) => {
      giuong?.DsBenhAn?.forEach((benhAn) => {
        const idPhieuKham = normalizeString(benhAn?.IdPhieuKhamMoiNhat);
        if (idPhieuKham) {
          ids.add(idPhieuKham);
        }
      });
    });
  });

  return Array.from(ids).sort();
};

const buildMedSplitsMapByVisit = (rows = []) => {
  const map = {};

  rows.forEach((row) => {
    if (!row?.idPhieuKham || !row?.idPhieuThuoc) {
      return;
    }

    if (!map[row.idPhieuKham]) {
      map[row.idPhieuKham] = {};
    }

    map[row.idPhieuKham][row.idPhieuThuoc] = {
      splits: row.splits,
      status: row.status,
      returnHistory: row.returnHistory,
      splitSource: row.splitSource,
      confidence: row.confidence,
      needsReview: row.needsReview,
      reason: row.reason,
      rawInstruction: row.rawInstruction,
      parsedInstruction: row.parsedInstruction,
      confirmedShifts: row.confirmedShifts ?? [],
    };
  });

  return map;
};

const buildShiftStats = (meds = [], splits = {}) => {
  const stats = {
    MORNING: { used: 0, pending: 0, returned: 0, total: 0 },
    NOON: { used: 0, pending: 0, returned: 0, total: 0 },
    AFTERNOON: { used: 0, pending: 0, returned: 0, total: 0 },
    NIGHT: { used: 0, pending: 0, returned: 0, total: 0 },
  };

  VALID_SHIFTS.forEach((shift) => {
    stats[shift] = stats[shift] || { used: 0, pending: 0, returned: 0, total: 0 };
  });

  meds.forEach((med) => {
    const idPhieuThuoc = normalizeString(med?.IdPhieuThuoc);
    if (!idPhieuThuoc) {
      return;
    }

    const splitInfo = splits[idPhieuThuoc];

    VALID_SHIFTS.forEach((shift) => {
      const quantityInShift = Number(splitInfo?.splits?.[shift] ?? 0);
      if (quantityInShift <= 0) {
        return;
      }

      stats[shift].total += quantityInShift;

      if (splitInfo?.confirmedShifts?.includes?.(shift)) {
        stats[shift].used += quantityInShift;
        return;
      }

      const returned = Array.isArray(splitInfo?.returnHistory)
        ? splitInfo.returnHistory.reduce((sum, entry) => {
            return entry?.shift === shift ? sum + Number(entry.quantity || 0) : sum;
          }, 0)
        : 0;

      stats[shift].returned += returned;
      stats[shift].pending += Math.max(0, quantityInShift - returned);
    });
  });

  return stats;
};

const buildTotalByShift = (wardLayout = []) => {
  const result = {};

  wardLayout.forEach((room) => {
    room?.beds?.forEach((bed) => {
      bed?.visits?.forEach((visit) => {
        const shifts = visit?.marSummary?.shifts || {};
        VALID_SHIFTS.forEach((shift) => {
          const total = Number(shifts?.[shift]?.total ?? 0);
          result[shift] = (result[shift] || 0) + total;
        });
      });
    });
  });

  return result;
};

const buildHistoryEntry = ({ req, shift, splitRow, medOrder, payload = {} }) => {
  const quantityFromPayload = pickFirstDefined(payload, [
    "soLuongDung",
    "SoLuongDung",
    "quantity",
    "Quantity",
    "soLuong",
    "SoLuong",
  ]);
  const fallbackQuantity = splitRow?.splits?.[shift];
  const normalizedQuantity =
    quantityFromPayload !== undefined &&
    quantityFromPayload !== null &&
    quantityFromPayload !== ""
      ? Number(quantityFromPayload)
      : Number(fallbackQuantity ?? 0);

  return {
    idKhoa: req.user?.idKhoa?.toString?.() || req.user?.idKhoa || null,
    idBenhNhan: normalizeString(pickFirstDefined(payload, ["idBenhNhan", "IdBenhNhan"])),
    tenBenhNhan: normalizeString(
      pickFirstDefined(payload, ["tenBenhNhan", "hoTenBenhNhan", "HoTenBenhNhan", "TenBenhNhan"])
    ),
    maBenhNhan: normalizeString(
      pickFirstDefined(payload, ["maBenhNhan", "MaBenhNhan", "patientCode", "PatientCode"])
    ),
    tuoi: normalizeString(pickFirstDefined(payload, ["tuoi", "Tuoi", "age", "Age"])),
    tenThuoc: normalizeString(
      pickFirstDefined(payload, ["tenThuoc", "TenThuoc", "medicineName", "MedicineName"]) ??
        getMedicationOrderField(medOrder, ["tenThuoc", "Ten", "TenThuoc"])
    ),
    hamLuong: normalizeString(
      pickFirstDefined(payload, ["hamLuong", "HamLuong"]) ??
        getMedicationOrderField(medOrder, ["hamLuong", "HamLuong"])
    ),
    loaiThuoc: normalizeString(
      pickFirstDefined(payload, ["loaiThuoc", "LoaiThuoc"]) ??
        getMedicationOrderField(medOrder, ["loaiThuoc", "LoaiThuoc"])
    ),
    donVi: normalizeString(
      pickFirstDefined(payload, ["donVi", "DonVi"]) ??
        getMedicationOrderField(medOrder, ["donVi", "DonVi"])
    ),
    soLuongDung: Number.isFinite(normalizedQuantity) ? normalizedQuantity : 0,
    shift,
    confirmedAt: new Date(),
    confirmedBy: req.user?.id || req.user?.sub || null,
  };
};

exports.list = async (req, res) => {
  try {
    const { idPhieuKham } = req.params;
    const rows = await MedShiftSplit.find({ idPhieuKham });

    const map = {};
    rows.forEach((r) => {
      map[r.idPhieuThuoc] = {
        splits: r.splits,
        status: r.status,
        returnHistory: r.returnHistory,
        splitSource: r.splitSource,
        confidence: r.confidence,
        needsReview: r.needsReview,
        reason: r.reason,
        rawInstruction: r.rawInstruction,
        parsedInstruction: r.parsedInstruction,
        confirmedShifts: r.confirmedShifts ?? [],
      };
    });

    return res.json({ idPhieuKham, splits: map });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getMedicationList = async (req, res) => {
  try {
    const todayKey = getCurrentDateInBangkok();
    const requestedDate = normalizeString(req.query.date) || todayKey;
    if (!DATE_PATTERN.test(requestedDate)) {
      return res.status(400).json({ message: "date must use YYYY-MM-DD format" });
    }

    const rawIdKhoa =
      req.query.idKhoa?.toString?.().trim() ||
      req.user?.idHis?.toString?.().trim() ||
      req.user?.idKhoa?.toString?.().trim() ||
      "";

    const departmentContext = await resolveDepartmentContext(rawIdKhoa, req.user?.idHis);
    if (!departmentContext?.idHis) {
      return res.status(400).json({ message: "Missing or invalid idKhoa" });
    }

    const wardData = await getBuongPhong(departmentContext.idHis);
    const benhAnIds = collectBenhAnIds(wardData);
    const latestPhieuKhamIds = collectLatestPhieuKhamIds(wardData);
    const shouldResolveEncountersByDate = requestedDate !== todayKey;

    let lanKhamByBenhAn = {};
    let lanKhamErrors = [];

    if (shouldResolveEncountersByDate && benhAnIds.length > 0) {
      const lanKhamResult = await mapWithConcurrency(benhAnIds, async (idBenhAn) => {
        const list = await getDsLanKham(idBenhAn);
        const matched = list.find((item) => item?.NgayThucKham?.startsWith?.(requestedDate));
        return [idBenhAn, normalizeString(matched?.Id)];
      });

      lanKhamByBenhAn = Object.fromEntries(
        lanKhamResult.results.filter((entry) => Array.isArray(entry) && entry[0])
      );
      lanKhamErrors = lanKhamResult.errors;
    }

    const phieuKhamIds = shouldResolveEncountersByDate
      ? Array.from(
          new Set(
            Object.values(lanKhamByBenhAn)
              .map((value) => normalizeString(value))
              .filter(Boolean)
          )
        ).sort()
      : latestPhieuKhamIds;

    let medsByVisit = {};
    let medicationErrors = [];

    if (phieuKhamIds.length > 0) {
      const medicationResult = await mapWithConcurrency(phieuKhamIds, async (idPhieuKham) => {
        const meds = await getDonThuocByPhieuKham(idPhieuKham);
        return [idPhieuKham, Array.isArray(meds) ? meds : []];
      });

      medsByVisit = Object.fromEntries(
        medicationResult.results.filter((entry) => Array.isArray(entry) && entry[0])
      );
      medicationErrors = medicationResult.errors;
    }

    const splitRows = phieuKhamIds.length
      ? await MedShiftSplit.find({
          idPhieuKham: { $in: phieuKhamIds },
        })
          .select(
            "idPhieuKham idPhieuThuoc splits status returnHistory splitSource confidence needsReview reason rawInstruction parsedInstruction confirmedShifts"
          )
          .lean()
      : [];

    const medSplitsByVisit = buildMedSplitsMapByVisit(splitRows);
    const shiftsByVisit = {};

    phieuKhamIds.forEach((idPhieuKham) => {
      shiftsByVisit[idPhieuKham] = buildShiftStats(
        medsByVisit[idPhieuKham] || [],
        medSplitsByVisit[idPhieuKham] || {}
      );
    });

    const wardLayout = Array.isArray(wardData?.DSPhong)
      ? wardData.DSPhong.map((phong) => ({
          room: normalizeString(phong?.Ma) || "--",
          beds: Array.isArray(phong?.DsGiuong)
            ? phong.DsGiuong.map((giuong) => {
                const bedCode = normalizeString(giuong?.MaGiuong) || "--";
                const visits = Array.isArray(giuong?.DsBenhAn)
                  ? giuong.DsBenhAn.map((benhAn) => {
                      const idBenhAn = normalizeString(benhAn?.IdBenhAn) || "";
                      const latestIdPhieuKham = normalizeString(benhAn?.IdPhieuKhamMoiNhat) || "";
                      const resolvedIdPhieuKham = shouldResolveEncountersByDate
                        ? normalizeString(lanKhamByBenhAn[idBenhAn]) || latestIdPhieuKham
                        : latestIdPhieuKham;
                      const meds = medsByVisit[resolvedIdPhieuKham] || [];
                      const shifts =
                        shiftsByVisit[resolvedIdPhieuKham] ||
                        buildShiftStats(meds, medSplitsByVisit[resolvedIdPhieuKham] || {});

                      return {
                        id: idBenhAn,
                        patientName: normalizeString(benhAn?.HoTenBenhNhan) || "",
                        patientCode: normalizeString(benhAn?.MaBenhNhan) || "",
                        patientGender: normalizeString(benhAn?.GioiTinh),
                        patientAge: normalizeString(benhAn?.Tuoi),
                        room: normalizeString(phong?.Ma) || "--",
                        bed: bedCode,
                        idPhieuKham: resolvedIdPhieuKham,
                        marSummary: { shifts },
                      };
                    })
                  : [];

                return {
                  code: bedCode,
                  visits,
                  isOccupied: visits.length > 0,
                };
              })
            : [],
        }))
      : [];

    const totalByShift = buildTotalByShift(wardLayout);
    const upstreamErrors = [...lanKhamErrors, ...medicationErrors];

    return res.json({
      date: requestedDate,
      idKhoa: departmentContext.idHis,
      departmentId: departmentContext.departmentId,
      shouldResolveEncountersByDate,
      source: {
        upstreamBaseUrl: getBaseUrl(),
        cacheTtlMs: getCacheTtlMs(),
      },
      wardData,
      wardLayout,
      benhAnIds,
      latestPhieuKhamIds,
      phieuKhamIds,
      lanKhamByBenhAn,
      medsByVisit,
      medSplitsByVisit,
      shiftsByVisit,
      totalByShift,
      meta: {
        partial: upstreamErrors.length > 0,
        upstreamErrors,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getMedicationConfirmationHistory = async (req, res) => {
  try {
    const date = String(req.query.date || "").trim();
    const rawIdKhoa =
      req.query.idKhoa?.toString?.().trim() ||
      req.user?.idKhoa?.toString?.() ||
      req.user?.idKhoa ||
      "";

    if (!date) {
      return res.status(400).json({ message: "Thiếu tham số date" });
    }

    if (!DATE_PATTERN.test(date)) {
      return res.status(400).json({ message: "date không đúng định dạng YYYY-MM-DD" });
    }

    const idKhoa = await resolveDepartmentId(rawIdKhoa);
    if (rawIdKhoa && !idKhoa) {
      return res.status(404).json({ message: "Không tìm thấy khoa theo idKhoa" });
    }

    const start = new Date(`${date}T00:00:00.000+07:00`);
    const end = new Date(`${date}T23:59:59.999+07:00`);

    const historyFilter = {
      confirmedAt: { $gte: start, $lte: end },
    };

    if (idKhoa) {
      historyFilter.idKhoa = idKhoa;
    }

    const rows = await MedShiftSplit.find({
      confirmationHistory: { $elemMatch: historyFilter },
    })
      .select("idPhieuKham idPhieuThuoc confirmationHistory")
      .lean();

    const medOrders = rows.length
      ? await MedicationOrder.find({
          idPhieuKham: { $in: [...new Set(rows.map((row) => row.idPhieuKham))] },
          idPhieuThuoc: { $in: [...new Set(rows.map((row) => row.idPhieuThuoc))] },
        })
          .select("idPhieuKham idPhieuThuoc tenThuoc Ten TenThuoc hamLuong HamLuong loaiThuoc LoaiThuoc donVi DonVi")
          .lean()
      : [];

    const medOrderMap = new Map(
      medOrders.map((row) => [`${row.idPhieuKham}__${row.idPhieuThuoc}`, row])
    );

    const items = rows
      .flatMap((row) =>
        (row.confirmationHistory || [])
          .filter((entry) => {
            const confirmedAt = new Date(entry.confirmedAt);
            if (Number.isNaN(confirmedAt.getTime())) return false;
            if (confirmedAt < start || confirmedAt > end) return false;
            if (idKhoa && entry.idKhoa !== idKhoa) return false;
            return true;
          })
          .map((entry) => {
            const medOrder = medOrderMap.get(`${row.idPhieuKham}__${row.idPhieuThuoc}`);

            return {
              idPhieuKham: row.idPhieuKham,
              idPhieuThuoc: row.idPhieuThuoc,
              idBenhNhan: normalizeString(entry.idBenhNhan),
              tenBenhNhan: normalizeString(entry.tenBenhNhan) ?? "",
              maBenhNhan: normalizeString(entry.maBenhNhan),
              tuoi: normalizeString(entry.tuoi),
              tenThuoc:
                normalizeString(entry.tenThuoc) ??
                getMedicationOrderField(medOrder, ["tenThuoc", "Ten", "TenThuoc"]) ??
                "",
              hamLuong:
                normalizeString(entry.hamLuong) ??
                getMedicationOrderField(medOrder, ["hamLuong", "HamLuong"]),
              loaiThuoc:
                normalizeString(entry.loaiThuoc) ??
                getMedicationOrderField(medOrder, ["loaiThuoc", "LoaiThuoc"]),
              donVi:
                normalizeString(entry.donVi) ??
                getMedicationOrderField(medOrder, ["donVi", "DonVi"]),
              soLuongDung: entry.soLuongDung ?? 0,
              confirmedAt: entry.confirmedAt ?? null,
              shift: entry.shift ?? null,
            };
          })
      )
      .sort((a, b) => new Date(b.confirmedAt) - new Date(a.confirmedAt));

    return res.json({
      date,
      idKhoa: idKhoa ?? null,
      items,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.saveOne = async (req, res) => {
  try {
    const { idPhieuKham, idPhieuThuoc } = req.params;
    const { splits } = req.body;
    const userId = req.user?.id || req.user?.sub;
    const normalizedSplits = normalizeSplits(splits);

    if (!normalizedSplits) {
      return res.status(400).json({
        message: "Liều chia không hợp lệ, cho phép số nguyên hoặc số lẻ >= 0",
      });
    }

    const updated = await MedShiftSplit.findOneAndUpdate(
      { idPhieuKham, idPhieuThuoc },
      {
        $set: {
          splits: normalizedSplits,
          updatedBy: userId,
          status: "Chờ dùng thuốc",
          splitSource: "MANUAL",
          confidence: 1,
          needsReview: false,
          reason: null,
        },
      },
      { upsert: true, new: true }
    );

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.confirmUsage = async (req, res) => {
  try {
    const { idPhieuKham, idPhieuThuoc } = req.params;
    const { shift } = req.body;
    const userId = req.user?.id || req.user?.sub;

    const shiftError = validateShift(shift);
    if (shiftError) {
      return res.status(400).json({ message: shiftError });
    }

    const existing = await MedShiftSplit.findOne({ idPhieuKham, idPhieuThuoc });
    if (!existing) {
      return res.status(404).json({ message: "Không tìm thấy phiếu thuốc" });
    }

    const alreadyConfirmed = (existing.confirmedShifts ?? []).includes(shift);
    if (alreadyConfirmed) {
      return res.json(existing);
    }

    const medOrder = await MedicationOrder.findOne({ idPhieuKham, idPhieuThuoc })
      .select("tenThuoc Ten TenThuoc hamLuong HamLuong loaiThuoc LoaiThuoc donVi DonVi")
      .lean();

    const updated = await MedShiftSplit.findOneAndUpdate(
      { idPhieuKham, idPhieuThuoc },
      {
        $addToSet: { confirmedShifts: shift },
        $push: {
          confirmationHistory: buildHistoryEntry({
            req,
            shift,
            splitRow: existing,
            medOrder,
            payload: req.body,
          }),
        },
        $set: { updatedBy: userId },
      },
      { new: true }
    );

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.confirmAllUsage = async (req, res) => {
  try {
    const { idPhieuKham } = req.params;
    const { shift, items = [] } = req.body;
    const userId = req.user?.id || req.user?.sub;

    const shiftError = validateShift(shift);
    if (shiftError) {
      return res.status(400).json({ message: shiftError });
    }

    const rows = await MedShiftSplit.find({ idPhieuKham }).select(
      "_id idPhieuThuoc confirmedShifts splits"
    );

    if (!rows.length) {
      return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y phiáº¿u thuá»‘c" });
    }

    const pendingRows = rows.filter((row) => !(row.confirmedShifts ?? []).includes(shift));
    const pendingIds = pendingRows.map((row) => row._id);

    const itemMap = new Map(
      Array.isArray(items)
        ? items
            .filter((item) => item?.idPhieuThuoc)
            .map((item) => [String(item.idPhieuThuoc), item])
        : []
    );

    const medOrders = pendingRows.length
      ? await MedicationOrder.find({
          idPhieuKham,
          idPhieuThuoc: { $in: pendingRows.map((row) => row.idPhieuThuoc) },
        })
          .select("idPhieuThuoc tenThuoc Ten TenThuoc hamLuong HamLuong loaiThuoc LoaiThuoc donVi DonVi")
          .lean()
      : [];

    const medOrderMap = new Map(medOrders.map((row) => [String(row.idPhieuThuoc), row]));

    let modifiedCount = 0;
    if (pendingIds.length > 0) {
      const sharedPayload = { ...(req.body || {}) };

      const result = await MedShiftSplit.bulkWrite(
        pendingRows.map((row) => {
          const payload = {
            ...sharedPayload,
            ...(itemMap.get(String(row.idPhieuThuoc)) || {}),
          };

          return {
            updateOne: {
              filter: { _id: row._id },
              update: {
                $addToSet: { confirmedShifts: shift },
                $push: {
                  confirmationHistory: buildHistoryEntry({
                    req,
                    shift,
                    splitRow: row,
                    medOrder: medOrderMap.get(String(row.idPhieuThuoc)),
                    payload,
                  }),
                },
                $set: { updatedBy: userId },
              },
            },
          };
        })
      );

      modifiedCount = result.modifiedCount ?? result.nModified ?? pendingIds.length;
    }

    return res.json({
      ok: true,
      idPhieuKham,
      shift,
      total: rows.length,
      modifiedCount,
      alreadyConfirmedCount: rows.length - pendingIds.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.cancelConfirmedUsage = async (req, res) => {
  try {
    const { idPhieuKham, idPhieuThuoc } = req.params;
    const { shift } = req.body;
    const userId = req.user?.id || req.user?.sub;

    const shiftError = validateShift(shift);
    if (shiftError) {
      return res.status(400).json({ message: shiftError });
    }

    const existing = await MedShiftSplit.findOne({ idPhieuKham, idPhieuThuoc });
    if (!existing) {
      return res.status(404).json({ message: "Không tìm thấy phiếu thuốc" });
    }

    const updated = await MedShiftSplit.findOneAndUpdate(
      { idPhieuKham, idPhieuThuoc },
      {
        $pull: { confirmedShifts: shift },
        $set: { updatedBy: userId },
      },
      { new: true }
    );

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.returnMedication = async (req, res) => {
  try {
    const { idPhieuKham, idPhieuThuoc } = req.params;
    const {
      quantity,
      reason,
      tenBenhNhan,
      maBenhNhan,
      tenThuoc,
      idBenhAn,
      shift,
    } = req.body;

    const userId = req.user?.id || req.user?.sub;
    const idKhoaRoom = req.user?.idKhoa?.toString?.() || req.user?.idKhoa;

    const safeTen = tenBenhNhan || "Bệnh nhân";
    const safeMa = maBenhNhan || "N/A";
    const safeThuoc = tenThuoc || "Thuốc";
    const safeQty = quantity || 0;
    const safeReason = reason || "";

    const qs = new URLSearchParams({
      maBenhNhan: safeMa,
      tenBenhNhan: safeTen,
      idPhieuKham,
    }).toString();

    const redirectUrl = `/medication/${idBenhAn}?${qs}`;

    const updated = await MedShiftSplit.findOneAndUpdate(
      { idPhieuKham, idPhieuThuoc },
      {
        $push: {
          returnHistory: {
            quantity: safeQty,
            reason: safeReason,
            shift,
            returnedBy: userId,
            returnedAt: new Date(),
          },
        },
        $set: { updatedBy: userId },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy phiếu thuốc" });
    }

    const notiPayload = {
      type: "RETURN",
      idPhieuKham,
      idPhieuThuoc,
      tenBenhNhan: safeTen,
      maBenhNhan: safeMa,
      tenThuoc: safeThuoc,
      soLuongTra: safeQty,
      reason: safeReason,
      url: redirectUrl,
    };

    if (idKhoaRoom) {
      const noti = await Notification.create({
        idKhoa: idKhoaRoom,
        type: "RETURN",
        title: "Trả thuốc",
        body: `BN ${safeTen} trả ${safeQty} ${safeThuoc}`,
        payload: notiPayload,
        createdBy: userId || null,
      });

      if (global._io) {
        global._io.to(idKhoaRoom).emit("new_notification", {
          _id: noti._id,
          ...notiPayload,
          createdAt: noti.createdAt,
          read: false,
        });
      }
    }

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.saveBatch = async (req, res) => {
  try {
    const { idPhieuKham } = req.params;
    const { items } = req.body;
    const userId = req.user?.id;

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Danh sách thuốc không hợp lệ" });
    }

    const normalizedItems = [];
    for (const it of items) {
      const normalizedSplits = normalizeSplits(it.splits);
      if (!normalizedSplits) {
        return res.status(400).json({
          message: `Liều chia không hợp lệ cho thuốc ${it.idPhieuThuoc}`,
        });
      }

      normalizedItems.push({
        ...it,
        splits: normalizedSplits,
      });
    }

    const ops = normalizedItems.map((it) => ({
      updateOne: {
        filter: { idPhieuKham, idPhieuThuoc: it.idPhieuThuoc },
        update: {
          $set: {
            splits: it.splits,
            updatedBy: userId,
            status: "Chờ dùng thuốc",
            splitSource: it.splitSource || "MANUAL",
            confidence: it.confidence ?? 1,
            needsReview: it.needsReview ?? false,
            reason: it.reason ?? null,
            rawInstruction: it.rawInstruction ?? null,
            parsedInstruction: it.parsedInstruction ?? null,
          },
        },
        upsert: true,
      },
    }));

    if (ops.length) {
      await MedShiftSplit.bulkWrite(ops);
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.traThuoc = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select("idKhoa");
    const idKhoaRoom = user?.idKhoa?.toString();

    if (global._io && idKhoaRoom) {
      global._io.to(idKhoaRoom).emit("new_notification", {
        tenBenhNhan: req.body.tenBenhNhan,
        maBenhNhan: req.body.maBenhNhan,
        tenThuoc: req.body.tenThuoc,
        soLuongTra: req.body.soLuongTra,
        time: new Date(),
      });
    }

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.autoSplitAll = async (req, res) => {
  try {
    const { idPhieuKham } = req.params;
    const userId = req.user?.id;
    const { items = [] } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Không có dữ liệu đơn thuốc để tự động chia" });
    }

    const existingRows = await MedShiftSplit.find({ idPhieuKham }).lean();
    const existingMap = new Map(existingRows.map((row) => [row.idPhieuThuoc, row]));

    const ops = [];
    let autoSuccess = 0;
    let needsReview = 0;
    let failed = 0;
    let skippedManual = 0;

    for (const med of items) {
      const existing = existingMap.get(String(med.idPhieuThuoc));

      if (existing?.splitSource === "MANUAL") {
        skippedManual++;
        continue;
      }

      const suggestion = suggestSplitFromInstruction({
        lieuDung: med.lieuDung,
        maxQty: med.maxQty,
      });

      const total =
        suggestion.splits.MORNING +
        suggestion.splits.NOON +
        suggestion.splits.AFTERNOON +
        suggestion.splits.NIGHT;

      if (total <= 0) {
        failed++;
      } else if (suggestion.needsReview) {
        needsReview++;
      } else {
        autoSuccess++;
      }

      ops.push({
        updateOne: {
          filter: {
            idPhieuKham,
            idPhieuThuoc: String(med.idPhieuThuoc),
          },
          update: {
            $set: {
              splits: suggestion.splits,
              updatedBy: userId,
              status: "Chờ dùng thuốc",
              splitSource: suggestion.source,
              confidence: suggestion.confidence,
              needsReview: total <= 0 ? true : suggestion.needsReview,
              reason: suggestion.reason,
              rawInstruction: med.lieuDung || null,
              parsedInstruction: suggestion.parsedInstruction,
            },
          },
          upsert: true,
        },
      });
    }

    if (ops.length > 0) {
      await MedShiftSplit.bulkWrite(ops);
    }

    return res.json({
      ok: true,
      summary: {
        total: items.length,
        autoSuccess,
        needsReview,
        failed,
        skippedManual,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
