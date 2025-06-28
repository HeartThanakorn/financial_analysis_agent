function main() {
  const allItems = items;

  // Handle no input
  if (allItems.length === 0) {
    return [{ json: { category: "", raw: "error:no_input" } }];
  }

  // Get the single input item
  const item = allItems[0];
  const OutputJson = item.json.output || "";

  // Handle empty or invalid input
  if (!OutputJson) {
    return [{ json: { category: "", raw: "error:empty_output" } }];
  }

  try {
    // Clean the input by removing ```json and newlines
    const cleanedJson = OutputJson.replace(/```json\n|\n```/g, "").trim();

    // Parse the JSON string
    const entry = JSON.parse(cleanedJson);

    // Extract answer (as category) and raw_output (as raw)
    const ans = entry.answer || "";
    const raw = entry.raw_output || entry.rawOutput || ""; // Handle both snake_case and camelCase

    return [{ json: { ans, raw } }];
  } catch (error) {
    // Handle JSON parsing errors
    return [
      { json: { category: "", raw: `error:invalid_json:${error.message}` } },
    ];
  }
}

return main();
