import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  slots: [] as any[],
  cursor: 0,
  effects: [] as any[],
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({ api: { get: h.get, post: h.post, delete: h.delete } }));

vi.mock('react', async (original) => {
  const actual: any = await original();
  return {
    ...actual,
    useState: (initial: any) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [
        h.slots[index],
        (value: any) => {
          h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value;
        },
      ];
    },
    useRef: (initial: any) => {
      const index = h.cursor++;
      return h.slots[index] ?? (h.slots[index] = { current: initial });
    },
    useMemo: (fn: any) => fn(),
    useCallback: (fn: any) => fn,
    useEffect: (effect: any, deps?: any[]) => {
      const index = h.cursor++;
      const previous = h.slots[index];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        const slot = { deps, cleanup: previous?.cleanup };
        h.slots[index] = slot;
        h.effects.push(() => {
          previous?.cleanup?.();
          slot.cleanup = effect();
        });
      }
    },
  };
});

import ApplicantArchive from './ApplicantArchive';

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}

const text = (tree: any): string => {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  return [tree.props?.children].flat(Infinity).map(text).join(' ').replace(/\s+/g, ' ').trim();
};

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('ApplicantArchive Component', () => {
  const mockShowToast = vi.fn();
  const mockUpdateApplicant = vi.fn();
  const mockAddApplicant = vi.fn();
  const mockAddActivityLog = vi.fn();
  const mockOnNavigate = vi.fn();

  const mockArchivedData: any[] = [
    {
      applicant_id: 101,
      applicant_code: 'APP-2026-FP-00101',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      applied_position: 'Welder',
      status_code: 'Processing Stopped',
      is_stopped: true,
      stopped_reason: 'Candidate medical certificate unverified',
      stopped_by: 'Staff Admin',
      stopped_phase: 2,
      archive_type: 'stopped',
      job_order_code: 'JO-2026-0001',
    },
    {
      applicant_id: 102,
      applicant_code: 'APP-2026-FP-00102',
      first_name: 'Maria',
      last_name: 'Santos',
      applied_position: 'Nurse',
      status_code: 'Deleted',
      deleted_at: '2026-11-01T10:00:00Z',
      deleted_by: 5,
      deleted_by_name: 'Manager Rose',
      archive_type: 'deleted',
      job_order_code: 'JO-2026-0002',
    },
  ];

  const defaultProps = {
    showToast: mockShowToast,
    currentUserName: 'Test Manager',
    currentUserRole: 'Management',
    onNavigate: mockOnNavigate,
    applicants: [],
    updateApplicant: mockUpdateApplicant,
    addApplicant: mockAddApplicant,
    addActivityLog: mockAddActivityLog,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    h.slots = [];
    h.effects = [];
    h.cursor = 0;
    h.get.mockResolvedValue({ data: mockArchivedData });
    h.post.mockResolvedValue({
      data: {
        detail: 'Applicant successfully restored',
        applicant: {
          applicant_id: 101,
          applicant_code: 'APP-2026-FP-00101',
          first_name: 'Juan',
          last_name: 'Dela Cruz',
          status_code: 'Active',
          current_phase: 2,
        },
      },
    });
    h.delete.mockResolvedValue({
      data: { detail: 'Applicant permanently deleted' },
    });
  });

  const render = (props = defaultProps) => {
    h.cursor = 0;
    return ApplicantArchive(props);
  };

  it('renders applicant archive title, subtitle, and loads records from backend', async () => {
    render();
    h.effects.splice(0).forEach((e) => e());
    await flush();

    const output = render();
    const allText = text(output);

    expect(allText).toContain('Applicant Archive');
    expect(allText).toContain('Browse soft-deleted applicants');
    expect(h.get).toHaveBeenCalledWith('/applicants/archived');
    expect(allText).toContain('Juan Dela Cruz');
    expect(allText).toContain('Maria Santos');
  });

  it('displays count badge and segmented filter pills', async () => {
    render();
    h.effects.splice(0).forEach((e) => e());
    await flush();

    const output = render();
    const allText = text(output);

    expect(allText).toContain('2 records');
    expect(allText).toContain('All');
    expect(allText).toContain('Soft-Deleted');
    expect(allText).toContain('Processing Stopped');
  });

  it('filters by archive type: soft-deleted vs stopped', async () => {
    render();
    h.effects.splice(0).forEach((e) => e());
    await flush();

    // Click "Soft-Deleted" filter button
    const deletedFilterBtn = nodes(render()).find(
      (n) => n.type === 'button' && text(n).includes('Soft-Deleted')
    );
    expect(deletedFilterBtn).toBeDefined();
    deletedFilterBtn.props.onClick();

    const deletedView = text(render());
    expect(deletedView).toContain('Maria Santos');
    expect(deletedView).not.toContain('Juan Dela Cruz');

    // Click "Processing Stopped" filter button
    const stoppedFilterBtn = nodes(render()).find(
      (n) => n.type === 'button' && text(n).includes('Processing Stopped')
    );
    expect(stoppedFilterBtn).toBeDefined();
    stoppedFilterBtn.props.onClick();

    const stoppedView = text(render());
    expect(stoppedView).toContain('Juan Dela Cruz');
    expect(stoppedView).not.toContain('Maria Santos');
  });

  it('opens clean restore modal and restores candidate to active processing upon confirmation', async () => {
    render();
    h.effects.splice(0).forEach((e) => e());
    await flush();

    // Find "Restore" button for the first record
    const returnBtns = nodes(render()).filter(
      (n) => n.type === 'button' && text(n).includes('Restore')
    );
    expect(returnBtns.length).toBeGreaterThan(0);

    // Click Restore for Juan Dela Cruz
    returnBtns[0].props.onClick();

    // Check clean modal opens
    let modalText = text(render());
    expect(modalText).toContain('Restore Applicant');
    expect(modalText).toContain('Target Phase');

    // Confirm restore
    const confirmBtn = nodes(render()).find(
      (n) => n.type === 'button' && text(n).includes('Confirm Restore')
    );
    expect(confirmBtn).toBeDefined();
    await confirmBtn.props.onClick();

    expect(h.post).toHaveBeenCalledWith(
      '/applicants/101/restore',
      expect.objectContaining({ targetPhase: expect.any(Number) })
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining('restored to active processing')
    );
    expect(mockAddActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESTORE_APPLICANT' })
    );
  });

  it('filters candidates by search input', async () => {
    render();
    h.effects.splice(0).forEach((e) => e());
    await flush();

    const searchInput = nodes(render()).find(
      (n) => n.type === 'input' && n.props.placeholder?.includes('Search archived applicants')
    );
    expect(searchInput).toBeDefined();

    searchInput.props.onChange({ target: { value: 'Welder' } });

    const searchResult = text(render());
    expect(searchResult).toContain('Juan Dela Cruz');
    expect(searchResult).not.toContain('Maria Santos');
  });

  it('safeguards permanent deletion with required confirmation checkbox before allowing deletion', async () => {
    render();
    h.effects.splice(0).forEach((e) => e());
    await flush();

    // Find "Delete Record" button for Maria Santos (applicant 102)
    const deleteBtns = nodes(render()).filter(
      (n) => n.type === 'button' && text(n).includes('Delete Record')
    );
    expect(deleteBtns.length).toBeGreaterThan(0);

    // Click "Delete Record" on the second applicant
    deleteBtns[1].props.onClick();

    // Check modal opens with staff-friendly warning
    let modalText = text(render());
    expect(modalText).toContain('Delete Record Permanently');
    expect(modalText).toContain('Maria Santos');
    expect(modalText).toContain('Once deleted, this applicant cannot be returned or restored');

    // Confirm button should initially be disabled until checkbox is checked
    let confirmDeleteBtn = nodes(render()).find(
      (n) => n.type === 'button' && text(n).includes('Permanently Delete')
    );
    expect(confirmDeleteBtn).toBeDefined();
    expect(confirmDeleteBtn.props.disabled).toBe(true);

    // Check the safeguard checkbox
    const checkbox = nodes(render()).find(
      (n) => n.type === 'input' && n.props.type === 'checkbox'
    );
    expect(checkbox).toBeDefined();
    checkbox.props.onChange({ target: { checked: true } });

    // Now confirm button should be enabled
    confirmDeleteBtn = nodes(render()).find(
      (n) => n.type === 'button' && text(n).includes('Permanently Delete')
    );
    expect(confirmDeleteBtn.props.disabled).toBe(false);

    // Click confirm permanent delete
    await confirmDeleteBtn.props.onClick();

    expect(h.delete).toHaveBeenCalledWith('/applicants/102/permanent');
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining('permanently deleted')
    );
    expect(mockAddActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PERMANENT_DELETE_APPLICANT' })
    );
  });
});
