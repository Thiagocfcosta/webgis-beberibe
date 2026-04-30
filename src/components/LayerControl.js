'use client';

import { useState, useEffect } from 'react';
import { Layers, ChevronRight, Map as MapIcon, Database, ChevronDown, Moon, Sun, Globe, Info, Palette, GripVertical, Scissors, Save, X, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

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

export default function LayerControl({ activeLayers, setActiveLayers, basemapStyle, setBasemapStyle, geoData, setGeoData, symbologyConfig, setSymbologyConfig, clippedLayers, setClippedLayers, clearMap, showToast }) {
  const [layers, setLayers] = useState([]);
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSettings, setExpandedSettings] = useState(null);
  const [draggedLayer, setDraggedLayer] = useState(null);
  
  // -- NOVOS ESTADOS PARA ESTILOS SALVOS --
  const { data: session } = useSession();
  const [savedStyles, setSavedStyles] = useState([]);
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState('');

  // Busca estilos ao montar
  useEffect(() => {
    if (session) {
      fetch('/api/styles')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setSavedStyles(data);
        })
        .catch(console.error);
    }
  }, [session]);

  const handleSaveStyle = async (layerId) => {
    if (!newStyleName.trim()) return;
    const currentStyle = symbologyConfig[layerId] || {};
    
    try {
      const res = await fetch('/api/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStyleName, style_json: currentStyle })
      });
      if (res.ok) {
        setNewStyleName('');
        setIsSavingStyle(false);
        // Atualiza a lista
        const stylesRes = await fetch('/api/styles');
        const stylesData = await stylesRes.json();
        setSavedStyles(stylesData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteStyle = async () => {
    if (!selectedStyleId) return;
    if (!confirm('Deseja excluir permanentemente este estilo salvo?')) return;
    try {
      const res = await fetch(`/api/styles/${selectedStyleId}`, { method: 'DELETE' });
      if (res.ok) {
        const stylesRes = await fetch('/api/styles');
        const stylesData = await stylesRes.json();
        setSavedStyles(stylesData);
        setSelectedStyleId('');
        if (showToast) showToast('Estilo excluído.');
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir estilo.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const applyStylePreset = (layerId, styleJson) => {
    // Mescla o estilo salvo no estado atual da camada, forçando re-render
    setSymbologyConfig(prev => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        ...styleJson
      }
    }));
  };
  
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
    setActiveLayers(prev => prev.filter(id => id !== layerId)); // Apenas remove
  };

  const addLayerFromCatalog = (baseLayerId) => {
    setActiveLayers(prev => {
      // Verifica se a camada original (ou alguma cópia) já está ativa
      const activeInstances = prev.filter(id => id === baseLayerId || id.startsWith(`${baseLayerId}__copy_`));
      
      let newLayerId = baseLayerId;
      
      // Se já houver instâncias ativas, cria como cópia
      if (activeInstances.length > 0) {
        newLayerId = `${baseLayerId}__copy_${Date.now()}`;
        
        // Tenta clonar a simbologia da primeira instância ativa encontrada
        const templateId = activeInstances[0];
        if (symbologyConfig[templateId]) {
          setSymbologyConfig(s => ({
            ...s,
            [newLayerId]: JSON.parse(JSON.stringify(s[templateId]))
          }));
        }
      }
      
      return [newLayerId, ...prev]; // Adiciona no topo
    });
  };

  const duplicateLayer = (layerId) => {
    const baseLayerId = layerId.split('__')[0];
    const newLayerId = `${baseLayerId}__copy_${Date.now()}`;
    
    // Clona a configuração de simbologia atual para a nova camada
    if (symbologyConfig[layerId]) {
      setSymbologyConfig(prev => ({
        ...prev,
        [newLayerId]: JSON.parse(JSON.stringify(prev[layerId]))
      }));
    }

    setActiveLayers(prev => {
      const currentIndex = prev.indexOf(layerId);
      const newLayers = [...prev];
      // Insere logo acima da camada original
      newLayers.splice(currentIndex, 0, newLayerId);
      return newLayers;
    });
  };

  const toggleClipLayer = (layerId) => {
    setClippedLayers(prev => ({
      ...prev,
      [layerId]: !prev[layerId]
    }));
    // Limpa os dados em cache para forçar a API a buscar a versão nova (cortada ou inteira)
    setGeoData(prev => {
      const next = { ...prev };
      delete next[layerId];
      return next;
    });
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

  const updateClassLabel = (layerId, propertyValue, newLabel) => {
    setSymbologyConfig(prev => {
      const existing = prev[layerId];
      if (!existing || !existing.palette) return prev;
      return {
        ...prev,
        [layerId]: {
          ...existing,
          classLabels: {
            ...(existing.classLabels || {}),
            [propertyValue]: newLabel
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

  const updateLabelConfig = (layerId, key, value) => {
    setSymbologyConfig(prev => {
      const existing = prev[layerId] || {};
      return {
        ...prev,
        [layerId]: {
          ...existing,
          [key]: value
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
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500 hidden md:inline">(Arraste para ordenar)</span>
                  <button 
                    onClick={clearMap} 
                    className="flex items-center gap-1 text-[9px] bg-red-600/20 text-red-400 hover:bg-red-500/30 px-1.5 py-0.5 rounded transition-colors"
                    title="Limpar todas as camadas"
                  >
                    <X size={10} /> Limpar Mapa
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {activeLayers.map((layerId) => {
                  const baseLayerId = layerId.split('__')[0];
                  const baseLayer = layers.find(l => l.id === baseLayerId);
                  if (!baseLayer) return null;

                  // Criar uma camada virtual para a interface
                  const layer = { ...baseLayer, id: layerId };
                  const isCopy = layerId.includes('__copy_');
                  const layerName = isCopy ? `${layer.name} (Cópia)` : layer.name;

                  const layerColor = stringToColor(baseLayerId);
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
                        
                        <div className="flex-1 text-xs font-medium text-white leading-tight truncate">
                          {layerName}
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
                              onClick={() => toggleClipLayer(layer.id)}
                              className={`transition-colors ${clippedLayers[layer.id] ? 'text-blue-400' : 'text-slate-500 hover:text-white'}`}
                              title={clippedLayers[layer.id] ? "Dado recortado (Beberibe). Clique para ver completo." : "Dado completo. Clique para recortar (Beberibe)."}
                            >
                              <Scissors size={14} />
                            </button>
                          )}
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
                          
                          {/* Botão Duplicar */}
                          <button onClick={() => duplicateLayer(layer.id)} className="text-slate-500 hover:text-blue-400 ml-1 transition-colors" title="Duplicar Camada (Nova visualização)">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                          </button>

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
                        <div className="mx-2 mb-2 p-3 bg-slate-900/80 rounded-lg border border-white/5 shadow-inner flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                          
                          {/* PRESETS DE ESTILO GLOBAL */}
                          <div className="space-y-3 border-b border-white/10 pb-4">
                            <div className="flex justify-between items-center">
                              <div className="text-[10px] text-blue-400 uppercase tracking-wider font-bold">Meus Estilos</div>
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => {
                                    setSymbologyConfig(prev => {
                                      const next = {...prev};
                                      delete next[layer.id];
                                      return next;
                                    });
                                    if (showToast) showToast('Estilo revertido para o padrão.');
                                  }}
                                  className="text-[9px] text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded transition-colors"
                                  title="Remover estilo customizado desta camada"
                                >
                                  Limpar Estilo
                                </button>
                                {session && (
                                  <button 
                                    onClick={() => setIsSavingStyle(!isSavingStyle)}
                                    className="text-[9px] text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                  >
                                    {isSavingStyle ? <X size={10} /> : <Save size={10} />}
                                    {isSavingStyle ? 'Cancelar' : 'Salvar Estilo'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {isSavingStyle && (
                              <div className="flex gap-2 items-center mb-2 animate-in fade-in slide-in-from-top-1">
                                <input 
                                  type="text" 
                                  value={newStyleName}
                                  onChange={e => setNewStyleName(e.target.value)}
                                  placeholder="Nome do estilo..."
                                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                />
                                <button 
                                  onClick={() => handleSaveStyle(layer.id)}
                                  className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs transition-colors"
                                >Salvar</button>
                              </div>
                            )}

                            {session ? (
                              <div className="flex gap-1 items-center">
                                <select
                                  value={selectedStyleId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedStyleId(val);
                                    if (!val) return;
                                    const selected = savedStyles.find(s => s.id === parseInt(val));
                                    if (selected) applyStylePreset(layer.id, selected.style_json);
                                  }}
                                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 outline-none focus:border-blue-500 cursor-pointer"
                                >
                                  <option value="">-- Carregar Estilo Salvo --</option>
                                  {savedStyles.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                                {selectedStyleId && (
                                  <button 
                                    onClick={handleDeleteStyle}
                                    className="p-1.5 bg-red-600/20 text-red-400 hover:bg-red-500/40 rounded transition-colors"
                                    title="Excluir estilo salvo permanentemente"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 italic bg-slate-800/30 p-2 rounded text-center">Faça login para salvar e carregar estilos padronizados.</div>
                            )}
                          </div>

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

                          {/* Estilização de Rótulos (Labels) */}
                          <div className="space-y-3 border-b border-white/10 pb-4">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                              <span>Rótulos (Textos no Mapa)</span>
                              <label className="relative inline-flex items-center cursor-pointer" title="Ligar/Desligar Rótulos">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={symbologyConfig[layer.id]?.labelsEnabled || false}
                                  onChange={(e) => updateLabelConfig(layer.id, 'labelsEnabled', e.target.checked)}
                                />
                                <div className="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                              </label>
                            </div>
                            
                            {symbologyConfig[layer.id]?.labelsEnabled && (
                              <div className="bg-slate-800/30 p-2 rounded flex flex-col gap-2">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] text-slate-500 font-bold uppercase">Propriedade do Texto</span>
                                  <select 
                                    className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded px-2 py-1 outline-none focus:border-blue-500"
                                    value={symbologyConfig[layer.id]?.labelProperty || ''}
                                    onChange={(e) => updateLabelConfig(layer.id, 'labelProperty', e.target.value)}
                                  >
                                    <option value="">-- Selecione uma coluna --</option>
                                    {getValidProperties(layer.id).map(key => (
                                      <option key={`lbl-${key}`} value={key}>{key}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-300 mt-1">
                                  <span className="w-24">Tamanho</span>
                                  <input 
                                    type="range" 
                                    min="8" max="32" step="1" 
                                    value={symbologyConfig[layer.id]?.labelSize || 12}
                                    onChange={(e) => updateLabelConfig(layer.id, 'labelSize', parseInt(e.target.value))}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                  />
                                  <span className="text-[10px] ml-2 w-4 text-right">{symbologyConfig[layer.id]?.labelSize || 12}</span>
                                </div>

                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-slate-300">Cor do Texto</span>
                                  <input 
                                    type="color" 
                                    value={symbologyConfig[layer.id]?.labelColor || '#FFFFFF'}
                                    onChange={(e) => updateLabelConfig(layer.id, 'labelColor', e.target.value)}
                                    className="w-6 h-6 rounded bg-transparent border-none cursor-pointer p-0"
                                  />
                                </div>

                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-300">Cor do Contorno (Halo)</span>
                                  <input 
                                    type="color" 
                                    value={symbologyConfig[layer.id]?.labelHaloColor || '#000000'}
                                    onChange={(e) => updateLabelConfig(layer.id, 'labelHaloColor', e.target.value)}
                                    className="w-6 h-6 rounded bg-transparent border-none cursor-pointer p-0"
                                  />
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
                                    <input 
                                      type="text"
                                      className={`bg-transparent text-slate-300 text-[10px] flex-1 outline-none border-b border-transparent hover:border-slate-600 focus:border-blue-500 transition-all min-w-0 ${!isVisible ? 'opacity-50 line-through' : ''}`}
                                      value={symbologyConfig[layer.id].classLabels?.[val] !== undefined ? symbologyConfig[layer.id].classLabels[val] : val}
                                      onChange={(e) => updateClassLabel(layer.id, val, e.target.value)}
                                      title="Editar Rótulo na Legenda"
                                    />
                                    
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

                          {/* Configurações da Legenda do PDF */}
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                              <span>Convenções Cartográficas (PDF)</span>
                              <label className="relative inline-flex items-center cursor-pointer" title="Ligar/Desligar Camada na Legenda do PDF">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={symbologyConfig[layer.id]?.showInLegend !== false}
                                  onChange={(e) => updateLabelConfig(layer.id, 'showInLegend', e.target.checked)}
                                />
                                <div className="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                              </label>
                            </div>
                            
                            <div className={`transition-opacity ${symbologyConfig[layer.id]?.showInLegend === false ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Título na Legenda</span>
                                <input 
                                  type="text" 
                                  className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-blue-500 placeholder-slate-500"
                                  placeholder={layerName}
                                  value={symbologyConfig[layer.id]?.legendTitle || ''}
                                  onChange={(e) => updateLabelConfig(layer.id, 'legendTitle', e.target.value)}
                                />
                              </div>
                            </div>
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
                // Conta quantas instâncias das camadas desta categoria estão ativas
                const activeCount = catLayers.reduce((sum, layer) => {
                  return sum + activeLayers.filter(id => id === layer.id || id.startsWith(`${layer.id}__copy_`)).length;
                }, 0);
                
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
                          const instancesCount = activeLayers.filter(id => id === layer.id || id.startsWith(`${layer.id}__copy_`)).length;
                          const isActive = instancesCount > 0;
                          
                          return (
                            <button 
                              key={`catalog-${layer.id}`}
                              onClick={() => addLayerFromCatalog(layer.id)}
                              className={`w-full flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200 border text-left group hover:bg-slate-700/50 ${isActive ? 'bg-blue-500/5 border-blue-500/20' : 'border-transparent'}`}
                              title="Clique para adicionar ao mapa"
                            >
                              <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                                <div className="w-5 h-5 rounded-md border border-slate-600 bg-slate-800 flex items-center justify-center group-hover:border-blue-400 group-hover:bg-blue-500/20 transition-all">
                                  <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                  </svg>
                                </div>
                                {instancesCount > 0 && (
                                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white border border-slate-900 shadow-sm">
                                    {instancesCount}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 text-xs font-medium leading-tight pt-0.5">
                                <span className={isActive ? 'text-blue-300' : 'text-slate-300'}>{layer.name}</span>
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
                            </button>
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
