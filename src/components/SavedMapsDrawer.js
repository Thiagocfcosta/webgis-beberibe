'use client';

import { useState, useEffect } from 'react';
import { Save, FolderOpen, Loader2, X, Plus, Trash2, Users, Globe, Pencil, History, Star } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function SavedMapsDrawer({ 
  isOpen, 
  onClose, 
  getWorkspaceConfig, 
  loadWorkspace,
  showToast
}) {
  const { data: session } = useSession();
  const [maps, setMaps] = useState([]);
  const [sharedMaps, setSharedMaps] = useState([]);
  const [exportLogs, setExportLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('projects'); // 'projects', 'history' ou 'shared'

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [folderName, setFolderName] = useState('');
  
  const [folders, setFolders] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  
  const [teamFilterEmail, setTeamFilterEmail] = useState('Todos');
  
  // UI States
  const [expandedFolders, setExpandedFolders] = useState({});
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterRole, setAuditFilterRole] = useState('Todos');

  const [editingMapId, setEditingMapId] = useState(null);
  const [expandedHistoryMapId, setExpandedHistoryMapId] = useState(null);
  const [mapVersions, setMapVersions] = useState([]);

  // Busca dados
  useEffect(() => {
    if (isOpen && session) {
      if (activeTab === 'projects') {
        fetchMaps();
        fetchFolders();
      }
      if (activeTab === 'history') fetchExportLogs();
      if (activeTab === 'shared') fetchSharedMaps();
    }
  }, [isOpen, session, activeTab]);

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      if (Array.isArray(data)) setFolders(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchExportLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/export-logs');
      const data = await res.json();
      if (Array.isArray(data)) setExportLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaps = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/maps');
      const data = await res.json();
      if (Array.isArray(data)) setMaps(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedMaps = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/maps/shared');
      const data = await res.json();
      if (Array.isArray(data)) setSharedMaps(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleShare = async (id, currentStatus, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/workspaces/${id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_shared: !currentStatus })
      });
      if (res.ok) {
        setMaps(prev => prev.map(m => m.id === id ? { ...m, is_shared: !currentStatus } : m));
        if (showToast) showToast(!currentStatus ? 'Projeto compartilhado com a equipe.' : 'Projeto tornado privado.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFavorite = async (id, currentStatus, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/workspaces/${id}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: !currentStatus })
      });
      if (res.ok) {
        const updateMap = m => {
          if (m.id !== id) return m;
          return {
            ...m,
            is_favorite: !currentStatus,
            favorites_count: !currentStatus ? (Number(m.favorites_count) || 0) + 1 : Math.max(0, (Number(m.favorites_count) || 0) - 1)
          };
        };
        setMaps(prev => prev.map(updateMap));
        setSharedMaps(prev => prev.map(updateMap));
        if (showToast) showToast(!currentStatus ? 'Projeto adicionado aos favoritos.' : 'Projeto removido dos favoritos.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const config = getWorkspaceConfig();
    
    try {
      let finalFolderName = folderName;
      if (folderName === '__NEW__') {
        if (!newFolderName.trim()) {
          alert('Digite o nome da nova pasta');
          setSaving(false);
          return;
        }
        finalFolderName = newFolderName.trim();
        // Cria a pasta primeiro
        await fetch('/api/folders', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ name: finalFolderName }) 
        });
      }

      const url = editingMapId ? `/api/workspaces/${editingMapId}` : '/api/maps';
      const method = editingMapId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: desc, config_json: config, folder_name: finalFolderName })
      });
      if (res.ok) {
        setIsCreating(false);
        setEditingMapId(null);
        setTitle('');
        setDesc('');
        setFolderName('');
        setNewFolderName('');
        fetchMaps(); // Recarrega a lista
        fetchFolders(); // Atualiza pastas
        if (showToast) showToast(editingMapId ? 'Projeto atualizado com sucesso!' : 'Projeto salvo com sucesso!');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMap = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Deseja excluir permanentemente este projeto salvo?')) return;
    try {
      const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMaps(prev => prev.filter(m => m.id !== id));
        if (showToast) showToast('Projeto excluído com sucesso.');
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir projeto.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoad = (configJson) => {
    loadWorkspace(configJson);
    onClose();
  };

  const handleEditClick = (map, e) => {
    e.stopPropagation();
    setIsCreating(true);
    setEditingMapId(map.id);
    setTitle(map.title);
    setDesc(map.description || '');
    setFolderName(map.folder_name || '');
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingMapId(null);
    const config = getWorkspaceConfig ? getWorkspaceConfig() : {};
    setTitle(config.mapTitle || '');
    setDesc(config.mapDesc || '');
    setFolderName('');
  };

  const handleToggleHistory = async (mapId, e) => {
    e.stopPropagation();
    if (expandedHistoryMapId === mapId) {
      setExpandedHistoryMapId(null);
      setMapVersions([]);
      return;
    }
    
    setExpandedHistoryMapId(mapId);
    setMapVersions([]);
    try {
      const res = await fetch(`/api/workspaces/${mapId}/versions`);
      const data = await res.json();
      if (Array.isArray(data)) setMapVersions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFolderDirect = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName })
      });
      if (res.ok) {
        setNewFolderName('');
        setIsCreatingFolder(false);
        fetchFolders();
        if (showToast) showToast('Pasta criada com sucesso!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: prev[folder] === false ? true : false })); // Default is true usually, but we check truthiness
  };

  // Agrupar mapas por pasta garantindo que todas as pastas independentes apareçam
  const groupedMaps = folders.reduce((acc, f) => {
    acc[f.name] = [];
    return acc;
  }, {});

  maps.forEach(map => {
    const f = map.folder_name || 'Raiz';
    if (!groupedMaps[f]) groupedMaps[f] = [];
    groupedMaps[f].push(map);
  });

  // Excluir projetos do próprio usuário dos mapas compartilhados
  const teamSharedMaps = sharedMaps.filter(map => !maps.some(myMap => myMap.id === map.id));

  const filteredSharedMaps = teamSharedMaps.filter(map => teamFilterEmail === 'Todos' || map.owner_name === teamFilterEmail);

  const groupedSharedMaps = filteredSharedMaps.reduce((acc, map) => {
    const f = map.folder_name || 'Raiz';
    if (!acc[f]) acc[f] = [];
    acc[f].push(map);
    return acc;
  }, {});

  // Extrair usuários únicos da equipe para o filtro
  const teamUsers = [...new Set(teamSharedMaps.map(m => m.owner_name || m.owner_email))].filter(Boolean).sort();

  // Filtrar logs
  const filteredLogs = exportLogs.filter(log => {
    const matchesSearch = !auditSearch || (
      (log.map_title && log.map_title.toLowerCase().includes(auditSearch.toLowerCase())) || 
      (log.user_email && log.user_email.toLowerCase().includes(auditSearch.toLowerCase()))
    );
    const matchesRole = auditFilterRole === 'Todos' || (log.user_role === auditFilterRole);
    return matchesSearch && matchesRole;
  });

  const favoriteMaps = maps.filter(m => m.is_favorite);
  const teamFavoriteMaps = teamSharedMaps.filter(m => m.is_favorite);

  const renderMapCard = (map) => (
    <div key={map.id} className="relative bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-lg transition-colors cursor-pointer group" onClick={() => handleLoad(map.config_json)}>
      <div className="flex justify-between items-start">
        <h4 className="text-sm font-bold text-blue-400 group-hover:text-blue-300 mb-1 pr-24 flex items-center gap-2">
          {map.title}
          {map.is_shared && <Globe size={12} className="text-blue-500" title="Compartilhado com a equipe" />}
          {map.favorites_count > 0 && (
            <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded ml-1">
              <Star size={10} className="fill-current" /> {map.favorites_count}
            </span>
          )}
        </h4>
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => handleToggleFavorite(map.id, map.is_favorite, e)}
            className={`p-1 rounded transition-colors ${map.is_favorite ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            title={map.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Star size={14} className={map.is_favorite ? "fill-current" : ""} />
          </button>
          <button 
            onClick={(e) => handleToggleShare(map.id, map.is_shared, e)}
            className={`p-1 rounded transition-colors ${map.is_shared ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            title={map.is_shared ? "Remover do compartilhamento" : "Compartilhar com a equipe"}
          >
            <Globe size={14} />
          </button>
          <button 
            onClick={(e) => handleToggleHistory(map.id, e)}
            className={`p-1 rounded transition-colors ${expandedHistoryMapId === map.id ? 'bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-600/40' : 'bg-slate-800 text-slate-500 hover:text-indigo-400'}`}
            title="Histórico de Versões"
          >
            <History size={14} />
          </button>
          <button 
            onClick={(e) => handleEditClick(map, e)}
            className="p-1 text-slate-500 hover:text-blue-400 bg-slate-800 rounded transition-colors"
            title="Editar projeto"
          >
            <Pencil size={14} />
          </button>
          <button 
            onClick={(e) => handleDeleteMap(map.id, e)}
            className="p-1 text-slate-500 hover:text-red-400 bg-slate-800 rounded transition-colors"
            title="Excluir projeto"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {map.description && <p className="text-xs text-slate-400 mb-2 line-clamp-2">{map.description}</p>}
      
      {/* Versões expandidas */}
      {expandedHistoryMapId === map.id && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Histórico de Versões</h5>
          <div className="space-y-1.5">
            {mapVersions.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-2"><Loader2 size={12} className="animate-spin inline mr-1"/> Carregando...</div>
            ) : (
              mapVersions.map((version, index) => (
                <div 
                  key={version.id} 
                  className="flex justify-between items-center bg-slate-900/50 hover:bg-slate-900 p-2 rounded cursor-pointer border border-transparent hover:border-slate-700 transition-colors"
                  onClick={(e) => { e.stopPropagation(); handleLoad(version.config_json); }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-indigo-400">v{mapVersions.length - index}</span>
                    <span className="text-[10px] text-slate-300">{new Date(version.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <span className="text-[9px] bg-indigo-600/20 text-indigo-400 px-1.5 py-0.5 rounded">Carregar</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium mt-2">
        <span>{new Date(map.created_at).toLocaleDateString('pt-BR')}</span>
        <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-400">Clique para carregar</span>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-10 duration-300">
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <FolderOpen className="text-blue-400" size={20} />
          <h2 className="font-bold text-white tracking-wide">Workspace</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-md transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Abas */}
      <div className="flex border-b border-slate-700 bg-slate-800/50">
        <button 
          onClick={() => setActiveTab('projects')}
          className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'projects' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Meus Projetos
        </button>
        <button 
          onClick={() => setActiveTab('shared')}
          className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'shared' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Equipe
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'history' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Auditoria
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900/50">
        
        {/* ABA: PROJETOS SALVOS */}
        {activeTab === 'projects' && (
          <>
            {!isCreating ? (
              <button 
                onClick={handleCreateNew}
            className="w-full flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-400 font-medium py-3 rounded-lg transition-colors mb-6"
          >
            <Plus size={18} />
            Salvar Projeto Atual
          </button>
        ) : (
          <form onSubmit={handleSave} className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-medium text-white mb-3">
              {editingMapId ? 'Editando Projeto e Versão' : 'Novo Projeto Salvo'}
            </h3>
            <input 
              required value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Análise Densidade Centro"
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-2 mb-3 outline-none focus:border-blue-500"
            />
            <select 
              value={folderName} onChange={e => setFolderName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-2 mb-3 outline-none focus:border-blue-500"
            >
              <option value="" disabled>Selecione uma pasta...</option>
              {folders.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
              <option value="__NEW__">➕ Criar nova pasta...</option>
            </select>
            
            {folderName === '__NEW__' && (
              <input 
                value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                placeholder="Nome da nova pasta"
                className="w-full bg-slate-900 border border-blue-500/50 text-white text-sm rounded px-3 py-2 mb-3 outline-none focus:border-blue-500 animate-in fade-in"
              />
            )}
            <textarea 
              value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Nota técnica (Opcional)" rows={2}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-2 mb-3 outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex gap-2">
              <button 
                type="button" onClick={() => { setIsCreating(false); setEditingMapId(null); }}
                className="flex-1 text-slate-300 bg-slate-700 hover:bg-slate-600 text-sm py-2 rounded font-medium transition-colors"
              >Cancelar</button>
              <button 
                type="submit" disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm py-2 rounded font-medium transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar
              </button>
            </div>
          </form>
        )}

            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pastas e Projetos</h3>
                <button 
                  onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium bg-blue-900/20 px-2 py-1 rounded"
                >
                  <Plus size={12} />
                  Nova Pasta
                </button>
              </div>

              {isCreatingFolder && (
                <form onSubmit={handleCreateFolderDirect} className="flex gap-2 mb-3 animate-in slide-in-from-top-2">
                  <input 
                    required value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Nome da pasta"
                    className="flex-1 bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-blue-500"
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-medium">Criar</button>
                </form>
              )}

              {loading ? (
                <div className="flex justify-center p-6"><Loader2 className="animate-spin text-slate-500" /></div>
              ) : maps.length === 0 ? (
                <div className="text-xs text-slate-500 italic bg-slate-800/30 p-4 rounded-lg text-center">
                  Nenhum projeto salvo encontrado.
                </div>
              ) : (
                <>
                  {/* Seção de Favoritos (Meus Projetos) */}
                  {favoriteMaps.length > 0 && (
                    <div className="bg-slate-800/60 rounded-lg border border-amber-500/30 overflow-hidden mb-4 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                      <div className="bg-gradient-to-r from-amber-500/20 to-slate-800 px-3 py-2 flex items-center gap-2 border-b border-amber-500/20">
                        <Star size={14} className="text-amber-400 fill-current" />
                        <span className="text-xs font-bold text-amber-400 tracking-wider">FAVORITOS</span>
                      </div>
                      <div className="p-2 space-y-2 bg-slate-900/30">
                        {favoriteMaps.map(map => renderMapCard(map))}
                      </div>
                    </div>
                  )}

                  {/* Seção de Favoritos da Equipe (Curtidos por mim) */}
                  {teamFavoriteMaps.length > 0 && (
                    <div className="bg-slate-800/60 rounded-lg border border-indigo-500/30 overflow-hidden mb-4 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
                      <div className="bg-gradient-to-r from-indigo-500/20 to-slate-800 px-3 py-2 flex items-center gap-2 border-b border-indigo-500/20">
                        <Users size={14} className="text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-400 tracking-wider">FAVORITOS DA EQUIPE</span>
                      </div>
                      <div className="p-2 space-y-2 bg-slate-900/30">
                        {teamFavoriteMaps.map(map => renderMapCard(map))}
                      </div>
                    </div>
                  )}

                  {/* Pastas Normais */}
                  {Object.keys(groupedMaps).sort().map(folder => {
                    const isExpanded = expandedFolders[folder] !== false; // Padrão aberto
                    return (
                      <div key={folder} className="bg-slate-800/40 rounded-lg border border-slate-700 overflow-hidden mb-2">
                        <div 
                          className="bg-slate-800 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors"
                          onClick={() => toggleFolder(folder)}
                        >
                          <div className="flex items-center gap-2">
                            <FolderOpen size={14} className="text-blue-400" />
                            <span className="text-xs font-bold text-slate-300">{folder}</span>
                          </div>
                          <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded">{groupedMaps[folder].length}</span>
                        </div>
                        
                        {isExpanded && (
                          <div className="p-2 space-y-2 bg-slate-900/30">
                            {groupedMaps[folder].map(map => renderMapCard(map))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}

        {/* ABA: COMPARTILHADOS COM A EQUIPE */}
        {activeTab === 'shared' && (
          <div className="space-y-4">
            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg flex items-center gap-3">
              <Users size={24} className="text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-200 leading-relaxed">
                Estes projetos foram compartilhados por outros analistas da equipe. Clique para carregar o mapa no seu workspace atual.
              </p>
            </div>

            {teamUsers.length > 0 && (
              <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Filtrar por Analista</label>
                <select 
                  value={teamFilterEmail} onChange={e => setTeamFilterEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 outline-none focus:border-blue-500"
                >
                  <option value="Todos">Todos os analistas</option>
                  {teamUsers.map(email => (
                    <option key={email} value={email}>{email}</option>
                  ))}
                </select>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center p-6"><Loader2 className="animate-spin text-slate-500" /></div>
            ) : filteredSharedMaps.length === 0 ? (
              <div className="text-xs text-slate-500 italic bg-slate-800/30 p-4 rounded-lg text-center">
                {teamFilterEmail === 'Todos' ? 'Nenhum projeto foi compartilhado pela equipe ainda.' : `Nenhum projeto encontrado para ${teamFilterEmail}.`}
              </div>
            ) : (
              <>
                {/* Seção de Favoritos na Equipe */}
                {filteredSharedMaps.filter(m => m.is_favorite).length > 0 && (
                  <div className="bg-slate-800/60 rounded-lg border border-amber-500/30 overflow-hidden mb-4 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                    <div className="bg-gradient-to-r from-amber-500/20 to-slate-800 px-3 py-2 flex items-center gap-2 border-b border-amber-500/20">
                      <Star size={14} className="text-amber-400 fill-current" />
                      <span className="text-xs font-bold text-amber-400 tracking-wider">FAVORITOS DA EQUIPE</span>
                    </div>
                    <div className="p-2 space-y-2 bg-slate-900/30">
                      {filteredSharedMaps.filter(m => m.is_favorite).map(map => (
                        <div key={map.id} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-lg transition-colors cursor-pointer group" onClick={() => handleLoad(map.config_json)}>
                          <div className="flex justify-between items-start">
                            <h4 className="text-sm font-bold text-blue-400 group-hover:text-blue-300 mb-1 flex items-center gap-2">
                              {map.title}
                              {map.favorites_count > 0 && (
                                <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">
                                  <Star size={10} className="fill-current" /> {map.favorites_count}
                                </span>
                              )}
                            </h4>
                            <button 
                              onClick={(e) => handleToggleFavorite(map.id, map.is_favorite, e)}
                              className={`p-1 rounded transition-colors ${map.is_favorite ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white' : 'bg-slate-700 text-slate-400 hover:text-white'} opacity-0 group-hover:opacity-100`}
                              title={map.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                            >
                              <Star size={14} className={map.is_favorite ? "fill-current" : ""} />
                            </button>
                          </div>
                          {map.description && <p className="text-xs text-slate-400 mb-2 line-clamp-2">{map.description}</p>}
                          
                          <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between items-center text-[10px] text-slate-500 font-medium">
                            <span className="truncate max-w-[150px]" title={map.owner_email}>Por: {map.owner_name || map.owner_email}</span>
                            <span>{new Date(map.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(groupedSharedMaps).sort().map(folder => {
                  const isExpanded = expandedFolders[`shared_${folder}`] !== false; // Padrão aberto
                  return (
                    <div key={`shared_${folder}`} className="bg-slate-800/40 rounded-lg border border-slate-700 overflow-hidden">
                      <div 
                        className="bg-slate-800 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors"
                        onClick={() => toggleFolder(`shared_${folder}`)}
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen size={14} className="text-blue-400" />
                          <span className="text-xs font-bold text-slate-300">{folder}</span>
                        </div>
                        <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded">{groupedSharedMaps[folder].length}</span>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-2 space-y-2 bg-slate-900/30">
                          {groupedSharedMaps[folder].map(map => (
                            <div key={map.id} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-lg transition-colors cursor-pointer group" onClick={() => handleLoad(map.config_json)}>
                              <div className="flex justify-between items-start">
                                <h4 className="text-sm font-bold text-blue-400 group-hover:text-blue-300 mb-1 flex items-center gap-2">
                                  {map.title}
                                  {map.favorites_count > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">
                                      <Star size={10} className="fill-current" /> {map.favorites_count}
                                    </span>
                                  )}
                                </h4>
                                <button 
                                  onClick={(e) => handleToggleFavorite(map.id, map.is_favorite, e)}
                                  className={`p-1 rounded transition-colors ${map.is_favorite ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white' : 'bg-slate-700 text-slate-400 hover:text-white'} opacity-0 group-hover:opacity-100`}
                                  title={map.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                                >
                                  <Star size={14} className={map.is_favorite ? "fill-current" : ""} />
                                </button>
                              </div>
                              {map.description && <p className="text-xs text-slate-400 mb-2 line-clamp-2">{map.description}</p>}
                              
                              <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between items-center text-[10px] text-slate-500 font-medium">
                                <span className="truncate max-w-[150px]" title={map.owner_email}>Por: {map.owner_name || map.owner_email}</span>
                                <span>{new Date(map.created_at).toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* ABA: HISTÓRICO DE EXPORTAÇÕES */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg mb-4">
              <p className="text-xs text-blue-200">
                Cada vez que um PDF é gerado, o estado do mapa é salvo aqui silenciosamente. 
                Clique em qualquer registro para reproduzir o mapa exportado com precisão.
              </p>
            </div>

            {/* Filtros da Auditoria */}
            <div className="flex flex-col gap-2 mb-4 bg-slate-800 p-3 rounded-xl border border-slate-700">
              <input 
                type="text" 
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Buscar projeto ou usuário..."
                className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded px-3 py-2 outline-none focus:border-blue-500"
              />
              {(session?.user?.role === 'admin' || session?.user?.role === 'Administrador') && (
                <select 
                  value={auditFilterRole}
                  onChange={e => setAuditFilterRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded px-2 py-2 outline-none focus:border-blue-500"
                >
                  <option value="Todos">Todos os Cargos</option>
                  <option value="Administrador">Administradores</option>
                  <option value="Analista">Analistas</option>
                  <option value="Visualizador">Visualizadores</option>
                </select>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center p-6"><Loader2 className="animate-spin text-slate-500" /></div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-xs text-slate-500 italic bg-slate-800/30 p-4 rounded-lg text-center">
                Nenhum log encontrado para estes filtros.
              </div>
            ) : (
              filteredLogs.map(log => (
                <div key={log.id} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-lg transition-colors cursor-pointer group flex flex-col gap-1" onClick={() => handleLoad(log.config_json)}>
                  <h4 className="text-xs font-bold text-slate-300 group-hover:text-white line-clamp-1">
                    {log.map_title} 
                    {log.user_email && <span className="text-[9px] font-normal text-slate-500 ml-2 bg-slate-900 px-1 py-0.5 rounded">by: {log.user_email}</span>}
                  </h4>
                  {log.user_role && <span className="text-[9px] text-slate-500">Cargo: {log.user_role}</span>}
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium mt-1">
                    <span>{new Date(log.exported_at).toLocaleString('pt-BR')}</span>
                    <span className="bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      Reproduzir
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
