import React, { useEffect, useState } from 'react'
import { api } from '../../api'
import { usarEstadoJogo } from '../../store/estadoJogo'
import { Shield, Trash2, Search, ChevronLeft, ChevronRight, UserMinus, UserCheck } from 'lucide-react'

const GestaoUsuarios: React.FC = () => {
    const { token, adicionarNotificacao } = usarEstadoJogo()
    const [usuarios, definirUsuarios] = useState<any[]>([])
    const [meta, definirMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 10 })
    const [carregando, definirCarregando] = useState(true)
    const [busca, definirBusca] = useState('')

    const [modalConfirmacao, definirModalConfirmacao] = useState<{ id: string, username: string } | null>(null)

    const carregar = async (paginaAtual = meta.page, termoBusca = busca) => {
        definirCarregando(true)
        try {
            const queryParams = new URLSearchParams({
                page: paginaAtual.toString(),
                limit: '10',
                search: termoBusca
            }).toString()

            const resposta = await api.get(`/admin/users?${queryParams}`, token || '')
            if (resposta.data && resposta.meta) {
                definirUsuarios(resposta.data)
                definirMeta(resposta.meta)
            }
        } catch (erro: any) {
            adicionarNotificacao('Erro ao carregar usuários: ' + erro.message, 'erro')
        } finally {
            definirCarregando(false)
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            carregar(meta.page, busca)
        }, 300)
        return () => clearTimeout(timer)
    }, [meta.page, busca, token])

    const mudarCargo = async (id: string, novoCargo: string) => {
        try {
            await api.put(`/admin/users/${id}/role`, { role: novoCargo }, token)
            adicionarNotificacao('Privilégios alterados.', 'sucesso')
            carregar()
        } catch (e: any) {
            adicionarNotificacao(e.message || 'Erro ao alterar cargo', 'erro')
        }
    }

    const confirmarExclusao = async () => {
        if (!modalConfirmacao) return
        try {
            await api.del(`/admin/users/${modalConfirmacao.id}`, token)
            adicionarNotificacao('Usuário banido e apagado do sistema.', 'sucesso')
            carregar()
        } catch (e: any) {
            adicionarNotificacao(e.message || 'Erro ao deletar', 'erro')
        } finally {
            definirModalConfirmacao(null)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ color: 'white', margin: 0, fontWeight: 500 }}>Contas e Jogadores</h2>
                    <p style={{ color: '#888', margin: '5px 0 0 0', fontSize: '14px' }}>Gerencie as contas do servidor, promova administradores ou aplique banimentos.</p>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} color="#888" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                        <input 
                            type="text" 
                            placeholder="Buscar por nome ou e-mail..." 
                            value={busca}
                            onChange={e => { definirBusca(e.target.value); definirMeta(m => ({...m, page: 1})) }}
                            style={{ 
                                padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', 
                                backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', width: '250px'
                            }} 
                        />
                    </div>
                </div>
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', overflowX: 'auto', flex: 1, position: 'relative' }}>
                {carregando && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, color: 'var(--corPrimaria)' }}>
                        Carregando banco de dados...
                    </div>
                )}
                
                <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', color: '#ccc', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                            <th style={{ padding: '15px 20px', fontWeight: 600, color: '#eee' }}>Jogador</th>
                            <th style={{ padding: '15px', fontWeight: 600, color: '#eee' }}>E-mail</th>
                            <th style={{ padding: '15px', fontWeight: 600, color: '#eee' }}>Cargo</th>
                            <th style={{ padding: '15px', fontWeight: 600, color: '#eee' }}>Criado em</th>
                            <th style={{ padding: '15px', fontWeight: 600, color: '#eee', textAlign: 'right' }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuarios.length === 0 && !carregando ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Nenhum usuário encontrado.</td></tr>
                        ) : usuarios.map((user, idx) => (
                            <tr key={user.id} style={{ 
                                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                            >
                                <td style={{ padding: '12px 20px' }}>
                                    <strong style={{ color: 'white' }}>{user.username}</strong> <br/>
                                    <small style={{ color: '#666', fontFamily: 'monospace' }}>ID: {user.id.slice(0,8)}</small>
                                </td>
                                <td style={{ padding: '12px' }}>{user.email}</td>
                                <td style={{ padding: '12px' }}>
                                    {user.role === 'ADMIN' ? (
                                        <span style={{ color: '#E91E63', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={14} /> ADMIN</span>
                                    ) : (
                                        <span style={{ color: '#4CAF50' }}>USER</span>
                                    )}
                                </td>
                                <td style={{ padding: '12px', color: '#aaa' }}>{new Date(user.createdAt).toLocaleDateString()}</td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    {user.role === 'USER' ? (
                                        <button 
                                            onClick={() => mudarCargo(user.id, 'ADMIN')}
                                            style={{ background: 'rgba(233, 30, 99, 0.1)', border: '1px solid rgba(233, 30, 99, 0.3)', color: '#F48FB1', cursor: 'pointer', marginRight: '8px', padding: '6px', borderRadius: '6px', transition: 'all 0.2s' }}
                                            title="Promover a Admin"
                                        >
                                            <UserCheck size={16} />
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => mudarCargo(user.id, 'USER')}
                                            style={{ background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)', color: '#81C784', cursor: 'pointer', marginRight: '8px', padding: '6px', borderRadius: '6px', transition: 'all 0.2s' }}
                                            title="Rebaixar a Usuário"
                                        >
                                            <UserMinus size={16} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => definirModalConfirmacao({ id: user.id, username: user.username })} 
                                        style={{ background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)', color: '#E57373', cursor: 'pointer', padding: '6px', borderRadius: '6px', transition: 'all 0.2s' }}
                                        title="Banir e Apagar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {meta.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
                    <button 
                        onClick={() => definirMeta(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={meta.page === 1}
                        style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: meta.page === 1 ? 'transparent' : 'rgba(255,255,255,0.05)', color: meta.page === 1 ? '#555' : 'white', cursor: meta.page === 1 ? 'not-allowed' : 'pointer' }}
                    >
                        <ChevronLeft size={18} /> Anterior
                    </button>
                    <span style={{ color: '#aaa', fontSize: '14px' }}>Página <strong style={{ color: 'white' }}>{meta.page}</strong> de <strong style={{ color: 'white' }}>{meta.totalPages}</strong></span>
                    <button 
                        onClick={() => definirMeta(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={meta.page === meta.totalPages}
                        style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: meta.page === meta.totalPages ? 'transparent' : 'rgba(255,255,255,0.05)', color: meta.page === meta.totalPages ? '#555' : 'white', cursor: meta.page === meta.totalPages ? 'not-allowed' : 'pointer' }}
                    >
                        Próxima <ChevronRight size={18} />
                    </button>
                </div>
            )}

            {modalConfirmacao && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ backgroundColor: 'var(--corFundoSecundaria)', border: '1px solid rgba(255,255,255,0.1)', padding: '25px', borderRadius: '16px', width: '400px', textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.5)' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'rgba(244, 67, 54, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                            <Trash2 size={24} color="#f44336" />
                        </div>
                        <h3 style={{ color: 'white', marginTop: 0, fontWeight: 500 }}>Banimento Permanente</h3>
                        <p style={{ color: '#aaa', marginBottom: '25px', lineHeight: '1.5' }}>Você está prestes a excluir a conta de <strong style={{color:'white'}}>{modalConfirmacao.username}</strong>. Todas as aldeias dele serão convertidas em <strong style={{color:'white'}}>Bárbaras</strong> para outros jogadores.</p>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button onClick={() => definirModalConfirmacao(null)} className="botaoGeral" style={{ background: 'transparent', border: '1px solid #555', color: '#ccc' }}>Cancelar</button>
                            <button onClick={confirmarExclusao} className="botaoGeral" style={{ background: '#f44336', border: 'none', color: 'white' }}>Executar Sentença</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default GestaoUsuarios
