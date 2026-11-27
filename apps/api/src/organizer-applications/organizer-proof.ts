import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

const maxProofBytes = 10 * 1024 * 1024;
export const proofUploadLimits = {
  fileSize: maxProofBytes + 1,
  files: 1,
  fields: 12,
  fieldSize: 8192,
};

const formats = [
  { mediaType: 'application/pdf', extensions: ['pdf'], signature: Buffer.from('%PDF-') },
  { mediaType: 'image/png', extensions: ['png'], signature: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) },
  { mediaType: 'image/jpeg', extensions: ['jpg', 'jpeg'], signature: Buffer.from([255, 216, 255]) },
];

export type ProofUpload = { originalname: string; buffer: Buffer };
export type ProofData = { name: string; mediaType: string; data: Uint8Array<ArrayBuffer> };
export const proofMetadata = { id: true, name: true, mediaType: true } as const;

export function readProofUpload(file: ProofUpload): ProofData {
  if (file.buffer.length > maxProofBytes) {
    throw new PayloadTooLargeException('The proof document must be 10 MB or smaller.');
  }
  const extension = file.originalname.match(/\.([a-z]+)$/i)?.[1]?.toLowerCase() ?? '';
  const format = formats.find(({ extensions, signature }) =>
    extensions.includes(extension) &&
    file.buffer.length > signature.length &&
    file.buffer.subarray(0, signature.length).equals(signature),
  );
  if (!format) {
    throw new BadRequestException('Choose a valid PDF, PNG, or JPEG proof document.');
  }

  const title = file.originalname.slice(0, -(extension.length + 1))
    .replace(/[^\p{L}\p{N}._ -]/gu, '_').trim().slice(0, 170);
  return {
    name: `${title || 'organizer-proof'}.${extension}`,
    mediaType: format.mediaType,
    data: new Uint8Array(file.buffer),
  };
}

export function proofDisposition(name: string, download: boolean) {
  const fallback = name.replace(/[^a-zA-Z0-9._ -]/g, '_');
  return `${download ? 'attachment' : 'inline'}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
