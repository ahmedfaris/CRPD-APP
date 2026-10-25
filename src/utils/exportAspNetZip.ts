import JSZip from 'jszip';
import { ASPNET_PROJECT_FILES } from '../data/aspnetProjectFiles';

export async function exportAspNetMvcZip(): Promise<void> {
  const zip = new JSZip();

  // Root solution folder
  const rootFolder = zip.folder('EnterprisePortal_AspNetMvc');

  if (!rootFolder) {
    throw new Error('Failed to create zip root folder');
  }

  // Populate all files
  for (const file of ASPNET_PROJECT_FILES) {
    rootFolder.file(file.path, file.content);
  }

  // Generate ZIP blob
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  // Trigger browser download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `EnterprisePortal_AspNetMvc_Solution_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
