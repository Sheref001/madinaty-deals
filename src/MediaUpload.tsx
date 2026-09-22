import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { useTranslation } from './i18n';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const maxFiles = 6;
const maxBytes = 5 * 1024 * 1024;
const maxTotalBytes = 20 * 1024 * 1024;

export default function MediaUpload({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const previews = useMemo(() => files.filter(file => file.type !== 'image/heic' && file.type !== 'image/heif').map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);
  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const additions = [...incoming];
    if (files.length + additions.length > maxFiles) { setError(t('You can add up to 6 photos.')); return; }
    if (additions.some(file => !allowedTypes.has(file.type) || file.size > maxBytes)) { setError(t('Use JPG, PNG, WEBP, GIF, AVIF or phone images under 5 MB each.')); return; }
    if ([...files, ...additions].reduce((total, file) => total + file.size, 0) > maxTotalBytes) { setError(t('The total photo size cannot exceed 20 MB.')); return; }
    setError('');
    onChange([...files, ...additions]);
  };
  return <section className="media-upload" aria-label={t('Photos')}><div className="media-upload-head"><span><b>{t('Add photos')}</b><small>{t('Up to 6 photos · 5 MB each · 20 MB total')}</small></span><label className="media-upload-button"><ImagePlus size={17} /> <span>{t('Choose photos')}</span><input className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple onChange={event => { addFiles(event.target.files); event.currentTarget.value = ''; }} /></label></div>{previews.length > 0 && <div className="media-preview-grid">{previews.map(({ file, url }) => <figure key={`${file.name}-${file.lastModified}`}><img src={url} alt="" /><button type="button" onClick={() => onChange(files.filter(item => item !== file))} aria-label={`${t('Remove')} ${file.name}`}><X size={13} /></button></figure>)}</div>}{files.filter(file => file.type === 'image/heic' || file.type === 'image/heif').map(file => <div className="media-file" key={`${file.name}-${file.lastModified}`}>{file.name}<button type="button" onClick={() => onChange(files.filter(item => item !== file))}><X size={13} /></button></div>)}{error && <small className="form-error" role="alert">{error}</small>}</section>;
}
