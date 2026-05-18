/**
 * Pure TypeScript utility to parse TrueType (TTF) and OpenType (OTF) font binaries
 * and extract their exact internal Font Family Name from the metadata 'name' table.
 */
export function readFontFamily(buffer: ArrayBuffer): string | null {
  try {
    const view = new DataView(buffer);

    // 1. Read sfnt header
    const numTables = view.getUint16(4);

    // 2. Find 'name' table record
    let nameTableOffset = 0;

    for (let i = 0; i < numTables; i++) {
      const offset = 12 + i * 16;
      if (offset + 16 > buffer.byteLength) break;

      const tag = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );

      if (tag === 'name') {
        nameTableOffset = view.getUint32(offset + 8);
        break;
      }
    }

    if (nameTableOffset === 0 || nameTableOffset > buffer.byteLength) {
      return null;
    }

    // 3. Read 'name' table header
    const count = view.getUint16(nameTableOffset + 2);
    const stringOffset = view.getUint16(nameTableOffset + 4);

    // 4. Iterate name records
    // Name ID 1 is Font Family Name.
    // Name ID 16 is Preferred Family Name (sometimes used instead of 1).
    let familyName: string | null = null;
    let preferredFamilyName: string | null = null;

    for (let i = 0; i < count; i++) {
      const recordOffset = nameTableOffset + 6 + i * 12;
      if (recordOffset + 12 > buffer.byteLength) break;

      const platformId = view.getUint16(recordOffset);
      const encodingId = view.getUint16(recordOffset + 2);
      const languageId = view.getUint16(recordOffset + 4);
      const nameId = view.getUint16(recordOffset + 6);
      const length = view.getUint16(recordOffset + 8);
      const offset = view.getUint16(recordOffset + 10);

      // Name ID 1 = Family Name, 16 = Preferred Family
      if (nameId === 1 || nameId === 16) {
        const start = nameTableOffset + stringOffset + offset;
        if (start + length > buffer.byteLength) continue;

        let name = '';
        // Platform 0 (Unicode), Platform 3 (Windows), or Platform 1 (Mac) with specific encoding
        const isUnicode =
          platformId === 0 ||
          platformId === 3 ||
          (platformId === 1 && encodingId === 0 && languageId === 0);

        if (isUnicode) {
          // UTF-16BE (2 bytes per character)
          for (let j = 0; j < length; j += 2) {
            name += String.fromCharCode(view.getUint16(start + j));
          }
        } else {
          // 8-bit encoding (Mac Roman, etc.)
          for (let j = 0; j < length; j++) {
            name += String.fromCharCode(view.getUint8(start + j));
          }
        }

        name = name.trim();
        if (name) {
          if (nameId === 16) {
            preferredFamilyName = name;
          } else if (nameId === 1) {
            familyName = name;
          }
        }
      }
    }

    return preferredFamilyName || familyName;
  } catch (e) {
    console.error('[FontParser] Failed to parse font metadata:', e);
    return null;
  }
}
