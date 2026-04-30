'use client';

import { useState, useEffect } from 'react';
import { Shield, X, UserPlus, Trash2, Loader2, Save, KeyRound, Search } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function AdminUsersModal({ isOpen, onClose }) {
  const { data: session } = useSession();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Tab Principal (Usuários vs Projetos)
  const [mainTab, setMainTab] = useState('users');
  
  // States para criação de usuário
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Visualizador');

  // States para edição inline
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editPassword, setEditPassword] = useState('');

  // Filtros
  const [activeTab, setActiveTab] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (mainTab === 'users') fetchUsers();
      else if (mainTab === 'projects') fetchProjects();
    }
  }, [isOpen, mainTab]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users?t=${Date.now()}`);
      if (!res.ok) throw new Error('Não autorizado');
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/maps');
      if (!res.ok) throw new Error('Não autorizado');
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário');
      
      setIsCreating(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('Visualizador');
      fetchUsers();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente este usuário?')) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchUsers();
    } catch (e) {
      alert(e.message);
      setLoading(false);
    }
  };

  const handleUpdateUser = async (id) => {
    setLoading(true);
    try {
      const payload = { role: editRole };
      if (editPassword) payload.password = editPassword;
      
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Erro ao atualizar usuário');
      setEditingId(null);
      setEditPassword('');
      fetchUsers();
    } catch (e) {
      alert(e.message);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = activeTab === 'Todos' || 
                       (activeTab === 'Administrador' && (u.role === 'Administrador' || u.role === 'admin')) ||
                       activeTab === u.role;
                       
    return matchesSearch && matchesTab;
  });

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.owner_name && p.owner_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (p.owner_email && p.owner_email.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const toggleProjectShare = async (id, isShared) => {
    try {
      const res = await fetch(`/api/workspaces/${id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_shared: !isShared })
      });
      if (res.ok) {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, is_shared: !isShared } : p));
      } else {
        alert('Erro ao alterar status de compartilhamento.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de conexão ao alterar status.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-800/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
              <Shield className="text-blue-400" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Controle de Acessos</h2>
              <div className="flex gap-4 mt-2">
                <button 
                  onClick={() => setMainTab('users')}
                  className={`text-xs font-medium pb-1 border-b-2 transition-colors ${mainTab === 'users' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                >
                  USUÁRIOS
                </button>
                <button 
                  onClick={() => setMainTab('projects')}
                  className={`text-xs font-medium pb-1 border-b-2 transition-colors ${mainTab === 'projects' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                >
                  PROJETOS
                </button>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

          {/* Top Actions & Filters */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">
                {mainTab === 'users' ? 'Usuários Cadastrados' : 'Projetos de Usuários'}
              </h3>
              {mainTab === 'users' && !isCreating && (
                <button 
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/50"
                >
                  <UserPlus size={18} />
                  Novo Usuário
                </button>
              )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
              {/* Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                {mainTab === 'users' && ['Todos', 'Administrador', 'Analista', 'Visualizador'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
                  >
                    {tab}
                  </button>
                ))}
                {mainTab === 'projects' && (
                  <div className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-400">
                    Todos os Projetos
                  </div>
                )}
              </div>

              {/* Busca */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={14} className="text-slate-500" />
                </div>
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={mainTab === 'users' ? "Buscar por nome ou email..." : "Buscar projeto ou autor..."}
                  className="w-full md:w-64 bg-slate-900 border border-slate-700 text-white text-xs rounded-lg pl-9 pr-3 py-2 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {mainTab === 'users' && (
            <>

          {/* Formulário de Criação */}
          {isCreating && (
            <form onSubmit={handleCreateUser} className="bg-slate-800 border border-slate-700 p-5 rounded-xl mb-8 animate-in slide-in-from-top-4">
              <h4 className="text-sm font-bold text-white mb-4">Adicionar Novo Membro</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Nome Completo</label>
                  <input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500" placeholder="Ex: João da Silva" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">E-mail Corporativo</label>
                  <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500" placeholder="joao@empresa.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Senha de Acesso Inicial</label>
                  <input required type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500" placeholder="Defina uma senha..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Cargo (Permissões)</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500">
                    <option value="Administrador">Administrador (Acesso Total)</option>
                    <option value="Analista">Analista (Edita Mapas e Exporta)</option>
                    <option value="Visualizador">Visualizador (Apenas Visualização)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Cadastrar Conta
                </button>
              </div>
            </form>
          )}

          {/* Tabela de Usuários */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
            {loading && !isCreating && users.length === 0 ? (
              <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-700 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                    <th className="px-6 py-4">Nome / E-mail</th>
                    <th className="px-6 py-4">Cargo</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-10 text-center text-sm text-slate-500">
                        Nenhum usuário encontrado para a busca "{searchTerm}" na aba "{activeTab}".
                      </td>
                    </tr>
                  ) : filteredUsers.map(user => {
                    const isEditing = editingId === user.id;
                    const isMe = session?.user?.id === user.id.toString();

                    return (
                      <tr key={user.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white text-sm">{user.name} {isMe && <span className="ml-2 text-[10px] bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Você</span>}</div>
                          <div className="text-xs text-slate-400">{user.email}</div>
                        </td>
                        
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500">
                              <option value="Administrador">Administrador</option>
                              <option value="Analista">Analista</option>
                              <option value="Visualizador">Visualizador</option>
                            </select>
                          ) : (
                            <span className={`inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                              user.role === 'Administrador' || user.role === 'admin' 
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                : user.role === 'Analista' 
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}>
                              {user.role}
                            </span>
                          )}
                        </td>
                        
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input 
                              type="text" 
                              placeholder="Nova senha (vazio ignora)"
                              value={editPassword}
                              onChange={e => setEditPassword(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Ativo
                            </div>
                          )}
                        </td>
                        
                        <td className="px-6 py-4 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancelar</button>
                              <button onClick={() => handleUpdateUser(user.id)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded font-medium">Salvar</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-3">
                              <button 
                                onClick={() => {
                                  setEditingId(user.id);
                                  setEditRole(user.role);
                                  setEditPassword('');
                                }}
                                className="text-slate-400 hover:text-blue-400 transition-colors"
                                title="Editar Permissões ou Senha"
                              >
                                <KeyRound size={16} />
                              </button>
                              {!isMe && (
                                <button 
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="text-slate-400 hover:text-red-400 transition-colors"
                                  title="Excluir Usuário"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          </>
          )}

          {mainTab === 'projects' && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
              {loading && projects.length === 0 ? (
                <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-700 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                      <th className="px-6 py-4">Projeto / Criador</th>
                      <th className="px-6 py-4">Pasta</th>
                      <th className="px-6 py-4 text-center">Data</th>
                      <th className="px-6 py-4 text-right">Compartilhado com Equipe?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {filteredProjects.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-10 text-center text-sm text-slate-500">
                          Nenhum projeto encontrado para a busca "{searchTerm}".
                        </td>
                      </tr>
                    ) : filteredProjects.map(project => (
                        <tr key={project.id} className="hover:bg-slate-700/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-blue-400 text-sm mb-1">{project.title}</div>
                            <div className="text-xs text-slate-400">Criado por: {project.owner_name || project.owner_email}</div>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {project.folder_name || 'Raiz'}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400 text-center">
                            {new Date(project.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => toggleProjectShare(project.id, project.is_shared)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${project.is_shared ? 'bg-emerald-500' : 'bg-slate-600'}`}
                            >
                              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${project.is_shared ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                            <span className="text-[10px] uppercase font-bold ml-3 text-slate-400">
                              {project.is_shared ? 'Sim' : 'Não'}
                            </span>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
