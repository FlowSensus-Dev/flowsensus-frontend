import { describe, expect, it } from 'vitest';
import { hasAccessToView, MANAGEMENT_EXCLUSIVE_VIEWS, STATIC_VIEW_ROLES, UNIVERSAL_VIEWS } from './accessControl';
import type { ViewType } from '../app/types';

describe('platform and tenant navigation boundaries', () => {
  it('denies all tenant views to platform identities, even with Management roles or dynamic permissions', () => {
    const views = [...UNIVERSAL_VIEWS, ...MANAGEMENT_EXCLUSIVE_VIEWS, ...Object.keys(STATIC_VIEW_ROLES)] as ViewType[];
    for (const view of views) expect(hasAccessToView(view, ['Management', 'Recruitment'], true, { [view]: ['Management'] })).toBe(false);
  });
  it('preserves legitimate single-role, multi-role and dynamic tenant permissions', () => {
    expect(hasAccessToView('registration', ['Recruitment'], false)).toBe(true);
    expect(hasAccessToView('forecast', ['Recruitment', 'Management'], false)).toBe(true);
    expect(hasAccessToView('forecast', ['Recruitment'], false, { forecast: ['Recruitment'] })).toBe(false);
    expect(hasAccessToView('expense', ['Accounting'], false)).toBe(true);
    expect(hasAccessToView('expense', ['Recruitment'], false)).toBe(false);
    expect(hasAccessToView('screening', ['Admin'], false, { screening: ['Admin'] })).toBe(true);
    expect(hasAccessToView('archive', ['Admin'], false)).toBe(true);
    expect(hasAccessToView('archive', ['Management'], false)).toBe(true);
    expect(hasAccessToView('archive', ['Recruitment'], false)).toBe(false);
    expect(hasAccessToView('archive', ['Recruitment'], false, { archive: ['Recruitment', 'Management'] })).toBe(true);
  });
});
