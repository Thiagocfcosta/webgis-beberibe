'use client';

import { useState, useEffect } from 'react';
import { Layers, ChevronRight, Map as MapIcon, Database, ChevronDown, Moon, Sun, Globe, Info, Palette, GripVertical } from 'lucide-react';

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

const hslToHex = (h, s, l) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export default function LayerControl({ activeLayers, setActiveLayers, basemapStyle, setBasemapStyle, geoData, symbologyConfig, setSymbologyConfig }) {
  const [layers, setLayers] = useState([]);
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSettings, setExpandedSettings] = useState(null);
  const [draggedLayer, setDraggedLayer] = useState(null);
  
  // Controle de expansão das categorias
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    async function fetchLayers() {
      try {
        const res = await fetch('/api/layers');
        const data = await res.json();
        setLayers(data);
        
        // Inicializa todas as categorias como expandidas por padrão
        const cats = {};
        data.forEach(l => {
          if (!cats[l.category]) cats[l.category] = true;
        });
        setExpandedCategories(cats);
        
      } catch (error) {
        console.error('Failed to load layers:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLayers();
  }, []);

  const toggleLayer = (layerId) => {
    setActiveLayers(prev => 
      prev.includes(layerId) 
        ? prev.filter(id => id !== layerId)
        : [layerId, ...prev] // Adiciona no topo das ativas
    );
  };

  const toggleCategory = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  // Agrupar as camadas por categoria
  const groupedLayers = layers.reduce((acc, layer) => {
    const cat = layer.category || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(layer);
    return acc;
  }, {});

  // Função para descobrir as colunas úteis para classificação temática
  const getValidProperties = (layerId) => {
    const data = geoData[layerId];
    if (!data || !data.features || data.features.length === 0) return [];
    
    // 1. Coleta todas as chaves únicas das primeiras 50 feições (amostragem)
    const keys = new Set();
    data.features.slice(0, 50).forEach(f => {
      Object.keys(f.properties || {}).forEach(k => keys.add(k));
    });

    const validProps = [];
    // Regex para identificar campos numéricos identificadores ou espaciais (Metadata)
    const excludeRegex = /^(id|id0|gid|fid|objectid|uuid|shape_area|shape_length|st_area|st_length)$/i;
    
    const maxSamples = 500;
    const step = Math.max(1, Math.floor(data.features.length / maxSamples));

    keys.forEach(prop => {
      if (excludeRegex.test(prop)) return; // Ignora IDs e chaves espaciais

      const uniqueVals = new Set();
      let isNumerical = true;
      
      for (let i = 0; i < data.features.length; i += step) {
        const val = data.features[i].properties[prop];
        if (val !== undefined && val !== null && val !== '') {
          uniqueVals.add(val.toString());
          if (typeof val !== 'number' && isNaN(Number(val))) {
            isNumerical = false;
          }
        }
        
        // Se não for numérico e já tiver mais de 50 classes diferentes, ignora (muito poluído)
        if (!isNumerical && uniqueVals.size > 50) break;
      }

      // Se todos os valores amostrados forem iguais, ignora
      if (uniqueVals.size <= 1) return;
      
      // Se for textual e tiver muita variação, ignora
      if (!isNumerical && uniqueVals.size > 50) return;

      validProps.push(prop);
    });

    return validProps.sort();
  };

  // Função para aplicar a classificação temática (Categórica ou Numérica)
  const applyClassification = (layerId, property) => {
    if (!property) {
      // Remove classificação, mantendo o resto (opacity, lineWidth)
      setSymbologyConfig(prev => {
        const existing = prev[layerId] || {};
        const newConfig = { ...existing };
        delete newConfig.property;
        delete newConfig.palette;
        delete newConfig.classificationType;
        delete newConfig.breaks;
        return { ...prev, [layerId]: newConfig };
      });
      return;
    }

    const data = geoData[layerId];
    if (!data || !data.features) return;

    // Verificar se a propriedade é puramente Numérica
    let isNumerical = true;
    const numValues = [];
    
    data.features.forEach(f => {
      const val = f.properties[property];
      if (val !== undefined && val !== null) {
        if (typeof val !== 'number' && isNaN(Number(val))) {
          isNumerical = false;
        } else {
          numValues.push(Number(val));
        }
      }
    });

    const palette = {};
    let classificationType = 'categorical';
    let breaks = [];

    // Se Numérico e com variância, aplicamos Quebra por Intervalos Iguais (5 classes)
    if (isNumerical && numValues.length > 5) {
      const min = Math.min(...numValues);
      const max = Math.max(...numValues);
      
      if (min !== max) {
        classificationType = 'numerical';
        const stepSize = (max - min) / 5;
        const formatNum = (n) => Number.isInteger(n) ? n.toString() : n.toFixed(2);
        
        // Rampa Verde (Valores Baixos) -> Vermelho (Valores Altos)
        const colors = ['#1a9850', '#a6d96a', '#ffffbf', '#fdae61', '#d73027'];
        
        for (let i = 0; i < 5; i++) {
          const lower = min + (i * stepSize);
          const upper = (i === 4) ? max : min + ((i + 1) * stepSize);
          
          let label = '';
          if (i === 0) label = `<= ${formatNum(upper)}`;
          else if (i === 4) label = `>= ${formatNum(lower)}`;
          else label = `${formatNum(lower)} a ${formatNum(upper)}`;
          
          breaks.push({ label, lower, upper });
          palette[label] = colors[i];
        }
      }
    }
    
    // Fallback para Categórico (Valores únicos)
    if (classificationType === 'categorical') {
      const uniqueValues = new Set();
      data.features.forEach(f => {
        const val = f.properties[property];
        if (val !== undefined && val !== null) {
          uniqueValues.add(val.toString());
        }
      });

      const valuesArr = Array.from(uniqueValues).sort();
      const stepColor = 360 / Math.max(valuesArr.length, 1);
      valuesArr.forEach((val, i) => {
        palette[val] = hslToHex(Math.floor(i * stepColor), 75, 60);
      });
    }

    setSymbologyConfig(prev => ({
      ...prev,
      [layerId]: {
        ...(prev[layerId] || {}),
        property,
        palette,
        classificationType,
        breaks: classificationType === 'numerical' ? breaks : undefined
      }
    }));
  };

  const updateStyle = (layerId, key, value) => {
    setSymbologyConfig(prev => ({
      ...prev,
      [layerId]: {
        ...(prev[layerId] || {}),
        [key]: value
      }
    }));
  };

  const updatePaletteColor = (layerId, propertyValue, newColor) => {
    setSymbologyConfig(prev => {
      const existing = prev[layerId];
      if (!existing || !existing.palette) return prev;
      return {
        ...prev,
        [layerId]: {
          ...existing,
          palette: {
            ...existing.palette,
            [propertyValue]: newColor
          }
        }
      };
    });
  };

  const updateFeatureVisibility = (layerId, propertyValue, isVisible) => {
    setSymbologyConfig(prev => {
      const existing = prev[layerId];
      if (!existing || !existing.palette) return prev;
      return {
        ...prev,
        [layerId]: {
          ...existing,
          featureVisibilities: {
            ...(existing.featureVisibilities || {}),
            [propertyValue]: isVisible
          }
        }
      };
    });
  };

  const updateFillVisibility = (layerId, propertyValue, isFillVisible) => {
    setSymbologyConfig(prev => {
      const existing = prev[layerId];
      if (!existing || !existing.palette) return prev;
      return {
        ...prev,
        [layerId]: {
          ...existing,
          fillVisibilities: {
            ...(existing.fillVisibilities || {}),
            [propertyValue]: isFillVisible
          }
        }
      };
    });
  };

  const updatePalettePattern = (layerId, propertyValue, patternType) => {
    setSymbologyConfig(prev => {
      const existing = prev[layerId];
      if (!existing || !existing.palette) return prev;
      return {
        ...prev,
        [layerId]: {
          ...existing,
          patterns: {
            ...(existing.patterns || {}),
            [propertyValue]: patternType
          }
        }
      };
    });
  };

  const updatePaletteLineStyle = (layerId, propertyValue, lineStyleType) => {
    setSymbologyConfig(prev => {
      const existing = prev[layerId];
      if (!existing || !existing.palette) return prev;
      return {
        ...prev,
        [layerId]: {
          ...existing,
          lineStyles: {
            ...(existing.lineStyles || {}),
            [propertyValue]: lineStyleType
          }
        }
      };
    });
  };

  // Funções de Drag and Drop
  const handleDragStart = (e, layerId) => {
    setDraggedLayer(layerId);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.4';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedLayer(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessário para permitir o drop
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetLayerId) => {
    e.preventDefault();
    if (draggedLayer && draggedLayer !== targetLayerId) {
      const draggedIndex = activeLayers.indexOf(draggedLayer);
      const targetIndex = activeLayers.indexOf(targetLayerId);

      const newLayers = [...activeLayers];
      newLayers.splice(draggedIndex, 1);
      newLayers.splice(targetIndex, 0, draggedLayer);

      setActiveLayers(newLayers);
    }
    e.target.style.opacity = '1';
  };

  return (
    <div className={`absolute top-0 left-0 h-full transition-transform duration-300 ease-in-out z-40 flex ${isOpen ? 'translate-x-0' : '-translate-x-[360px]'}`}>
      {/* Sidebar Content */}
      <div className="w-[360px] h-full glass-panel flex flex-col text-slate-200">
        <div className="p-6 border-b border-white/10 flex items-center gap-3 shrink-0">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
            <MapIcon size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">GeoViewer</h1>
            <p className="text-xs text-slate-400 font-medium">PDOT Beberibe</p>
          </div>
        </div>

        <div className="p-4 border-b border-white/5 bg-black/20 shrink-0">
          <div className="flex items-center justify-between text-sm text-slate-400 font-semibold uppercase tracking-wider mb-3">
            <div className="flex items-center gap-2">
              <Database size={16} />
              Bases Geográficas
            </div>
            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs">
              {layers.length}
            </span>
          </div>

          {/* Basemap Switcher */}
          <div className="flex items-center justify-between gap-1 bg-slate-800/80 p-1 rounded-lg">
            <button 
              onClick={() => setBasemapStyle('dark')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md text-[11px] font-medium transition-colors ${basemapStyle === 'dark' ? 'bg-blue-500 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            >
              <Moon size={12} /> Dark
            </button>
            <button 
              onClick={() => setBasemapStyle('light')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md text-[11px] font-medium transition-colors ${basemapStyle === 'light' ? 'bg-blue-500 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            >
              <Sun size={12} /> Light
            </button>
            <button 
              onClick={() => setBasemapStyle('satellite')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md text-[11px] font-medium transition-colors ${basemapStyle === 'satellite' ? 'bg-blue-500 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            >
              <Globe size={12} /> Cor
            </button>
            <button 
              onClick={() => setBasemapStyle('satellite-bw')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md text-[10px] font-medium transition-colors ${basemapStyle === 'satellite-bw' ? 'bg-blue-500 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
              title="Satélite Preto e Branco Escuro"
            >
              <Globe size={11} className="opacity-50" /> P/B Esc.
            </button>
            <button 
              onClick={() => setBasemapStyle('satellite-bw-light')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md text-[10px] font-medium transition-colors ${basemapStyle === 'satellite-bw-light' ? 'bg-blue-500 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
              title="Satélite Preto e Branco Claro"
            >
              <Globe size={11} className="opacity-90" /> P/B Clr.
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pb-6">
          
          {/* Painel de Camadas Ativas (Drag and Drop) */}
          {activeLayers.length > 0 && (
            <div className="p-3 pb-0 shrink-0">
              <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-2 px-1 flex justify-between items-center">
                <span>Camadas Selecionadas</span>
                <span className="text-[9px] text-slate-500">(Arraste para ordenar)</span>
              </div>
              <div className="space-y-1.5">
                {activeLayers.map((layerId) => {
                  const layer = layers.find(l => l.id === layerId);
                  if (!layer) return null;

                  const layerColor = stringToColor(layer.id);
                  const isPolygon = layer.type.includes('POLYGON');
                  const isLine = layer.type.includes('LINE');
                  const isPoint = layer.type.includes('POINT');

                  return (
                    <div 
                      key={`active-${layer.id}`} 
                      className="flex flex-col bg-slate-800/80 border border-blue-500/20 rounded-lg shadow-sm"
                      draggable
                      onDragStart={(e) => handleDragStart(e, layer.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, layer.id)}
                    >
                      <div className="flex items-center gap-2 p-2">
                        {/* Drag Handle */}
                        <div className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300">
                          <GripVertical size={14} />
                        </div>
                        
                        <div className="flex-1 text-xs font-medium text-white leading-tight">
                          {layer.name}
                        </div>
                        
                        {/* Icone da Geometria */}
                        <div className="flex items-center gap-1.5 opacity-80 shrink-0 mx-1">
                          {isPolygon && <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: layerColor, opacity: 0.6, border: `1px solid ${layerColor}` }}></div>}
                          {isLine && <div className="w-3 h-0.5" style={{ backgroundColor: layerColor }}></div>}
                          {isPoint && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: layerColor, border: '1px solid rgba(255,255,255,0.5)' }}></div>}
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center gap-2 shrink-0">
                          {geoData[layer.id] && (
                            <button
                              onClick={() => setExpandedSettings(expandedSettings === layer.id ? null : layer.id)}
                              className={`transition-colors ${expandedSettings === layer.id || symbologyConfig[layer.id] ? 'text-blue-400' : 'text-slate-500 hover:text-white'}`}
                              title="Estúdio de Estilização"
                            >
                              <Palette size={14} />
                            </button>
                          )}
                          <div className="relative group/tooltip flex items-center cursor-help">
                            <Info size={14} className="text-slate-500 hover:text-blue-400 transition-colors" />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 w-56 p-3 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-[100] pointer-events-none">
                              <p className="text-[10px] text-slate-300 mb-2.5 leading-relaxed font-normal">
                                {layer.metadata?.description || 'Sem descrição.'}
                              </p>
                              <div className="grid grid-cols-2 gap-2.5 text-[9px]">
                                <div>
                                  <span className="text-slate-500 block uppercase tracking-wider font-bold mb-0.5">Fonte</span>
                                  <span className="text-blue-300 font-mono">{layer.metadata?.source || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block uppercase tracking-wider font-bold mb-0.5">Ano</span>
                                  <span className="text-blue-300 font-mono">{layer.metadata?.year || 'N/A'}</span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-slate-500 block uppercase tracking-wider font-bold mb-0.5">Escala / Resolução</span>
                                  <span className="text-blue-300 font-mono">{layer.metadata?.scale || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Botão de Desligar (Remove from activeLayers) */}
                          <button onClick={() => toggleLayer(layer.id)} className="text-slate-500 hover:text-red-400 ml-1" title="Desligar Camada">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Painel de Estúdio de Estilização */}
                      {expandedSettings === layer.id && geoData[layer.id] && (
                        <div className="mx-2 mb-2 p-3 bg-slate-900/80 rounded-lg border border-white/5 shadow-inner flex flex-col gap-3">
                          
                          {/* Estilos Globais */}
                          <div className="space-y-3 border-b border-white/10 pb-4">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Estilo Global</div>
                            
                            {/* Toggle Preenchimento (Só aparece se NÃO estiver classificado por atributo) */}
                            {layer.type.includes('POLYGON') && !symbologyConfig[layer.id]?.property && (
                              <div className="flex items-center justify-between text-xs text-slate-300">
                                <span className="w-28">Preenchimento</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={symbologyConfig[layer.id]?.showFill !== false}
                                    onChange={(e) => updateStyle(layer.id, 'showFill', e.target.checked)}
                                  />
                                  <div className="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-xs text-slate-300">
                              <span className="w-28">Transparência</span>
                              <input 
                                type="range" 
                                min="0.1" max="1" step="0.1" 
                                value={symbologyConfig[layer.id]?.opacity ?? (layer.type.includes('POLYGON') ? 0.6 : 1)}
                                onChange={(e) => updateStyle(layer.id, 'opacity', parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-300">
                              <span className="w-24">Bordas / Linha</span>
                              <input 
                                type="range" 
                                min="0" max="5" step="0.5" 
                                value={symbologyConfig[layer.id]?.lineWidth ?? (layer.type.includes('LINE') ? 2 : 1)}
                                onChange={(e) => updateStyle(layer.id, 'lineWidth', parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                            
                            {!symbologyConfig[layer.id]?.property && (
                              <div className="flex items-center justify-between text-xs text-slate-300">
                                <span className="w-28">Cor Principal</span>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="color" 
                                    value={symbologyConfig[layer.id]?.baseColor || layerColor}
                                    onChange={(e) => updateStyle(layer.id, 'baseColor', e.target.value)}
                                    className="w-6 h-6 rounded bg-transparent border-none cursor-pointer p-0"
                                    title="Alterar Cor"
                                  />
                                  {layer.type.includes('POLYGON') && (
                                    <select 
                                      className="w-10 h-4 text-[9px] bg-slate-800 border border-slate-600 text-slate-300 rounded outline-none cursor-pointer px-0.5 appearance-none text-center"
                                      title="Estilo do Preenchimento Global"
                                      value={symbologyConfig[layer.id]?.basePattern || 'solid'}
                                      onChange={(e) => updateStyle(layer.id, 'basePattern', e.target.value)}
                                    >
                                      <option value="solid">■</option>
                                      <option value="diagonal">▨</option>
                                      <option value="cross">▦</option>
                                      <option value="dots">▤</option>
                                    </select>
                                  )}
                                  {layer.type.includes('LINE') && !layer.type.includes('POLYGON') && (
                                    <select 
                                      className="w-10 h-4 text-[9px] bg-slate-800 border border-slate-600 text-slate-300 rounded outline-none cursor-pointer px-0.5 appearance-none text-center"
                                      title="Estilo de Linha Global"
                                      value={symbologyConfig[layer.id]?.baseLineStyle || 'solid'}
                                      onChange={(e) => updateStyle(layer.id, 'baseLineStyle', e.target.value)}
                                    >
                                      <option value="solid">―</option>
                                      <option value="dashed">- -</option>
                                      <option value="dotted">. .</option>
                                      <option value="dashdot">- .</option>
                                    </select>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Estilização Temática (Classificada) */}
                          <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Classificar por Atributo</div>
                            <select 
                              className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded px-2 py-1.5 mb-2 outline-none focus:border-blue-500"
                              value={symbologyConfig[layer.id]?.property || ''}
                              onChange={(e) => applyClassification(layer.id, e.target.value)}
                            >
                              <option value="">-- Cor única (Padrão) --</option>
                              {getValidProperties(layer.id).map(key => (
                                <option key={key} value={key}>{key}</option>
                              ))}
                            </select>

                            {symbologyConfig[layer.id]?.property && (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1 mt-2 bg-slate-800/30 p-1.5 rounded">
                                {Object.entries(symbologyConfig[layer.id].palette).map(([val, color]) => {
                                  const isVisible = symbologyConfig[layer.id].featureVisibilities?.[val] !== false;
                                  const isFillVisible = symbologyConfig[layer.id].fillVisibilities?.[val] !== false;
                                  return (
                                  <div key={val} className="flex items-center gap-2 text-[10px]">
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <input 
                                        type="checkbox" 
                                        checked={isVisible}
                                        onChange={(e) => updateFeatureVisibility(layer.id, val, e.target.checked)}
                                        className="w-3 h-3 rounded bg-slate-800 border-slate-600 accent-blue-500 cursor-pointer"
                                        title="Exibir/Ocultar Feição do Mapa"
                                      />
                                      <input 
                                        type="color"
                                        value={color}
                                        onChange={(e) => updatePaletteColor(layer.id, val, e.target.value)}
                                        className={`w-4 h-4 rounded cursor-pointer border border-slate-600 p-0 transition-opacity ${!isVisible ? 'opacity-30' : ''}`}
                                        style={{ backgroundColor: color }}
                                        title="Alterar Cor"
                                      />
                                      {layer.type.includes('POLYGON') && (
                                        <select 
                                          className={`w-10 h-4 text-[9px] bg-slate-800 border border-slate-600 text-slate-300 rounded outline-none cursor-pointer px-0.5 appearance-none text-center transition-opacity ${!isVisible ? 'opacity-30' : ''}`}
                                          title="Estilo do Preenchimento"
                                          value={symbologyConfig[layer.id].patterns?.[val] || 'solid'}
                                          onChange={(e) => updatePalettePattern(layer.id, val, e.target.value)}
                                        >
                                          <option value="solid">■</option>
                                          <option value="diagonal">▨</option>
                                          <option value="cross">▦</option>
                                          <option value="dots">▤</option>
                                        </select>
                                      )}
                                      {layer.type.includes('LINE') && !layer.type.includes('POLYGON') && (
                                        <select 
                                          className={`w-10 h-4 text-[9px] bg-slate-800 border border-slate-600 text-slate-300 rounded outline-none cursor-pointer px-0.5 appearance-none text-center transition-opacity ${!isVisible ? 'opacity-30' : ''}`}
                                          title="Estilo de Linha"
                                          value={symbologyConfig[layer.id].lineStyles?.[val] || 'solid'}
                                          onChange={(e) => updatePaletteLineStyle(layer.id, val, e.target.value)}
                                        >
                                          <option value="solid">―</option>
                                          <option value="dashed">- -</option>
                                          <option value="dotted">. .</option>
                                          <option value="dashdot">- .</option>
                                        </select>
                                      )}
                                    </div>
                                    <span className={`text-slate-300 truncate flex-1 transition-opacity ${!isVisible ? 'opacity-50 line-through' : ''}`} title={val}>{val}</span>
                                    
                                    {/* Toggle Preenchimento Individual */}
                                    {layer.type.includes('POLYGON') && (
                                      <label className={`relative inline-flex items-center cursor-pointer ml-1 shrink-0 transition-opacity ${!isVisible ? 'opacity-30 pointer-events-none' : ''}`} title="Ligar/Desligar Preenchimento">
                                        <input 
                                          type="checkbox" 
                                          className="sr-only peer"
                                          checked={isFillVisible}
                                          onChange={(e) => updateFillVisibility(layer.id, val, e.target.checked)}
                                        />
                                        <div className="w-5 h-3 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-blue-500"></div>
                                      </label>
                                    )}
                                  </div>
                                )})}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Catálogo de Camadas (Biblioteca) */}
          {isLoading ? (
            <div className="text-sm text-slate-400 animate-pulse text-center mt-10">
              Carregando catálogo com IA...
            </div>
          ) : layers.length === 0 ? (
            <div className="text-sm text-slate-400 text-center mt-10">
              Nenhuma camada encontrada.
            </div>
          ) : (
            <div className="p-3 space-y-4 mt-2">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-1">Biblioteca de Dados</div>
              {Object.entries(groupedLayers).sort().map(([categoryName, catLayers]) => {
                const isExpanded = expandedCategories[categoryName];
                const activeCount = catLayers.filter(l => activeLayers.includes(l.id)).length;
                
                return (
                  <div key={categoryName} className="border border-white/5 bg-white/5 rounded-xl overflow-hidden">
                    <button 
                      onClick={() => toggleCategory(categoryName)}
                      className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-700/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown size={16} className="text-blue-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                        <span className="font-medium text-sm text-white">{categoryName}</span>
                      </div>
                      {activeCount > 0 && (
                        <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                          {activeCount}
                        </span>
                      )}
                    </button>
                    
                    <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                      <div className="p-2 space-y-1">
                        {catLayers.map(layer => {
                          const isActive = activeLayers.includes(layer.id);
                          return (
                            <label 
                              key={`catalog-${layer.id}`}
                              className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200 border ${isActive ? 'bg-blue-500/10 border-blue-500/30 opacity-60' : 'border-transparent hover:bg-white/10'}`}
                            >
                              <div className="relative flex items-center justify-center mt-0.5">
                                <input 
                                  type="checkbox" 
                                  className="peer sr-only"
                                  checked={isActive}
                                  onChange={() => toggleLayer(layer.id)}
                                />
                                <div className="w-4 h-4 rounded border border-slate-500 bg-slate-800/50 peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-colors flex items-center justify-center">
                                  <svg className={`w-3 h-3 text-white transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                              <div className="flex-1 text-xs font-medium leading-tight select-none pt-0.5">
                                <span className={isActive ? 'text-blue-200' : 'text-slate-300'}>{layer.name}</span>
                              </div>
                              <div className="relative group/tooltip flex items-center cursor-help shrink-0 pt-0.5" onClick={(e) => e.preventDefault()}>
                                <Info size={14} className="text-slate-500 hover:text-blue-400 transition-colors" />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 w-56 p-3 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-[100] pointer-events-none">
                                  <p className="text-[10px] text-slate-300 mb-2.5 leading-relaxed font-normal whitespace-normal">
                                    {layer.metadata?.description || 'Sem descrição.'}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2.5 text-[9px] whitespace-normal">
                                    <div>
                                      <span className="text-slate-500 block uppercase tracking-wider font-bold mb-0.5">Fonte</span>
                                      <span className="text-white font-medium break-words block">{layer.metadata?.source || 'Desconhecido'}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500 block uppercase tracking-wider font-bold mb-0.5">Ano/Escala</span>
                                      <span className="text-white font-medium break-words block">{layer.metadata?.year} • {layer.metadata?.scale}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-center items-center">
          <span className="text-xs font-semibold text-slate-500 tracking-wide">
            Powered by <a href="https://espacoeplano.com.br" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-blue-400 transition-colors">Espaço e Plano</a>
          </span>
        </div>
      </div>

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-6 -right-12 w-12 h-12 bg-slate-800/90 backdrop-blur border border-white/10 border-l-0 rounded-r-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/90 transition-colors shadow-xl"
        title="Alternar Painel"
      >
        <Layers size={20} className={`transition-transform duration-300 ${isOpen ? '' : 'scale-110 text-blue-400'}`} />
      </button>
    </div>
  );
}
