import * as XLSX from "xlsx";

/**
 * Download data as an Excel file.
 * @param {string} filename  e.g. "employees_2026_05_28.xlsx"
 * @param {string} sheetName displayed tab name in Excel
 * @param {string[]} headers column headers row
 * @param {any[][]} rows     data rows (arrays of values, order matching headers)
 */
export function exportXlsx(filename, sheetName, headers, rows) {
  const aoa = [headers, ...rows];
  const ws  = XLSX.utils.aoa_to_sheet(aoa);

  // Auto column widths
  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.max(
      String(h).length + 2,
      ...rows.map(r => String(r[i] ?? "").length + 2)
    ),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

/** Returns today as YYYY_MM_DD */
export function todayTag() {
  const d = new Date();
  return `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, "0")}_${String(d.getDate()).padStart(2, "0")}`;
}

/** Returns current month as mon_YYYY (e.g. may_2026) */
export function monthTag(date = new Date()) {
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  return `${months[date.getMonth()]}_${date.getFullYear()}`;
}
