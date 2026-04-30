const fs = require('fs');
const path = require('path');

const rootDir = 'D:\\Espaço e Plano\\PDOT\\Beberibe';
const categoriesPath = 'C:\\Users\\Thiago\\.gemini\\antigravity\\scratch\\webgis_beberibe\\categories.json';

const folders = {
  geo: path.join(rootDir, '01_Bases_Geograficas'),
  admin: path.join(rootDir, '02_Administrativo_e_Contratos'),
  qgis: path.join(rootDir, '03_Projetos_QGIS'),
  reports: path.join(rootDir, '04_Relatorios_e_Entregas'),
  backups: path.join(rootDir, '05_Backups_e_Outros')
};

// Ler categorias geradas pela IA
let categories = {};
try {
  categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
} catch (e) {
  console.error("Erro ao ler categories.json", e);
}

// Criar estrutura de pastas
Object.values(folders).forEach(f => {
  if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true });
});

// Extensões de um shapefile
const shpExtensions = ['.shp', '.shx', '.dbf', '.prj', '.cpg', '.qpj', '.sbn', '.sbx'];

// Função para buscar arquivos recursivamente ignorando pastas de destino
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    // Ignorar pastas destino para não entrar em loop ou mover o que já foi movido
    if (Object.values(folders).includes(filePath)) continue;
    
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = getFiles(rootDir);
let movedCount = 0;

allFiles.forEach(file => {
  const ext = path.extname(file).toLowerCase();
  const baseName = path.basename(file, ext);
  const fileName = path.basename(file);
  const lowerFileName = fileName.toLowerCase();
  
  let targetDir = null;

  // Lógica de distribuição
  if (shpExtensions.includes(ext)) {
    // Normalizar o nome para bater com o categories.json
    let normName = baseName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    let category = categories[normName] || 'Outros_Shapefiles';
    
    // Se não encontrou exato, tenta procurar se a chave da categoria contém o nome base
    if (category === 'Outros_Shapefiles') {
      const match = Object.keys(categories).find(k => k.includes(normName) || normName.includes(k));
      if (match) category = categories[match];
    }
    
    targetDir = path.join(folders.geo, category);
  } else if (ext === '.qgz' || ext === '.qgs') {
    targetDir = folders.qgis;
  } else if (lowerFileName.includes('contrato')) {
    targetDir = folders.admin;
  } else if (lowerFileName.includes('diagnóstico') || lowerFileName.includes('diagnostico') || lowerFileName.includes('plano de trabalho')) {
    targetDir = folders.reports;
  } else if (ext === '.zip') {
    targetDir = folders.backups;
  }
  
  // Mover arquivo se tiver destino e ainda não estiver nele
  if (targetDir) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const destPath = path.join(targetDir, fileName);
    if (file !== destPath && !fs.existsSync(destPath)) {
      try {
        fs.renameSync(file, destPath);
        movedCount++;
        console.log(`Movido: ${fileName} -> ${path.basename(targetDir)}`);
      } catch (e) {
        console.log(`Erro ao mover ${fileName}: ${e.message}`);
      }
    }
  }
});

console.log(`\nOrganização concluída! ${movedCount} arquivos foram categorizados e movidos.`);
