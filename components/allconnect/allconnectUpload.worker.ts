import Papa from 'papaparse';

let parser: Papa.Parser | undefined;
self.onmessage = async (event: MessageEvent) => {
  if (event.data.action === 'resume') { parser?.resume(); return; }
  if (event.data.action !== 'parse') return;
  // Decode once before character-based chunking so UTF-8 characters cannot be
  // split between separately decoded byte slices by Papa's FileStreamer.
  let source: string;
  try { source = await event.data.file.text(); }
  catch { self.postMessage({ type: 'error', message: 'อ่านไฟล์ไม่สำเร็จ' }); return; }
  Papa.parse<Record<string, string>>(source, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
    encoding: 'UTF-8',
    chunkSize: 512 * 1024,
    transformHeader: (header, index) => index === 0 ? header.replace(/^\uFEFF/, '') : header,
    chunk(results: Papa.ParseResult<Record<string, string>>, handle: Papa.Parser) {
      parser = handle;
      handle.pause();
      self.postMessage({ type: 'chunk', results });
    },
    complete() { self.postMessage({ type: 'complete' }); },
    error(error: Error) { self.postMessage({ type: 'error', message: error.message }); },
  });
};
