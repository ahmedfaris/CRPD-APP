import fs from 'fs';

const file = 'src/components/OrgStructureApp.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace alerts with setErrorMsg
content = content.replace(/alert\(res\.error \|\| 'Failed to save'\);/g, "setErrorMsg(res.error || 'Failed to save');");
content = content.replace(/alert\(res\.error \|\| 'Failed to create organization'\);/g, "setErrorMsg(res.error || 'Failed to create organization');");
content = content.replace(/alert\(res\.error \|\| 'Failed to delete'\);/g, "setErrorMsg(res.error || 'Failed to delete');");

// Add a simple error banner right below the Main Content header
const errorBannerJSX = `
        {errorMsg && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-center justify-between">
            <div className="flex items-center text-red-600 dark:text-red-400 text-sm">
              <svg className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {errorMsg}
            </div>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
`;

content = content.replace(
  /<div className="flex items-center justify-between mb-6">/g,
  `${errorBannerJSX}\n          <div className="flex items-center justify-between mb-6">`
);

fs.writeFileSync(file, content);
