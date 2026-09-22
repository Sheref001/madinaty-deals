// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MediaUpload from './MediaUpload';
import VerificationForm from './VerificationForm';
import { LanguageContext, type Language } from './i18n';
import { uploadFile, submitVerification } from './api';

vi.mock('./api', () => ({ uploadFile: vi.fn(), submitVerification: vi.fn() }));
beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test-photo'), revokeObjectURL: vi.fn() }));
  vi.mocked(uploadFile).mockResolvedValue({ id: 'private-document', originalFileName: 'proof.pdf', mimeType: 'application/pdf', byteSize: 20 });
  vi.mocked(submitVerification).mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

function Photos() {
  const [files, setFiles] = useState<File[]>([]);
  return <MediaUpload files={files} onChange={setFiles} />;
}

it.each(['en', 'ar'] as Language[])('selects, removes and reselects photos using the labelled native control (%s)', language => {
  render(<LanguageContext.Provider value={language}><Photos /></LanguageContext.Provider>);
  const input = screen.getByLabelText(language === 'en' ? 'Choose photos' : 'اختر الصور') as HTMLInputElement;
  const file = new File(['photo'], 'table.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
  expect(screen.getByRole('img').getAttribute('src')).toBe('blob:test-photo');
  fireEvent.click(screen.getByRole('button'));
  expect(screen.queryByRole('img')).toBeNull();
  fireEvent.change(input, { target: { files: [file] } });
  expect(screen.getByRole('img')).toBeTruthy();
  expect(input.value).toBe('');
});

it('retains existing photos when a later selection exceeds limits', () => {
  render(<LanguageContext.Provider value="en"><Photos /></LanguageContext.Provider>);
  const input = screen.getByLabelText('Choose photos');
  const file = new File(['photo'], 'table.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.change(input, { target: { files: Array(6).fill(file) } });
  expect(screen.getByRole('alert').textContent).toContain('up to 6');
  expect(screen.getAllByRole('img')).toHaveLength(1);
});

it.each(['drop', 'paste'])('accepts photos through %s without a file dialog and still validates formats', method => {
  render(<LanguageContext.Provider value="en"><Photos /></LanguageContext.Provider>);
  const area = screen.getByRole('group', { name: 'Drag or paste files' });
  const select = (file: File) => method === 'drop'
    ? fireEvent.drop(area, { dataTransfer: { files: [file] } })
    : fireEvent.paste(area, { clipboardData: { files: [file] } });
  select(new File(['photo'], 'table.jpg', { type: 'image/jpeg' }));
  expect(screen.getByRole('img')).toBeTruthy();
  select(new File(['script'], 'script.svg', { type: 'image/svg+xml' }));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getAllByRole('img')).toHaveLength(1);
});

it('accepts one dropped PDF and rejects multiple documents without discarding the previous file', async () => {
  render(<LanguageContext.Provider value="en"><VerificationForm onSubmitted={vi.fn()} onSkip={vi.fn()} /></LanguageContext.Provider>);
  const area = screen.getByRole('group', { name: 'Drag or paste files' });
  const file = new File(['%PDF-1.7\n%%EOF'], 'proof.pdf', { type: 'application/pdf' });
  fireEvent.drop(area, { dataTransfer: { files: [file] } });
  expect(screen.getByText('proof.pdf')).toBeTruthy();
  fireEvent.drop(area, { dataTransfer: { files: [file, file] } });
  expect(screen.getByRole('alert').textContent).toBe('Choose one document at a time.');
  fireEvent.submit(area.closest('form')!);
  await waitFor(() => expect(uploadFile).toHaveBeenCalledWith(file, 'verification', 'MADINATY_ID'));
});

it('keeps the selected document on cancel and submits its upload ID', async () => {
  const onSubmitted = vi.fn();
  render(<LanguageContext.Provider value="en"><VerificationForm onSubmitted={onSubmitted} onSkip={vi.fn()} /></LanguageContext.Provider>);
  const input = screen.getByLabelText('Choose file');
  const file = new File(['%PDF-1.7\n%%EOF'], 'proof.pdf', { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent(input, new Event('cancel', { bubbles: true }));
  expect(screen.getByText('proof.pdf')).toBeTruthy();
  fireEvent.submit(input.closest('form')!);
  await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
  expect(uploadFile).toHaveBeenCalledWith(file, 'verification', 'MADINATY_ID');
  expect(submitVerification).toHaveBeenCalledWith(['private-document']);
});

it('keeps a document available for retry after upload fails', async () => {
  vi.mocked(uploadFile).mockRejectedValueOnce(new Error('Upload failed'));
  render(<LanguageContext.Provider value="en"><VerificationForm onSubmitted={vi.fn()} onSkip={vi.fn()} /></LanguageContext.Provider>);
  const input = screen.getByLabelText('Choose file');
  fireEvent.change(input, { target: { files: [new File(['pdf'], 'proof.pdf', { type: 'application/pdf' })] } });
  fireEvent.submit(input.closest('form')!);
  await screen.findByRole('alert');
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Request verification' }).disabled).toBe(false);
  expect(screen.getByText('proof.pdf')).toBeTruthy();
  expect(submitVerification).not.toHaveBeenCalled();
});
