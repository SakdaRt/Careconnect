import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Modal } from '../components/ui/Modal';

describe('Modal', () => {
  it('renders when isOpen and shows title and content', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal isOpen onClose={onClose} title="ทดสอบ" size="sm">
        <div id="modal-content">เนื้อหา</div>
      </Modal>
    );
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    const title = document.getElementById('modal-title');
    expect(title?.textContent).toBe('ทดสอบ');
    const content = document.getElementById('modal-content');
    expect(content?.textContent).toBe('เนื้อหา');
    unmount();
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal isOpen onClose={onClose} title="ทดสอบ">
        เนื้อหา
      </Modal>
    );
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('calls onClose when pressing Escape', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal isOpen onClose={onClose} title="ทดสอบ">
        เนื้อหา
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });
});
