'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { BarChart3, ChevronRight, ChevronLeft, Users, Home, Map as MapIcon, Activity, Route, Leaf, Droplets, LogIn, LogOut, FolderOpen, XCircle } from 'lucide-react';
import LoginModal from './LoginModal';
import SavedMapsDrawer from './SavedMapsDrawer';
import AdminUsersModal from './AdminUsersModal';
import { Shield } from 'lucide-react';

export default function DashboardPanel({ activeLayers, geoData, symbologyConfig, getWorkspaceConfig, loadWorkspace, clearMap, showToast, activeMapId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { data: session, status } = useSession();
  const [fixedKpis, setFixedKpis] = useState(null);

  // Buscar KPIs fixos do Back-end
  useEffect(() => {
    fetch('/api/kpis')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setFixedKpis(data);
      })
      .catch(err => console.error('Erro ao buscar KPIs:', err));
  }, []);

  // Helper para formatar números (ex: 25.430)
  const formatNum = (num) => {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(num || 0);
  };

  // --- Sub-componente KpiCard com Tooltip Customizado ---
  const KpiCard = ({ icon: Icon, iconColor, label, value, unit, source, layer, desc, details, align = 'left' }) => (
    <div className="group relative bg-slate-800/80 hover:bg-slate-700/80 p-3 rounded-lg border border-slate-700/50 cursor-help transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={iconColor} />
        <span className="text-[10px] text-slate-400 font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold text-slate-100">
        {value} {unit && <span className="text-xs font-normal">{unit}</span>}
      </div>

      {/* Tooltip flutuante */}
      <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50`}>
        {desc && <p className="text-xs text-slate-300 mb-3">{desc}</p>}
        
        {/* Sub-divisões dinâmicas (ex: rodovias_detalhes) */}
        {details && details.length > 0 && (
          <div className="mb-3 space-y-1 bg-slate-800/50 rounded p-2">
            {details.map((d, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="text-slate-400 truncate pr-2" title={d.tipo}>{d.tipo}</span>
                <span className="text-slate-200 font-medium whitespace-nowrap">{formatNum(d.km)} {unit}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between gap-2 border-t border-slate-800 pt-2 mt-2">
          <div className="flex-1">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fonte</div>
            <div className="text-[10px] font-bold text-slate-200">{source}</div>
          </div>
          <div className="flex-1">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Camada</div>
            <div className="text-[10px] font-bold text-slate-200 truncate" title={layer}>{layer}</div>
          </div>
        </div>
      </div>
    </div>
  );



  // --- 2. Análise Dinâmica da Camada Ativa Classificada ---
  const activeStats = useMemo(() => {
    if (!activeLayers || activeLayers.length === 0) return null;
    
    const layerId = activeLayers[0]; // Pega a camada mais no topo
    const data = geoData[layerId];
    const sym = symbologyConfig[layerId];
    
    if (!data || !data.features || !sym || !sym.property) return null;

    const prop = sym.property;
    const isNumerical = sym.classificationType === 'numerical';
    const features = data.features;
    
    // Se for categórico, agrupar por categorias (contagem)
    if (!isNumerical) {
      const groups = {};
      let maxCount = 0;
      
      features.forEach(f => {
        let val = f.properties[prop];
        val = (val !== undefined && val !== null) ? String(val) : 'Outros';
        
        if (!groups[val]) groups[val] = { label: val, count: 0, pop: 0 };
        groups[val].count += 1;
        if (f.properties.populacao_2022) groups[val].pop += Number(f.properties.populacao_2022);
        
        if (groups[val].count > maxCount) maxCount = groups[val].count;
      });

      // Ordenar do maior pro menor
      const sorted = Object.values(groups).sort((a, b) => b.count - a.count);
      return {
        type: 'categorical',
        property: prop,
        maxCount,
        data: sorted
      };
    } 
    // Se for numérico, calcular métricas descritivas
    else {
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      let count = 0;
      
      features.forEach(f => {
        const val = Number(f.properties[prop]);
        if (!isNaN(val)) {
          if (val < min) min = val;
          if (val > max) max = val;
          sum += val;
          count++;
        }
      });
      
      return {
        type: 'numerical',
        property: prop,
        min: min === Infinity ? 0 : min,
        max: max === -Infinity ? 0 : max,
        avg: count > 0 ? sum / count : 0,
        total: sum
      };
    }
  }, [activeLayers, geoData, symbologyConfig]);

  return (
    <>
      {/* Menu de Perfil / Login / Workspace (Flutuante no topo centro/direito) */}
      <div className="absolute top-4 right-1/2 translate-x-1/2 md:right-4 md:translate-x-0 flex items-center gap-3 z-40">
        {status === 'loading' ? (
          <div className="w-10 h-10 bg-slate-800/50 rounded-full animate-pulse border border-slate-700"></div>
        ) : session ? (
          <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 shadow-lg group">
            <div className="flex flex-col items-end mr-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">{session.user.role}</span>
              <span className="text-xs text-white font-medium">{session.user.name?.split(' ')[0]}</span>
            </div>
            
            {/* Botão de Administração (apenas para Admins) */}
            {(session.user.role === 'admin' || session.user.role === 'Administrador') && (
              <button 
                onClick={() => setIsAdminPanelOpen(true)}
                className="w-7 h-7 bg-purple-600/30 hover:bg-purple-500/50 text-purple-400 hover:text-white rounded-full flex items-center justify-center transition-colors"
                title="Administração de Usuários"
              >
                <Shield size={14} />
              </button>
            )}

            {/* Botão de Workspace (apenas para logados) */}
            <button 
              onClick={() => {
                setIsWorkspaceOpen(true);
                // Fecha o dashboard analítico se abrir a gaveta no mobile para evitar sobreposição
                if (window.innerWidth < 768) setIsOpen(false);
              }}
              className="w-7 h-7 bg-blue-600/30 hover:bg-blue-500/50 text-blue-400 hover:text-white rounded-full flex items-center justify-center transition-colors"
              title="Meus Projetos"
            >
              <FolderOpen size={14} />
            </button>
            <button 
              onClick={() => signOut()}
              className="w-7 h-7 bg-slate-700 hover:bg-red-500/20 text-slate-300 hover:text-red-400 rounded-full flex items-center justify-center transition-colors ml-1"
              title="Sair da Conta"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsLoginModalOpen(true)}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/90 backdrop-blur-md px-4 py-2 text-sm font-medium text-white transition-all rounded-full shadow-lg border border-slate-700"
          >
            <LogIn size={18} className="text-blue-400" />
            <span>Acesso Restrito</span>
          </button>
        )}
      </div>

      {/* Botão flutuante para abrir o painel analítico (quando fechado) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute right-0 top-16 bg-slate-800/90 hover:bg-blue-600 backdrop-blur-md p-3 rounded-l-xl border border-r-0 border-slate-700 shadow-xl transition-all z-40 text-slate-300 hover:text-white"
        >
          <BarChart3 size={24} />
        </button>
      )}

      {/* Painel do Dashboard */}
      <div 
        className={`absolute right-0 top-0 h-full w-80 bg-slate-900/95 backdrop-blur-md border-l border-slate-700 shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Activity className="text-blue-500" size={20} />
            <h2 className="font-bold text-slate-200 tracking-wide">Inteligência Territorial</h2>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          
          {/* Seção 1: KPIs Globais do Município (Sempre Fixos) */}
          {fixedKpis && (
            <div className="mb-6">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Visão Geral (Beberibe)</h3>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard 
                  icon={Users} iconColor="text-blue-400" label="Habitantes" 
                  value={formatNum(fixedKpis.populacao)}
                  source="IBGE / Censo 2022" layer="extra_ibge_setores_beberibe"
                  desc="Total de residentes permanentes contabilizados pelo IBGE."
                  align="left"
                />
                <KpiCard 
                  icon={Home} iconColor="text-purple-400" label="Domicílios" 
                  value={formatNum(fixedKpis.domicilios)}
                  source="IBGE / Censo 2022" layer="extra_ibge_setores_beberibe"
                  desc="Total de domicílios particulares permanentes."
                  align="right"
                />
                <KpiCard 
                  icon={MapIcon} iconColor="text-emerald-400" label="Área Mapeada" 
                  value={formatNum(fixedKpis.area_km2)} unit="km²"
                  source="IBGE / 2022" layer="beberibe_limite_municipal_2025"
                  desc="Área física do município."
                  align="left"
                />
                <KpiCard 
                  icon={Activity} iconColor="text-orange-400" label="Densidade" 
                  value={formatNum(fixedKpis.densidade)} unit="hab/km²"
                  source="IBGE / Censo 2022" layer="extra_ibge_setores_beberibe"
                  desc="Relação entre habitantes e a área territorial."
                  align="right"
                />
                <KpiCard 
                  icon={Route} iconColor="text-stone-400" label="Malha Viária" 
                  value={formatNum(fixedKpis.rodovias_km)} unit="km"
                  source="OpenStreetMap" layer="osm_roads"
                  desc="Extensão total e qualificação de vias mapeadas no território municipal."
                  align="left"
                  details={fixedKpis.rodovias_detalhes}
                />
                <KpiCard 
                  icon={Users} iconColor="text-amber-600" label="Área Quilombola" 
                  value={formatNum(fixedKpis.quilombos_ha)} unit="ha"
                  source="INCRA / SAB" layer="quilombos_sab_incra"
                  desc="Território total de comunidades tradicionais homologadas em hectares."
                  align="right"
                />
                <KpiCard 
                  icon={Leaf} iconColor="text-lime-400" label="Proteção Ambiental" 
                  value={fixedKpis.unidades_conservacao} unit="UCs"
                  source="ICMBio / SEMA" layer="i3geomap_uc_estadual / federal"
                  desc="Contagem de Unidades de Conservação estaduais e federais incidentes."
                  align="left"
                />
                <KpiCard 
                  icon={Droplets} iconColor="text-cyan-400" label="Ativos Hídricos" 
                  value={fixedKpis.ativos_hidricos} unit="açudes"
                  source="FUNCEME / SRH" layer="i3geomap_acudes_monitorados"
                  desc="Total de corpos d'água e açudes monitorados listados."
                  align="right"
                />
              </div>
            </div>
          )}

          {/* Seção 2: Gráficos Dinâmicos da Camada Ativa */}
          <div className="mb-4">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-t border-slate-700 pt-4">
              Análise da Camada Atual
            </h3>

            {!activeLayers.length ? (
              <div className="text-xs text-slate-500 italic bg-slate-800/30 p-3 rounded-md">
                Nenhuma camada ativa no mapa.
              </div>
            ) : !activeStats ? (
              <div className="text-xs text-slate-500 italic bg-slate-800/30 p-3 rounded-md">
                Classifique a camada por algum atributo no painel lateral para gerar gráficos.
              </div>
            ) : activeStats.type === 'categorical' ? (
              // Gráfico de Barras Categórico
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-slate-400">Classificação por <strong>{activeStats.property}</strong></span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Frequência</span>
                </div>
                
                {activeStats.data.slice(0, 10).map((item, i) => (
                  <div key={i} className="relative pt-1">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-medium text-slate-300 truncate pr-2 max-w-[70%]">{item.label}</span>
                      <span className="text-[10px] font-bold text-slate-400">{item.count} pol</span>
                    </div>
                    <div className="overflow-hidden h-2 text-xs flex rounded bg-slate-800">
                      <div 
                        style={{ width: Math.max(1, (item.count / activeStats.maxCount) * 100) + '%' }} 
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                      ></div>
                    </div>
                  </div>
                ))}
                {activeStats.data.length > 10 && (
                  <div className="text-[10px] text-center text-slate-500 mt-2">
                    + {activeStats.data.length - 10} categorias ocultas
                  </div>
                )}
              </div>
            ) : (
              // Estatísticas Numéricas (Calor/Quantitativo)
              <div className="space-y-3">
                <div className="text-[11px] text-slate-400 mb-2">
                  Análise estatística do campo <strong>{activeStats.property}</strong>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                    <span className="text-xs text-slate-400">Total Somado</span>
                    <span className="text-sm font-bold text-blue-400">{formatNum(activeStats.total)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                    <span className="text-xs text-slate-400">Média Setorial</span>
                    <span className="text-sm font-bold text-purple-400">{formatNum(activeStats.avg)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500">Mínimo</span>
                      <span className="text-xs font-bold text-emerald-400">{formatNum(activeStats.min)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-slate-500">Máximo</span>
                      <span className="text-xs font-bold text-red-400">{formatNum(activeStats.max)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Rampa visual */}
                <div className="mt-4 pt-2">
                  <span className="text-[10px] text-slate-500 block mb-1">Distribuição (Mín → Máx)</span>
                  <div className="h-2 w-full rounded bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500 opacity-80"></div>
                </div>
              </div>
            )}
          </div>
          
        </div>
      </div>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      
      <SavedMapsDrawer 
        isOpen={isWorkspaceOpen} 
        onClose={() => setIsWorkspaceOpen(false)}
        getWorkspaceConfig={getWorkspaceConfig}
        loadWorkspace={loadWorkspace}
        showToast={showToast}
        activeMapId={activeMapId}
      />

      <AdminUsersModal 
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
      />
    </>
  );
}
