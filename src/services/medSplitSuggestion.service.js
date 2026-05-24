function emptySplit() {
  return {
    MORNING: 0,
    NOON: 0,
    AFTERNOON: 0,
    NIGHT: 0,
  };
}

function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparableText(text = "") {
  return normalizeText(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function mapTimeToShift(time) {
  if (!time) return "NIGHT";

  const [hh, mm] = time.split(":").map(Number);
  const minutes = hh * 60 + (mm || 0);

  if (minutes >= 6 * 60 && minutes <= 10 * 60 + 59) return "MORNING";
  if (minutes >= 11 * 60 && minutes <= 13 * 60 + 59) return "NOON";
  if (minutes >= 14 * 60 && minutes <= 17 * 60 + 59) return "AFTERNOON";
  return "NIGHT";
}

function safePositiveNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseDosePerTime(text) {
  const raw = normalizeComparableText(text);

  const patterns = [
    /uong\s*(\d+(?:[.,]\d+)?)\s*(vien|ong|goi|chai|ml|giot|ong tiem)/i,
    /(\d+(?:[.,]\d+)?)\s*(vien|ong|goi|chai|ml|giot|ong tiem)\s*\/\s*lan/i,
    /(\d+(?:[.,]\d+)?)\s*(vien|ong|goi|chai|ml|giot|ong tiem)\s*lan/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      return {
        value: Number(String(match[1]).replace(",", ".")),
        explicit: true,
      };
    }
  }

  return { value: 1, explicit: false };
}

function extractExplicitTimes(text) {
  const raw = normalizeComparableText(text);
  const matches = [...raw.matchAll(/\b(\d{1,2})(?::(\d{1,2}))?\s*h\b/g)];
  const times = [];

  for (const match of matches) {
    const hour = Number(match[1]);
    const minute = Number(match[2] || 0);

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      times.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }

  return [...new Set(times)];
}

function extractPeriods(text) {
  const raw = normalizeComparableText(text);
  const periods = [];

  if (raw.includes("sang")) periods.push("MORNING");
  if (raw.includes("trua")) periods.push("NOON");
  if (raw.includes("chieu")) periods.push("AFTERNOON");
  if (raw.includes("toi") || raw.includes("dem")) periods.push("NIGHT");

  return [...new Set(periods)];
}

function extractTimesPerDay(text) {
  const raw = normalizeComparableText(text);

  const patterns = [
    /(\d+)\s*lan\s*\/\s*24h/i,
    /(\d+)\s*lan\s*\/\s*ngay/i,
    /ngay\s*(\d+)\s*lan/i,
    /(\d+)\s*lan\/ngay/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isInteger(value) && value > 0) {
        return value;
      }
    }
  }

  return null;
}

function inferTimesFromTimesPerDay(timesPerDay) {
  if (timesPerDay === 1) return ["08:00"];
  if (timesPerDay === 2) return ["08:00", "20:00"];
  if (timesPerDay === 3) return ["08:00", "14:00", "20:00"];
  if (timesPerDay === 4) return ["06:00", "12:00", "18:00", "22:00"];
  return [];
}

function totalSplitQty(splits) {
  return (
    Number(splits.MORNING || 0) +
    Number(splits.NOON || 0) +
    Number(splits.AFTERNOON || 0) +
    Number(splits.NIGHT || 0)
  );
}

function isNonSchedulableInstruction(text) {
  const raw = normalizeComparableText(text);

  const keywords = [
    "pha thuoc",
    "pha loang",
    "nuoc cat",
    "nuoc cat tiem",
    "bom tiem",
    "kim tiem",
    "day truyen",
    "vat tu",
    "dung moi",
  ];

  return keywords.some((keyword) => raw.includes(keyword));
}

function roundSplitValue(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function scaleSplitsToMaxQty(splits, maxQty) {
  const total = totalSplitQty(splits);
  if (total <= 0 || maxQty <= 0) {
    return emptySplit();
  }

  const factor = maxQty / total;
  const scaled = {
    MORNING: roundSplitValue((splits.MORNING || 0) * factor),
    NOON: roundSplitValue((splits.NOON || 0) * factor),
    AFTERNOON: roundSplitValue((splits.AFTERNOON || 0) * factor),
    NIGHT: roundSplitValue((splits.NIGHT || 0) * factor),
  };

  const diff = roundSplitValue(maxQty - totalSplitQty(scaled));
  if (diff !== 0) {
    const lastNonZeroShift = ["NIGHT", "AFTERNOON", "NOON", "MORNING"].find(
      (shift) => scaled[shift] > 0
    );

    if (lastNonZeroShift) {
      scaled[lastNonZeroShift] = roundSplitValue(scaled[lastNonZeroShift] + diff);
    }
  }

  return scaled;
}

function parseByRule(text) {
  const raw = normalizeText(text);
  const { value: detectedDose, explicit: doseExplicit } = parseDosePerTime(raw);
  const dosePerTime = safePositiveNumber(detectedDose, 1);
  const explicitTimes = extractExplicitTimes(raw);
  const periods = extractPeriods(raw);
  const timesPerDay = extractTimesPerDay(raw);

  const base = {
    splits: emptySplit(),
    source: "RULE",
    confidence: 0.3,
    needsReview: true,
    reason: "Không đủ dữ liệu để tự động chia",
    parsedInstruction: {
      raw,
      dosePerTime,
      doseExplicit,
      explicitTimes,
      periods,
      timesPerDay,
      parser: "rule-v2",
    },
  };

  if (!raw) {
    return {
      ...base,
      confidence: 0.2,
      needsReview: true,
      reason: "Không có hướng dẫn liều dùng, cần chia thủ công",
    };
  }

  if (isNonSchedulableInstruction(raw)) {
    return {
      ...base,
      confidence: 0.2,
      needsReview: true,
      reason: "Hướng dẫn pha thuốc hoặc vật tư, cần chia thủ công",
      parsedInstruction: {
        ...base.parsedInstruction,
        blockedAutoSplit: true,
        blockReason: "NON_SCHEDULABLE",
      },
    };
  }

  if (explicitTimes.length > 0) {
    for (const time of explicitTimes) {
      const shift = mapTimeToShift(time);
      base.splits[shift] += dosePerTime;
    }

    return {
      ...base,
      confidence: doseExplicit ? 0.95 : 0.7,
      needsReview: !doseExplicit,
      reason: doseExplicit
        ? `Tìm thấy giờ dùng cụ thể: ${explicitTimes.join(", ")}`
        : `Tìm thấy giờ dùng cụ thể nhưng thiếu liều mỗi lần: ${explicitTimes.join(", ")}`,
    };
  }

  if (periods.length > 0) {
    for (const period of periods) {
      base.splits[period] += dosePerTime;
    }

    return {
      ...base,
      confidence: doseExplicit ? 0.88 : 0.62,
      needsReview: !doseExplicit,
      reason: doseExplicit
        ? `Tách theo buổi: ${periods.join(", ")}`
        : `Tách theo buổi nhưng thiếu liều mỗi lần: ${periods.join(", ")}`,
    };
  }

  if (timesPerDay && timesPerDay > 0) {
    const inferredTimes = inferTimesFromTimesPerDay(timesPerDay);

    if (inferredTimes.length === 0) {
      return {
        ...base,
        confidence: 0.25,
        needsReview: true,
        reason: `Có số lần/ngày (${timesPerDay}) nhưng không có rule chia ca phù hợp`,
      };
    }

    for (const time of inferredTimes) {
      const shift = mapTimeToShift(time);
      base.splits[shift] += dosePerTime;
    }

    return {
      ...base,
      confidence: doseExplicit ? 0.55 : 0.4,
      needsReview: true,
      reason: doseExplicit
        ? `Suy luận từ số lần/ngày: ${timesPerDay}`
        : `Suy luận từ số lần/ngày nhưng thiếu liều mỗi lần: ${timesPerDay}`,
      parsedInstruction: {
        ...base.parsedInstruction,
        inferredTimes,
      },
    };
  }

  return {
    ...base,
    confidence: 0.25,
    needsReview: true,
    reason: "Không rõ thời điểm dùng, cần chia thủ công",
  };
}

function suggestSplitFromInstruction({ lieuDung, maxQty }) {
  const result = parseByRule(lieuDung);
  const maxQtyNumber = Number(String(maxQty ?? "").replace(",", "."));
  const total = totalSplitQty(result.splits);

  if (!Number.isFinite(maxQtyNumber) || maxQtyNumber <= 0 || total <= maxQtyNumber) {
    return result;
  }

  if (!result.parsedInstruction?.doseExplicit && total > 0) {
    return {
      ...result,
      splits: scaleSplitsToMaxQty(result.splits, maxQtyNumber),
      confidence: Math.min(result.confidence, 0.45),
      needsReview: true,
      reason: `Tổng liều suy luận (${total}) vượt số lượng tối đa (${maxQtyNumber}), tạm phân bổ theo số lượng tối đa`,
      parsedInstruction: {
        ...result.parsedInstruction,
        originalSplits: result.splits,
        scaledToMaxQty: maxQtyNumber,
      },
    };
  }

  return {
    ...result,
    splits: emptySplit(),
    confidence: 0.2,
    needsReview: true,
    reason: `Tổng số lượng chia (${total}) vượt số lượng tối đa (${maxQtyNumber})`,
  };
}

module.exports = {
  emptySplit,
  mapTimeToShift,
  parseByRule,
  suggestSplitFromInstruction,
  totalSplitQty,
};
