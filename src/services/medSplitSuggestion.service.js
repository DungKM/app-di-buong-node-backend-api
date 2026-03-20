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

function toHourMinute(hour) {
    const h = String(hour).padStart(2, "0");
    return `${h}:00`;
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

function detectDosePerTime(text) {
    const raw = normalizeText(text);

    const patterns = [
        /uống\s*(\d+(?:[.,]\d+)?)\s*(viên|ống|gói|chai|ml|giọt|ống tiêm)/i,
        /(\d+(?:[.,]\d+)?)\s*(viên|ống|gói|chai|ml|giọt|ống tiêm)\s*\/\s*lần/i,
        /(\d+(?:[.,]\d+)?)\s*(viên|ống|gói|chai|ml|giọt|ống tiêm)\s*lần/i,
    ];

    for (const p of patterns) {
        const match = raw.match(p);
        if (match) {
            return Number(String(match[1]).replace(",", "."));
        }
    }

    return 1;
}

function extractExplicitTimes(text) {
    const raw = normalizeText(text);
    const matches = [...raw.matchAll(/\b(\d{1,2})(?::(\d{1,2}))?\s*h\b/g)];
    const times = [];

    for (const m of matches) {
        const hour = Number(m[1]);
        const minute = Number(m[2] || 0);
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
            times.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
        }
    }

    return [...new Set(times)];
}

function extractPeriods(text) {
    const raw = normalizeText(text);
    const periods = [];

    if (raw.includes("sáng")) periods.push("MORNING");
    if (raw.includes("trưa")) periods.push("NOON");
    if (raw.includes("chiều")) periods.push("AFTERNOON");
    if (raw.includes("tối") || raw.includes("đêm")) periods.push("NIGHT");

    return [...new Set(periods)];
}

function extractTimesPerDay(text) {
    const raw = normalizeText(text);

    const patterns = [
        /(\d+)\s*lần\s*\/\s*24h/i,
        /(\d+)\s*lần\s*\/\s*ngày/i,
        /ngày\s*(\d+)\s*lần/i,
        /(\d+)\s*lần\/ngày/i,
    ];

    for (const p of patterns) {
        const match = raw.match(p);
        if (match) return Number(match[1]);
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

function parseByRule(text) {
    const raw = normalizeText(text);
    const dosePerTime = safePositiveNumber(detectDosePerTime(raw), 1);
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
            explicitTimes,
            periods,
            timesPerDay,
            parser: "rule-v1",
        },
    };

    if (!raw) {
        base.splits.MORNING = dosePerTime;
        return {
            ...base,
            confidence: 0.2,
            needsReview: true,
            reason: "Không có hướng dẫn liều dùng, tạm gán ca sáng",
        };
    }

    if (explicitTimes.length > 0) {
        for (const time of explicitTimes) {
            const shift = mapTimeToShift(time);
            base.splits[shift] += dosePerTime;
        }

        return {
            ...base,
            confidence: 0.95,
            needsReview: false,
            reason: `Tìm thấy giờ dùng cụ thể: ${explicitTimes.join(", ")}`,
        };
    }

    if (periods.length > 0) {
        for (const period of periods) {
            base.splits[period] += dosePerTime;
        }

        return {
            ...base,
            confidence: 0.88,
            needsReview: false,
            reason: `Tách theo buổi: ${periods.join(", ")}`,
        };
    }

    if (timesPerDay && timesPerDay > 0) {
        const inferredTimes = inferTimesFromTimesPerDay(timesPerDay);
        for (const time of inferredTimes) {
            const shift = mapTimeToShift(time);
            base.splits[shift] += dosePerTime;
        }

        return {
            ...base,
            confidence: 0.55,
            needsReview: true,
            reason: `Suy luận từ số lần/ngày: ${timesPerDay}`,
            parsedInstruction: {
                ...base.parsedInstruction,
                inferredTimes,
            },
        };
    }

    // fallback: không rõ thì vẫn nhét tạm vào MORNING
    base.splits.MORNING = dosePerTime;
    return {
        ...base,
        confidence: 0.25,
        needsReview: true,
        reason: "Không rõ thời điểm dùng, tạm gán ca sáng",
    };
}

function suggestSplitFromInstruction({ lieuDung, maxQty }) {
    const result = parseByRule(lieuDung);

    const total = totalSplitQty(result.splits);
    if (maxQty && total > Number(maxQty)) {
        return {
            ...result,
            splits: emptySplit(),
            confidence: 0.2,
            needsReview: true,
            reason: `Tổng số lượng chia (${total}) vượt số lượng tối đa (${maxQty})`,
        };
    }

    return result;
}

module.exports = {
    emptySplit,
    mapTimeToShift,
    parseByRule,
    suggestSplitFromInstruction,
    totalSplitQty,
};