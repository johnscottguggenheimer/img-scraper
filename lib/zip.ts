import JSZip from "jszip";
import type { DownloadResult } from "./download";

export async function buildZip(files: DownloadResult[]): Promise<ArrayBuffer> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.filename, file.data);
  }

  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}
