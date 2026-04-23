import path from 'path';

export function getUploadRootDir() {
  const raw = process.env.UPLOAD_DIR ?? './public/uploads';
  return path.resolve(process.cwd(), raw);
}

export function assertSafeRelativeContractsPath(rel: string) {
  if (!rel.startsWith('contracts/')) {
    throw new Error('Invalid file path');
  }
  if (rel.includes('..') || path.isAbsolute(rel)) {
    throw new Error('Invalid file path');
  }
}
