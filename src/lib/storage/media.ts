/**
 * Audio and video sniffing, for guest book recordings.
 *
 * Deliberately a separate inspector from `inspectImage` and `inspectFile`: each
 * upload endpoint accepts exactly the family it needs, so a video cannot be
 * posted where a mood board image belongs and a PDF cannot be posted as a voice
 * message. As everywhere else, the format comes from the bytes.
 */

export type RecordingFormat =
  | "audio/wav"
  | "audio/mpeg"
  | "audio/mp4"
  | "audio/ogg"
  | "video/mp4"
  | "video/webm"
  | "video/quicktime";

/**
 * Recordings are much larger than photos — a minute of phone video is tens of
 * megabytes — so they get their own ceiling rather than the image one.
 */
export const MAX_RECORDING_BYTES = 50 * 1024 * 1024;

const EXTENSIONS: Record<RecordingFormat, string> = {
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function extensionForRecording(format: RecordingFormat): string {
  return EXTENSIONS[format];
}

export function isVideoFormat(format: string): boolean {
  return format.startsWith("video/");
}

const ascii = (bytes: Uint8Array, from: number, length: number): string =>
  String.fromCharCode(...bytes.slice(from, from + length));

/** RIFF container with a WAVE form type. */
function isWav(bytes: Uint8Array): boolean {
  return (
    bytes.length > 44 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE"
  );
}

/**
 * MP3 is either tagged with ID3 or starts on a raw frame sync — eleven set bits,
 * which is `0xFF` followed by a byte whose top three bits are set.
 */
function isMp3(bytes: Uint8Array): boolean {
  if (bytes.length < 64) return false;
  if (ascii(bytes, 0, 3) === "ID3") return true;
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

function isOgg(bytes: Uint8Array): boolean {
  return bytes.length > 32 && ascii(bytes, 0, 4) === "OggS";
}

/** Matroska/WebM open with the same EBML magic number. */
function isEbml(bytes: Uint8Array): boolean {
  return (
    bytes.length > 32 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

/**
 * ISO base media (MP4, M4A, MOV) carries an `ftyp` box at offset 4, with the
 * brand that follows deciding what kind of file it is.
 */
function isoBrand(bytes: Uint8Array): string | null {
  if (bytes.length < 32 || ascii(bytes, 4, 4) !== "ftyp") return null;
  return ascii(bytes, 8, 4);
}

/**
 * Identifies a recording from its bytes, or null when it is not a format we
 * accept — the caller turns that into a 400.
 *
 * WebM is reported as video even for audio-only recordings: the container is the
 * same either way and the entry's own kind decides which player is rendered, so
 * guessing from the byte stream would add a parser without adding information.
 */
export function inspectRecording(bytes: Uint8Array): RecordingFormat | null {
  if (isWav(bytes)) return "audio/wav";
  if (isMp3(bytes)) return "audio/mpeg";
  if (isOgg(bytes)) return "audio/ogg";
  if (isEbml(bytes)) return "video/webm";

  const brand = isoBrand(bytes);
  if (brand) {
    if (brand === "M4A " || brand === "M4B ") return "audio/mp4";
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }

  return null;
}
