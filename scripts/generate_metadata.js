const fs = require('fs');

const categories = require('../categories.json');
const layers = Object.keys(categories);

const metadata = {};

layers.forEach(layer => {
  const name = layer.toLowerCase();
  const category = categories[layer];
  
  let source = "IBGE / IPECE";
  let year = "2023";
  let scale = "Escala Municipal";
  let desc = "Base cartográfica municipal com delimitações oficiais.";

  if (name.includes('zeec')) {
    source = "SEMACE / LABOMAR";
    year = "2021";
    scale = name.includes('10_000') ? "1:10.000" : "1:25.000";
    desc = "Zoneamento Ecológico-Econômico Costeiro (ZEEC). Instrumental essencial para a gestão do uso e ocupação da planície litorânea.";
  } else if (name.includes('quilombo')) {
    source = "INCRA / SAB";
    year = "2022";
    desc = "Áreas de territórios quilombolas oficialmente delimitadas pelo INCRA.";
  } else if (name.includes('indigena')) {
    source = "FUNAI";
    year = "2022";
    desc = "Terras indígenas homologadas ou em processo de delimitação.";
  } else if (name.includes('curva')) {
    source = "IPECE / SRTM (NASA)";
    year = "2010";
    scale = "40 metros";
    desc = "Modelo Digital de Elevação e curvas de nível extraídas de radar orbital (SRTM).";
  } else if (name.includes('acude') || name.includes('bacia') || name.includes('corpo') || name.includes('drenagem') || name.includes('canal') || name.includes('transposicao') || name.includes('cinturao')) {
    source = "FUNCEME / SRH";
    desc = "Mapeamento das feições hidrográficas, espelhos d'água e infraestrutura hídrica do estado.";
  } else if (name.includes('geologia') || name.includes('geomorfologia') || name.includes('solo')) {
    source = "CPRM / IBGE";
    desc = "Mapeamento das estruturas e formações geológicas, classes de solos e relevo terrestre.";
  } else if (name.includes('mata') || name.includes('fitoecologica') || name.includes('vegetacao')) {
    source = "FUNCEME / MMA";
    desc = "Classificação da cobertura vegetal e biomas predominantes (ex: Mata Atlântica).";
  } else if (name.includes('uc_estadual') || name.includes('uc_federal')) {
    source = "ICMBio / SEMA";
    desc = "Unidades de Conservação de proteção integral e uso sustentável (Parques, APAs, Reservas).";
  } else if (name.includes('urbana') || name.includes('sede') || name.includes('localidade')) {
    source = "Prefeitura / IBGE";
    scale = "Alta resolução";
    desc = "Delimitação das áreas densamente urbanizadas, loteamentos e limites de bairros.";
  } else if (name.includes('rodovia')) {
    source = "SOP / DER-CE";
    desc = "Malha rodoviária e vias de acesso pavimentadas e não pavimentadas.";
  } else if (name.includes('limite') || name.includes('setor')) {
    source = "IBGE";
    year = "2022";
    desc = "Limites político-administrativos oficiais e setores censitários urbanos e rurais.";
  }

  metadata[layer] = {
    category: category,
    source: source,
    year: year,
    scale: scale,
    description: desc
  };
});

fs.writeFileSync('../metadata.json', JSON.stringify(metadata, null, 2), 'utf8');
console.log('metadata.json generated successfully!');
