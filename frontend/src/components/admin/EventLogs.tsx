import React, { useEffect, useState } from 'react'
import { api } from '../../api'
import { usarEstadoJogo } from '../../store/estadoJogo'
import { FileText, Shield, User, Clock } from 'lucide-react'

const EventLogs: React.FC = () => {
    const { token, adicionarNotificacao } = usarEstadoJogo()
    const [logs, definirLogs] = useState<any[]>([])
    const [carregando, definirCarregando] = useState(true)
    const [modalLimpar, definirModalLimpar] = useState(false)

    const carregar = async () => {
        try {
            const dados = await api.get('/admin/logs', token || '')
            definirLogs(dados)
        } catch (erro: any) {
            adicionarNotificacao('Erro ao carregar auditoria: ' + erro.message, 'erro')
        } finally {
            definirCarregando(false)
        }
    }

    useEffect(() => {
        carregar()
    }, [token])

    const confirmarLimpeza = async () => {
        try {
            await api.del('/admin/logs/clear', token)
            adicionarNotificacao('Trilha de auditoria obliterada.', 'sucesso')
            carregar()
        } catch (e: any) {
            adicionarNotificacao('Erro ao limpar logs: ' + e.message, 'erro')
        } finally {
            definirModalLimpar(false)
        }
    }

    if (carregando) return <div style={{ color: '#aaa', textAlign: 'center', padding: '50px' }}>Carregando trilha de auditoria...</div>

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ color: 'white', margin: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={24} color="var(--corPrimaria)" /> Auditoria do Sistema
                    </h2>
                    <p style={{ color: '#aaa', fontSize: '14px', marginTop: '5px' }}>Trilha imutável de todas as ações de nível "God Mode" executadas por administradores.</p>
                </div>
                <button 
                    onClick={() => definirModalLimpar(true)} 
                    className="botaoGeral"
                    style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)', color: '#E57373', transition: 'all 0.2s', padding: '10px 15px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(244, 67, 54, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(244, 67, 54, 0.1)'}
                >
                    <Shield size={18} /> Limpar Trilha
                </button>
            </div>

            <div style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                padding: '30px',
                position: 'relative'
            }}>
                {logs.length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '30px' }}>Nenhuma ação administrativa registrada no log.</div>
                ) : (
                    <div style={{ position: 'relative' }}>
                        {/* Linha vertical central da timeline */}
                        <div style={{ 
                            position: 'absolute', 
                            top: 0, bottom: 0, left: '20px', 
                            width: '2px', 
                            backgroundColor: 'rgba(255, 255, 255, 0.1)' 
                        }}></div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                            {logs.map((log, index) => {
                                const actionColors: Record<string, string> = {
                                    'SPAWN_BARBARIANS': '#2196F3',
                                    'DELETE_VILLAGE': '#F44336',
                                    'SET_RESOURCES': '#4CAF50',
                                    'SET_TROOPS': '#FF9800'
                                }
                                const actionColor = actionColors[log.action] || 'var(--corPrimaria)'

                                return (
                                    <div key={log.id} style={{ 
                                        position: 'relative', 
                                        paddingLeft: '60px',
                                        animation: `fadeIn 0.3s ease-out ${index * 0.05}s both`
                                    }}>
                                        {/* Círculo do marcador */}
                                        <div style={{
                                            position: 'absolute',
                                            left: '11px',
                                            top: '0px',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: 'rgba(20, 20, 20, 1)',
                                            border: `3px solid ${actionColor}`,
                                            boxShadow: `0 0 10px ${actionColor}80`,
                                            zIndex: 2
                                        }}></div>

                                        <div style={{ 
                                            backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                            borderRadius: '12px',
                                            padding: '20px',
                                            transition: 'transform 0.2s',
                                            cursor: 'default',
                                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateX(5px)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                                <div>
                                                    <span style={{ 
                                                        color: actionColor, 
                                                        fontWeight: 'bold', 
                                                        fontSize: '14px',
                                                        letterSpacing: '1px',
                                                        backgroundColor: `${actionColor}15`,
                                                        padding: '4px 10px',
                                                        borderRadius: '20px',
                                                        display: 'inline-block',
                                                        marginBottom: '8px'
                                                    }}>
                                                        {log.action}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '15px', color: '#888', fontSize: '12px' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {new Date(log.createdAt).toLocaleString()}</span>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={12} /> ID: {log.id.slice(0,8)}</span>
                                                    </div>
                                                </div>
                                                
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '6px', color: '#aaa', fontSize: '12px' }}>
                                                    <User size={14} /> Admin: {log.adminId.slice(0,8)}
                                                </div>
                                            </div>

                                            <div style={{ 
                                                backgroundColor: 'rgba(0,0,0,0.4)', 
                                                padding: '15px', 
                                                borderRadius: '8px', 
                                                borderLeft: `2px solid ${actionColor}50`,
                                                fontFamily: 'monospace',
                                                color: '#ddd',
                                                fontSize: '13px',
                                                overflowX: 'auto'
                                            }}>
                                                {log.details}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Limpeza de Logs */}
            {modalLimpar && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ backgroundColor: 'var(--corFundoEscuro)', border: '1px solid rgba(255,255,255,0.1)', padding: '25px', borderRadius: '16px', width: '400px', textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.5)' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'rgba(244, 67, 54, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                            <Shield size={24} color="#f44336" />
                        </div>
                        <h3 style={{ color: 'white', marginTop: 0, fontWeight: 500 }}>Atenção - Ocultação de Pistas</h3>
                        <p style={{ color: '#aaa', marginBottom: '25px', lineHeight: '1.5' }}>Tem certeza que deseja limpar todo o histórico de atividades administrativas? <strong>Esta ação irá registrar um log contra você mesmo informando a limpeza.</strong></p>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button onClick={() => definirModalLimpar(false)} className="botaoGeral" style={{ background: 'transparent', border: '1px solid #555', color: '#ccc' }}>Cancelar</button>
                            <button onClick={confirmarLimpeza} className="botaoGeral" style={{ background: '#f44336', border: 'none', color: 'white' }}>Destruir Histórico</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(-10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    )
}

export default EventLogs
