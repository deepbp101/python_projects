import QRCode from "qrcode";

/**
 * QR codes for the printed table cards.
 *
 * Rendered as SVG on the server so it prints crisply at any size — a raster code
 * enlarged onto a card is exactly where scanning starts failing. Error correction
 * is left at the default M, which tolerates a smudge or a thumb without inflating
 * the code past what fits on a place setting.
 */
export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: "#2F2A26", light: "#FFFFFF" },
  });
}
