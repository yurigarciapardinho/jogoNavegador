import React, { useEffect, useState } from 'react'
import { api } from '../../api'
import { usarEstadoJogo } from '../../store/estadoJogo'
import { Trash2, Edit3, ShieldAlert, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

const MesaDeGuerra: React.FC = () => {
    const { token, adicionarNotificacao } = usarEstadoJogo()
    const [aldeias, definirAldeias] = useState<any[]>([])
    const [meta, definirMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 10 })
    const [carregando, definirCarregando] = useState(true)
    
    // Controles de Busca e Filtro
    const [busca, definirBusca] = useState('')
    const [filtro, definirFiltro] = useState('all') // 'all', 'players', 'barbarians'

    // Modais
    const [modalEdicao, definirModalEdicao] = useState<any>(null)
    const [modalConfirmacao, definirModalConfirmacao] = useState<{ id: string, name: string } | null>(null)
    const [modalSpawn, definirModalSpawn] = useState(false)
    const [quantidadeSpawn, definirQuantidadeSpawn] = useState<number>(5)

    const carregar = async (paginaAtual = meta.page, termoBusca = busca, tipoFiltro = filtro) => {
        definirCarregando(true)
        try {
            const queryParams = new URLSearchParams({
                page: paginaAtual.toString(),
                limit: '10',
                search: termoBusca,
                filter: tipoFiltro
            }).toString()

            const resposta = await api.get(`/admin/villages?${queryParams}`, token || '')
            // O backend agora retorna { data: [...], meta: {...} }
            if (resposta.data && resposta.meta) {
                definirAldeias(resposta.data)
                definirMeta(resposta.meta)
            } else {
                // Caso o backend antigo responda temporariamente
                definirAldeias(resposta)
            }
        } catch (erro: any) {
            adicionarNotificacao('Erro: ' + erro.message, 'erro')
        } finally {
            definirCarregando(false)
        }
    }

    // Recarregar quando página, busca ou filtro mudarem
    useEffect(() => {
        // Debounce simples para a busca não martelar o servidor a cada tecla
        const timer = setTimeout(() => {
            carregar(meta.page, busca, filtro)
        }, 300)
        return () => clearTimeout(timer)
    }, [meta.page, busca, filtro, token])

    const abrirModalDeletar = (id: string, name: string) => {
        definirModalConfirmacao({ id, name })
    }

    const confirmarDeletar = async () => {
        if (!modalConfirmacao) return
        try {
            await api.del(`/admin/village/${modalConfirmacao.id}`, token)
            adicionarNotificacao('Aldeia obliterada com sucesso.', 'sucesso')
            carregar()
        } catch (e: any) {
            adicionarNotificacao('Erro: ' + e.message, 'erro')
        } finally {
            definirModalConfirmacao(null)
        }
    }

    const salvarEdicao = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await api.put(`/admin/village/${modalEdicao.id}/resources`, {
                wood: modalEdicao.wood,
                clay: modalEdicao.clay,
                iron: modalEdicao.iron
            }, token)
            
            await api.put(`/admin/village/${modalEdicao.id}/troops`, {
                spear: modalEdicao.spear,
                sword: modalEdicao.sword,
                axe: modalEdicao.axe
            }, token)

            adicionarNotificacao('Aldeia modificada com sucesso.', 'sucesso')
            definirModalEdicao(null)
            carregar()
        } catch (e: any) {
            adicionarNotificacao('Falha ao modificar.', 'erro')
        }
    }

    const confirmarSpawn = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!quantidadeSpawn || isNaN(quantidadeSpawn) || quantidadeSpawn <= 0) return

        try {
            await api.post('/admin/barbarians/spawn', { amount: quantidadeSpawn }, token)
            adicionarNotificacao(`${quantidadeSpawn} Bárbaras criadas com sucesso.`, 'sucesso')
            carregar()
        } catch (e: any) {
            adicionarNotificacao('Erro: ' + e.message, 'erro')
        } finally {
            definirModalSpawn(false)
        }
    }

    const mudarPagina = (novaPagina: number) => {
        if (novaPagina < 1 || novaPagina > meta.totalPages) return
        definirMeta(prev => ({ ...prev, page: novaPagina }))
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header da Mesa */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ color: 'white', margin: 0, fontWeight: 500 }}>Gestão do Mapa</h2>
                    <p style={{ color: '#888', margin: '5px 0 0 0', fontSize: '14px' }}>Modifique aldeias, aplique filtros ou apague permanentemente.</p>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Barra de Pesquisa */}
                    <div style={{ position: 'relative' }}>
                        <Search size={16} color="#888" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                        <input 
                            type="text" 
                            placeholder="Buscar aldeia ou jogador..." 
                            value={busca}
                            onChange={e => { definirBusca(e.target.value); definirMeta(m => ({...m, page: 1})) }}
                            style={{ 
                                padding: '10px 10px 10px 35px', 
                                borderRadius: '8px', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                backgroundColor: 'rgba(0,0,0,0.3)', 
                                color: 'white',
                                width: '220px'
                            }} 
                        />
                    </div>

                    {/* Filtro Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <Filter size={16} color="#888" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                        <select 
                            value={filtro}
                            onChange={e => { definirFiltro(e.target.value); definirMeta(m => ({...m, page: 1})) }}
                            style={{ 
                                padding: '10px 10px 10px 35px', 
                                borderRadius: '8px', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                backgroundColor: 'rgba(20,20,20,0.8)', 
                                color: 'white',
                                appearance: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="all">Todas as Aldeias</option>
                            <option value="players">Apenas Jogadores</option>
                            <option value="barbarians">Apenas Bárbaras</option>
                        </select>
                    </div>

                    <button 
                        onClick={() => definirModalSpawn(true)} 
                        className="botaoGeral botaoGeral--primario"
                        style={{ display: 'flex', gap: '8px', alignItems: 'center', boxShadow: '0 4px 15px rgba(76, 175, 80, 0.3)' }}
                    >
                        <ShieldAlert size={18} /> Spawnar Bárbaras
                    </button>
                </div>
            </div>

            {/* Container da Tabela com Correção de Scroll Horizontal */}
            <div style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                overflowX: 'auto', // Correção do Scroll
                flex: 1, // Permite que cresça ocupando espaço
                position: 'relative'
            }}>
                {carregando && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, color: 'var(--corPrimaria)' }}>
                        Atualizando mesa...
                    </div>
                )}
                
                <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', color: '#ccc', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                            <th style={{ padding: '15px 20px', fontWeight: 600, color: '#eee' }}>Aldeia</th>
                            <th style={{ padding: '15px', fontWeight: 600, color: '#eee' }}>Dono</th>
                            <th style={{ padding: '15px', fontWeight: 600, color: '#eee' }}>Coords</th>
                            <th style={{ padding: '15px', fontWeight: 600, color: '#eee' }}>Recursos (M/A/F)</th>
                            <th style={{ padding: '15px', fontWeight: 600, color: '#eee' }}>Tropas (L/E/M)</th>
                            <th style={{ padding: '15px', fontWeight: 600, color: '#eee', textAlign: 'right' }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {aldeias.length === 0 && !carregando ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Nenhuma aldeia encontrada com estes filtros.</td></tr>
                        ) : aldeias.map((ald, idx) => (
                            <tr key={ald.id} style={{ 
                                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                            >
                                <td style={{ padding: '12px 20px' }}>
                                    <strong style={{ color: 'white' }}>{ald.name}</strong> <br/>
                                    <small style={{ color: '#666', fontFamily: 'monospace' }}>{ald.id.slice(0,8)}</small>
                                </td>
                                <td style={{ padding: '12px' }}>
                                    {ald.user?.username ? (
                                        <span style={{ color: '#4CAF50' }}>{ald.user.username}</span>
                                    ) : (
                                        <span style={{ color: '#9E9E9E' }}>Bárbara</span>
                                    )}
                                </td>
                                <td style={{ padding: '12px', fontFamily: 'monospace' }}>({ald.x}|{ald.y})</td>
                                <td style={{ padding: '12px', color: '#aaa' }}>
                                    {ald.resources?.wood || 0} / {ald.resources?.clay || 0} / {ald.resources?.iron || 0}
                                </td>
                                <td style={{ padding: '12px', color: '#aaa' }}>
                                    {ald.units?.spear || 0} / {ald.units?.sword || 0} / {ald.units?.axe || 0}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <button 
                                        onClick={() => definirModalEdicao({
                                            id: ald.id, name: ald.name,
                                            wood: ald.resources?.wood || 0, clay: ald.resources?.clay || 0, iron: ald.resources?.iron || 0,
                                            spear: ald.units?.spear || 0, sword: ald.units?.sword || 0, axe: ald.units?.axe || 0
                                        })}
                                        style={{ 
                                            background: 'rgba(33, 150, 243, 0.1)', border: '1px solid rgba(33, 150, 243, 0.3)', 
                                            color: '#64B5F6', cursor: 'pointer', marginRight: '8px',
                                            padding: '6px', borderRadius: '6px', transition: 'all 0.2s'
                                        }}
                                        title="Editar Recursos e Tropas"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => abrirModalDeletar(ald.id, ald.name)} 
                                        style={{ 
                                            background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)', 
                                            color: '#E57373', cursor: 'pointer',
                                            padding: '6px', borderRadius: '6px', transition: 'all 0.2s'
                                        }}
                                        title="Obliterar Aldeia"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Paginação */}
            {meta.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
                    <button 
                        onClick={() => mudarPagina(meta.page - 1)}
                        disabled={meta.page === 1}
                        style={{ 
                            display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', 
                            border: '1px solid rgba(255,255,255,0.1)', backgroundColor: meta.page === 1 ? 'transparent' : 'rgba(255,255,255,0.05)',
                            color: meta.page === 1 ? '#555' : 'white', cursor: meta.page === 1 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <ChevronLeft size={18} /> Anterior
                    </button>
                    
                    <span style={{ color: '#aaa', fontSize: '14px' }}>
                        Página <strong style={{ color: 'white' }}>{meta.page}</strong> de <strong style={{ color: 'white' }}>{meta.totalPages}</strong>
                        <span style={{ marginLeft: '10px', fontSize: '12px' }}>({meta.total} registros totaal)</span>
                    </span>

                    <button 
                        onClick={() => mudarPagina(meta.page + 1)}
                        disabled={meta.page === meta.totalPages}
                        style={{ 
                            display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', 
                            border: '1px solid rgba(255,255,255,0.1)', backgroundColor: meta.page === meta.totalPages ? 'transparent' : 'rgba(255,255,255,0.05)',
                            color: meta.page === meta.totalPages ? '#555' : 'white', cursor: meta.page === meta.totalPages ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Próxima <ChevronRight size={18} />
                    </button>
                </div>
            )}

            {/* Modais omitidos para manter clareza (Eles funcionam de forma idêntica ao código anterior, com Glassmorphism) */}
            {/* Modal de Edição */}
            {modalEdicao && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <form onSubmit={salvarEdicao} style={{ backgroundColor: 'var(--corFundoSecundaria)', border: '1px solid rgba(255,255,255,0.1)', padding: '25px', borderRadius: '16px', width: '450px', boxShadow: '0 15px 35px rgba(0,0,0,0.5)' }}>
                        <h3 style={{ color: 'white', marginTop: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px' }}><Edit3 size={20} color="var(--corPrimaria)" /> Editar {modalEdicao.name}</h3>
                        
                        <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Recursos Mágicos</div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <label style={{ color: '#ccc', flex: 1, fontSize: '14px' }}>Madeira <input type="number" value={modalEdicao.wood} onChange={e => definirModalEdicao({...modalEdicao, wood: Number(e.target.value)})} style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '6px', border: '1px solid #444', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white' }} /></label>
                            <label style={{ color: '#ccc', flex: 1, fontSize: '14px' }}>Argila <input type="number" value={modalEdicao.clay} onChange={e => definirModalEdicao({...modalEdicao, clay: Number(e.target.value)})} style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '6px', border: '1px solid #444', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white' }} /></label>
                            <label style={{ color: '#ccc', flex: 1, fontSize: '14px' }}>Ferro <input type="number" value={modalEdicao.iron} onChange={e => definirModalEdicao({...modalEdicao, iron: Number(e.target.value)})} style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '6px', border: '1px solid #444', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white' }} /></label>
                        </div>

                        <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Exército Fantasma</div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
                            <label style={{ color: '#ccc', flex: 1, fontSize: '14px' }}>Lanceiros <input type="number" value={modalEdicao.spear} onChange={e => definirModalEdicao({...modalEdicao, spear: Number(e.target.value)})} style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '6px', border: '1px solid #444', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white' }} /></label>
                            <label style={{ color: '#ccc', flex: 1, fontSize: '14px' }}>Espadachins <input type="number" value={modalEdicao.sword} onChange={e => definirModalEdicao({...modalEdicao, sword: Number(e.target.value)})} style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '6px', border: '1px solid #444', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white' }} /></label>
                            <label style={{ color: '#ccc', flex: 1, fontSize: '14px' }}>Machados <input type="number" value={modalEdicao.axe} onChange={e => definirModalEdicao({...modalEdicao, axe: Number(e.target.value)})} style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '6px', border: '1px solid #444', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white' }} /></label>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => definirModalEdicao(null)} className="botaoGeral" style={{ background: 'transparent', border: '1px solid #555', color: '#ccc' }}>Cancelar</button>
                            <button type="submit" className="botaoGeral" style={{ background: 'linear-gradient(to right, #4CAF50, #45a049)', border: 'none', color: 'white' }}>Injetar Forçadamente</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal de Confirmação */}
            {modalConfirmacao && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ backgroundColor: 'var(--corFundoSecundaria)', border: '1px solid rgba(255,255,255,0.1)', padding: '25px', borderRadius: '16px', width: '400px', textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.5)' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'rgba(244, 67, 54, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                            <Trash2 size={24} color="#f44336" />
                        </div>
                        <h3 style={{ color: 'white', marginTop: 0, fontWeight: 500 }}>Atenção - GOD MODE</h3>
                        <p style={{ color: '#aaa', marginBottom: '25px', lineHeight: '1.5' }}>Tem certeza que deseja apagar a aldeia <strong style={{color:'white'}}>{modalConfirmacao.name}</strong> do mapa permanentemente? Esta ação não pode ser desfeita.</p>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button onClick={() => definirModalConfirmacao(null)} className="botaoGeral" style={{ background: 'transparent', border: '1px solid #555', color: '#ccc' }}>Cancelar</button>
                            <button onClick={confirmarDeletar} className="botaoGeral" style={{ background: '#f44336', border: 'none', color: 'white' }}>Sim, Obliterar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Spawn */}
            {modalSpawn && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <form onSubmit={confirmarSpawn} style={{ backgroundColor: 'var(--corFundoSecundaria)', border: '1px solid rgba(255,255,255,0.1)', padding: '25px', borderRadius: '16px', width: '350px', boxShadow: '0 15px 35px rgba(0,0,0,0.5)' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'rgba(33, 150, 243, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px' }}>
                            <ShieldAlert size={24} color="#2196F3" />
                        </div>
                        <h3 style={{ color: 'white', marginTop: 0, fontWeight: 500 }}>Spawnar Bárbaras</h3>
                        <p style={{ color: '#aaa', marginBottom: '20px', fontSize: '14px', lineHeight: '1.5' }}>Quantas aldeias selvagens deseja espalhar aleatoriamente pelo mundo?</p>
                        <input 
                            type="number" 
                            value={quantidadeSpawn} 
                            onChange={(e) => definirQuantidadeSpawn(Number(e.target.value))} 
                            style={{ width: '100%', padding: '12px', marginBottom: '25px', borderRadius: '8px', border: '1px solid #444', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '16px', textAlign: 'center' }}
                            min="1"
                            max="500"
                        />
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button type="button" onClick={() => definirModalSpawn(false)} className="botaoGeral" style={{ background: 'transparent', border: '1px solid #555', color: '#ccc' }}>Cancelar</button>
                            <button type="submit" className="botaoGeral" style={{ background: '#2196F3', border: 'none', color: 'white' }}>Confirmar</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}

export default MesaDeGuerra
