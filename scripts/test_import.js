const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const dataDir = 'D:\\Espaço e Plano\\PDOT\\Beberibe\\01_Bases_Geograficas';

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else if (filePath.endsWith('.shp')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function importShapefile(shpPath, tableName) {
  return new Promise((resolve, reject) => {
    
    // Check .cpg for encoding
    const cpgFile = shpPath.replace('.shp', '.cpg');
    let encoding = 'UTF-8';
    if (fs.existsSync(cpgFile)) {
       const cpgContent = fs.readFileSync(cpgFile, 'utf8').trim();
       if (cpgContent.toUpperCase().includes('1252') || cpgContent.toUpperCase().includes('LATIN1')) {
           encoding = 'LATIN1';
       }
    }

    const shp = spawn('C:\\Program Files\\PostgreSQL\\18\\bin\\shp2pgsql.exe', [
      '-s', '4326', '-d', '-I', '-W', encoding, shpPath, `public.${tableName}`
    ]);

    const psql = spawn('C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe', [
      '-U', 'postgres', '-d', 'beberibe', '-q'
    ], {
      env: { ...process.env, PGPASSWORD: '1234', PGCLIENTENCODING: 'UTF8' }
    });

    shp.stdout.pipe(psql.stdin);

    let errorOutput = '';
    psql.stderr.on('data', data => {
      errorOutput += data.toString();
    });

    psql.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`PSQL exited with code ${code}. Error: ${errorOutput}`));
    });
  });
}

async function run() {
  const shpFiles = getFiles(dataDir);
  console.log(`Encontrados ${shpFiles.length} shapefiles para reimportação...`);
  
  for (const shp of shpFiles) {
    const baseName = path.basename(shp, '.shp');
    let cleanLayer = baseName.toLowerCase()
      .replace(/[áàãâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòõôö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
      
    if (cleanLayer.length > 60) cleanLayer = cleanLayer.substring(0, 60);

    console.log(`Importando: ${cleanLayer}...`);
    try {
      await importShapefile(shp, cleanLayer);
    } catch (err) {
      console.error(`Erro ao importar ${cleanLayer}:`, err.message);
    }
  }
  
  console.log('Reimportação concluída em lote!');
}

run();
