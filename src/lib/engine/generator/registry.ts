import type { ComponentNode } from '@/types/schema';
import type { ComponentPlugin, RenderContext } from './types';

/**
 * Registry that maps component type strings to their render plugins.
 * Registering a second plugin for the same type overwrites the first — use this
 * to override built-in renderers with custom implementations.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, ComponentPlugin>();

  /** Register a plugin. Returns `this` for chaining. */
  register(plugin: ComponentPlugin): this {
    this.plugins.set(plugin.type, plugin);
    return this;
  }

  /** Retrieve a plugin by component type without rendering. */
  get(type: string): ComponentPlugin | undefined {
    return this.plugins.get(type);
  }

  /** Render a component node using its registered plugin. */
  render(comp: ComponentNode, ctx: RenderContext): string {
    const plugin = this.plugins.get(comp.type);
    if (!plugin) return `// [${comp.type}] no plugin registered\n`;
    return plugin.render(comp, ctx);
  }
}
