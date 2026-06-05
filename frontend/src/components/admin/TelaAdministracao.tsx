import React, { useState } from 'react'
import GraficosKPI from './GraficosKPI'
import MesaDeGuerra from './MesaDeGuerra'
import EventLogs from './EventLogs'
import GestaoUsuarios from './GestaoUsuarios'
import ControleServidor from './ControleServidor'
import { LayoutDashboard, Map, List, Crown, Users, Database } from 'lucide-react'

const TelaAdministracao: React.FC = () => {
    const [abaAtual, definirAbaAtual] = useState<'kpi' | 'mesa' | 'logs' | 'usuarios' | 'server'>('kpi')

    return (
        <section style={{
            display: 'flex',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: 'rgba(10, 10, 10, 0.85)',
            backdropFilter: 'blur(10px)',
            borderRadius: 'var(--raio-lg)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        }}>
            {/* Sidebar */}
            <aside style={{
                width: '260px',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--espacamentoGrande)',
                backgroundColor: 'rgba(20, 20, 20, 0.6)'
            }}>
                <h1 style={{ 
                    color: 'var(--corPrimaria)', 
                    margin: '0 0 30px 0', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    fontSize: '18px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    textShadow: '0 0 10px var(--corPrimaria)'
                }}>
                    <Crown size={24} />
                    God Mode
                </h1>
                
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    <button 
                        onClick={() => definirAbaAtual('kpi')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                            border: 'none', transition: 'all 0.2s',
                            backgroundColor: abaAtual === 'kpi' ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
                            color: abaAtual === 'kpi' ? 'var(--corPrimaria)' : '#aaa',
                            fontWeight: abaAtual === 'kpi' ? 'bold' : 'normal',
                            boxShadow: abaAtual === 'kpi' ? 'inset 4px 0 0 var(--corPrimaria)' : 'none'
                        }}
                    >
                        <LayoutDashboard size={20} />
                        Visão Geral
                    </button>
                    
                    <button 
                        onClick={() => definirAbaAtual('mesa')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                            border: 'none', transition: 'all 0.2s',
                            backgroundColor: abaAtual === 'mesa' ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
                            color: abaAtual === 'mesa' ? 'var(--corPrimaria)' : '#aaa',
                            fontWeight: abaAtual === 'mesa' ? 'bold' : 'normal',
                            boxShadow: abaAtual === 'mesa' ? 'inset 4px 0 0 var(--corPrimaria)' : 'none'
                        }}
                    >
                        <Map size={20} />
                        Mesa de Guerra
                    </button>
                    
                    <button 
                        onClick={() => definirAbaAtual('usuarios')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                            border: 'none', transition: 'all 0.2s',
                            backgroundColor: abaAtual === 'usuarios' ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
                            color: abaAtual === 'usuarios' ? 'var(--corPrimaria)' : '#aaa',
                            fontWeight: abaAtual === 'usuarios' ? 'bold' : 'normal',
                            boxShadow: abaAtual === 'usuarios' ? 'inset 4px 0 0 var(--corPrimaria)' : 'none'
                        }}
                    >
                        <Users size={20} />
                        Gestão de Contas
                    </button>

                    <button 
                        onClick={() => definirAbaAtual('logs')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                            border: 'none', transition: 'all 0.2s',
                            backgroundColor: abaAtual === 'logs' ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
                            color: abaAtual === 'logs' ? 'var(--corPrimaria)' : '#aaa',
                            fontWeight: abaAtual === 'logs' ? 'bold' : 'normal',
                            boxShadow: abaAtual === 'logs' ? 'inset 4px 0 0 var(--corPrimaria)' : 'none'
                        }}
                    >
                        <List size={20} />
                        Auditoria
                    </button>
                    
                    <div style={{ marginTop: 'auto' }}>
                        <button 
                            onClick={() => definirAbaAtual('server')}
                            style={{
                                width: '100%',
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                                border: '1px solid rgba(244, 67, 54, 0.2)', transition: 'all 0.2s',
                                backgroundColor: abaAtual === 'server' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.05)',
                                color: abaAtual === 'server' ? '#f44336' : '#E57373',
                                fontWeight: abaAtual === 'server' ? 'bold' : 'normal',
                                boxShadow: abaAtual === 'server' ? 'inset 4px 0 0 #f44336' : 'none'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.2)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = abaAtual === 'server' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.05)'}
                        >
                            <Database size={20} />
                            Servidor (Nuke)
                        </button>
                    </div>
                </nav>
            </aside>

            {/* Conteúdo Principal */}
            <main style={{ 
                flex: 1, 
                padding: 'var(--espacamentoGrande)', 
                overflowY: 'auto',
                position: 'relative'
            }}>
                <div style={{
                    animation: 'fadeIn 0.3s ease-in-out'
                }}>
                    {abaAtual === 'kpi' && <GraficosKPI />}
                    {abaAtual === 'mesa' && <MesaDeGuerra />}
                    {abaAtual === 'usuarios' && <GestaoUsuarios />}
                    {abaAtual === 'logs' && <EventLogs />}
                    {abaAtual === 'server' && <ControleServidor />}
                </div>
            </main>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </section>
    )
}

export default TelaAdministracao
