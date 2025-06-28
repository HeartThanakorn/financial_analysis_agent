const RISEORFALL_WORDS = [
  "rise or fall",
  "ขึ้นหรือลง",
  "escalate or deflate",
  "grow or shrink",
  "boost or lower",
  "surge or decline",
  "upwards or downwards",
  "ปรับตัวขึ้นหรือลง",
  "ปรับตัวสูงขึ้นหรือต่ำลง",
  'ขึ้น"" หรือ ""ลง',
  "rise หรือ fall",
  '"ขึ้น" หรือ "ลง"',
];
const MULTIPLECHOICE_WORDS = [
  "options:",
  "answer choices:",
  "ตัวเลือก",
  "choice",
  "appropriate among the three options",
];

function classifyQuestionType(query) {
  const queryLower = query.toLowerCase();
  if (RISEORFALL_WORDS.some((keyword) => queryLower.includes(keyword)))
    return "Type#2";
  if (MULTIPLECHOICE_WORDS.some((keyword) => queryLower.includes(keyword)))
    return "Type#1";
  return "Unknown";
}

function summarizeTrendForAiV6(block) {
  try {
    const lines = block
      .trim()
      .split("\n")
      .filter((line) => line.trim());
    if (lines.length < 2) return "error:insufficient_data";

    // Get header and data
    const header = lines[0].split(",").map((col) => col.trim());
    const dataRows = lines
      .slice(1)
      .map((line) => line.split(",").map((val) => val.trim()))
      .filter((row) => row.length === header.length);

    // Find closing price column
    const closeColIdx = header.findIndex(
      (c) => c.toLowerCase().startsWith("close") || c.includes("ปิด")
    );
    if (closeColIdx === -1) {
      return "close_col:N/A";
    }

    // Extract closing prices
    const closePrices = dataRows.map((row) => {
      const val = parseFloat(row[closeColIdx]);
      if (isNaN(val)) throw new Error("invalid_close_data");
      return val;
    });

    // Calculate percentage changes
    const changePct = [];
    for (let i = 1; i < closePrices.length; i++) {
      const prev = closePrices[i - 1];
      const curr = closePrices[i];
      const pct = prev !== 0 ? ((curr - prev) / prev) * 100 : 0.0;
      changePct.push(Math.round(pct * 100) / 100);
    }

    // Basic statistics
    const totalDays = closePrices.length;
    const avgChange =
      changePct.length > 0
        ? Math.round(
            (changePct.reduce((sum, pct) => sum + pct, 0) / changePct.length) *
              100
          ) / 100
        : 0.0;
    const posDays = changePct.filter((pct) => pct > 0).length;
    const negDays = changePct.filter((pct) => pct < 0).length;
    const last3 = changePct
      .slice(-3)
      .concat(Array(3 - Math.min(3, changePct.length)).fill(0.0));
    const trend =
      last3.reduce((sum, pct) => sum + pct, 0) > 0
        ? "upward"
        : last3.reduce((sum, pct) => sum + pct, 0) < 0
        ? "downward"
        : "flat";

    // Assemble summary
    return [
      `total_days:${totalDays}`,
      `avg_change_pct:${avgChange}`,
      `positive_days:${posDays}`,
      `negative_days:${negDays}`,
      `last_3_day_change_pct:${JSON.stringify(last3)}`,
      `trend:${trend}`,
    ].join(" | ");
  } catch (e) {
    return `error:${e.message}`;
  }
}

function extractPromptAndTimeseriesDataV6(query) {
  if (typeof query !== "string") {
    return [null, null];
  }

  const lines = query.trim().split("\n");
  const promptLines = [];
  const dataLines = [];
  let inDataBlock = false;
  let expectedColumns = 0;

  const headerPattern = /(context|บริบท|บริษัทย่อย)\s*:\s*(.*)/i;
  const dateRowPattern = /^\d{4}-\d{2}-\d{2}/;

  for (let line of lines) {
    const stripped = line.trim();

    if (!inDataBlock) {
      const headerMatch = headerPattern.exec(line);
      if (headerMatch) {
        inDataBlock = true;
        const headerLine = headerMatch[2].trim();
        expectedColumns = headerLine
          .split(",")
          .filter((col) => col.trim()).length;
        dataLines.push(headerLine);
      } else {
        promptLines.push(line);
      }
    } else {
      if (!stripped) continue;

      if (dateRowPattern.test(stripped)) {
        let values;
        if (stripped.includes(":")) {
          try {
            const [datePart, valuePart] = stripped.split(":", 2);
            values = [
              datePart.trim(),
              ...valuePart.split(",").map((v) => v.trim()),
            ];
          } catch {
            continue;
          }
        } else {
          values = stripped.split(",").map((v) => v.trim());
        }

        if (values.length === expectedColumns) {
          dataLines.push(values.join(", "));
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }

  const prompt = promptLines.join("\n").trim();
  const data = dataLines.length > 1 ? dataLines.join("\n") : null;

  return [prompt, data];
}

function main() {
  const item = $json.body.question;
  let output = [];
  const query = item;
  const itemType = classifyQuestionType(query);
  const itemData = { query: item, type: itemType };

  if (itemType === "Type#1") {
    output.push({ json: itemData });
  } else if (itemType === "Type#2") {
    const [prompt, timeseriesData] = extractPromptAndTimeseriesDataV6(query);
    if (prompt && timeseriesData) {
      const summary = summarizeTrendForAiV6(timeseriesData);
      itemData.query = `${prompt}\n\n${summary}`;
      output.push({ json: itemData });
    }
  }
  return output;
}

return main();
