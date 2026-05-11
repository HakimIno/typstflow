import type { ComponentNode, LayoutSchema } from '@/types/schema';

/**
 * Context passed to every plugin render call.
 * Carries the current data scope and a recursive render function so plugins
 * like Repeater and Columns can render their children without importing the registry.
 */
export interface RenderContext {
  /** Data in scope for the current item/row (e.g. a repeater item). */
  readonly local: Record<string, unknown>;
  /** Root-level data object — fallback for bindings not found in local. */
  readonly global: Record<string, unknown>;
  /** Items array for aggregate functions (SUM, COUNT, AVG, MIN, MAX). */
  readonly groupItems: unknown[];
  /** Zone X origin in mm from page corner (always 0 for page-width zones). */
  readonly offsetX: number;
  /** Zone Y origin in mm from page corner (stacked: header → body → footer). */
  readonly offsetY: number;
  /** Current zone layout type. */
  readonly layoutType: 'absolute' | 'flow';
  /** Full layout schema — available for plugins that need page/font config. */
  readonly schema: LayoutSchema;
  /**
   * Render any component node, optionally overriding parts of the context.
   * Plugins call this for children (repeater children, column components, etc.)
   */
  render(comp: ComponentNode, overrides?: Partial<Omit<RenderContext, 'render'>>): string;
}

/**
 * A component plugin: knows how to turn one component type into Typst source.
 * Register instances in a PluginRegistry to make the generator aware of them.
 */
export interface ComponentPlugin<T = unknown> {
  /** Must match the component's `type` discriminant exactly. */
  readonly type: string;
  render(comp: T, ctx: RenderContext): string;
}
