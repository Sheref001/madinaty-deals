import { useTranslation } from './i18n';

// Keep activation native. Drop/paste also work without opening the OS file dialog.
export default function FilePicker({ label, accept, multiple = false, disabled = false, onFiles }: {
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const { t } = useTranslation();
  return <div className="file-drop-area" role="group" aria-label={t('Drag or paste files')} tabIndex={disabled ? -1 : 0}
    onDragOver={event => event.preventDefault()}
    onDrop={event => {
      event.preventDefault();
      if (!disabled && event.dataTransfer.files.length) onFiles([...event.dataTransfer.files]);
    }}
    onPaste={event => {
      if (!disabled && event.clipboardData.files.length) {
        event.preventDefault();
        onFiles([...event.clipboardData.files]);
      }
    }}>
    <label className="native-file-picker"><span>{t(label)}</span>
      <input className="native-file-input" type="file" accept={accept} multiple={multiple} disabled={disabled}
        onChange={event => {
          if (event.target.files?.length) onFiles([...event.target.files]);
          event.currentTarget.value = '';
        }} />
    </label>
    <small>{t('You can also drag files here, or click here and paste a copied image.')}</small>
  </div>;
}
