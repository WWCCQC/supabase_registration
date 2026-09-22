import { parseTechnicianWorkbook } from '@/lib/allconnectTechniciansUpload';

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const rows = parseTechnicianWorkbook(await event.data.arrayBuffer());
    self.postMessage({ rows });
  } catch (cause) {
    self.postMessage({ error: cause instanceof Error ? cause.message : 'อ่านไฟล์ Excel ไม่สำเร็จ' });
  }
};
