'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Map, { Source, Layer, NavigationControl, Popup, ScaleControl } from 'react-map-gl/maplibre';
import bbox from '@turf/bbox';
import { Table, X, ChevronUp, ChevronDown, Printer, Compass, Download } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSession } from 'next-auth/react';
import LoginModal from './LoginModal';
import { createPattern } from '../utils/patternGenerator';
import PrintLayout from './PrintLayout';

// Generating random colors for different layers
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

export default function MapViewer({ globalMapRef, activeLayers, basemapStyle, geoData, setGeoData, symbologyConfig, clippedLayers, getWorkspaceConfig, mapTitle, setMapTitle, mapDesc, setMapDesc }) {
  // Se recebemos um ref de fora, usamos ele. Senão criamos um fallback.
  const fallbackRef = useRef(null);
  const mapRef = globalMapRef || fallbackRef;
  const [loadingLayers, setLoadingLayers] = useState(new Set());
  const [hoverInfo, setHoverInfo] = useState(null);
  const [activePopupTab, setActivePopupTab] = useState(0);
  const [cursor, setCursor] = useState('grab');
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [isTableAggregated, setIsTableAggregated] = useState(false);

  // Estados para exportação
  const [isExporting, setIsExporting] = useState(false);

  const [printSnapshot, setPrintSnapshot] = useState(null);
  const [printMetadata, setPrintMetadata] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [finalPdfImage, setFinalPdfImage] = useState(null);
  
  const { data: session } = useSession();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handlePrintReady = async () => {
    try {
      const element = document.getElementById('print-layout-container');
      if (!element) throw new Error("Container do layout não encontrado");

      // 1. Gera o Canvas apenas da parte UI (Carimbo, Legenda) - O lado do mapa fica transparente
      const uiCanvas = await htmlToImage.toCanvas(element, { pixelRatio: 1 });
      
      // 2. Cria o Canvas Final mestre
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = 2970;
      finalCanvas.height = 2100;
      const ctx = finalCanvas.getContext('2d');
      
      // 3. Fundo branco para o carimbo, fundo escuro para o mapa
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(finalCanvas.width * 0.78, 0, finalCanvas.width * 0.22, finalCanvas.height);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, finalCanvas.width * 0.78, finalCanvas.height);

      // 4. Desenha a foto nativa do WebGL na parte reservada ao mapa
      if (printSnapshot) {
        const img = new Image();
        img.src = printSnapshot; 
        await new Promise((resolve) => { img.onload = resolve; });
        ctx.drawImage(img, 0, 0, finalCanvas.width * 0.78, finalCanvas.height);
      }

      // 5. Por cima de tudo, colamos a camada do Carimbo e as "réguas" do mapa
      ctx.drawImage(uiCanvas, 0, 0);

      // 6. Transforma o canvas montado numa imagem JPEG
      const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.95);
      
      setFinalPdfImage(dataUrl);
      setShowPrintPreview(true);
    } catch (e) {
      console.error('Erro DETALHADO ao exportar PDF:', e);
      alert('Erro ao gerar o preview do PDF. Verifique o console.');
      setIsExporting(false);
    } 
  };

  // Botão "Download" do Modal de Preview
  const downloadConfirmedPdf = () => {
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(finalPdfImage, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const safeTitle = mapTitle
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase() || 'mapa_webgis';
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, 'h').replace('h', 'm') + 's'; 
      // ou apenas replace(/:/g, '') para ficar HHMMSS
      // Vamos usar HH-MM-SS
      const timeFormatted = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      
      pdf.save(`${safeTitle}_${dateStr}_${timeFormatted}.pdf`);

      // Registra o log da exportação silenciosamente
      if (session && getWorkspaceConfig) {
        try {
          const config = getWorkspaceConfig();
          // Certifique-se de que a API sabe o título que o usuário digitou
          fetch('/api/export-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ map_title: mapTitle, config_json: config })
          }).catch(err => console.error('Erro ao logar exportação:', err));
        } catch (logErr) {
          console.error(logErr);
        }
      }

    } catch (e) {
      console.error(e);
      alert('Erro ao salvar o PDF.');
    } finally {
      setShowPrintPreview(false);
      setFinalPdfImage(null);
      setPrintSnapshot(null);
      setIsExporting(false);
    }
  };

  const cancelPrint = () => {
    setShowPrintPreview(false);
    setFinalPdfImage(null);
    setPrintSnapshot(null);
    setIsExporting(false);
  };

  const exportToPDF = () => {
    if (!session) {
      setIsLoginModalOpen(true);
      return;
    }
    
    if (!mapRef.current) return;
    
    setIsExporting(true);
    
    try {
      const map = mapRef.current.getMap();
      const mapCanvas = map.getCanvas();
      
      // Função para extrair síncronamente no final do frame de renderização
      const doExtract = () => {
        try {
          // 1. Extrai metadados essenciais (bounds para escala, bearing para bússola)
          const bounds = map.getBounds();
          const nw = bounds.getNorthWest();
          const ne = bounds.getNorthEast();
          
          // Haversine para distância entre NW e NE (largura do mapa em KM)
          const R = 6371; // km
          const dLat = (ne.lat - nw.lat) * Math.PI / 180;
          const dLon = (ne.lng - nw.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(nw.lat * Math.PI / 180) * Math.cos(ne.lat * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const widthKm = R * c;

          setPrintMetadata({ widthKm, bearing: map.getBearing() });

          // 2. Garante que o WebGL não seja apagado pegando no milissegundo exato
          const dataUrl = mapCanvas.toDataURL('image/png');
          setPrintSnapshot(dataUrl);
        } catch(e) {
          console.error("Erro na extração nativa:", e);
          setIsExporting(false);
        }
      };

      // Garante que TODOS os tiles, polígonos e dados carregaram (idle)
      map.once('idle', () => {
        // Agora que tudo está na RAM, forçamos um único redesenho e capturamos na mosca!
        map.once('render', doExtract);
        map.triggerRepaint();
      });
      
      // Se ele já estava idle, o evento acima não dispara.
      // Então, damos um triggerRepaint() para chutar o idle.
      map.triggerRepaint();
      
    } catch (error) {
      console.error('Erro ao preparar exportação:', error);
      setIsExporting(false);
    }
  };


  // Definição dos estilos de basemap disponíveis
  const getMapStyle = (style) => {
    switch (style) {
      case 'light':
        return "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
      case 'satellite':
        // Estilo inline compatível com MapLibre para o ESRI World Imagery
        return {
          version: 8,
          sources: {
            'esri-satellite': {
              type: 'raster',
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256
            }
          },
          layers: [{
            id: 'satellite-layer',
            type: 'raster',
            source: 'esri-satellite',
            minzoom: 0,
            maxzoom: 22
          }]
        };
      case 'satellite-bw':
        return {
          version: 8,
          sources: {
            'esri-satellite': {
              type: 'raster',
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256
            }
          },
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: {
                'background-color': '#0f172a' // Fundo escuro
              }
            },
            {
              id: 'satellite-layer-bw',
              type: 'raster',
              source: 'esri-satellite',
              minzoom: 0,
              maxzoom: 22,
              paint: {
                'raster-saturation': -1,
                'raster-opacity': 0.4
              }
            }
          ]
        };
      case 'satellite-bw-light':
        return {
          version: 8,
          sources: {
            'esri-satellite': {
              type: 'raster',
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256
            }
          },
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: {
                'background-color': '#ffffff' // Fundo não interfere na opacidade agora
              }
            },
            {
              id: 'satellite-layer-bw-light',
              type: 'raster',
              source: 'esri-satellite',
              minzoom: 0,
              maxzoom: 22,
              paint: {
                'raster-saturation': -1,     // Preto e branco
                'raster-opacity': 1,         // Opacidade total para preservar todos os detalhes
                'raster-brightness-min': 0.35, // Clareia os tons escuros
                'raster-contrast': 0.15      // Aumenta o contraste para realçar as feições
              }
            }
          ]
        };
      case 'dark':
      default:
        return "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
    }
  };

  // Coordenadas iniciais focadas em Beberibe - CE
  const initialViewState = {
    longitude: -38.1306,
    latitude: -4.1797,
    zoom: 9
  };

  // Fetch GeoJSON for newly activated layers
  useEffect(() => {
    const fetchLayerData = async (layerId) => {
      // Evita re-fetch se já existir
      if (geoData[layerId]) return;

      const baseLayerId = layerId.split('__')[0];
      const isCopy = layerId !== baseLayerId;
      const isClipped = clippedLayers[layerId] === true;

      // OTIMIZAÇÃO DE MEMÓRIA (Proxy Data)
      // Se for uma cópia, a base já existir na memória, e não for um recorte exclusivo da cópia:
      // Simplesmente apontamos para os mesmos dados da RAM em vez de baixar 20MB de novo!
      if (isCopy && geoData[baseLayerId] && !isClipped && !clippedLayers[baseLayerId]) {
        setGeoData(prev => ({ ...prev, [layerId]: prev[baseLayerId] }));
        return;
      }

      setLoadingLayers(prev => new Set(prev).add(layerId));
      try {
        // A API sempre recebe o ID real do banco (baseLayerId)
        const response = await fetch(`/api/geojson/${baseLayerId}?clip=${isClipped}`);
        const data = await response.json();
        // Salva na memória usando o ID da cópia para isolamento de estado
        setGeoData(prev => ({ ...prev, [layerId]: data }));

        // O Auto-zoom automático foi desativado a pedido do usuário,
        // para preservar a visão travada (viewport atual) ao adicionar novas camadas para comparação.
        // O usuário pode usar o botão 'Centralizar Camada' no LayerControl se desejar o zoom.

      } catch (error) {
        console.error(`Erro ao carregar a camada ${layerId}:`, error);
      } finally {
        setLoadingLayers(prev => {
          const next = new Set(prev);
          next.delete(layerId);
          return next;
        });
      }
    };

    activeLayers.forEach(fetchLayerData);
  }, [activeLayers, geoData, clippedLayers, setGeoData]);

  // Efeito para registrar as texturas (padrões) dinâmicas no MapLibre GL
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    activeLayers.forEach(layerId => {
      const sym = symbologyConfig[layerId];
      if (sym) {
        
        // Padrão Global (sem classificação)
        if (!sym.property && sym.basePattern && sym.basePattern !== 'solid') {
          (async () => {
             const color = sym.baseColor || stringToColor(layerId);
             const patternId = `pattern-${layerId}-base`;
             const img = await createPattern(sym.basePattern, color);
             if (map.hasImage(patternId)) map.updateImage(patternId, img);
             else map.addImage(patternId, img);
          })();
        }

        // Padrões por Atributo (Classificados)
        if (sym.property && sym.palette) {
          // Verifica se há pelo menos um padrão nesta camada
          let layerHasPattern = false;
          Object.keys(sym.palette).forEach(val => {
            if (sym.patterns?.[val] && sym.patterns?.[val] !== 'solid') layerHasPattern = true;
          });

          if (layerHasPattern) {
            Object.entries(sym.palette).forEach(async ([val, color]) => {
              const patternType = sym.patterns?.[val] || 'solid';
              const patternId = `pattern-${layerId}-${val}`;
              
              // Gerar imagem do padrão via Canvas
              const img = await createPattern(patternType, color);
              
              if (map.hasImage(patternId)) {
                map.updateImage(patternId, img);
              } else {
                map.addImage(patternId, img);
              }
            });
          }
        }
      }
    });
  }, [symbologyConfig, activeLayers]);

  const renderedLayers = useMemo(() => {
    // Invertemos a ordem do array para que a camada no topo da UI (índice 0)
    // seja a ÚLTIMA a ser renderizada pelo MapLibre, ficando fisicamente por cima.
    const reversedLayers = [...activeLayers].reverse();
    
    return reversedLayers.map(layerId => {
      const data = geoData[layerId];
      if (!data) return null;

      const sym = symbologyConfig[layerId] || {};
      const baseLayerId = layerId.split('__')[0];
      
      const baseColor = sym.baseColor || stringToColor(baseLayerId);
      let featureColor = baseColor;
      let featurePattern = null;

      // Lendo estilos globais da camada ou usando padrões
      const layerOpacity = sym.opacity !== undefined ? sym.opacity : (sym.property ? 0.7 : 0.4);
      const strokeWidth = sym.lineWidth !== undefined ? sym.lineWidth : (sym.property ? 2 : 1);
      const showFill = sym.showFill !== false; // Toggle global (Padrão: true)

      let fillOpacityExpr = showFill ? layerOpacity : 0;

      if (sym.property && sym.palette) {
        let layerHasPattern = false;
        Object.keys(sym.palette).forEach(val => {
          if (sym.patterns?.[val] && sym.patterns?.[val] !== 'solid') layerHasPattern = true;
        });

        if (sym.classificationType === 'numerical' && sym.breaks && sym.breaks.length > 0) {
          // Classificação Numérica (Coroplética) usando 'step'
          const stepColorExpr = ['step', ['to-number', ['get', sym.property]]];
          const stepPatternExpr = ['step', ['to-number', ['get', sym.property]]];
          const stepOpacityExpr = ['step', ['to-number', ['get', sym.property]]];

          const firstLabel = sym.breaks[0].label;
          stepColorExpr.push(sym.palette[firstLabel] || baseColor);
          stepPatternExpr.push(layerHasPattern && sym.patterns?.[firstLabel] !== 'solid' ? `pattern-${layerId}-${firstLabel}` : "");
          stepOpacityExpr.push(sym.fillVisibilities?.[firstLabel] !== false ? layerOpacity : 0);

          for (let i = 1; i < sym.breaks.length; i++) {
            const stopVal = sym.breaks[i].lower;
            const label = sym.breaks[i].label;
            
            stepColorExpr.push(stopVal, sym.palette[label] || baseColor);
            stepPatternExpr.push(stopVal, layerHasPattern && sym.patterns?.[label] !== 'solid' ? `pattern-${layerId}-${label}` : "");
            stepOpacityExpr.push(stopVal, sym.fillVisibilities?.[label] !== false ? layerOpacity : 0);
          }

          featureColor = stepColorExpr;
          if (layerHasPattern) featurePattern = stepPatternExpr;
          if (showFill) fillOpacityExpr = stepOpacityExpr;

        } else {
          // Classificação Categórica (Valores únicos) usando 'match'
          const matchColorExpr = ['match', ['to-string', ['get', sym.property]]];
          const matchPatternExpr = ['match', ['to-string', ['get', sym.property]]];
          const matchOpacityExpr = ['match', ['to-string', ['get', sym.property]]];

          Object.entries(sym.palette).forEach(([val, color]) => {
            matchColorExpr.push(val, color);
            if (layerHasPattern) matchPatternExpr.push(val, `pattern-${layerId}-${val}`);
            matchOpacityExpr.push(val, sym.fillVisibilities?.[val] !== false ? layerOpacity : 0);
          });
          
          matchColorExpr.push(baseColor); // fallback
          matchPatternExpr.push(sym.basePattern && sym.basePattern !== 'solid' ? `pattern-${layerId}-base` : ""); // fallback
          matchOpacityExpr.push(layerOpacity); // fallback

          featureColor = matchColorExpr;
          if (layerHasPattern) featurePattern = matchPatternExpr;
          if (showFill) fillOpacityExpr = matchOpacityExpr;
        }

      } else if (!sym.property && sym.basePattern && sym.basePattern !== 'solid') {
        featurePattern = `pattern-${layerId}-base`;
      }

      // Filtro dinâmico para ocultar features inteiras (Visibilidade)
      let basePolygonFilter = ['==', ['geometry-type'], 'Polygon'];
      let baseLineFilter = ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']];
      let basePointFilter = ['==', ['geometry-type'], 'Point'];

      if (sym.property && sym.featureVisibilities) {
        const hiddenValues = Object.keys(sym.palette).filter(val => sym.featureVisibilities[val] === false);
        if (hiddenValues.length > 0) {
          if (sym.classificationType === 'numerical' && sym.breaks) {
            const exclusionExpressions = hiddenValues.map(label => {
              const breakObj = sym.breaks.find(b => b.label === label);
              if (breakObj) {
                const isLast = breakObj === sym.breaks[sym.breaks.length - 1];
                if (isLast) {
                  return ['all', ['>=', ['to-number', ['get', sym.property]], breakObj.lower], ['<=', ['to-number', ['get', sym.property]], breakObj.upper]];
                } else {
                  return ['all', ['>=', ['to-number', ['get', sym.property]], breakObj.lower], ['<', ['to-number', ['get', sym.property]], breakObj.upper]];
                }
              }
              return null;
            }).filter(Boolean);
            
            if (exclusionExpressions.length > 0) {
              const exclusionExpr = ['!', ['any', ...exclusionExpressions]];
              basePolygonFilter = ['all', basePolygonFilter, exclusionExpr];
              baseLineFilter = ['all', baseLineFilter, exclusionExpr];
              basePointFilter = ['all', basePointFilter, exclusionExpr];
            }
          } else {
            const exclusionExpr = ['!', ['in', ['to-string', ['get', sym.property]], ['literal', hiddenValues]]];
            basePolygonFilter = ['all', basePolygonFilter, exclusionExpr];
            baseLineFilter = ['all', baseLineFilter, exclusionExpr];
            basePointFilter = ['all', basePointFilter, exclusionExpr];
          }
        }
      }

      // Expressão Dinâmica de Rótulo (Aproveita a renomeação de classes se a coluna for a mesma)
      let textFieldExpr = ['to-string', ['get', sym.labelProperty]];

      if (sym.classLabels && sym.property && sym.labelProperty === sym.property) {
        if (sym.classificationType === 'numerical' && sym.breaks && sym.breaks.length > 0) {
          const stepTextExpr = ['step', ['to-number', ['get', sym.property]]];
          const firstLabel = sym.breaks[0].label;
          stepTextExpr.push(sym.classLabels[firstLabel] !== undefined ? sym.classLabels[firstLabel] : firstLabel);

          for (let i = 1; i < sym.breaks.length; i++) {
            const stopVal = sym.breaks[i].lower;
            const label = sym.breaks[i].label;
            stepTextExpr.push(stopVal, sym.classLabels[label] !== undefined ? sym.classLabels[label] : label);
          }
          textFieldExpr = stepTextExpr;
        } else if (sym.palette) {
          const matchTextExpr = ['match', ['to-string', ['get', sym.property]]];
          Object.keys(sym.palette).forEach(val => {
            matchTextExpr.push(val, sym.classLabels[val] !== undefined ? sym.classLabels[val] : val);
          });
          matchTextExpr.push(['to-string', ['get', sym.labelProperty]]); // fallback
          textFieldExpr = matchTextExpr;
        }
      }

      // Definições de estilo dinâmicas baseadas no tipo de geometria.
      
      const polygonPaint = {
        'fill-color': featureColor,
        'fill-opacity': fillOpacityExpr
      };
      
      // Se houver textura, injeta a propriedade fill-pattern e remove fill-color para evitar conflitos
      if (featurePattern) {
        polygonPaint['fill-pattern'] = featurePattern;
      }

      return (
        <Source key={layerId} id={`source-${layerId}`} type="geojson" data={data}>
          {/* Fill for polygons */}
          <Layer
            id={`fill-${layerId}`}
            type="fill"
            paint={polygonPaint}
            filter={basePolygonFilter}
          />
          {/* Line for lines and polygon borders */}
          {(() => {
            const dashArrays = { solid: undefined, dashed: [4, 4], dotted: [1, 2], dashdot: [4, 2, 1, 2] };
            
            // Se houver estilização de linha específica por categoria
            if (sym.property && sym.palette && sym.lineStyles && Object.keys(sym.lineStyles).length > 0) {
              const styleGroups = { solid: [], dashed: [], dotted: [], dashdot: [] };
              
              if (sym.classificationType === 'numerical' && sym.breaks) {
                sym.breaks.forEach(b => {
                  const style = sym.lineStyles[b.label] || 'solid';
                  styleGroups[style].push(b);
                });
              } else {
                Object.keys(sym.palette).forEach(val => {
                  const style = sym.lineStyles[val] || 'solid';
                  styleGroups[style].push(val);
                });
              }

              return Object.entries(styleGroups).map(([style, values]) => {
                if (values.length === 0) return null;
                
                let styleFilter = baseLineFilter;
                if (sym.classificationType === 'numerical' && sym.breaks) {
                  const numExpressions = values.map(breakObj => {
                    const isLast = breakObj === sym.breaks[sym.breaks.length - 1];
                    if (isLast) return ['all', ['>=', ['to-number', ['get', sym.property]], breakObj.lower], ['<=', ['to-number', ['get', sym.property]], breakObj.upper]];
                    return ['all', ['>=', ['to-number', ['get', sym.property]], breakObj.lower], ['<', ['to-number', ['get', sym.property]], breakObj.upper]];
                  });
                  styleFilter = ['all', baseLineFilter, ['any', ...numExpressions]];
                } else {
                  styleFilter = ['all', baseLineFilter, ['in', ['to-string', ['get', sym.property]], ['literal', values]]];
                }

                return (
                  <Layer
                    key={`line-${layerId}-${style}`}
                    id={`line-${layerId}-${style}`}
                    type="line"
                    paint={{
                      'line-color': featureColor,
                      'line-width': strokeWidth,
                      'line-opacity': layerOpacity,
                      ...(style !== 'solid' && { 'line-dasharray': dashArrays[style] })
                    }}
                    filter={styleFilter}
                  />
                );
              });
            }

            // Fallback: Linha Global única
            const baseStyle = sym.baseLineStyle || 'solid';
            return (
              <Layer
                id={`line-${layerId}`}
                type="line"
                paint={{
                  'line-color': featureColor,
                  'line-width': strokeWidth,
                  'line-opacity': layerOpacity,
                  ...(baseStyle !== 'solid' && { 'line-dasharray': dashArrays[baseStyle] })
                }}
                filter={baseLineFilter}
              />
            );
          })()}
          {/* Circles for points */}
          <Layer
            id={`point-${layerId}`}
            type="circle"
            paint={{
              'circle-color': featureColor,
              'circle-radius': 6,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#fff'
            }}
            filter={basePointFilter}
          />
          
          {/* Rótulos (Textos Dinâmicos) */}
          {sym?.labelsEnabled && sym?.labelProperty && (
            <Layer
              id={`label-${layerId}`}
              type="symbol"
              layout={{
                'text-field': textFieldExpr,
                'text-size': sym.labelSize || 12,
                'text-anchor': 'center',
                'text-justify': 'center',
                'symbol-placement': data?.features?.[0]?.geometry?.type?.includes('LineString') ? 'line' : 'point',
                'text-allow-overlap': false
              }}
              paint={{
                'text-color': sym.labelColor || '#FFFFFF',
                'text-halo-color': sym.labelHaloColor || '#000000',
                'text-halo-width': 1.5,
                'text-halo-blur': 0.5
              }}
              filter={['has', sym.labelProperty]}
            />
          )}
        </Source>
      );
    });
  }, [activeLayers, geoData, symbologyConfig]);

  const onMouseEnter = useCallback(() => setCursor('pointer'), []);
  const onMouseLeave = useCallback(() => setCursor('grab'), []);
  
  const onClick = useCallback((event) => {
    if (event.features && event.features.length > 0) {
      const featuresByLayer = {};
      
      event.features.forEach(f => {
        const layerId = f.layer.id.replace(/^(fill-|line-|point-)/, '');
        // Exibe apenas camadas ativas interativas
        if (activeLayers.includes(layerId) && !featuresByLayer[layerId]) {
          featuresByLayer[layerId] = f;
        }
      });
      
      const layerIds = Object.keys(featuresByLayer);
      if (layerIds.length === 0) {
        setHoverInfo(null);
        return;
      }

      const layersData = layerIds.map(layerId => {
        const feature = featuresByLayer[layerId];
        let props = feature.properties;
        let aggregatedProps = null;
        let classificationClass = null;

        const sym = symbologyConfig[layerId];
        if (sym && sym.property && geoData[layerId]) {
          const prop = sym.property;
          const myVal = props[prop];
          classificationClass = String(myVal !== undefined && myVal !== null ? myVal : 'Outros');

          if (sym.classificationType === 'numerical' && sym.breaks) {
             const numVal = Number(myVal);
             const brk = sym.breaks.find(b => numVal >= b.lower && numVal <= b.upper);
             classificationClass = brk ? brk.label : 'Outros';
          }

          const features = geoData[layerId].features;
          const numericCols = Object.keys(props).filter(k => {
            if (k === prop || k === 'id' || k === 'gid') return false;
            const v = props[k];
            if (typeof v === 'number') return true;
            if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) {
              if (v.length > 5 && !v.includes('.')) return false;
              return true;
            }
            return false;
          });

          if (numericCols.length > 0) {
            aggregatedProps = { Contagem: 0 };
            numericCols.forEach(k => aggregatedProps[k] = 0);

            features.forEach(f => {
              let fVal = f.properties[prop];
              fVal = (fVal !== undefined && fVal !== null) ? fVal : 'Outros';
              
              let fClass = String(fVal);
              if (sym.classificationType === 'numerical' && sym.breaks) {
                 const nVal = Number(fVal);
                 const brk = sym.breaks.find(b => nVal >= b.lower && nVal <= b.upper);
                 fClass = brk ? brk.label : 'Outros';
              }

              if (fClass === classificationClass) {
                aggregatedProps.Contagem += 1;
                numericCols.forEach(k => {
                  aggregatedProps[k] += Number(f.properties[k]) || 0;
                });
              }
            });

            numericCols.forEach(k => {
              if (!Number.isInteger(aggregatedProps[k])) {
                aggregatedProps[k] = parseFloat(aggregatedProps[k].toFixed(2));
              }
            });
          }
        }

        return {
          layerId,
          properties: props,
          aggregatedProps,
          classificationClass
        };
      });

      setHoverInfo({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        layersData
      });
      setActivePopupTab(0);
    } else {
      setHoverInfo(null);
    }
  }, [geoData, symbologyConfig]);

  // Controlar aba ativa da tabela de atributos
  useEffect(() => {
    if (activeLayers.length > 0 && (!activeTab || !activeLayers.includes(activeTab))) {
      setActiveTab(activeLayers[0]);
    } else if (activeLayers.length === 0) {
      setIsTableOpen(false);
      setActiveTab(null);
    }
  }, [activeLayers, activeTab]);

  const tableData = useMemo(() => {
    if (!activeTab || !geoData[activeTab] || !geoData[activeTab].features || geoData[activeTab].features.length === 0) return { headers: [], rows: [], isClassified: false };
    const features = geoData[activeTab].features;
    const sym = symbologyConfig[activeTab];
    const isClassified = sym && !!sym.property;

    if (isTableAggregated && isClassified) {
      const prop = sym.property;
      const groups = {};
      
      const firstProps = features[0].properties;
      const numericCols = Object.keys(firstProps).filter(k => {
        if (k === prop || k === 'id' || k === 'gid') return false;
        const v = firstProps[k];
        if (typeof v === 'number') return true;
        if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) {
          // Ignorar prováveis IDs (códigos longos sem decimais)
          if (v.length > 5 && !v.includes('.')) return false;
          return true;
        }
        return false;
      });

      features.forEach(f => {
        let val = f.properties[prop];
        if (val === undefined || val === null) val = 'Outros';
        
        if (sym.classificationType === 'numerical' && sym.breaks) {
           const numVal = Number(val);
           const brk = sym.breaks.find(b => numVal >= b.lower && numVal <= b.upper);
           val = brk ? brk.label : 'Outros';
        } else {
           val = String(val);
        }

        if (!groups[val]) {
          groups[val] = { [prop]: val, Contagem: 0 };
          numericCols.forEach(k => groups[val][k] = 0);
        }
        groups[val].Contagem += 1;
        numericCols.forEach(k => {
          groups[val][k] += Number(f.properties[k]) || 0;
        });
      });

      const rows = Object.values(groups).map(g => {
        const row = { ...g };
        numericCols.forEach(k => {
          if (!Number.isInteger(row[k])) {
            row[k] = parseFloat(row[k].toFixed(2));
          }
        });
        return row;
      });

      return { headers: [prop, 'Contagem', ...numericCols], rows, isClassified };
    } else {
      const headers = Object.keys(features[0].properties);
      const rows = features.map(f => f.properties);
      return { headers, rows, isClassified };
    }
  }, [activeTab, geoData, symbologyConfig, isTableAggregated]);

  return (
    <div className="w-full h-full relative flex flex-col bg-slate-900">
      <div id="map-export-container" className="flex-1 w-full relative">
        <Map
          ref={mapRef}
          initialViewState={initialViewState}
          mapStyle={getMapStyle(basemapStyle)}
          mapLib={maplibregl}
          style={{ width: '100%', height: '100%' }}
          interactiveLayerIds={activeLayers.flatMap(id => [`fill-${id}`, `line-${id}`, `point-${id}`])}
          cursor={cursor}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={onClick}
          preserveDrawingBuffer={true} // OBRIGATÓRIO PARA EXPORTAÇÃO PDF!
        >
          {/* Controles Cartográficos */}
          <NavigationControl position="bottom-right" showCompass={true} />
          <ScaleControl position="bottom-left" maxWidth={150} unit="metric" />

          {/* Cartela de Informações do Mapa (Editável) */}
          <div id="map-info-panel" className="absolute bottom-[60px] left-4 bg-slate-900/90 border border-slate-700/50 p-4 rounded-xl shadow-2xl backdrop-blur-sm max-w-[350px] z-10 hover:border-blue-500/50 transition-colors mt-2">
            <input
              type="text"
              value={mapTitle}
              onChange={(e) => setMapTitle(e.target.value)}
              className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 text-lg font-bold text-slate-100 outline-none pb-1 transition-colors mb-2"
              placeholder="Título do Mapa"
            />
            <textarea
              value={mapDesc}
              onChange={(e) => setMapDesc(e.target.value)}
              className="w-full bg-transparent border border-transparent hover:border-slate-600 focus:border-blue-500 text-xs text-slate-400 outline-none p-1 transition-colors resize-none custom-scrollbar"
              rows={3}
              placeholder="Descrição ou informações adicionais..."
            />
          </div>

          {renderedLayers}

        {hoverInfo && hoverInfo.layersData && hoverInfo.layersData.length > 0 && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            closeButton={true}
            closeOnClick={false}
            onClose={() => setHoverInfo(null)}
            anchor="bottom"
            maxWidth="320px"
          >
            <div className="text-slate-800 text-xs min-w-[250px] max-w-[320px]">
              {hoverInfo.layersData.length > 1 && (
                <div className="flex overflow-x-auto border-b border-slate-200 mb-2 custom-scrollbar">
                  {hoverInfo.layersData.map((ld, idx) => (
                    <button
                      key={ld.layerId}
                      onClick={() => setActivePopupTab(idx)}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${activePopupTab === idx ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {ld.layerId.replace(/^(beberibe_|i3geomap_|zeec_|extra_)/i, '').replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              )}

              {hoverInfo.layersData[activePopupTab] && (
                <div className="max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                  {hoverInfo.layersData.length === 1 && (
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <h3 className="font-bold uppercase text-[10px] tracking-wider text-slate-500">
                        {hoverInfo.layersData[0].layerId.replace(/_/g, ' ')}
                      </h3>
                    </div>
                  )}
                  
                  {hoverInfo.layersData[activePopupTab].aggregatedProps && (
                    <div className="mb-4 bg-blue-50 p-2 rounded-md border border-blue-100">
                      <div className="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">
                        Agregado: {hoverInfo.layersData[activePopupTab].classificationClass}
                      </div>
                      {Object.entries(hoverInfo.layersData[activePopupTab].aggregatedProps).map(([key, val]) => (
                        <div key={`agg-${key}`} className="mb-1 flex justify-between items-center">
                          <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">{key}</span>
                          <span className="text-[11px] font-bold text-blue-900">{val}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Dados do Objeto</div>
                  {Object.entries(hoverInfo.layersData[activePopupTab].properties).map(([key, val]) => (
                    <div key={`prop-${key}`} className="mb-2">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{key}</div>
                      <div className="text-sm font-medium text-slate-700">{val !== null && val !== undefined ? String(val) : '-'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Botão de Exportar PDF */}
      <button
        id="export-pdf-button"
        onClick={exportToPDF}
        disabled={isExporting}
        className="absolute bottom-[160px] right-[10px] bg-blue-600 hover:bg-blue-500 text-white rounded-full p-3 shadow-lg shadow-blue-900/50 border border-blue-400/50 transition-all z-20 group disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
        title={session ? "Exportar Mapa em PDF (A4 Paisagem)" : "Faça login para exportar PDF"}
      >
        {isExporting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        ) : (
          <>
            <Printer size={20} />
            <span className="absolute right-full mr-3 bg-slate-800 text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700 shadow-xl">
              {session ? "Exportar para PDF" : "Login necessário"}
            </span>
          </>
        )}
      </button>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

    </div> {/* FECHAMENTO DO map-export-container */}

      {/* Loading Indicator */}
      {loadingLayers.size > 0 && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-800/80 backdrop-blur-md px-4 py-2 rounded-full text-sm text-white flex items-center gap-2 border border-slate-700 shadow-lg z-50">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Carregando dados ({loadingLayers.size})...
        </div>
      )}

      {/* Botão flutuante para abrir a tabela */}
      {activeLayers.length > 0 && !isTableOpen && (
        <button
          onClick={() => setIsTableOpen(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/90 hover:bg-slate-700/90 text-white px-6 py-2 rounded-full shadow-xl border border-slate-600 backdrop-blur flex items-center gap-2 transition-all font-medium text-sm z-10"
        >
          <Table size={16} /> Ver Tabela de Atributos
        </button>
      )}

      {/* Painel Inferior: Tabela de Atributos */}
      <div 
        className={`absolute bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-md border-t border-slate-700 shadow-2xl transition-transform duration-300 ease-in-out z-20 flex flex-col ${isTableOpen ? 'translate-y-0 h-[40%]' : 'translate-y-full h-[40%]'}`}
      >
        <div className="flex bg-slate-800 border-b border-slate-700 relative">
          <div className="flex flex-1 overflow-x-auto custom-scrollbar">
            {activeLayers.map(layerId => (
              <button
                key={layerId}
                onClick={() => setActiveTab(layerId)}
                className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-r border-slate-700 transition-colors ${
                  activeTab === layerId 
                    ? 'bg-slate-700 text-white' 
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`}
              >
                {layerId.replace(/^(beberibe_|i3geomap_|zeec_|extra_)/i, '').replace(/_/g, ' ').toUpperCase()}
              </button>
            ))}
          </div>
          <div className="absolute right-12 top-0 bottom-0 flex items-center pr-2 bg-gradient-to-l from-slate-800 via-slate-800 to-transparent pl-8">
            {tableData.isClassified && (
              <button 
                onClick={() => setIsTableAggregated(!isTableAggregated)}
                className={`text-[10px] px-2 py-1 rounded transition-colors mr-2 ${isTableAggregated ? 'bg-blue-600 text-white font-bold' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                title="Agrupar Tabela por Classificação Ativa"
              >
                {isTableAggregated ? 'DADOS AGREGADOS' : 'AGRUPAR DADOS'}
              </button>
            )}
          </div>
          <button 
            onClick={() => setIsTableOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors ml-auto mr-1 my-1"
          >
            <ChevronDown size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto bg-slate-900 p-0 custom-scrollbar">
          {tableData.rows.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-800 sticky top-0 z-10 shadow">
                <tr>
                  {tableData.headers.map(key => (
                    <th key={key} className={`p-3 font-semibold border-b border-slate-700 uppercase tracking-wider ${isTableAggregated && (key === 'Contagem' || key === symbologyConfig[activeTab]?.property) ? 'text-blue-400 bg-slate-800/80' : 'text-slate-300'}`}>
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tableData.rows.map((row, i) => (
                  <tr key={i} className={`hover:bg-white/5 transition-colors ${isTableAggregated ? 'bg-slate-800/20' : ''}`}>
                    {tableData.headers.map((key, j) => {
                      const val = row[key];
                      return (
                        <td key={j} className={`p-3 truncate max-w-[200px] ${isTableAggregated && (key === 'Contagem' || key === symbologyConfig[activeTab]?.property) ? 'text-blue-300 font-medium' : 'text-slate-400'}`}>
                          {val !== null && val !== undefined ? String(val) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500 text-sm">
              Nenhum dado disponível.
            </div>
          )}
        </div>
      </div>

      {/* Motor de PDF A4 Paisagem (Renderizado invisivelmente) */}
      <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -1000, pointerEvents: 'none', opacity: 0 }}>
        {isExporting && printSnapshot && !showPrintPreview && (
          <PrintLayout 
            mapImage={printSnapshot}
            mapTitle={mapTitle}
            mapDesc={mapDesc}
            activeLayers={activeLayers}
            symbologyConfig={symbologyConfig}
            printMetadata={printMetadata}
            onReady={handlePrintReady}
          />
        )}
      </div>

      {/* Modal de Preview do PDF */}
      {showPrintPreview && finalPdfImage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-8">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl flex flex-col w-full max-w-6xl max-h-full overflow-hidden">
            
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Printer size={20} className="text-blue-400" />
                Pré-visualização do PDF Cartográfico
              </h2>
              <button onClick={cancelPrint} className="p-2 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-auto bg-slate-900/50 custom-scrollbar flex items-center justify-center">
              <div className="relative shadow-2xl border border-slate-800">
                {/* Mostra a imagem exata que irá pro PDF */}
                <img 
                  src={finalPdfImage} 
                  alt="Preview do PDF" 
                  className="max-h-[70vh] object-contain bg-white"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-end gap-3">
              <button 
                onClick={cancelPrint}
                className="px-6 py-2.5 rounded-xl font-semibold text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={downloadConfirmedPdf}
                className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/50 transition-colors flex items-center gap-2"
              >
                <Download size={18} />
                Confirmar e Baixar PDF
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
