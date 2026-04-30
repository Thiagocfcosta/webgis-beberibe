'use client';

import { useState } from 'react';
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

  return (
    <main className="w-screen h-screen overflow-hidden bg-slate-900 relative flex">
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
      />

      {/* Visualizador do Mapa */}
      <div className="flex-1 h-full relative">
        <MapViewer 
          activeLayers={activeLayers} 
          basemapStyle={basemapStyle} 
          geoData={geoData}
          setGeoData={setGeoData}
          symbologyConfig={symbologyConfig}
          clippedLayers={clippedLayers}
        />
      </div>

      {/* Painel de Dashboard (Direita) */}
      <DashboardPanel 
        activeLayers={activeLayers}
        geoData={geoData}
        symbologyConfig={symbologyConfig}
      />
    </main>
  );
}
