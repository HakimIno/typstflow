import { resolveBinding, resolvePath } from '@/lib/engine/generator/binding';
import type { LayoutSchema, TableComponent } from '@/types/schema';
import { downloadBlob } from './export-utils';

/**
 * Traverses the LayoutSchema to find all TableComponent instances.
 * Recursively scans layout structures like columns and repeaters.
 */
export function findAllTables(schema: LayoutSchema): TableComponent[] {
  const tables: TableComponent[] = [];

  const extractFromZone = (zone?: { components?: any[] }) => {
    if (!zone?.components) return;
    for (const comp of zone.components) {
      if (comp.type === 'table') {
        tables.push(comp as TableComponent);
      } else if (comp.type === 'columns') {
        for (const col of comp.columns || []) {
          extractFromZone(col);
        }
      } else if (comp.type === 'repeater') {
        extractFromZone(comp);
      }
    }
  };

  extractFromZone(schema.zones?.header);
  extractFromZone(schema.zones?.footer);

  for (const page of schema.pages || []) {
    extractFromZone(page.body);
  }

  return tables;
}

/**
 * Converts CSS Hex color into ExcelJS ARGB string (without '#').
 */
function toArgb(hex: string | undefined, defaultColor?: string): string | undefined {
  if (!hex) return defaultColor;
  let cleaned = hex.trim().replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (cleaned.length === 6) {
    return `FF${cleaned.toUpperCase()}`;
  }
  if (cleaned.length === 8) {
    return cleaned.toUpperCase();
  }
  return defaultColor;
}

/**
 * Attempts to parse dynamic strings (like currency or raw numbers) into native floats
 * so that Excel's calculation engine can compute formulas and alignments correctly.
 */
function parseNumeric(val: unknown): number | null {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return null;
  const cleaned = val.replace(/,/g, '').trim();
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

/**
 * Exports all tables in the given schema to a premium, styled Excel workbook (.xlsx).
 * Dynamically loads exceljs to maintain an optimized bundle size.
 */
export async function exportSchemaToExcel(schema: LayoutSchema, sampleData: unknown) {
  // 1. Dynamic import of exceljs for bundle efficiency
  const ExcelJS = await import('exceljs');

  const tables = findAllTables(schema);
  if (tables.length === 0) {
    throw new Error('ไม่พบตารางในเทมเพลตปัจจุบันสำหรับการนำออกข้อมูล Excel');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TypstFlow Designer';
  workbook.lastModifiedBy = 'TypstFlow Designer';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Standard border style
  const standardBorder = {
    top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  };

  for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
    const table = tables[tableIdx];
    const tableName = table.name || `Table ${tableIdx + 1}`;
    // Limit worksheet name to 31 chars (Excel requirement)
    const safeSheetName = tableName.replace(/[\\\/\?\*\:\[\]]/g, '').substring(0, 31);

    const worksheet = workbook.addWorksheet(safeSheetName, {
      views: [{ showGridLines: true }],
    });

    const style = table.style || {};
    const columns = table.columns || [];

    let currentExcelRowIdx = 1;
    const coveredCells = new Set<string>(); // Tracks merged grid coordinates: "row,col"

    /**
     * Writes a template-defined row (header/detail/footer) into Excel,
     * fully resolving and marking colspans/rowspans as native Excel merges.
     */
    const writeTemplateRow = (
      templateCells: any[],
      evaluatedValues: any[],
      defaultStyle: any,
      isHeader: boolean,
      zebraBg?: string
    ) => {
      const excelRow = worksheet.getRow(currentExcelRowIdx);
      excelRow.height = isHeader ? 24 : 20;

      let cellIndexInTemplate = 0;
      let colIdx = 1;

      while (colIdx <= columns.length) {
        // Skip coordinates covered by previous rowspans
        if (coveredCells.has(`${currentExcelRowIdx},${colIdx}`)) {
          colIdx++;
          continue;
        }

        const cell = templateCells[cellIndexInTemplate];
        if (!cell) break;

        const cs = cell.colspan ?? 1;
        const rs = cell.rowspan ?? 1;

        const startRow = currentExcelRowIdx;
        const startCol = colIdx;
        const endRow = startRow + rs - 1;
        const endCol = startCol + cs - 1;

        // Perform merge in Excel if spanned
        if (cs > 1 || rs > 1) {
          worksheet.mergeCells(startRow, startCol, endRow, endCol);
        }

        // Cover the merged region in our tracker
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            coveredCells.add(`${r},${c}`);
          }
        }

        const cellVal = evaluatedValues[cellIndexInTemplate];
        const parsedNum = isHeader ? null : parseNumeric(cellVal);

        // Styling and borders must be applied to all cells in the merge block
        for (let r = startRow; r <= endRow; r++) {
          const rObj = worksheet.getRow(r);
          for (let c = startCol; c <= endCol; c++) {
            const excelCell = rObj.getCell(c);

            // Set value ONLY to the top-left cell of the merge region
            if (r === startRow && c === startCol) {
              if (parsedNum !== null) {
                const col = columns[c - 1];
                const colFormat = col?.format || 'text';
                excelCell.value = parsedNum;
                if (colFormat === 'currency-thb') {
                  excelCell.numFmt = '"฿"#,##0.00';
                } else if (colFormat === 'currency-usd') {
                  excelCell.numFmt = '"$"#,##0.00';
                } else if (colFormat === 'percent') {
                  excelCell.value = parsedNum / 100;
                  excelCell.numFmt = '0.00%';
                } else if (colFormat === 'number') {
                  excelCell.numFmt = '#,##0.00';
                }
              } else {
                excelCell.value = cellVal !== undefined ? cellVal : '';
              }
            }

            // Set styling details
            const cellStyle = cell.style || {};
            excelCell.font = {
              name: cellStyle.fontFamily || defaultStyle.fontFamily || 'Segoe UI',
              size:
                cellStyle.fontSize ||
                (isHeader ? defaultStyle.headerFontSize : defaultStyle.bodyFontSize) ||
                10,
              bold: isHeader ? true : cellStyle.fontWeight === 'bold',
              italic: !!cellStyle.italic,
              underline: !!cellStyle.underline,
              color: cellStyle.color
                ? { argb: toArgb(cellStyle.color) }
                : isHeader
                  ? { argb: defaultStyle.headerTextColor }
                  : undefined,
            };

            // Set horizontal & vertical alignments
            const colAlign = columns[c - 1]?.align || 'left';
            excelCell.alignment = {
              horizontal: cell.align || colAlign || (parsedNum !== null ? 'right' : 'left'),
              vertical:
                cell.verticalAlign === 'top'
                  ? 'top'
                  : cell.verticalAlign === 'bottom'
                    ? 'bottom'
                    : 'middle',
            };

            // Set cell fill/background
            const fillHex =
              toArgb(cell.fill) || (isHeader ? defaultStyle.headerBg : zebraBg || 'FFFFFFFF');
            excelCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: fillHex },
            };

            // Set cell borders
            excelCell.border = isHeader
              ? {
                  top: { style: 'medium' as const, color: { argb: 'FF94A3B8' } },
                  bottom: { style: 'medium' as const, color: { argb: 'FF94A3B8' } },
                  left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
                  right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
                }
              : standardBorder;
          }
        }

        cellIndexInTemplate++;
        colIdx += cs;
      }

      currentExcelRowIdx++;
    };

    // --- 1. RENDER HEADERS ---
    const headerBg = toArgb(style.headerBackground, 'FFF1F5F9') || 'FFF1F5F9';
    const headerTextColor = toArgb(style.headerColor, 'FF000000') || 'FF000000';
    const defaultHeaderStyle = {
      fontFamily: style.fontFamily,
      headerFontSize: style.headerFontSize,
      headerTextColor,
      headerBg,
    };

    if (table.headerRows && table.headerRows.length > 0) {
      // Designed multi-row headers
      for (const row of table.headerRows) {
        const cells = row.cells || [];
        const values = cells.map((cell) => {
          return resolveBinding(cell.content || '', sampleData, sampleData);
        });
        writeTemplateRow(cells, values, defaultHeaderStyle, true);
      }
    } else if (table.showHeader !== false) {
      // Fallback: flat synthetic row
      const cells = columns.map((col) => ({
        colspan: col.colspan || 1,
        rowspan: col.rowspan || 1,
        fill: col.background || style.headerBackground,
        align: col.align || 'center',
        style: col.style,
      }));
      const values = columns.map((col) => col.header || 'Column');
      writeTemplateRow(cells, values, defaultHeaderStyle, true);
    }

    // --- 2. PREPARE DATA ITEMS ---
    const isStatic = table.isStatic ?? false;
    const dataPath = table.dataSource ? table.dataSource.replace(/[{}]/g, '').trim() : '';
    const rawData = dataPath ? resolvePath(dataPath, sampleData) : null;
    const dataItems = isStatic ? [sampleData] : Array.isArray(rawData) ? rawData : [];

    const pattern = style.fillPattern || 'header-only';
    const c1 = toArgb(style.stripedColor1, 'FFFFFFFF') || 'FFFFFFFF';
    const c2 = toArgb(style.stripedColor2, 'FFF8FAFC') || 'FFF8FAFC';

    const defaultBodyStyle = {
      fontFamily: style.fontFamily,
      bodyFontSize: style.bodyFontSize || 10,
    };

    let rowIdx = 0;

    /**
     * Renders a dynamic data row utilizing either table.detailRows (designed cells)
     * or table.columns (fallback mapping).
     */
    const renderRowObj = (item: any) => {
      let rowBg = 'FFFFFFFF';
      if (pattern === 'striped-rows') {
        rowBg = rowIdx % 2 === 0 ? c1 : c2;
      }

      if (table.detailRows && table.detailRows.length > 0) {
        for (const detailRow of table.detailRows) {
          const cells = detailRow.cells || [];
          const values = cells.map((cell) => {
            return resolveBinding(cell.content || '', item, sampleData);
          });
          writeTemplateRow(cells, values, defaultBodyStyle, false, rowBg);
        }
      } else {
        const cells = columns.map((col) => ({
          colspan: col.colspan || 1,
          rowspan: col.rowspan || 1,
          fill: col.background,
          align: col.align,
          style: col.style,
        }));
        const values = columns.map((col) => {
          const val = col.field ? resolvePath(col.field.replace(/[{}]/g, '').trim(), item) : '';
          return val !== undefined ? String(val) : '';
        });
        writeTemplateRow(cells, values, defaultBodyStyle, false, rowBg);
      }
      rowIdx++;
    };

    // --- 3. RENDER DATA & GROUPING ---
    if (table.groupBy && !isStatic) {
      const groups = new Map<string, any[]>();
      for (const item of dataItems) {
        const key = String(resolvePath(table.groupBy, item) ?? 'Other');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)?.push(item);
      }

      for (const [groupKey, items] of groups.entries()) {
        // Render Group Header Row (Spanning all columns)
        const gh = table.groupHeaderStyle;
        const ghBg = toArgb(gh?.background, 'FFF1F5F9') || 'FFF1F5F9';
        const ghColor = toArgb(gh?.color, 'FF000000') || 'FF000000';
        const ghText = resolveBinding(
          table.groupHeaderFormat || '{{group}}',
          { group: groupKey, ...items[0] },
          sampleData,
          items
        );

        const excelRow = worksheet.getRow(currentExcelRowIdx);
        excelRow.height = 22;
        worksheet.mergeCells(currentExcelRowIdx, 1, currentExcelRowIdx, columns.length);

        for (let c = 1; c <= columns.length; c++) {
          const cell = excelRow.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ghBg } };
          cell.border = standardBorder;
          if (c === 1) {
            cell.value = ghText;
            cell.font = {
              name: style.fontFamily || 'Segoe UI',
              size: gh?.fontSize || 10,
              bold: true,
              color: { argb: ghColor },
            };
            cell.alignment = { horizontal: gh?.align || 'left', vertical: 'middle' };
          }
        }
        currentExcelRowIdx++;

        // Render dynamic rows inside this group
        for (const item of items) {
          renderRowObj(item);
        }

        // Render Group Subtotal Row (Auto Group Footer)
        if (table.autoGroupFooter) {
          const gf = table.groupFooterStyle;
          const gfBg = toArgb(gf?.background, 'FFF8FAFC') || 'FFF8FAFC';
          const gfColor = toArgb(gf?.color, 'FF000000') || 'FF000000';

          const footerCells = columns.map((col) => {
            return {
              colspan: 1,
              rowspan: 1,
              fill: gfBg,
              align: col.align || 'left',
              style: {
                fontWeight: gf?.fontWeight || 'bold',
                fontSize: gf?.fontSize || style.bodyFontSize || 10,
                color: gfColor,
              },
            };
          });

          const footerValues = columns.map((col, x) => {
            let content = '';
            if (col.footerExpr) {
              content = col.footerExpr;
            } else if (x === 0) {
              content = table.autoGroupFooterLabel || 'Subtotal';
            } else if (col.field) {
              content = `{{SUM(${col.field})}}`;
            }
            if (!content) return '';
            return resolveBinding(content, items[0], sampleData, items);
          });

          writeTemplateRow(footerCells, footerValues, defaultBodyStyle, false);
        }
      }
    } else {
      // Standard dynamic row rendering (No grouping)
      for (const item of dataItems) {
        renderRowObj(item);
      }
    }

    // --- 4. RENDER FOOTER ROWS ---
    if (table.footerRows && table.footerRows.length > 0) {
      for (const footerRow of table.footerRows) {
        const cells = footerRow.cells || [];
        const values = cells.map((cell) => {
          return resolveBinding(cell.content || '', sampleData, sampleData, dataItems);
        });
        const defaultFooterStyle = {
          fontFamily: style.fontFamily,
          bodyFontSize: style.bodyFontSize || 10,
        };
        const cellsWithBold = cells.map((c) => ({
          ...c,
          style: {
            ...c.style,
            fontWeight: 'bold',
          },
        }));
        writeTemplateRow(cellsWithBold, values, defaultFooterStyle, false);
      }
    }

    // --- 5. COLUMN WIDTH AUTO-FITTING ---
    if (worksheet.columns) {
      for (const column of worksheet.columns) {
        let maxLen = 12; // Fallback default
        if (column.values) {
          for (const val of column.values) {
            if (val != null) {
              let strVal = String(val);
              if (typeof val === 'number') {
                strVal = val.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
              }
              if (strVal.length > maxLen) {
                maxLen = strVal.length;
              }
            }
          }
        }
        // Set dynamic width with padding
        column.width = Math.min(maxLen + 4, 45);
      }
    }
  }

  // 6. Write file buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  downloadBlob(blob, `${schema.name || 'report'}.xlsx`);
}
