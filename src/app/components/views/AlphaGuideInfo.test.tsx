import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ open: false }));
vi.mock('react', async (original) => ({ ...(await original() as any), useState: () => [h.open, (value: boolean) => { h.open = value; }] }));
import SesAlphaDecisionGuide, { AlphaGuideInfo } from './SesAlphaDecisionGuide';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}

describe('alpha information tooltips', () => {
  const render = () => AlphaGuideInfo({ label: 'High Alpha', children: 'Educational detail' });
  beforeEach(() => { h.open = false; });
  it('uses the existing portalled Radix tooltip for hover, focus, Escape and collision handling', () => {
    const tree = render(); expect(tree.type).toBe(Tooltip);
    expect(nodes(tree).find((n) => n.type === TooltipTrigger).props.asChild).toBe(true);
    const content = nodes(tree).find((n) => n.type === TooltipContent);
    expect(content.props.children).toBe('Educational detail'); expect(content.props.collisionPadding).toBe(12);
    expect(content.props.className).toContain('100vw');
    expect(content.props.className).toContain('overflow-y-auto');
    tree.props.onOpenChange(true); expect(render().props.open).toBe(true);
    tree.props.onOpenChange(false); expect(render().props.open).toBe(false);
  });
  it('toggles on button activation for click, tap, and keyboard without triggering Radix click-to-close', () => {
    const preventDefault = vi.fn();
    const button = () => nodes(render()).find((n) => n.type === 'button');
    expect(button().props['aria-label']).toBe('About high alpha');
    expect(button().props.type).toBe('button');
    button().props.onClick({ preventDefault }); expect(h.open).toBe(true);
    button().props.onClick({ preventDefault }); expect(h.open).toBe(false);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });
  it('provides the requested stable, normal, sustained-change and very-high-alpha explanations', () => {
    const rows = nodes(SesAlphaDecisionGuide({ alpha: 0.99999 })).filter((n) => n.type === AlphaGuideInfo);
    expect(rows).toHaveLength(4);
    expect(rows[0].props.children).toContain('isolated long or short');
    expect(rows[1].props.children).toContain('no major sustained operational change');
    expect(rows[1].props.children).not.toMatch(/current setting/i);
    expect(rows[2].props.children).toContain('Hypothetical'); expect(rows[2].props.children).toContain('DMW');
    expect(rows[2].props.children).toContain('cannot predict an outage before observations arrive');
    expect(rows[2].props.children).toContain('one-day disruption with a specific Delay Reason');
    expect(rows[3].props.children).toContain('90%'); expect(rows[3].props.children).toContain('10%');
    expect(rows[3].props.children).toContain('SES follows the newest observation entirely');
    expect(rows[3].props.children).toContain('not universally better or more accurate');
  });
});
