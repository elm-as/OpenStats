import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

function Trigger() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success({ description: 'Saved', duration: 200 })}>ok</button>
      <button onClick={() => toast.error({ title: 'Boom', description: 'detail' })}>err</button>
      <button onClick={() => toast.clear()}>clear</button>
    </div>
  );
}

describe('Toast system', () => {
  it('throws if useToast is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(/useToast must be used inside/);
    spy.mockRestore();
  });

  it('shows a success toast and auto-dismisses', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText('ok'));
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Saved')).not.toBeInTheDocument(), {
      timeout: 1500,
    });
  });

  it('renders an error toast with title + description', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText('err'));
    });
    expect(screen.getByText('Boom')).toBeInTheDocument();
    expect(screen.getByText('detail')).toBeInTheDocument();
  });

  it('clears all toasts', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText('err'));
    });
    expect(screen.getByText('Boom')).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByText('clear'));
    });
    expect(screen.queryByText('Boom')).not.toBeInTheDocument();
  });
});
