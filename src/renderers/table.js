/**
 * Generic CLI Table Renderer
 *
 * Renders tabular data with automatic column width calculation,
 * text wrapping, and terminal-aware formatting.
 */

/**
 * Get terminal width, with fallback
 * @returns {number} Terminal width in columns
 */
function getTerminalWidth() {
  return process.stdout.columns || 120;
}

/**
 * Wrap text to fit within a specified width
 * @param {string} text - Text to wrap
 * @param {number} width - Maximum width
 * @returns {string[]} Array of wrapped lines
 */
function wrapText(text, width) {
  if (!text || width <= 0) return [''];

  const str = String(text);
  if (str.length <= width) return [str];

  const words = str.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (word.length > width) {
      // Word is longer than width, force break it
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width));
      }
    } else if (currentLine.length + word.length + 1 <= width) {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

/**
 * Calculate optimal column widths based on content and terminal width
 * @param {Object[]} rows - Array of row objects
 * @param {Object[]} columns - Column definitions [{key, label, minWidth?, maxWidth?, flex?}]
 * @param {number} termWidth - Available terminal width
 * @returns {Object} Map of column key to calculated width
 */
function calculateColumnWidths(rows, columns, termWidth) {
  const gap = 2; // Space between columns
  const totalGaps = (columns.length - 1) * gap;
  const availableWidth = termWidth - totalGaps;

  // Calculate content widths for each column
  const contentWidths = {};
  for (const col of columns) {
    const labelWidth = col.label.length;
    const maxContentWidth = rows.reduce((max, row) => {
      const val = String(row[col.key] || '');
      return Math.max(max, val.length);
    }, 0);
    contentWidths[col.key] = Math.max(labelWidth, maxContentWidth);
  }

  // Apply min/max constraints and calculate flex columns
  const widths = {};
  let fixedWidth = 0;
  let flexColumns = [];

  for (const col of columns) {
    const contentWidth = contentWidths[col.key];
    const minWidth = col.minWidth || 4;
    const maxWidth = col.maxWidth || Infinity;

    if (col.flex) {
      flexColumns.push(col);
    } else {
      // Fixed column - use content width within constraints
      widths[col.key] = Math.min(Math.max(contentWidth, minWidth), maxWidth);
      fixedWidth += widths[col.key];
    }
  }

  // Distribute remaining width to flex columns
  const remainingWidth = availableWidth - fixedWidth;
  if (flexColumns.length > 0 && remainingWidth > 0) {
    const flexWidth = Math.floor(remainingWidth / flexColumns.length);
    for (const col of flexColumns) {
      const minWidth = col.minWidth || 10;
      const maxWidth = col.maxWidth || Infinity;
      widths[col.key] = Math.min(Math.max(flexWidth, minWidth), maxWidth);
    }
  }

  return widths;
}

/**
 * Render a table to string
 * @param {Object} options - Table options
 * @param {string} options.title - Table title (optional)
 * @param {Object[]} options.columns - Column definitions [{key, label, minWidth?, maxWidth?, flex?, align?}]
 * @param {Object[]} options.rows - Data rows (array of objects)
 * @param {string} options.emptyMessage - Message when no rows (optional)
 * @param {string} options.footer - Footer message (optional)
 * @returns {string} Rendered table
 */
function renderTable({ title, columns, rows, emptyMessage, footer }) {
  const termWidth = getTerminalWidth();
  const lines = [];
  const gap = '  '; // 2 spaces between columns

  // Title
  if (title) {
    lines.push(title);
    lines.push('');
  }

  // Empty state
  if (!rows || rows.length === 0) {
    lines.push(emptyMessage || 'No items.');
    if (footer) {
      lines.push('');
      lines.push(footer);
    }
    return lines.join('\n');
  }

  // Calculate column widths
  const widths = calculateColumnWidths(rows, columns, termWidth);

  // Header row
  const headerParts = columns.map(col => {
    const width = widths[col.key];
    return col.label.slice(0, width).padEnd(width);
  });
  lines.push(headerParts.join(gap));

  // Separator
  const separatorParts = columns.map(col => '─'.repeat(widths[col.key]));
  lines.push(separatorParts.join(gap));

  // Data rows with wrapping
  for (const row of rows) {
    // Wrap each cell's content
    const wrappedCells = columns.map(col => {
      const value = String(row[col.key] ?? '');
      return wrapText(value, widths[col.key]);
    });

    // Find max lines needed for this row
    const maxLines = Math.max(...wrappedCells.map(cell => cell.length));

    // Render each line of the row
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      const rowParts = columns.map((col, colIdx) => {
        const cellLines = wrappedCells[colIdx];
        const text = cellLines[lineIdx] || '';
        const width = widths[col.key];

        if (col.align === 'right') {
          return text.padStart(width);
        }
        return text.padEnd(width);
      });
      lines.push(rowParts.join(gap));
    }
  }

  // Footer
  if (footer) {
    lines.push('');
    lines.push(footer);
  }

  return lines.join('\n');
}

/**
 * Render a simple key-value list (for profiles, providers, etc.)
 * @param {Object} options - List options
 * @param {string} options.title - List title
 * @param {Object[]} options.items - Items to render
 * @param {Function} options.renderItem - Function to render each item (returns string or string[])
 * @param {string} options.emptyMessage - Message when no items
 * @returns {string} Rendered list
 */
function renderList({ title, items, renderItem, emptyMessage }) {
  const lines = [];

  if (title) {
    lines.push(title);
    lines.push('');
  }

  if (!items || items.length === 0) {
    lines.push(emptyMessage || 'No items.');
    return lines.join('\n');
  }

  for (const item of items) {
    const rendered = renderItem(item);
    if (Array.isArray(rendered)) {
      lines.push(...rendered);
    } else {
      lines.push(rendered);
    }
  }

  return lines.join('\n');
}

module.exports = {
  renderTable,
  renderList,
  wrapText,
  calculateColumnWidths,
  getTerminalWidth
};
