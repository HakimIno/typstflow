import type { ComponentNode, LayoutSchema } from '@/types/schema';

/**
 * Generates a massive schema for stress testing.
 * @param pageCount Number of pages (default 50)
 * @param componentsPerPage Number of components on each page (default 20)
 */
export function generateStressTestSchema(pageCount = 50, componentsPerPage = 20): LayoutSchema {
  const pages = [];

  for (let i = 0; i < pageCount; i++) {
    const components: ComponentNode[] = [];

    for (let j = 0; j < componentsPerPage; j++) {
      components.push({
        id: crypto.randomUUID(),
        type: 'text',
        name: `Component P${i + 1}-C${j + 1}`,
        x: Math.random() * 100,
        y: Math.random() * 200,
        width: 50,
        height: 10,
        content: `Stress test content for component ${j + 1} on page ${i + 1}`,
        style: {
          fontSize: 10,
          color: '#000000',
        },
      } as any);
    }

    pages.push({
      id: crypto.randomUUID(),
      name: `Page ${i + 1}`,
      body: {
        id: `body-${i}`,
        components,
      },
    });
  }

  return {
    id: 'stress-test',
    name: 'Stress Test Report',
    version: '1.0.0',
    page: {
      size: 'A4',
      orientation: 'portrait',
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    },
    zones: {
      header: { id: 'header-zone', components: [] },
      footer: { id: 'footer-zone', components: [] },
    },
    groups: [],
    pages,
    variables: [],
    dataSchema: [],
    metadata: {
      title: 'Stress Test Document',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'System Stress Test',
    },
    fonts: [{ family: 'Inter', size: 10, role: 'body', embedded: true }],
  };
}
