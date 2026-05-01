'use client';

import { useEffect, useState } from 'react';
import { Navigation } from 'lucide-react';

export default function PrintLayout({ 
  mapImage, 
  mapTitle, 
  mapDesc, 
  activeLayers, 
  symbologyConfig, 
  printMetadata,
  onReady 
}) {
  const [layersDef, setLayersDef] = useState([]);

  useEffect(() => {
    // Busca a definição das camadas para montar a legenda
    fetch('/api/layers')
      .then(res => res.json())
      .then(data => {
        setLayersDef(data);
        // Pequeno atraso para garantir que as fontes/imagens carreguem
        setTimeout(() => {
          if (onReady) onReady();
        }, 1000);
      });
  }, [onReady]);

  // A4 Landscape em alta resolução (300 DPI = ~3508 x 2480 px)
  // Vamos usar 2970 x 2100 para manter proporção 10px = 1mm
  return (
    <div 
      id="print-layout-container"
      className="bg-white text-black font-sans relative"
      style={{
        width: '2970px',
        height: '2100px',
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
        backgroundColor: '#ffffff'
      }}
    >
      {/* 75% Mapa */}
      <div 
        style={{ 
          width: '78%', 
          height: '100%', 
          position: 'relative',
          borderRight: '8px solid #000', // Borda preta grossa separando o mapa do carimbo
          backgroundColor: '#0f172a'
        }}
      >
        {mapImage && (
          <img 
            src={mapImage} 
            alt="Mapa" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover' 
            }} 
          />
        )}
        
        {/* A imagem do mapa ocupa 100% da área, sem bordas internas perdendo espaço */}
      </div>

      {/* 25% Carimbo / Selo Técnico */}
      <div 
        style={{ 
          width: '22%', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: '#fff',
          boxSizing: 'border-box'
        }}
      >
        {/* Bloco 1: Logos Principais */}
        <div style={{ padding: '40px', borderBottom: '6px solid #000', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '220px' }}>
          <img src="/logo_pdot.jpeg" alt="Plano Diretor de Beberibe" style={{ width: '100%', maxHeight: '260px', objectFit: 'contain' }} />
        </div>

        {/* Bloco 2: Identificação do Projeto */}
        <div style={{ padding: '40px', borderBottom: '4px solid #000', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 15px 0', letterSpacing: '2px' }}>
            PLANO DIRETOR DE DESENVOLVIMENTO URBANO E TERRITORIAL
          </h2>
          <h3 style={{ fontSize: '24px', fontWeight: '500', color: '#444', margin: 0, textTransform: 'uppercase' }}>
            {mapTitle || 'Análise Territorial'}
          </h3>
          {mapDesc && (
            <p style={{ fontSize: '18px', color: '#666', marginTop: '20px', fontStyle: 'italic' }}>
              {mapDesc}
            </p>
          )}
        </div>

        {/* Bloco 3: Convenções Cartográficas (Legenda Dinâmica) */}
        <div style={{ padding: '40px', flex: 1, borderBottom: '4px solid #000', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 30px 0', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
            CONVENÇÕES CARTOGRÁFICAS
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {activeLayers.map(layerId => {
              const baseLayerId = layerId.split('__')[0];
              const layerMeta = layersDef.find(l => l.id === baseLayerId);
              if (!layerMeta) return null;
              
              const sym = symbologyConfig && symbologyConfig[layerId];
              
              // Verifica se a camada foi explicitamente ocultada da legenda
              if (sym && sym.showInLegend === false) return null;

              const isCopy = layerId !== baseLayerId;
              const defaultName = isCopy ? `${layerMeta.name} (Cópia)` : layerMeta.name;
              const layerName = (sym && sym.legendTitle) ? sym.legendTitle : defaultName;
              
              const isPolygon = layerMeta.type.includes('POLYGON');
              const isLine = layerMeta.type.includes('LINE');

              // Se a camada for classificada (tem property e palette)
              if (sym && sym.property && sym.palette) {
                // Classes categóricas ou numéricas (usamos as chaves do palette)
                const classes = Object.keys(sym.palette);
                // Filtramos classes que foram ocultadas pelo usuário (featureVisibilities = false)
                const visibleClasses = classes.filter(cls => !sym.featureVisibilities || sym.featureVisibilities[cls] !== false);

                return (
                  <div key={layerId} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', color: '#333' }}>
                      {layerName} <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>({sym.property})</span>
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '15px' }}>
                      {visibleClasses.map(cls => {
                        const colorHex = sym.palette[cls];
                        // Resgata o estilo de linha específico dessa classe (se existir)
                        const lineStyle = (sym.lineStyles && sym.lineStyles[cls]) ? sym.lineStyles[cls] : 'solid';
                        
                        // Resgata o título humanizado (se o usuário tiver editado)
                        const classDisplayName = sym.classLabels?.[cls] !== undefined ? sym.classLabels[cls] : cls;
                        
                        return (
                          <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ 
                              width: '40px', 
                              height: '25px', 
                              backgroundColor: isLine ? 'transparent' : colorHex,
                              border: isPolygon ? `2px solid ${colorHex}` : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {isLine && (
                                <div style={{ 
                                  width: '100%', 
                                  height: '4px', 
                                  backgroundColor: colorHex,
                                  borderTop: lineStyle === 'dashed' ? `4px dashed ${colorHex}` : (lineStyle === 'dotted' ? `4px dotted ${colorHex}` : 'none')
                                }} />
                              )}
                            </div>
                            <span style={{ fontSize: '18px', fontWeight: '500', color: '#444' }}>
                              {classDisplayName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Se NÃO for classificada, usamos a baseColor ou o hash aleatório
              let colorHex = sym?.baseColor;
              if (!colorHex) {
                let hash = 0;
                for (let i = 0; i < layerId.length; i++) hash = layerId.charCodeAt(i) + ((hash << 5) - hash);
                colorHex = '#' + '00000'.substring(0, 6 - ((hash & 0x00FFFFFF).toString(16).toUpperCase()).length) + ((hash & 0x00FFFFFF).toString(16).toUpperCase());
              }
              
              return (
                <div key={layerId} style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px' }}>
                  <div style={{ 
                    width: '60px', 
                    height: '40px', 
                    backgroundColor: isLine ? 'transparent' : colorHex,
                    border: isPolygon ? `3px solid ${colorHex}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isLine && <div style={{ width: '100%', height: '6px', backgroundColor: colorHex }} />}
                  </div>
                  <span style={{ fontSize: '22px', fontWeight: '600', textTransform: 'uppercase' }}>
                    {layerName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bloco 4: Informações Técnicas e Escala */}
        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {(() => {
            // Cálculos da Escala Gráfica
            let scaleWidthPx = 400; // Tamanho visual fixo padronizado
            let scaleLabels = [0, 2.5, 5, 7.5, 10]; // fallback labels
            
            if (printMetadata && printMetadata.widthKm) {
              const mapWidthPx = 2970 * 0.78; // 2316.6px no PDF
              const kmPerPx = printMetadata.widthKm / mapWidthPx;
              
              // O tamanho físico da escala nunca muda (400px), mas os km representados sim
              const totalKm = kmPerPx * scaleWidthPx;
              
              scaleLabels = [0, totalKm/4, totalKm/2, (totalKm*3)/4, totalKm];
              
              // Formatar labels para no máximo 2 casas decimais, para precisão sem poluição
              scaleLabels = scaleLabels.map(v => Number.isInteger(v) ? v : Number(v.toFixed(2)));
            }

            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Navigation 
                      size={65} 
                      strokeWidth={2} 
                      fill="currentColor"
                      style={{ transform: `rotate(${-45 - (printMetadata?.bearing || 0)}deg)` }} 
                    />
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>N</span>
                  </div>
                </div>
                
                <div style={{ flex: 1, marginLeft: '40px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>ESCALA GRÁFICA</div>
                  {/* Barra de escala visual calculada */}
                  <div style={{ display: 'flex', width: `${scaleWidthPx}px`, height: '15px', border: '2px solid #000' }}>
                    <div style={{ flex: 1, backgroundColor: '#000' }} />
                    <div style={{ flex: 1, backgroundColor: '#fff' }} />
                    <div style={{ flex: 1, backgroundColor: '#000' }} />
                    <div style={{ flex: 1, backgroundColor: '#fff' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: `${scaleWidthPx}px`, fontSize: '16px', marginTop: '5px', fontWeight: 'bold' }}>
                    <span>{scaleLabels[0]}</span>
                    <span>{scaleLabels[1]}</span>
                    <span>{scaleLabels[2]}</span>
                    <span>{scaleLabels[3]}</span>
                    <span>{scaleLabels[4]} km</span>
                  </div>
                </div>
              </div>
            );
          })()}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px', fontSize: '18px', fontWeight: '600' }}>
            <div>
              <span style={{ color: '#666', display: 'block', fontSize: '14px' }}>SISTEMA DE REFERÊNCIA</span>
              SIRGAS 2000
            </div>
            <div>
              <span style={{ color: '#666', display: 'block', fontSize: '14px' }}>PROJEÇÃO</span>
              UTM Zona 24S
            </div>
            <div>
              <span style={{ color: '#666', display: 'block', fontSize: '14px' }}>DATA</span>
              {new Date().toLocaleDateString('pt-BR')}
            </div>
            <div>
              <span style={{ color: '#666', display: 'block', fontSize: '14px' }}>FONTE</span>
              Prefeitura, IBGE, OSM
            </div>
          </div>
          
        </div>

        {/* Bloco 5: Carimbo das Empresas Envolvidas */}
        <div style={{ padding: '30px 40px', borderTop: '4px solid #000', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: '30px', flexWrap: 'wrap' }}>
            
            {/* Logo Espaço e Plano com tipografia */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <img src="/logo.jpg" alt="Logo Símbolo Espaço e Plano" style={{ height: '65px', objectFit: 'contain' }} />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '5px' }}>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: '900', color: '#3A1405', letterSpacing: '1px', lineHeight: '1' }}>
                  ESPAÇO E PLANO
                </span>
              </div>
            </div>

            {/* Adicione futuras logos aqui */}
          </div>
        </div>
      </div>
    </div>
  );
}
