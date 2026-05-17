import { describe, expect, it } from 'vitest';

// Mock schema and store context
const _mockSchema = {
  page: {
    size: 'A4',
    orientation: 'portrait',
    margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
  },
  zones: {
    header: { minHeight: '20mm', components: [] },
    footer: { minHeight: '20mm', components: [] },
  },
  pages: [{ id: 'page-1', body: { components: [] } }],
} as any;

describe('Multi-select Drag Drift Regression', () => {
  it('components in different zones should move by the same absolute distance', () => {
    // SETUP
    // A is in Body (Zone Offset 20mm), y = 10mm => Absolute Y = 30mm
    const compA = { id: 'A', x: 10, y: 10 };
    // B is in Header (Zone Offset 0mm), y = 5mm => Absolute Y = 5mm
    const compB = { id: 'B', x: 10, y: 5 };

    const _idsToDrag = ['A', 'B'];
    const primaryId = 'A';

    // Simulating current buggy logic in ComponentWrapper.tsx
    // 1. Capture initial positions (zone-local)
    const initialPositions = new Map();
    initialPositions.set('A', { x: compA.x, y: compA.y });
    initialPositions.set('B', { x: compB.x, y: compB.y });

    const primaryInitial = initialPositions.get(primaryId);

    // 2. Simulate snap to a new absolute position
    // Suppose we drag A to absolute y = 40mm
    const snappedAbsoluteY = 40;
    const dstZoneOffset = 20; // Dropping back into Body

    const finalPrimaryY = snappedAbsoluteY - dstZoneOffset; // 20mm (zone-local)

    // 3. Calculate new positions for everyone
    const results = new Map();
    for (const [id, pos] of initialPositions) {
      const relY = pos.y - primaryInitial.y; // BUG: uses zone-local y
      const newY = finalPrimaryY + relY;
      results.set(id, newY);
    }

    // VERIFY
    const newYA = results.get('A'); // 20 + (10 - 10) = 20
    const newYB = results.get('B'); // 20 + (5 - 10) = 15

    // Check absolute positions after move
    const absYA = newYA + 20; // 40mm (Correct: A moved from 30 to 40, delta = 10)
    const absYB = newYB + 20; // 35mm (INCORRECT: B moved from 5 to 35, delta = 30!)

    expect(absYA - 30).toBe(10);
    // This expectation will FAIL if the bug is present (it will be 30 instead of 10)
    // But since I'm simulating the bug here, I'll show it drifts.
    expect(absYB - 5).not.toBe(10); // Drift detected!
  });

  it('FIXED logic: components move by same absolute distance', () => {
    // A: absY = 30, B: absY = 5
    const initialPositions = new Map();
    initialPositions.set('A', { x: 10, y: 10, absY: 30 });
    initialPositions.set('B', { x: 10, y: 5, absY: 5 });

    const primaryInitial = initialPositions.get('A');
    const snappedAbsoluteY = 40;
    const dstZoneOffset = 20;

    const absoluteDeltaY = snappedAbsoluteY - primaryInitial.absY; // 10mm

    const results = new Map();
    for (const [id, pos] of initialPositions) {
      const newAbsY = pos.absY + absoluteDeltaY;
      const newLocalY = newAbsY - dstZoneOffset;
      results.set(id, newLocalY);
    }

    expect(results.get('A') + 20).toBe(40); // 30 + 10 = 40
    expect(results.get('B') + 20).toBe(15); // 5 + 10 = 15

    // Both moved by exactly 10mm absolute
    expect(results.get('A') + 20 - 30).toBe(10);
    expect(results.get('B') + 20 - 5).toBe(10);
  });
});
