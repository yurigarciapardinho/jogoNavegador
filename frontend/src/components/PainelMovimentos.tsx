import { useState, useEffect } from 'react'
import ContadorTempo from './ContadorTempo'
import { api } from '../api'
import { usarEstadoJogo } from '../store/estadoJogo'

export default function PainelMovimentos({ dadosAldeia, aoAtualizar }: { dadosAldeia: any, aoAtualizar: () => void }) {
    const { token, adicionarNotificacao } = usarEstadoJogo()
    const [carregando, setCarregando] = useState(false)

    const retornosChegando = (dadosAldeia?.movementsTarget || []).filter((m: any) => m.type === 'RETURN')
    const mad = retornosChegando.reduce((acc: number, m: any) => acc + (m.wood || 0), 0)
    const arg = retornosChegando.reduce((acc: number, m: any) => acc + (m.clay || 0), 0)
    const fer = retornosChegando.reduce((acc: number, m: any) => acc + (m.iron || 0), 0)

    const ataquesSaindo = (dadosAldeia?.movementsOrigin || []).filter((m: any) => m.type === 'ATTACK')
    const apoiosSaindo = (dadosAldeia?.movementsOrigin || []).filter((m: any) => m.type === 'SUPPORT')
    const mercadoresSaindo = (dadosAldeia?.movementsOrigin || []).filter((m: any) => m.type === 'TRANSPORT')
    const transferenciasSaindo = (dadosAldeia?.movementsOrigin || []).filter((m: any) => m.type === 'TRANSFER')

    const ataquesChegando = (dadosAldeia?.movementsTarget || []).filter((m: any) => m.type === 'ATTACK')
    const apoiosChegandoMov = (dadosAldeia?.movementsTarget || []).filter((m: any) => m.type === 'SUPPORT')
    const mercadoresChegando = (dadosAldeia?.movementsTarget || []).filter((m: any) => m.type === 'TRANSPORT')
    const mercadoresRetornando = (dadosAldeia?.movementsTarget || []).filter((m: any) => m.type === 'TRANSPORT_RETURN')
    const transferenciasChegando = (dadosAldeia?.movementsTarget || []).filter((m: any) => m.type === 'TRANSFER')

    const tropasApoioFora = dadosAldeia?.supportingSent || []
    const tropasApoioDentro = dadosAldeia?.supportingReceived || []

    const totalMovimentos = ataquesSaindo.length + apoiosSaindo.length + mercadoresSaindo.length + transferenciasSaindo.length + ataquesChegando.length + apoiosChegandoMov.length + mercadoresChegando.length + mercadoresRetornando.length + transferenciasChegando.length + tropasApoioFora.length + tropasApoioDentro.length
    
    const [isExpanded, setIsExpanded] = useState(totalMovimentos > 0)

    useEffect(() => {
        if (ataquesChegando.length > 0) {
            setIsExpanded(true)
        }
    }, [ataquesChegando.length])

    if (!dadosAldeia) return null

    const chamarDeVolta = async (supportId: string) => {
        setCarregando(true)
        try {
            await api.post('/village/support/recall', { supportId }, token || undefined)
            adicionarNotificacao('Tropas chamadas de volta!', 'sucesso')
            aoAtualizar()
        } catch (erro: any) {
            adicionarNotificacao(erro.message, 'erro')
        } finally {
            setCarregando(false)
        }
    }

    const devolverApoio = async (supportId: string) => {
        setCarregando(true)
        try {
            await api.post('/village/support/send-back', { supportId }, token || undefined)
            adicionarNotificacao('Tropas devolvidas!', 'sucesso')
            aoAtualizar()
        } catch (erro: any) {
            adicionarNotificacao(erro.message, 'erro')
        } finally {
            setCarregando(false)
        }
    }

    return (
        <section className="painelSecao" style={{ gridColumn: '1 / -1' }}>
            <div 
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => setIsExpanded(!isExpanded)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded(!isExpanded); } }}
                className="painelMovimentos_header"
                style={{ 
                    paddingBottom: isExpanded ? '10px' : '0px',
                    borderBottom: isExpanded ? '1px solid #334155' : 'none',
                    marginBottom: isExpanded ? '10px' : '0px'
                }}
            >
                <h2 className="telaGeral_titulo" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
                    Praça de Reuniões
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {!isExpanded && ataquesChegando.length > 0 && (
                        <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', animation: 'pulse 2s infinite' }}>
                            <span aria-hidden="true">🚨</span> {ataquesChegando.length} Ataque{ataquesChegando.length > 1 ? 's' : ''}
                        </span>
                    )}
                    {!isExpanded && totalMovimentos > 0 && ataquesChegando.length === 0 && (
                        <span style={{ background: '#475569', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                            <span aria-hidden="true">📦</span> {totalMovimentos} Ativo{totalMovimentos > 1 ? 's' : ''}
                        </span>
                    )}
                    
                    <span style={{ 
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.3s ease',
                        fontSize: '1.2rem',
                        color: '#94a3b8'
                    }}>
                        ▼
                    </span>
                </div>
            </div>

            <div style={{ 
                display: 'grid', 
                gridTemplateRows: isExpanded ? '1fr' : '0fr',
                transition: 'grid-template-rows 0.3s ease-in-out'
            }}>
                <div style={{ overflow: 'hidden' }}>
                    <div style={{ paddingTop: '5px' }}>
                        {(mad > 0 || arg > 0 || fer > 0) && (
                            <div style={{ padding: '10px', backgroundColor: '#334155', borderRadius: '5px', marginBottom: '15px' }}>
                                <strong>Recursos a caminho (Retorno):</strong> {mad} <span style={{ color: '#d97706' }}>Mad</span> | {arg} <span style={{ color: '#ea580c' }}>Arg</span> | {fer} <span style={{ color: '#94a3b8' }}>Fer</span>
                            </div>
                        )}

            <div className="gradePaineis">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {/* COMANDOS RECEBIDOS */}
                    {(ataquesChegando.length > 0 || apoiosChegandoMov.length > 0 || retornosChegando.length > 0 || mercadoresChegando.length > 0 || mercadoresRetornando.length > 0 || transferenciasChegando.length > 0) && (
                        <div>
                            <h3 style={{ color: '#f87171', borderBottom: '1px solid #475569', paddingBottom: '5px' }}>Comandos Recebidos</h3>
                            
                            {ataquesChegando.map((m: any) => (
                                <div key={m.id} style={{ backgroundColor: 'rgba(220, 38, 38, 0.2)', border: '1px solid #dc2626', padding: '10px', borderRadius: '5px', marginBottom: '8px' }}>
                                    <div style={{ color: '#fca5a5', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">⚔️</span> Ataque INIMIGO de {m.origin?.user?.username || 'Bárbaros'}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                                        Vindo de {m.origin?.name} ({m.origin?.x}|{m.origin?.y})
                                    </div>
                                    <div style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                        <ContadorTempo endTime={m.arrivalTime} />
                                    </div>
                                </div>
                            ))}

                            {apoiosChegandoMov.map((m: any) => (
                                <div key={m.id} style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', padding: '10px', borderRadius: '5px', marginBottom: '8px' }}>
                                    <div style={{ color: '#93c5fd', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">🛡️</span> Apoio ALIADO de {m.origin?.user?.username || 'Desconhecido'}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                                        Vindo de {m.origin?.name} ({m.origin?.x}|{m.origin?.y})
                                    </div>
                                    <div style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                        <ContadorTempo endTime={m.arrivalTime} />
                                    </div>
                                </div>
                            ))}

                            {transferenciasChegando.map((m: any) => (
                                <div key={m.id} style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid #a855f7', padding: '10px', borderRadius: '5px', marginBottom: '8px' }}>
                                    <div style={{ color: '#d8b4fe', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">🚚</span> Transferência ALIADA de {m.origin?.user?.username || 'Desconhecido'}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                                        Vindo de {m.origin?.name} ({m.origin?.x}|{m.origin?.y})
                                    </div>
                                    <div style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                        <ContadorTempo endTime={m.arrivalTime} />
                                    </div>
                                </div>
                            ))}

                            {retornosChegando.map((m: any) => (
                                <div key={m.id} style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', padding: '10px', borderRadius: '5px', marginBottom: '8px' }}>
                                    <div style={{ color: '#fde047', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">📦</span> Retorno de Tropas
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '5px' }}>
                                        Voltando de {m.origin?.name} ({m.origin?.x}|{m.origin?.y})
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {m.spear > 0 && <span>Lança: {m.spear}</span>}
                                        {m.sword > 0 && <span>Espada: {m.sword}</span>}
                                        {m.axe > 0 && <span>Bárbaro: {m.axe}</span>}
                                        {(m.wood > 0 || m.clay > 0 || m.iron > 0) && (
                                            <span style={{ color: '#fbbf24', marginLeft: 'auto' }}>
                                                Saque: {m.wood} Mad | {m.clay} Arg | {m.iron} Fer
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                        <ContadorTempo endTime={m.arrivalTime} />
                                    </div>
                                </div>
                            ))}

                            {mercadoresChegando.map((m: any) => (
                                <div key={m.id} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '10px', borderRadius: '5px', marginBottom: '8px' }}>
                                    <div style={{ color: '#34d399', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">🛒</span> Recebendo Recursos
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                                        Vindo de {m.origin?.name} ({m.origin?.x}|{m.origin?.y})
                                    </div>
                                    <div style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                        <ContadorTempo endTime={m.arrivalTime} />
                                    </div>
                                </div>
                            ))}

                            {mercadoresRetornando.map((m: any) => (
                                <div key={m.id} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '10px', borderRadius: '5px', marginBottom: '8px' }}>
                                    <div style={{ color: '#34d399', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">🛒</span> Mercadores Retornando
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                                        Voltando de {m.origin?.name} ({m.origin?.x}|{m.origin?.y})
                                    </div>
                                    <div style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                        <ContadorTempo endTime={m.arrivalTime} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* COMANDOS ENVIADOS */}
                    {(ataquesSaindo.length > 0 || apoiosSaindo.length > 0 || mercadoresSaindo.length > 0 || transferenciasSaindo.length > 0) && (
                        <div>
                            <h3 style={{ color: '#94a3b8', borderBottom: '1px solid #475569', paddingBottom: '5px' }}>Comandos Enviados</h3>
                            
                            {ataquesSaindo.map((m: any) => (
                                <div key={m.id} style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', border: '1px solid #f97316', padding: '10px', borderRadius: '5px', marginBottom: '8px' }}>
                                    <div style={{ color: '#fdba74', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">⚔️</span> Atacando {m.target?.user?.username || 'Bárbaros'}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '5px' }}>
                                        Alvo: {m.target?.name} ({m.target?.x}|{m.target?.y})
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {m.spear > 0 && <span>Lança: {m.spear}</span>}
                                        {m.sword > 0 && <span>Espada: {m.sword}</span>}
                                        {m.axe > 0 && <span>Bárbaro: {m.axe}</span>}
                                    </div>
                                    <div style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                        <ContadorTempo endTime={m.arrivalTime} />
                                    </div>
                                </div>
                            ))}

                            {apoiosSaindo.map((m: any) => (
                                <div key={m.id} style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', border: '1px solid #0ea5e9', padding: '10px', borderRadius: '5px', marginBottom: '8px' }}>
                                    <div style={{ color: '#7dd3fc', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">🛡️</span> Apoiando {m.target?.user?.username || 'Desconhecido'}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '5px' }}>
                                        Alvo: {m.target?.name} ({m.target?.x}|{m.target?.y})
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {m.spear > 0 && <span>Lança: {m.spear}</span>}
                                        {m.sword > 0 && <span>Espada: {m.sword}</span>}
                                        {m.axe > 0 && <span>Bárbaro: {m.axe}</span>}
                                    </div>
                                    <div style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                        <ContadorTempo endTime={m.arrivalTime} />
                                    </div>
                                </div>
                            ))}

                            {transferenciasSaindo.map((m: any) => (
                                <div key={m.id} style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid #a855f7', padding: '10px', borderRadius: '5px', marginBottom: '8px' }}>
                                    <div style={{ color: '#d8b4fe', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">🚚</span> Transferindo para {m.target?.user?.username || 'Desconhecido'}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '5px' }}>
                                        Alvo: {m.target?.name} ({m.target?.x}|{m.target?.y})
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {m.spear > 0 && <span>Lança: {m.spear}</span>}
                                        {m.sword > 0 && <span>Espada: {m.sword}</span>}
                                        {m.axe > 0 && <span>Bárbaro: {m.axe}</span>}
                                    </div>
                                    <div style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                        <ContadorTempo endTime={m.arrivalTime} />
                                    </div>
                                </div>
                            ))}

                            {mercadoresSaindo.map((m: any) => (
                                <div key={m.id} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '10px', borderRadius: '5px', marginBottom: '8px' }}>
                                    <div style={{ color: '#34d399', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">🛒</span> Enviando Recursos
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                                        Alvo: {m.target?.name} ({m.target?.x}|{m.target?.y})
                                    </div>
                                    <div style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                        <ContadorTempo endTime={m.arrivalTime} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {ataquesSaindo.length === 0 && apoiosSaindo.length === 0 && transferenciasSaindo.length === 0 && mercadoresSaindo.length === 0 && retornosChegando.length === 0 && ataquesChegando.length === 0 && apoiosChegandoMov.length === 0 && transferenciasChegando.length === 0 && mercadoresChegando.length === 0 && mercadoresRetornando.length === 0 && (
                        <div>
                            <h3 style={{ color: '#94a3b8', borderBottom: '1px solid #475569', paddingBottom: '5px' }}>Comandos</h3>
                            <p style={{ color: '#64748b', marginTop: '10px' }}>Nenhum movimento ativo.</p>
                        </div>
                    )}
                </div>

                <div>
                    <h3>Tropas Estacionadas (Apoio)</h3>

                    {tropasApoioFora.length > 0 && (
                        <div style={{ marginBottom: '15px' }}>
                            <strong style={{ color: '#3b82f6' }}>Nossas tropas fora:</strong>
                            {tropasApoioFora.map((sup: any) => (
                                <div key={sup.id} style={{ padding: '8px', background: '#1e293b', marginTop: '5px', borderRadius: '4px' }}>
                                    Em {sup.target?.name} ({sup.target?.x}|{sup.target?.y})
                                    <br/>
                                    <small>{sup.spear} Lanças | {sup.sword} Espadas | {sup.axe} Machados</small>
                                    <br/>
                                    <button 
                                        disabled={carregando} 
                                        onClick={() => chamarDeVolta(sup.id)}
                                        style={{ marginTop: '5px', fontSize: '0.75rem', padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                                    >
                                        Chamar de volta
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {tropasApoioDentro.length > 0 && (
                        <div>
                            <strong style={{ color: '#22c55e' }}>Apoios recebidos:</strong>
                            {tropasApoioDentro.map((sup: any) => (
                                <div key={sup.id} style={{ padding: '8px', background: '#1e293b', marginTop: '5px', borderRadius: '4px' }}>
                                    De {sup.owner?.name} ({sup.owner?.user?.username})
                                    <br/>
                                    <small>{sup.spear} Lanças | {sup.sword} Espadas | {sup.axe} Machados</small>
                                    <br/>
                                    <button 
                                        disabled={carregando} 
                                        onClick={() => devolverApoio(sup.id)}
                                        style={{ marginTop: '5px', fontSize: '0.75rem', padding: '4px 8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                                    >
                                        Devolver tropas
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {tropasApoioFora.length === 0 && tropasApoioDentro.length === 0 && (
                        <p style={{ color: '#94a3b8' }}>Nenhuma tropa estacionada.</p>
                    )}
                </div>
            </div>
            </div>
            </div>
            </div>
        </section>
    )
}
