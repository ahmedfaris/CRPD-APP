import fs from 'fs';

const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('departmentRoutes')) {
  content = content.replace(
    "import roleRoutes from './src/server/routes/roleRoutes.ts';",
    "import roleRoutes from './src/server/routes/roleRoutes.ts';\nimport departmentRoutes from './src/server/routes/departmentRoutes.ts';"
  );
  
  content = content.replace(
    'app.use("/api/roles", roleRoutes);',
    'app.use("/api/roles", roleRoutes);\n  app.use("/api/departments", departmentRoutes);'
  );
  
  fs.writeFileSync(file, content);
}
