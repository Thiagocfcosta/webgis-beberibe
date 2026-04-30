'use client';

import { useState, useRef } from 'react';
import LayerControl from '@/components/LayerControl';
import MapViewer from '@/components/MapViewer';
import DashboardPanel from '@/components/DashboardPanel';

export default function Home() {
  const [activeLayers, setActiveLayers] = useState([]);
  const [basemapStyle, setBasemapStyle] = useState('satellite-bw');
  
  // Elevando o estado dos dados espaciais para serem lidos pelo menu lateral
  const [geoData, setGeoData] = useState({});
  const [symbologyConfig, setSymbologyConfig] = useState({});
  const [clippedLayers, setClippedLayers] = useState({}); // { layerId: true } se deve recortar
  const [toastMessage, setToastMessage] = useState(null); // Sistema global de notificações
  
  // Título e Descrição do Painel Frontal no Mapa
  const [mapTitle, setMapTitle] = useState('Análise Territorial - Beberibe');
  const [mapDesc, setMapDesc] = useState('Insira uma descrição, data ou nota técnica sobre o mapa aqui...');
  const [activeMapId, setActiveMapId] = useState(null);
  
  
  const mapRef = useRef(null); // Ref global do mapa para capturar viewport ao salvar

  // Carrega os dados de um Workspace (Projeto Salvo)
  const loadWorkspace = (config, mapId = null) => {
    setActiveMapId(mapId);
    if (config.activeLayers) setActiveLayers(config.activeLayers);
    if (config.basemapStyle) setBasemapStyle(config.basemapStyle);
    if (config.symbologyConfig) setSymbologyConfig(config.symbologyConfig);
    if (config.clippedLayers) setClippedLayers(config.clippedLayers);
    if (config.mapTitle) setMapTitle(config.mapTitle);
    if (config.mapDesc) setMapDesc(config.mapDesc);
    
    showToast('Projeto carregado com sucesso!');
    
    // Anima a câmera para o estado salvo
    if (config.viewState && mapRef.current) {
      const map = mapRef.current.getMap();
      map.flyTo({
        center: [config.viewState.longitude, config.viewState.latitude],
        zoom: config.viewState.zoom,
        pitch: config.viewState.pitch,
        bearing: config.viewState.bearing,
        duration: 2000
      });
    }
  };

  // Mescla os dados de um Workspace com o atual
  const mergeWorkspace = (config) => {
    setActiveMapId(null); // Vira um projeto novo/mesclado, não deve sobrescrever o antigo ao salvar

    if (config.activeLayers) {
      setActiveLayers(prev => ({ ...prev, ...config.activeLayers }));
    }
    if (config.symbologyConfig) {
      setSymbologyConfig(prev => ({ ...prev, ...config.symbologyConfig }));
    }
    if (config.clippedLayers) {
      setClippedLayers(prev => ({ ...prev, ...config.clippedLayers }));
    }
    if (config.mapTitle) {
      setMapTitle(prev => prev === 'Análise Territorial - Beberibe' ? config.mapTitle : `${prev} + ${config.mapTitle}`);
    }
    if (config.mapDesc) {
      setMapDesc(prev => prev.startsWith('Insira uma descrição') ? config.mapDesc : `${prev}\n\n---\nAdicionado do projeto mesclado:\n${config.mapDesc}`);
    }
    
    showToast('Projetos mesclados com sucesso! Não esqueça de salvar o novo projeto.');
    
    // Opcional: voar para a câmera do novo mapa (descomentar se preferir)
    // Se não, mantemos a câmera do mapa que já estava aberto.
  };

  // Prepara o JSON exato do estado atual
  const getWorkspaceConfig = () => {
    let viewState = {};
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      viewState = {
        longitude: map.getCenter().lng,
        latitude: map.getCenter().lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing()
      };
    }

    return {
      activeLayers,
      basemapStyle,
      symbologyConfig,
      clippedLayers,
      mapTitle,
      mapDesc,
      viewState
    };
  };

  // Funções de QoL (Qualidade de Vida)
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const clearMap = () => {
    setActiveLayers([]);
    showToast('Camadas removidas da tela.');
  };

  return (
    <main className="w-screen h-screen overflow-hidden bg-slate-900 relative flex">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600/90 text-white px-5 py-2.5 rounded-full shadow-xl border border-emerald-500 backdrop-blur-sm animate-in fade-in slide-in-from-top-5 duration-300 font-medium text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {toastMessage}
        </div>
      )}

      {/* Sidebar de Controle */}
      <LayerControl 
        activeLayers={activeLayers} 
        setActiveLayers={setActiveLayers} 
        basemapStyle={basemapStyle}
        setBasemapStyle={setBasemapStyle}
        geoData={geoData}
        setGeoData={setGeoData}
        symbologyConfig={symbologyConfig}
        setSymbologyConfig={setSymbologyConfig}
        clippedLayers={clippedLayers}
        setClippedLayers={setClippedLayers}
        clearMap={clearMap}
        showToast={showToast}
      />

      {/* Visualizador do Mapa */}
      <div className="flex-1 h-full relative">
        <MapViewer 
          globalMapRef={mapRef}
          activeLayers={activeLayers} 
          basemapStyle={basemapStyle} 
          geoData={geoData}
          setGeoData={setGeoData}
          symbologyConfig={symbologyConfig}
          clippedLayers={clippedLayers}
          getWorkspaceConfig={getWorkspaceConfig}
          mapTitle={mapTitle}
          setMapTitle={setMapTitle}
          mapDesc={mapDesc}
          setMapDesc={setMapDesc}
        />
      </div>

      {/* Painel de Dashboard (Direita) */}
      <DashboardPanel 
        activeLayers={activeLayers}
        geoData={geoData}
        symbologyConfig={symbologyConfig}
        getWorkspaceConfig={getWorkspaceConfig}
        loadWorkspace={loadWorkspace}
        mergeWorkspace={mergeWorkspace}
        clearMap={clearMap}
        showToast={showToast}
        activeMapId={activeMapId}
      />
    </main>
  );
}
